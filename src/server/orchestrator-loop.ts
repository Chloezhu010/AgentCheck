import { getGeminiClient } from "@/server/agents/gemini-client";
import { allFunctionDeclarations, executeTool } from "@/server/tools";
import { getStoredSamples } from "@/server/tools/business";
import { makeMsg, sessions } from "@/server/orchestrator-session";
import {
  applyDemoFallback,
  coerceBidsFromToolResult,
  hashscanTopicMessageUrl,
  parseAuditPayload,
  syncSessionFromAuditEvent,
  tryParseEventLabel,
} from "@/server/orchestrator-state";
import type { FunctionCall } from "@google/genai";
import type { ImageAgentId } from "@/types/agent";
import type { AuditEvent } from "@/types/audit";
import type { SessionEntry } from "@/server/orchestrator-session";

const MAX_AGENT_STEPS = 25;
const AGENT_STEP_TIMEOUT_MS = readTimeoutMs("AGENT_STEP_TIMEOUT_MS", 20_000);
const TOOL_TIMEOUT_MS = readTimeoutMs("AGENT_TOOL_TIMEOUT_MS", 20_000);
const REQUEST_SAMPLES_TIMEOUT_MS = readTimeoutMs("AGENT_REQUEST_SAMPLES_TIMEOUT_MS", 90_000);
const LOOP_TIMEOUT_MS = readTimeoutMs("AGENT_LOOP_TIMEOUT_MS", 90_000);
const ALL_AGENT_IDS: ImageAgentId[] = ["agent-alpha", "agent-beta", "agent-gamma"];
const HEDERA_AUDIT_TOPIC_ID = process.env.HEDERA_AUDIT_TOPIC_ID ?? "";

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

