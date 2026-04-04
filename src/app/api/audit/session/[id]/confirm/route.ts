import { confirmSpec } from "@/server/orchestrator";
import type { ApiError, SessionResponse } from "@/types/audit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const result = confirmSpec(id);

  if ("error" in result) {
    return Response.json({ error: result.error } satisfies ApiError, { status: 400 });
  }

  return Response.json({ session: result } satisfies SessionResponse);
}
