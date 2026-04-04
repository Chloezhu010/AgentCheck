import { TopicCreateTransaction, TopicMessageSubmitTransaction, TopicId } from "@hashgraph/sdk";
import { getHederaClient } from "./client";
import type { HcsAuditMessage } from "@/types/hedera";

// Topic creation (one-time setup)

export async function createAuditTopic(): Promise<string> {
  const client = getHederaClient();

  const tx = new TopicCreateTransaction()
    .setTopicMemo("AgentProcure Audit Log")
    .setAdminKey(client.operatorPublicKey!)
    .setSubmitKey(client.operatorPublicKey!);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const topicId = receipt.topicId;
  if (!topicId) throw new Error("Topic creation failed: no topicId in receipt");

  return topicId.toString();
}

// Submit audit event

function getTopicId(): TopicId {
  const raw = process.env.HEDERA_AUDIT_TOPIC_ID;
  if (!raw) throw new Error("Missing HEDERA_AUDIT_TOPIC_ID in environment");
  return TopicId.fromString(raw);
}

export async function logAuditEvent(
  event: Omit<HcsAuditMessage, "v" | "ts">,
): Promise<{ sequenceNumber: string; status: string }> {
  const client = getHederaClient();
  const topicId = getTopicId();

  const message: HcsAuditMessage = { v: 1, ts: Date.now(), ...event };

  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(message));

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);

  return {
    sequenceNumber: receipt.topicSequenceNumber?.toString() ?? "",
    status: receipt.status.toString(),
  };
}
