import { logAuditEvent as hcsSubmit } from "@/server/hedera/audit";
import type { AuditEvent } from "@/types/audit";
import type { AuditEventType } from "@/types/hedera";

const TOPIC_ID = process.env.HEDERA_AUDIT_TOPIC_ID ?? "";

function hashscanTopicMessageUrl(seqNum: string): string {
  return `https://hashscan.io/testnet/topic/${TOPIC_ID}/message/${seqNum}`;
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
