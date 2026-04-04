import { logAuditEvent as hcsSubmit } from "@/server/hedera/audit";
import type { AuditEvent } from "@/types/audit";
import type { AuditEventType } from "@/types/hedera";

const TOPIC_ID = process.env.HEDERA_AUDIT_TOPIC_ID ?? "";

function hashscanTopicMessageUrl(seqNum: string): string {
  if (!TOPIC_ID) {
    return "";
  }

  return `https://hashscan.io/testnet/topic/${encodeURIComponent(TOPIC_ID)}?p=1&k=${encodeURIComponent(seqNum)}`;
}

export async function recordAuditEvent(
  taskId: string,
  eventType: AuditEventType,
  label: string,
  data: Record<string, unknown> = {},
  agentId?: string,
): Promise<AuditEvent> {
  try {
    const result = await hcsSubmit({ t: eventType, taskId, agentId, d: data });

    return {
      id: `audit-${eventType}-${Date.now()}`,
      label,
      status: "logged",
      txUrl: hashscanTopicMessageUrl(result.sequenceNumber),
      hcsSequenceNumber: Number(result.sequenceNumber),
    };
  } catch {
    return {
      id: `audit-${eventType}-${Date.now()}`,
      label,
      status: "failed",
      txUrl: "",
    };
  }
}
