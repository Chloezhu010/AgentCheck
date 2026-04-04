import { getPersona } from "@/server/agents/personas";
import type { AgentBid, ApiError } from "@/types/audit";

// Each agent's pricing / capability profile.
// In production these would be computed dynamically by the agent LLM.
const bidProfiles: Record<
  string,
  Omit<AgentBid, "id" | "agentName" | "model" | "verified">
> = {
  "agent-epsilon": {
    avatar: "🦊",
    bidLine: "I can deliver premium storytelling visuals with high confidence and consistent quality.",
    trialQuoteUsd: 4.8,
    quoteUsd: 24,
    etaMinutes: 52,
    reputation: 0.94,
  },
  "agent-delta": {
    avatar: "🧠",
    bidLine: "I optimize for product clarity and speed, with implementation-ready structure.",
    trialQuoteUsd: 3.6,
    quoteUsd: 19,
    etaMinutes: 38,
    reputation: 0.89,
  },
  "agent-alpha": {
    avatar: "🎬",
    bidLine: "I'll produce cinematic-grade visuals quickly, tuned for strong emotional impact.",
    trialQuoteUsd: 3.2,
    quoteUsd: 18,
    etaMinutes: 45,
    reputation: 0.85,
  },
  "agent-beta": {
    avatar: "🎨",
    bidLine: "I offer balanced value with strong style fidelity and dependable delivery.",
    trialQuoteUsd: 4.1,
    quoteUsd: 22,
    etaMinutes: 60,
    reputation: 0.91,
  },
  "agent-gamma": {
    avatar: "🧩",
    bidLine: "I deliver minimalist compositions at low cost when conceptual clarity matters most.",
    trialQuoteUsd: 2.6,
    quoteUsd: 14,
    etaMinutes: 90,
    reputation: 0.78,
  },
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
): Promise<Response> {
  const { agentId } = await params;

  const persona = getPersona(agentId);
  const profile = bidProfiles[agentId];
  if (!persona || !profile) {
    return Response.json(
      { error: `Unknown agent: ${agentId}` } satisfies ApiError,
      { status: 404 },
    );
  }

  const bid: AgentBid = {
    id: agentId,
    agentName: persona.name,
    model: persona.style,
    verified: true,
    ...profile,
  };

  return Response.json(bid);
}
