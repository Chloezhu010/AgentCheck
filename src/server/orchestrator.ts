import { getGeminiClient } from "@/server/agents/gemini-client";
import { allFunctionDeclarations, executeTool } from "@/server/tools";
import { getStoredSamples } from "@/server/tools/business";
import { buildDeliveryReport } from "@/lib/audit-demo-data";
import type { Content, FunctionCall } from "@google/genai";
import type {
  AgentBid,
  AuditSession,
  AuditEvent,
  IntentInput,
  OrchestratorMessage,
} from "@/types/audit";

const MAX_AGENT_STEPS = 25;

const ORCHESTRATOR_SYSTEM_PROMPT = `You are AgentCheck's orchestrator — an autonomous AI procurement agent.
You manage the full lifecycle of hiring an AI agent for a user's task: from broadcasting an RFQ, to evaluating bids, running trials, scoring samples, and handling payment via Hedera.

## Your tools
- broadcast_rfq: Send the task to the agent market and collect bids
- request_samples: Have agents generate trial work products
- score_samples: Run the LLM Judge to evaluate and rank samples
- hcs_submit_message: Log audit events to Hedera Consensus Service (topicId comes from env: use "${process.env.HEDERA_AUDIT_TOPIC_ID ?? ""}")
- hbar_transfer: Transfer HBAR for escrow lock or payment release
- hbar_get_balance: Check an account's HBAR balance
- ask_user: Pause and ask the user a question when you need their input

## Your flow
1. Log the task intent to Hedera via hcs_submit_message.
2. Broadcast RFQ (broadcast_rfq). Analyze the returned bids — compare prices, reputation, style fit.
3. Share your analysis and recommendation with the user. Ask them to confirm which agents should proceed to trial (ask_user).
4. Request trial samples (request_samples), then score them (score_samples).
5. Present the scored results and recommend the best agent with reasoning. Ask user to approve (ask_user).
6. Once approved: lock escrow via hbar_transfer (operator ${process.env.HEDERA_ACCOUNT_ID ?? ""} → escrow ${process.env.HEDERA_ESCROW_ACCOUNT_ID ?? ""}), log it to Hedera.
7. Confirm delivery. Release payment via hbar_transfer (escrow → operator as demo). Log completion to Hedera.

## Rules
- Be concise: 1-3 sentences per message. No fluff.
- Always explain your reasoning briefly before making a recommendation.
- Log every major decision to Hedera (intent, bids received, scoring, selection, payment).
- For hcs_submit_message, format the message as a JSON string: {"t":"EVENT_TYPE","ts":EPOCH_MS,"taskId":"SESSION_ID","d":{...}}
  - "t" is the event type: TASK_INTENT, BID_RECEIVED, SAMPLE_SCORED, AGENT_SELECTED, ESCROW_LOCKED, PAYMENT_RELEASED, TASK_COMPLETED
  - "ts" is Date.now() epoch milliseconds
  - "d" is an object with extra data relevant to the event
- Use ask_user whenever you need the user's decision. Don't assume approval.
- If something fails, explain what happened and suggest next steps.`;

// In-memory session store
type SessionEntry = {
  session: AuditSession;
  agentHistory: Content[];
  loopRunning: boolean;
  currentBids: AgentBid[];
  selectedAgent?: {
    agentId: string;
    agentName: string;
    quoteUsd: number;
  };
  pendingAskCallId?: string;
};
const sessions = new Map<string, SessionEntry>();

