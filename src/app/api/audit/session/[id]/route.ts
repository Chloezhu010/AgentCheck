import { getSession } from "@/server/orchestrator";
import type { ApiError, SessionResponse } from "@/types/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const session = getSession(id);

  if (!session) {
    return Response.json({ error: "Session not found" } satisfies ApiError, { status: 404 });
  }

  return Response.json({ session } satisfies SessionResponse);
}
