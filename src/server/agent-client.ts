import type { AgentBid, SampleEvaluation } from "@/types/audit";
import type { ImageAgentId } from "@/types/agent";

const BASE_URL =
  process.env.AGENT_BASE_URL ||
  `http://localhost:${process.env.PORT || 3000}`;

const AGENT_IDS: ImageAgentId[] = [
  "agent-alpha",
  "agent-beta",
  "agent-gamma",
];

export async function fetchBid(
  agentId: ImageAgentId,
  taskDescription: string,
  budgetUsd: number,
): Promise<AgentBid> {
  const res = await fetch(`${BASE_URL}/api/agent/${agentId}/bid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskDescription, budgetUsd }),
  });
  if (!res.ok) throw new Error(`Agent ${agentId} bid failed: ${res.status}`);
  return res.json();
}

export async function fetchSample(
  agentId: ImageAgentId,
  prompt: string,
): Promise<SampleEvaluation> {
  const res = await fetch(`${BASE_URL}/api/agent/${agentId}/sample`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok)
    throw new Error(`Agent ${agentId} sample failed: ${res.status}`);
  return res.json();
}

export async function fetchAllBids(
  taskDescription: string,
  budgetUsd: number,
): Promise<AgentBid[]> {
  const results = await Promise.allSettled(
    AGENT_IDS.map((id) => fetchBid(id, taskDescription, budgetUsd)),
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<AgentBid> => r.status === "fulfilled",
    )
    .map((r) => r.value);
}

export async function fetchAllSamples(
  prompt: string,
): Promise<SampleEvaluation[]> {
  return fetchSamplesForAgents(prompt, AGENT_IDS);
}

export async function fetchSamplesForAgents(
  prompt: string,
  agentIds: ImageAgentId[],
): Promise<SampleEvaluation[]> {
  const results = await Promise.allSettled(
    agentIds.map((id) => fetchSample(id, prompt)),
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<SampleEvaluation> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);
}
