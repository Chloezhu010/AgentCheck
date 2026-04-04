import { getStoredSamples } from "@/server/tools/business";
import { runAgentLoop, parseTrialAgentSelection } from "@/server/orchestrator-loop";
import { makeMsg, generateSessionId, sessions } from "@/server/orchestrator-session";
import { setDeliveredState } from "@/server/orchestrator-state";
import { escrowRelease } from "@/server/hedera/payment";
import type { Content } from "@google/genai";
import type { AuditSession, IntentInput } from "@/types/audit";
import type { SessionEntry } from "@/server/orchestrator-session";

export function createSession(input: IntentInput): AuditSession {
  const id = generateSessionId();
  const now = Date.now();

  const session: AuditSession = {
    id,
    input,
    state: { stage: "agentic" },
    pendingQuestion: undefined,
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

  runAgentLoop(id).catch((err) => {
    const currentEntry = sessions.get(id);
    if (currentEntry) {
      markLoopError(currentEntry, err);
    }
  });

  return session;
}

export function getSession(sessionId: string): AuditSession | null {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  return entry.session;
}

export function respondToAgent(
  sessionId: string,
  userMessage: string,
): AuditSession | { error: string } {
  const entry = sessions.get(sessionId);
  if (!entry) return { error: "Session not found" };

  if (!entry.session.pendingQuestion) {
    return { error: "No pending question to respond to" };
  }

  const selectedTrialAgents = parseTrialAgentSelection(userMessage);
  if (selectedTrialAgents) {
    entry.trialAgentIds = selectedTrialAgents;
  }

  entry.session.pendingQuestion = undefined;

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

  if (!entry.loopRunning) {
    runAgentLoop(sessionId).catch((err) => {
      markLoopError(entry, err);
    });
  }

  return entry.session;
}

export async function finalizeDelivery(
  sessionId: string,
  agentId: string,
): Promise<AuditSession | { error: string }> {
  const entry = sessions.get(sessionId);
  if (!entry) return { error: "Session not found" };

  const samples = getStoredSamples(sessionId);
  const sample = samples.find((s) => s.agentId === agentId);
  if (!sample) return { error: "Agent not found in samples" };

  const quoteUsd = entry.currentBids.find((bid) => bid.id === agentId)?.quoteUsd ?? 0;

  // Release exactly what was locked in escrow (not the full quote)
  const operatorAccountId = process.env.HEDERA_ACCOUNT_ID;
  const lockedHbar = entry.escrowLockedHbar ?? 0;
  if (operatorAccountId && lockedHbar > 0) {
    try {
      await escrowRelease(sessionId, operatorAccountId, lockedHbar);
      entry.escrowLockedHbar = 0;
    } catch (err) {
      console.error("Escrow release failed:", err);
      // Continue with delivery even if release fails — don't block the UI
    }
  }

  setDeliveredState(entry, {
    agentId,
    agentName: sample.agentName,
    quoteUsd,
  });

  return entry.session;
}

function markLoopError(entry: SessionEntry, err: unknown): void {
  entry.session.messages.push(
    makeMsg(`Agent loop error: ${err instanceof Error ? err.message : "unknown"}`),
  );
  entry.session.state = {
    stage: "error",
    message: err instanceof Error ? err.message : "Agent loop failed",
  };
  entry.session.updatedAt = Date.now();
}
