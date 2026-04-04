import { chatIntake } from "@/server/orchestrator";
import { ChatMessageSchema } from "@/lib/validation";
import type { ApiError, SessionResponse } from "@/types/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" } satisfies ApiError, { status: 400 });
  }

  const parsed = ChatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message } satisfies ApiError,
      { status: 400 },
    );
  }

  const result = await chatIntake(id, parsed.data.message);

  if ("error" in result) {
    return Response.json({ error: result.error } satisfies ApiError, { status: 400 });
  }

  return Response.json({ session: result } satisfies SessionResponse);
}
