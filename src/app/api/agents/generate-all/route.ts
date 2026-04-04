import { generateImage } from "@/server/agents/generate";
import type { ApiError } from "@/types/audit";
import type { ImageAgentId, GenerateImageResult } from "@/types/agent";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

const Schema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(2000),
});

const AGENT_IDS: ImageAgentId[] = ["agent-alpha", "agent-beta", "agent-gamma"];

type AgentResult =
  | { status: "ok"; data: GenerateImageResult }
  | { status: "error"; agentId: ImageAgentId; error: string };

// POST — generate images from all 3 agents in parallel
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" } satisfies ApiError, {
      status: 400,
    });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message } satisfies ApiError,
      { status: 400 },
    );
  }

  const results = await Promise.all(
    AGENT_IDS.map(async (agentId): Promise<AgentResult> => {
      try {
        const data = await generateImage(agentId, parsed.data.prompt);
        return { status: "ok", data };
      } catch (err) {
        return {
          status: "error",
          agentId,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }),
  );

  return Response.json({ results });
}
