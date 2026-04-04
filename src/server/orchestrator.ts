import { buildDeliveryReport } from "@/lib/audit-demo-data";
import { logAndGetAuditEvents } from "@/server/audit-log";
import { scoreSamples } from "@/server/judge";
import {
  getVisibleBids,
  getCountdownSeconds,
  isBiddingComplete,
} from "@/server/mock-market";
import type { AuditSession, IntentInput } from "@/types/audit";

// In-memory store — sufficient for the demo prototype.
// Note: resets on Next.js dev server hot reload.
const sessions = new Map<string, AuditSession & { startedAt: number }>();

function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Advance the session state based on elapsed time. Called on every read so the
// server owns all stage transitions without requiring background timers.
function advance(session: AuditSession & { startedAt: number }): AuditSession {
  if (session.state.stage !== "bidding") {
    return session;
  }

  if (!isBiddingComplete(session.startedAt)) {
    // Still in bidding window — update visible bids and countdown.
    const updated: AuditSession = {
      ...session,
      state: {
        stage: "bidding",
        visibleBids: getVisibleBids(session.startedAt),
        countdownSeconds: getCountdownSeconds(session.startedAt),
      },
      updatedAt: Date.now(),
    };
    sessions.set(session.id, { ...updated, startedAt: session.startedAt });
    return updated;
  }

  // Bidding window closed — transition to evaluating.
  const updated: AuditSession = {
    ...session,
    state: {
      stage: "evaluating",
      bids: getVisibleBids(session.startedAt),
      samples: scoreSamples(),
    },
    updatedAt: Date.now(),
  };
  sessions.set(session.id, { ...updated, startedAt: session.startedAt });
  return updated;
}

export function createSession(input: IntentInput): AuditSession {
  const id = generateId();
  const now = Date.now();
  const session: AuditSession & { startedAt: number } = {
    id,
    input,
    state: {
      stage: "bidding",
      visibleBids: [],
      countdownSeconds: 15,
    },
    createdAt: now,
    updatedAt: now,
    startedAt: now,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(sessionId: string): AuditSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return advance(session);
}

export function approveAgent(
  sessionId: string,
  agentId: string,
): AuditSession | { error: string } {
  const session = sessions.get(sessionId);
  if (!session) return { error: "Session not found" };

  const current = advance(session);
  if (current.state.stage !== "evaluating") {
    return { error: `Cannot approve agent in stage: ${current.state.stage}` };
  }

  const sample = current.state.samples.find((s) => s.agentId === agentId);
  if (!sample) return { error: "Agent not found in sample evaluations" };

  const bid = current.state.bids.find((b) => b.id === agentId);
  const delivery = buildDeliveryReport(sample.agentName, session.input.taskDescription);
  const auditEvents = logAndGetAuditEvents(sample.agentName);

  const updated: AuditSession = {
    ...current,
    state: {
      stage: "delivered",
      approvedAgentId: agentId,
      approvedAgentName: sample.agentName,
      quoteUsd: bid?.quoteUsd ?? 0,
      delivery,
      auditEvents,
    },
    updatedAt: Date.now(),
  };
  sessions.set(sessionId, { ...updated, startedAt: session.startedAt });
  return updated;
}
