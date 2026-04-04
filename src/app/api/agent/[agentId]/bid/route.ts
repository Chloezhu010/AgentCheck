import { getPersona } from "@/server/agents/personas";
import type { AgentBid, ApiError } from "@/types/audit";

// Each agent's pricing / capability profile.
// In production these would be computed dynamically by the agent LLM.
const bidProfiles: Record<
  string,
  Omit<AgentBid, "id" | "agentName" | "model" | "verified">
> = {
  "agent-alpha": {
    trialQuoteUsd: 0.6,
    quoteUsd: 3,
    etaMinutes: 45,
    reputation: 0.85,
  },
  "agent-beta": {
    trialQuoteUsd: 0.8,
    quoteUsd: 4,
    etaMinutes: 60,
    reputation: 0.91,
  },
  "agent-gamma": {
    trialQuoteUsd: 0.5,
    quoteUsd: 2,
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
