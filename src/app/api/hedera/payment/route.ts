import { escrowLock, escrowRelease } from "@/server/hedera/payment";
import { HederaPaymentRequestSchema } from "@/lib/validation";
import type { ApiError } from "@/types/audit";

// POST — escrow lock or release
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" } satisfies ApiError, {
      status: 400,
    });
  }

  const parsedBody = HederaPaymentRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return Response.json(
      { error: parsedBody.error.issues[0].message } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
    const payload = parsedBody.data;
    if (payload.action === "lock") {
      const result = await escrowLock(payload.taskId, payload.amountHbar);
      return Response.json(result);
    }

    const result = await escrowRelease(
      payload.taskId,
      payload.agentAccountId,
      payload.amountHbar,
    );
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Failed to process escrow payment" } satisfies ApiError,
      { status: 500 },
    );
  }
}