function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function msgId(): string {
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function makeMsg(
  text: string,
  kind: OrchestratorMessage["kind"] = "text",
  extras?: Partial<OrchestratorMessage>,
): OrchestratorMessage {
  return { id: msgId(), ts: Date.now(), text, kind, ...extras };
}

// Create a new session and start the agent loop
export function createSession(input: IntentInput): AuditSession {
  const id = generateId();
  const now = Date.now();

  const session: AuditSession = {
    id,
    input,
    state: { stage: "agentic" },
    messages: [
      makeMsg(
        `Task received. Starting autonomous procurement for: "${input.taskDescription}" with budget $${input.budgetUsd.toFixed(2)}.`,
      ),
    ],
    auditTrail: [],
    createdAt: now,
    updatedAt: now,
  };

  const initialContent: Content = {
    role: "user",
    parts: [
      {
        text: `New procurement task:\n- Description: ${input.taskDescription}\n- Budget: $${input.budgetUsd}\n- Weights: quality=${input.weights.quality}, price=${input.weights.price}, speed=${input.weights.speed}\n- Session ID: ${id}\n\nBegin the procurement flow. Start by logging the task intent to Hedera, then broadcast the RFQ.`,
      },
    ],
  };

  const entry: SessionEntry = {
    session,
    agentHistory: [initialContent],
    currentBids: [],
    loopRunning: false,
  };
  sessions.set(id, entry);

  // Fire-and-forget: start the agent loop
  runAgentLoop(id).catch((err) => {
    const e = sessions.get(id);
    if (e) {
      e.session.messages.push(
        makeMsg(`Agent loop error: ${err instanceof Error ? err.message : "unknown"}`),
      );
      e.session.state = {
        stage: "error",
        message: err instanceof Error ? err.message : "Agent loop failed",
      };
      e.session.updatedAt = Date.now();
    }
  });

  return session;
}

// Get current session state (for polling)
export function getSession(sessionId: string): AuditSession | null {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  return entry.session;
}

// User responds to an ask_user question — resume the agent loop
export function respondToAgent(
  sessionId: string,
  userMessage: string,
): AuditSession | { error: string } {
  const entry = sessions.get(sessionId);
  if (!entry) return { error: "Session not found" };

  if (entry.session.state.stage !== "agentic") {
    return { error: `Cannot respond in stage: ${entry.session.state.stage}` };
  }

  // Clear pending question
  entry.session.state = { stage: "agentic" };

  // Respond as a functionResponse for the pending ask_user call so the
  // model sees one clean turn instead of a placeholder + separate user text.
  if (entry.pendingAskCallId) {
    entry.agentHistory.push({
      role: "user",
      parts: [
        {
          functionResponse: {
            id: entry.pendingAskCallId,
            name: "ask_user",
            response: { userResponse: userMessage },
          },
        },
      ],
    });
    entry.pendingAskCallId = undefined;
  } else {
    entry.agentHistory.push({
      role: "user",
      parts: [{ text: userMessage }],
    });
  }

  entry.session.updatedAt = Date.now();

  // Resume the agent loop
  if (!entry.loopRunning) {
    runAgentLoop(sessionId).catch((err) => {
      entry.session.messages.push(
        makeMsg(`Agent loop error: ${err instanceof Error ? err.message : "unknown"}`),
      );
      entry.session.state = {
        stage: "error",
        message: err instanceof Error ? err.message : "Agent loop failed",
      };
      entry.session.updatedAt = Date.now();
    });
  }

  return entry.session;
}

// Core agent loop
async function runAgentLoop(sessionId: string): Promise<void> {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  if (entry.loopRunning) return;

  entry.loopRunning = true;
  const client = getGeminiClient();

  try {
    for (let step = 0; step < MAX_AGENT_STEPS; step++) {
      const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: entry.agentHistory,
        config: {
          systemInstruction: ORCHESTRATOR_SYSTEM_PROMPT,
          tools: [{ functionDeclarations: allFunctionDeclarations }],
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate?.content) break;

      // Add model response to history
      entry.agentHistory.push(candidate.content);

      const functionCalls = response.functionCalls ?? [];

      if (functionCalls.length > 0) {
        // Process each function call
        const shouldPause = await processToolCalls(
          sessionId,
          entry,
          functionCalls,
        );
        if (shouldPause) break;
        // Continue loop — the function results are in history, get next response
        continue;
      }

      // Text response — add as orchestrator message
      const text = response.text ?? "";
      if (text.trim()) {
        entry.session.messages.push(makeMsg(text));
        entry.session.updatedAt = Date.now();
      }

      // If the model returned text without tool calls, the loop pauses
      // (it's either done or waiting for something)
      break;
    }
  } finally {
    entry.loopRunning = false;
  }
}

// Process tool calls. Returns true if the loop should pause (ask_user).
async function processToolCalls(
  sessionId: string,
  entry: SessionEntry,
  calls: FunctionCall[],
): Promise<boolean> {
  let shouldPause = false;

  for (const call of calls) {
    const name = call.name ?? "";
    const args = (call.args ?? {}) as Record<string, unknown>;

    // Log tool call as a message
    entry.session.messages.push(
      makeMsg(`**${formatToolName(name)}**`, "toolCall"),
    );
    entry.session.updatedAt = Date.now();

    if (name === "ask_user") {
      // Pause the loop — store the question for the frontend.
      // Don't add a functionResponse yet; we'll add it with the user's
      // actual answer in respondToAgent() so the model sees a single,
      // coherent turn instead of a placeholder followed by a second user turn.
      const question = args.question as string;
      const options = args.options as string[] | undefined;

      entry.session.messages.push(
        makeMsg(question, "text", { options }),
      );
      entry.session.state = {
        stage: "agentic",
        pendingQuestion: { question, options },
      };
      entry.pendingAskCallId = call.id;
      entry.session.updatedAt = Date.now();

      shouldPause = true;
      break;
    }

    // Execute the tool
    let result: unknown;
    try {
      result = await executeTool(name, args, sessionId);

      if (name === "broadcast_rfq") {
        entry.currentBids = coerceBidsFromToolResult(result);
      }

      // Track audit events from HCS submissions
      if (name === "hcs_submit_message" && result && typeof result === "object") {
        const r = result as Record<string, unknown>;
        const auditPayload = parseAuditPayload(args.message as string);
        const event: AuditEvent = {
          id: `audit-${Date.now()}`,
          label: tryParseEventLabel(args.message as string),
          status: r.status === "SUCCESS" ? "logged" : "failed",
          txUrl: r.sequenceNumber
            ? `https://hashscan.io/testnet/topic/${process.env.HEDERA_AUDIT_TOPIC_ID}/message/${r.sequenceNumber}`
            : "",
          hcsSequenceNumber: r.sequenceNumber
            ? Number(r.sequenceNumber)
            : undefined,
        };
        entry.session.auditTrail.push(event);

        if (r.status === "SUCCESS") {
          syncSessionFromAuditEvent(entry, sessionId, auditPayload);
        }
      }

      // When samples are scored, update session state for the UI
      if (name === "score_samples") {
        const samples = getStoredSamples(sessionId);
        if (samples.length > 0) {
          entry.session.messages.push(
            makeMsg("", "scoreCanvas", { samples }),
          );
        }
      }
    } catch (err) {
      result = { error: err instanceof Error ? err.message : "Tool execution failed" };
    }

    // Add function response to history
    entry.agentHistory.push({
      role: "user",
      parts: [
        {
          functionResponse: {
            id: call.id,
            name,
            response: (typeof result === "object" && result !== null ? result : { output: result }) as Record<string, unknown>,
          },
        },
      ],
    });
  }

  return shouldPause;
}

// Check if the agent has selected and approved a final agent — transition to delivered
export function finalizeDelivery(
  sessionId: string,
  agentId: string,
): AuditSession | { error: string } {
  const entry = sessions.get(sessionId);
  if (!entry) return { error: "Session not found" };

  const samples = getStoredSamples(sessionId);
  const sample = samples.find((s) => s.agentId === agentId);
  if (!sample) return { error: "Agent not found in samples" };

  setDeliveredState(entry, {
    agentId,
    agentName: sample.agentName,
    quoteUsd: entry.currentBids.find((bid) => bid.id === agentId)?.quoteUsd ?? 0,
  });

  return entry.session;
}

function formatToolName(name: string): string {
  return name.replace(/_/g, " ").replace(/\bhcs\b/g, "HCS").replace(/\bhbar\b/g, "HBAR");
}

function tryParseEventLabel(messageStr: string): string {
  const parsed = parseAuditPayload(messageStr);
  if (parsed?.t) {
    return parsed.t;
  }

  return "Audit event";
}

function parseAuditPayload(messageStr: string): { t?: string; agentId?: string; d?: unknown } | null {
  try {
    return JSON.parse(messageStr) as { t?: string; agentId?: string; d?: unknown };
  } catch {
    return null;
  }
}

function syncSessionFromAuditEvent(
  entry: SessionEntry,
  sessionId: string,
  payload: { t?: string; agentId?: string; d?: unknown } | null,
): void {
  if (!payload?.t) return;

  const selection = deriveSelectedAgent(entry, sessionId, payload);

  if (payload.t === "AGENT_SELECTED" && selection) {
    entry.selectedAgent = selection;
    return;
  }

  if (payload.t === "TASK_COMPLETED") {
    setDeliveredState(entry, selection ?? entry.selectedAgent);
  }
}

function deriveSelectedAgent(
  entry: SessionEntry,
  sessionId: string,
  payload: { agentId?: string; d?: unknown },
): { agentId: string; agentName: string; quoteUsd: number } | null {
  const data = isRecord(payload.d) ? payload.d : null;

  const agentId =
    payload.agentId ??
    readString(data, "agentId") ??
    readString(data, "selectedAgentId");

  const sample = agentId
    ? getStoredSamples(sessionId).find((item) => item.agentId === agentId)
    : undefined;
  const bid = agentId
    ? entry.currentBids.find((item) => item.id === agentId)
    : undefined;

  const agentName =
    readString(data, "agentName") ??
    readString(data, "selectedAgentName") ??
    sample?.agentName ??
    bid?.agentName ??
    entry.selectedAgent?.agentName;

  const quoteUsd =
    readNumber(data, "quoteUsd") ??
    readNumber(data, "finalQuoteUsd") ??
    bid?.quoteUsd ??
    entry.selectedAgent?.quoteUsd ??
    0;

  if (!agentId && !agentName) {
    return deriveFallbackSelection(entry, sessionId);
  }

  return {
    agentId: agentId ?? entry.selectedAgent?.agentId ?? "selected-agent",
    agentName: agentName ?? "Selected agent",
    quoteUsd,
  };
}

function deriveFallbackSelection(
  entry: SessionEntry,
  sessionId: string,
): { agentId: string; agentName: string; quoteUsd: number } | null {
  const sample = getStoredSamples(sessionId)[0];
  if (sample) {
    return {
      agentId: sample.agentId,
      agentName: sample.agentName,
      quoteUsd: entry.currentBids.find((bid) => bid.id === sample.agentId)?.quoteUsd ?? 0,
    };
  }

  const bid = entry.currentBids[0];
  if (bid) {
    return {
      agentId: bid.id,
      agentName: bid.agentName,
      quoteUsd: bid.quoteUsd,
    };
  }

  return entry.selectedAgent ?? null;
}

function setDeliveredState(
  entry: SessionEntry,
  selection?: { agentId: string; agentName: string; quoteUsd: number } | null,
): void {
  const resolvedSelection = selection ?? deriveFallbackSelection(entry, entry.session.id);
  const agentId = resolvedSelection?.agentId ?? "selected-agent";
  const agentName = resolvedSelection?.agentName ?? "Selected agent";
  const quoteUsd = resolvedSelection?.quoteUsd ?? 0;

  entry.session.state = {
    stage: "delivered",
    approvedAgentId: agentId,
    approvedAgentName: agentName,
    quoteUsd,
    delivery: buildDeliveryReport(agentName, entry.session.input.taskDescription),
    auditEvents: entry.session.auditTrail,
  };
  entry.session.updatedAt = Date.now();
}

function coerceBidsFromToolResult(result: unknown): AgentBid[] {
  if (!isRecord(result) || !Array.isArray(result.bids)) {
    return [];
  }

  return result.bids.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const id = readString(item, "agentId");
    const agentName = readString(item, "agentName");
    if (!id || !agentName) {
      return [];
    }

    return [
      {
        id,
        agentName,
        model: readString(item, "style") ?? "unknown",
        trialQuoteUsd: readNumber(item, "trialQuoteUsd") ?? 0,
        quoteUsd: readNumber(item, "quoteUsd") ?? 0,
        etaMinutes: readNumber(item, "etaMinutes") ?? 0,
        reputation: readNumber(item, "reputation") ?? 0,
        verified: false,
      },
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown> | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(record: Record<string, unknown> | null, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
