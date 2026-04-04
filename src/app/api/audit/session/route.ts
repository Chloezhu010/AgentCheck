import { createSession } from "@/server/orchestrator";
import { CreateIntakeSessionSchema } from "@/lib/validation";
import type { ApiError, CreateSessionResponse } from "@/types/audit";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" } satisfies ApiError, { status: 400 });
  }

  const parsed = CreateIntakeSessionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message } satisfies ApiError,
      { status: 400 },
    );
  }

  const session = await createSession(parsed.data.initialMessage);
  return Response.json(
    { sessionId: session.id, session } satisfies CreateSessionResponse,
    { status: 201 },
  );
}