export async function runAgentLoop(sessionId: string): Promise<void> {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  if (entry.loopRunning) return;

  entry.loopRunning = true;
  const startedAt = Date.now();

  try {
    const client = getGeminiClient();

    for (let step = 0; step < MAX_AGENT_STEPS; step++) {
      if (Date.now() - startedAt > LOOP_TIMEOUT_MS) {
        throw new Error(`Agent loop timeout after ${LOOP_TIMEOUT_MS}ms`);
      }

      const response = await withTimeout(
        client.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: entry.agentHistory,
          config: {
            systemInstruction: ORCHESTRATOR_SYSTEM_PROMPT,
            tools: [{ functionDeclarations: allFunctionDeclarations }],
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
        AGENT_STEP_TIMEOUT_MS,
        "Agent reasoning",
      );

      const candidate = response.candidates?.[0];
      if (!candidate?.content) break;

      entry.agentHistory.push(candidate.content);

      const functionCalls = response.functionCalls ?? [];
      if (functionCalls.length > 0) {
        const shouldPause = await processToolCalls(sessionId, entry, functionCalls, startedAt);
        if (shouldPause) break;
        continue;
      }

      const text = response.text ?? "";
      if (text.trim()) {
        entry.session.messages.push(makeMsg(text));
        entry.session.updatedAt = Date.now();
      }

      break;
    }
  } catch (err) {
    applyDemoFallback(entry, err);
  } finally {
    entry.loopRunning = false;
  }
}

export function parseTrialAgentSelection(userMessage: string): ImageAgentId[] | null {
  const text = userMessage.toLowerCase();
  if (!text.trim()) {
    return null;
  }

  if (
    /\ball\s+agents?\b/.test(text) ||
    /\ball\s+three\b/.test(text) ||
    /\beveryone\b/.test(text)
  ) {
    return [...ALL_AGENT_IDS];
  }

  const selected: ImageAgentId[] = [];
  if (/\b(agent[-\s]?)?alpha\b/.test(text)) {
    selected.push("agent-alpha");
  }
  if (/\b(agent[-\s]?)?beta\b/.test(text)) {
    selected.push("agent-beta");
  }
  if (/\b(agent[-\s]?)?gamma\b/.test(text)) {
    selected.push("agent-gamma");
  }

  if (selected.length === 0) {
    return null;
  }

  return selected;
}

async function processToolCalls(
  sessionId: string,
  entry: SessionEntry,
  calls: FunctionCall[],
  startedAt: number,
): Promise<boolean> {
  let shouldPause = false;

  for (const call of calls) {
    if (Date.now() - startedAt > LOOP_TIMEOUT_MS) {
      applyDemoFallback(entry, new Error(`Agent loop timeout after ${LOOP_TIMEOUT_MS}ms`));
      return true;
    }

    const name = call.name ?? "";
    const args = (call.args ?? {}) as Record<string, unknown>;

    entry.session.messages.push(makeMsg(`**${formatToolName(name)}**`, "toolCall"));
    entry.session.updatedAt = Date.now();

    if (name === "ask_user") {
      const question = args.question as string;
      const options = args.options as string[] | undefined;

      entry.session.messages.push(makeMsg(question, "text", { options }));
      entry.session.pendingQuestion = { question, options };
      entry.pendingAskCallId = call.id;
      entry.session.updatedAt = Date.now();

      shouldPause = true;
      break;
    }

    let result: unknown;
    const toolArgs =
      name === "request_samples"
        ? injectTrialAgentSelection(args, entry.trialAgentIds)
        : args;

    try {
      const toolTimeoutMs = getToolTimeoutMs(name);
      result = await withTimeout(
        executeTool(name, toolArgs, sessionId),
        toolTimeoutMs,
        `Tool ${name}`,
      );

      if (name === "request_samples") {
        entry.trialAgentIds = undefined;
      }

      if (name === "broadcast_rfq") {
        entry.currentBids = coerceBidsFromToolResult(result);
        entry.session.state = {
          stage: "bidding",
          visibleBids: entry.currentBids,
          countdownSeconds: 0,
        };
        entry.session.updatedAt = Date.now();
      }

      if (name === "hcs_submit_message" && result && typeof result === "object") {
        const response = result as Record<string, unknown>;
        const auditPayload = parseAuditPayload(args.message as string);
        const event: AuditEvent = {
          id: `audit-${Date.now()}`,
          label: tryParseEventLabel(args.message as string),
          status: response.status === "SUCCESS" ? "logged" : "failed",
          txUrl: hashscanTopicMessageUrl(HEDERA_AUDIT_TOPIC_ID, response.sequenceNumber),
          hcsSequenceNumber: response.sequenceNumber
            ? Number(response.sequenceNumber)
            : undefined,
        };
        entry.session.auditTrail.push(event);

        if (response.status === "SUCCESS") {
          syncSessionFromAuditEvent(entry, sessionId, auditPayload);
        }
      }

      if (name === "score_samples") {
        const samples = getStoredSamples(sessionId);
        if (samples.length > 0) {
          entry.session.messages.push(makeMsg("", "scoreCanvas", { samples }));
          entry.session.state = {
            stage: "evaluating",
            bids: entry.currentBids,
            samples,
          };
          entry.session.updatedAt = Date.now();
        } else {
          applyDemoFallback(entry, new Error("No scored samples available"));
          shouldPause = true;
          break;
        }
      }
    } catch (err) {
      result = { error: err instanceof Error ? err.message : "Tool execution failed" };
      if (shouldFallbackOnToolFailure(name)) {
        applyDemoFallback(entry, err);
        shouldPause = true;
        break;
      }
    }

    entry.agentHistory.push({
      role: "user",
      parts: [
        {
          functionResponse: {
            id: call.id,
            name,
            response: (typeof result === "object" && result !== null ? result : { output: result }) as Record<
              string,
              unknown
            >,
          },
        },
      ],
    });
  }

  return shouldPause;
}

function injectTrialAgentSelection(
  args: Record<string, unknown>,
  trialAgentIds?: ImageAgentId[],
): Record<string, unknown> {
  if (!trialAgentIds || trialAgentIds.length === 0) {
    return args;
  }

  if (Array.isArray(args.agentIds) && args.agentIds.length > 0) {
    return args;
  }

  return { ...args, agentIds: trialAgentIds };
}

function shouldFallbackOnToolFailure(toolName: string): boolean {
  return toolName === "broadcast_rfq" || toolName === "request_samples" || toolName === "score_samples";
}

function getToolTimeoutMs(toolName: string): number {
  if (toolName === "request_samples") {
    return REQUEST_SAMPLES_TIMEOUT_MS;
  }
  return TOOL_TIMEOUT_MS;
}

function formatToolName(name: string): string {
  return name.replace(/_/g, " ").replace(/\bhcs\b/g, "HCS").replace(/\bhbar\b/g, "HBAR");
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => clearTimeout(timeoutId));
  });
}

function readTimeoutMs(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw < 1_000) {
    return fallback;
  }
  return raw;
}
