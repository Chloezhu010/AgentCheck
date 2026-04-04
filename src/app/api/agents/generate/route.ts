import { generateImage } from "@/server/agents/generate";
import { GenerateImageSchema } from "@/lib/validation";
import type { ApiError } from "@/types/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST — generate an image with a specific agent persona
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" } satisfies ApiError, {
      status: 400,
    });
  }

  const parsed = GenerateImageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
    const result = await generateImage(parsed.data.agentId, parsed.data.prompt);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return Response.json({ error: message } satisfies ApiError, { status: 500 });
  }
}
