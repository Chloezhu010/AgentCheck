import { TransferTransaction, Hbar, HbarUnit } from "@hashgraph/sdk";
import { getHederaClient, getEscrowClient } from "./client";
import { logAuditEvent } from "./audit";
import type { EscrowResult } from "@/types/hedera";

// Testnet safety: reject transfers above this limit to avoid draining the account
const MAX_TRANSFER_HBAR = 300;

export async function escrowLock(
  taskId: string,
  amountHbar: number,
): Promise<EscrowResult> {
  if (amountHbar > MAX_TRANSFER_HBAR) {
    throw new Error(`Transfer ${amountHbar} HBAR exceeds safety limit of ${MAX_TRANSFER_HBAR} HBAR`);
  }

  const client = getHederaClient();
  const escrowAccountId = process.env.HEDERA_ESCROW_ACCOUNT_ID;
  if (!escrowAccountId) {
    throw new Error("Missing HEDERA_ESCROW_ACCOUNT_ID in environment");
  }

  const tx = await new TransferTransaction()
    .addHbarTransfer(client.operatorAccountId!, Hbar.from(-amountHbar, HbarUnit.Hbar))
    .addHbarTransfer(escrowAccountId, Hbar.from(amountHbar, HbarUnit.Hbar))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const txId = tx.transactionId.toString();
  const status = receipt.status.toString();

  await logAuditEvent({
    t: "ESCROW_LOCKED",
    taskId,
    d: { amount: amountHbar, txId, status },
  });

  return { txId, status };
}

export async function escrowRelease(
  taskId: string,
  agentAccountId: string,
  amountHbar: number,
): Promise<EscrowResult> {
  if (amountHbar > MAX_TRANSFER_HBAR) {
    throw new Error(`Transfer ${amountHbar} HBAR exceeds safety limit of ${MAX_TRANSFER_HBAR} HBAR`);
  }

  const escrowClient = getEscrowClient();

  const tx = await new TransferTransaction()
    .addHbarTransfer(escrowClient.operatorAccountId!, Hbar.from(-amountHbar, HbarUnit.Hbar))
    .addHbarTransfer(agentAccountId, Hbar.from(amountHbar, HbarUnit.Hbar))
    .execute(escrowClient);

  const receipt = await tx.getReceipt(escrowClient);
  const txId = tx.transactionId.toString();
  const status = receipt.status.toString();

  await logAuditEvent({
    t: "PAYMENT_RELEASED",
    taskId,
    agentId: agentAccountId,
    d: { amount: amountHbar, txId, status },
  });

  return { txId, status };
}
