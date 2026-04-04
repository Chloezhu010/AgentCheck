import { NextResponse } from "next/server";
import { createAuditTopic } from "@/server/hedera/audit";

// POST — create a new HCS audit topic (one-time setup)
export async function POST() {
  try {
    const topicId = await createAuditTopic();
    return NextResponse.json({ topicId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
