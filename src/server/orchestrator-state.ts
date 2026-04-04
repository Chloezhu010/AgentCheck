import { getPersona } from "@/server/agents/personas";
import { getStoredSamples } from "@/server/tools/business";
import { buildDeliveryReport } from "@/lib/audit-demo-data";
import { makeMsg } from "@/server/orchestrator-session";
import type { AgentBid, SampleEvaluation } from "@/types/audit";
import type { SessionEntry, SelectedAgent } from "@/server/orchestrator-session";

export type AuditPayload = { t?: string; agentId?: string; d?: unknown } | null;

export function parseAuditPayload(messageStr: string): AuditPayload {
  try {
    return JSON.parse(messageStr) as AuditPayload;
  } catch {
    return null;
  }
}

export function tryParseEventLabel(messageStr: string): string {
  const parsed = parseAuditPayload(messageStr);
  if (parsed?.t) {
    return parsed.t;
  }
  return "Audit event";
}

export function hashscanTopicMessageUrl(topicId: string, sequenceNumber: unknown): string {
  if (!topicId) {
    return "";
  }

  if (typeof sequenceNumber !== "string" && typeof sequenceNumber !== "number") {
    return "";
  }

  const sequence = String(sequenceNumber).trim();
  if (!sequence) {
    return "";
  }

  return `https://hashscan.io/testnet/topic/${encodeURIComponent(topicId)}?p=1&k=${encodeURIComponent(sequence)}`;
}

export function applyDemoFallback(entry: SessionEntry, reason: unknown): void {
  if (entry.session.state.stage === "delivered") return;
  if (
    entry.session.state.stage === "evaluating" &&
    entry.session.state.samples.some((sample) => sample.id.startsWith("fallback-"))
  ) {
    return;
  }

  const bids = buildFallbackBids();
  const samples = buildFallbackSamples(entry.session.input.taskDescription, bids);
  const reasonText = reason instanceof Error ? reason.message : "unknown fallback reason";

  entry.currentBids = bids;
  entry.session.messages.push(
    makeMsg(
      `Live agent orchestration timed out (${reasonText}). Switched to demo fallback so you can continue the flow without blocking.`,
    ),
  );
  entry.session.messages.push(makeMsg("", "scoreCanvas", { samples }));
  entry.session.state = {
    stage: "evaluating",
    bids,
    samples,
  };
  entry.session.pendingQuestion = undefined;
  entry.pendingAskCallId = undefined;
  entry.session.updatedAt = Date.now();
}

export function syncSessionFromAuditEvent(
  entry: SessionEntry,
  sessionId: string,
  payload: AuditPayload,
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

export function setDeliveredState(
  entry: SessionEntry,
  selection?: SelectedAgent | null,
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
  entry.session.pendingQuestion = undefined;
  entry.pendingAskCallId = undefined;
  entry.session.updatedAt = Date.now();
}

export function coerceBidsFromToolResult(result: unknown): AgentBid[] {
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

function buildFallbackBids(): AgentBid[] {
  const profiles: Array<{
    id: AgentBid["id"];
    quoteUsd: number;
    trialQuoteUsd: number;
    etaMinutes: number;
    reputation: number;
  }> = [
    { id: "agent-beta", trialQuoteUsd: 4.1, quoteUsd: 22, etaMinutes: 60, reputation: 0.91 },
    { id: "agent-alpha", trialQuoteUsd: 3.2, quoteUsd: 18, etaMinutes: 45, reputation: 0.85 },
    { id: "agent-gamma", trialQuoteUsd: 2.6, quoteUsd: 14, etaMinutes: 90, reputation: 0.78 },
  ];

  return profiles.map((profile) => {
    const persona = getPersona(profile.id);
    return {
      id: profile.id,
      agentName: persona?.name ?? profile.id,
      model: persona?.style ?? "Unknown style",
      verified: true,
      trialQuoteUsd: profile.trialQuoteUsd,
      quoteUsd: profile.quoteUsd,
      etaMinutes: profile.etaMinutes,
      reputation: profile.reputation,
    };
  });
}

function buildFallbackSamples(
  taskDescription: string,
  bids: AgentBid[],
): SampleEvaluation[] {
  const scoreMap: Record<string, number> = {
    "agent-beta": 0.91,
    "agent-alpha": 0.86,
    "agent-gamma": 0.79,
  };

  return bids
    .map((bid) => ({
      id: `fallback-${bid.id}`,
      agentId: bid.id,
      agentName: bid.agentName,
      model: bid.model,
      score: scoreMap[bid.id] ?? 0.75,
      recommendation:
        bid.id === "agent-beta"
          ? "Best overall balance of quality and delivery confidence for the requested output."
          : bid.id === "agent-alpha"
            ? "Strong visual quality and fast turnaround, with slightly higher execution variance."
            : "Cost-efficient option with simpler style output and slower turnaround.",
      sampleTitle: `${bid.agentName} Fallback Sample`,
      summary: `Fallback preview generated for demo continuity. Task focus: ${taskDescription.slice(0, 140)}.`,
    }))
    .sort((a, b) => b.score - a.score);
}

function deriveSelectedAgent(
  entry: SessionEntry,
  sessionId: string,
  payload: { agentId?: string; d?: unknown },
): SelectedAgent | null {
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
): SelectedAgent | null {
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
