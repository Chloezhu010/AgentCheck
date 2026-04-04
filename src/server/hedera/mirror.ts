import type { MirrorMessage } from "@/types/hedera";

const MIRROR_BASE =
  process.env.HEDERA_NETWORK === "mainnet"
    ? "https://mainnet.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";

export async function getAuditMessages(
  topicId: string,
  limit = 100,
  order: "asc" | "desc" = "desc",
): Promise<MirrorMessage[]> {
  const url = `${MIRROR_BASE}/api/v1/topics/${topicId}/messages?limit=${limit}&order=${order}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Mirror node error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  return (data.messages ?? []).map((msg: Record<string, unknown>) => ({
    sequenceNumber: msg.sequence_number as number,
    consensusTimestamp: msg.consensus_timestamp as string,
    content: JSON.parse(
      Buffer.from(msg.message as string, "base64").toString("utf-8"),
    ),
  }));
}

export async function getAccountBalance(accountId: string): Promise<number> {
  const url = `${MIRROR_BASE}/api/v1/balances?account.id=${accountId}&limit=1`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Mirror node error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const balance = data.balances?.[0]?.balance;
  // Mirror node returns tinybars, convert to HBAR
  return balance ? balance / 1e8 : 0;
}
