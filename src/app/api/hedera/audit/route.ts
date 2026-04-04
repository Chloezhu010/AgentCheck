import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/server/hedera/audit";
import { getAuditMessages } from "@/server/hedera/mirror";
import type { AuditEventType } from "@/types/hedera";

// POST — submit an audit event to HCS
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { t, taskId, subtaskId, agentId, d } = body as {
      t: AuditEventType;
      taskId: string;
      subtaskId?: string;
      agentId?: string;
      d?: Record<string, unknown>;
    };

    if (!t || !taskId) {
      return NextResponse.json(
        { error: "Missing required fields: t, taskId" },
        { status: 400 },
      );
    }

    const result = await logAuditEvent({ t, taskId, subtaskId, agentId, d: d ?? {} });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET — read audit messages from Mirror Node
export async function GET(request: NextRequest) {
  try {
    const topicId = process.env.HEDERA_AUDIT_TOPIC_ID;
    if (!topicId) {
      return NextResponse.json(
        { error: "HEDERA_AUDIT_TOPIC_ID not configured" },
        { status: 500 },
      );
    }

    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "25");
    const order = request.nextUrl.searchParams.get("order") === "asc" ? "asc" : "desc";
    const messages = await getAuditMessages(topicId, limit, order);

    return NextResponse.json({ topicId, messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
