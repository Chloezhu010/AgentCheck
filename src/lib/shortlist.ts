import { normalizeWeights } from "@/lib/audit-demo-data";
import type { AgentBid, AgentShortlist, IntentWeights } from "@/types/audit";
import { IMAGE_AGENT_IDS, type ImageAgentId } from "@/types/agent";

type ScoredBid = {
  bid: AgentBid;
  total: number;
};

export function buildAgentShortlist(
  bids: AgentBid[],
  weights: IntentWeights,
  shortlistSize = 3,
): AgentShortlist | undefined {
  if (bids.length === 0) {
    return undefined;
  }

  const weighted = normalizeWeights(weights);
  const quoteRange = getRange(bids.map((bid) => bid.quoteUsd));
  const etaRange = getRange(bids.map((bid) => bid.etaMinutes));

  const scored = bids
    .map<ScoredBid>((bid) => {
      const quality = clamp01(bid.reputation);
      const price = normalizeInverse(bid.quoteUsd, quoteRange.min, quoteRange.max);
      const speed = normalizeInverse(bid.etaMinutes, etaRange.min, etaRange.max);

      return {
        bid,
        total: quality * weighted.quality + price * weighted.price + speed * weighted.speed,
      };
    })
    .sort((a, b) => b.total - a.total);

  const shortlisted = scored
    .slice(0, Math.max(1, shortlistSize))
    .map((entry) => ({
      agentId: toImageAgentId(entry.bid.id),
      agentName: entry.bid.agentName,
      score: Math.round(entry.total * 100),
    }))
    .filter((entry): entry is { agentId: ImageAgentId; agentName: string; score: number } =>
      Boolean(entry.agentId),
    );

  if (shortlisted.length === 0) {
    return undefined;
  }

  const breakdown = shortlisted
    .map((entry) => `${entry.agentName} ${entry.score}`)
    .join(", ");
  const rationale = `Weighted shortlist (quality ${Math.round(weighted.quality * 100)}%, price ${Math.round(
    weighted.price * 100,
  )}%, speed ${Math.round(weighted.speed * 100)}%): ${breakdown}.`;

  return {
    shortlistedAgentIds: shortlisted.map((entry) => entry.agentId),
    rationale,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeInverse(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (max <= min) return 1;
  return clamp01(1 - (value - min) / (max - min));
}

function getRange(values: number[]): { min: number; max: number } {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) {
    return { min: 0, max: 0 };
  }
  return {
    min: Math.min(...finiteValues),
    max: Math.max(...finiteValues),
  };
}

function toImageAgentId(agentId: string): ImageAgentId | null {
  return IMAGE_AGENT_IDS.includes(agentId as ImageAgentId) ? (agentId as ImageAgentId) : null;
}
