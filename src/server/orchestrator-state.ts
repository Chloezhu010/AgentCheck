import { getPersona } from "@/server/agents/personas";
import { getStoredSamples } from "@/server/tools/business";
import { buildDeliveryReport } from "@/lib/audit-demo-data";
import { buildAgentShortlist } from "@/lib/shortlist";
import { makeMsg } from "@/server/orchestrator-session";
import type { AgentBid, DeliveryReport, SampleEvaluation } from "@/types/audit";
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
  const shortlist = buildAgentShortlist(bids, entry.session.input.weights, 3);
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
    shortlist,
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
  delivery?: DeliveryReport,
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
    delivery: delivery ?? buildDeliveryReport(agentName, entry.session.input.taskDescription),
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
        avatar: readString(item, "avatar") ?? defaultAvatarForAgent(id),
        bidLine: readString(item, "bidLine") ?? defaultBidLineForAgent(id),
        trialQuoteUsd: readNumber(item, "trialQuoteUsd") ?? 0,
        quoteUsd: readNumber(item, "quoteUsd") ?? 0,
        etaMinutes: readNumber(item, "etaMinutes") ?? 0,
        reputation: readNumber(item, "reputation") ?? 0,
        verified: readBoolean(item, "verified") ?? false,
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
    { id: "agent-epsilon", trialQuoteUsd: 4.8, quoteUsd: 24, etaMinutes: 52, reputation: 0.94 },
    { id: "agent-delta", trialQuoteUsd: 3.6, quoteUsd: 19, etaMinutes: 38, reputation: 0.89 },
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
      avatar: defaultAvatarForAgent(profile.id),
      bidLine: defaultBidLineForAgent(profile.id),
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
    "agent-epsilon": 0.94,
    "agent-delta": 0.88,
    "agent-beta": 0.91,
    "agent-alpha": 0.86,
    "agent-gamma": 0.79,
  };
  const breakdownMap: Record<string, { quality: number; price: number; speed: number }> = {
    "agent-beta": { quality: 0.92, price: 0.84, speed: 0.9 },
    "agent-alpha": { quality: 0.9, price: 0.78, speed: 0.86 },
    "agent-gamma": { quality: 0.76, price: 0.9, speed: 0.7 },
  };

  return bids
    .map((bid) => {
      const persona = getPersona(bid.id);
      const scoreBreakdown =
        breakdownMap[bid.id] ??
        (bid.id === "agent-epsilon"
          ? { quality: 0.95, price: 0.72, speed: 0.86 }
          : bid.id === "agent-delta"
            ? { quality: 0.88, price: 0.83, speed: 0.92 }
            : { quality: 0.75, price: 0.75, speed: 0.75 });

      return {
        id: `fallback-${bid.id}`,
        agentId: bid.id,
        agentName: bid.agentName,
        model: bid.model,
        score: scoreMap[bid.id] ?? 0.75,
        recommendation:
          bid.id === "agent-epsilon"
            ? "Most polished visual storytelling with top-end quality and consistent delivery confidence."
            : bid.id === "agent-delta"
              ? "Strong product-focused visuals with fast turnaround and balanced cost."
              : bid.id === "agent-beta"
            ? "Best overall balance of quality and delivery confidence for the requested output."
            : bid.id === "agent-alpha"
              ? "Strong visual quality and fast turnaround, with slightly higher execution variance."
              : "Cost-efficient option with simpler style output and slower turnaround.",
        sampleTitle: `${bid.agentName} Fallback Sample`,
        summary: `Fallback preview generated for demo continuity. Task focus: ${taskDescription.slice(0, 140)}.`,
        scoreBreakdown,
        persona: persona
          ? {
              personality: persona.personality,
              taste: persona.taste,
              skills: persona.skills,
            }
          : undefined,
        plan: {
          concept: "Fallback execution concept for demo continuity.",
          samplePlan: "Generate one representative sample image to validate style direction.",
          deliverPlan: "Deliver final output after approval with consistent quality checks.",
          qualityRisk: "Style consistency may drift without iterative feedback.",
          panelFlow: [],
        },
      };
    })
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

function readBoolean(record: Record<string, unknown> | null, key: string): boolean | undefined {
  const value = record?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function defaultAvatarForAgent(agentId: string): string {
  switch (agentId) {
    case "agent-alpha":
      return "🎬";
    case "agent-beta":
      return "🎨";
    case "agent-gamma":
      return "🧩";
    case "agent-delta":
      return "🧠";
    case "agent-epsilon":
      return "🦊";
    default:
      return "🤖";
  }
}

function defaultBidLineForAgent(agentId: string): string {
  switch (agentId) {
    case "agent-alpha":
      return "Cinematic output, fast turnaround, and strong detail under your budget cap.";
    case "agent-beta":
      return "Balanced quality and reliability with predictable execution risk.";
    case "agent-gamma":
      return "Best for budget-first scope with minimalist direction and lower spend.";
    case "agent-delta":
      return "Product-focused visuals optimized for UX clarity and implementation readiness.";
    case "agent-epsilon":
      return "Premium storytelling direction with top-tier polish and consistency.";
    default:
      return "Ready to quote and execute against your trial scope.";
  }
}
