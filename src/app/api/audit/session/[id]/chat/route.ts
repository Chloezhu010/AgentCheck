import { respondToAgent } from "@/server/orchestrator";
import type { ApiError, SessionResponse } from "@/types/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  let body: { message?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON" } satisfies ApiError,
      { status: 400 },
    );
  }

  const message = body.message;
  if (!message) {
    return Response.json(
      { error: "message is required" } satisfies ApiError,
      { status: 400 },
    );
  }

  const result = respondToAgent(id, message);
  if ("error" in result) {
    return Response.json(
      { error: result.error } satisfies ApiError,
      { status: 400 },
    );
  }

  return Response.json({ session: result } satisfies SessionResponse);
}
