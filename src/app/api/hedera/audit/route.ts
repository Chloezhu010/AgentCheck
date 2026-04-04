import { logAuditEvent } from "@/server/hedera/audit";
import { getAuditMessages } from "@/server/hedera/mirror";
import {
  HederaAuditEventSchema,
  HederaAuditQuerySchema,
} from "@/lib/validation";
import type { ApiError } from "@/types/audit";

// POST — submit an audit event to HCS
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" } satisfies ApiError, {
      status: 400,
    });
  }

  const parsedBody = HederaAuditEventSchema.safeParse(body);
  if (!parsedBody.success) {
    return Response.json(
      { error: parsedBody.error.issues[0].message } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
    const result = await logAuditEvent(parsedBody.data);
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Failed to submit audit event" } satisfies ApiError,
      { status: 500 },
    );
  }
}

// GET — read audit messages from Mirror Node
export async function GET(request: Request): Promise<Response> {
  const topicId = process.env.HEDERA_AUDIT_TOPIC_ID;
  if (!topicId) {
    return Response.json(
      { error: "HEDERA_AUDIT_TOPIC_ID not configured" } satisfies ApiError,
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const parsedQuery = HederaAuditQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    order: url.searchParams.get("order") ?? undefined,
  });
  if (!parsedQuery.success) {
    return Response.json(
      { error: parsedQuery.error.issues[0].message } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
    const { limit, order } = parsedQuery.data;
    const messages = await getAuditMessages(topicId, limit, order);
    return Response.json({ topicId, messages });
  } catch {
    return Response.json(
      { error: "Failed to read audit messages" } satisfies ApiError,
      { status: 500 },
    );
  }
}
