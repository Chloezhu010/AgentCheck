import { escrowRelease } from "@/server/hedera/payment";
import type { PaymentReleaseInput } from "@/server/payment-ledger";

const DEFAULT_USD_TO_HBAR_RATE = 0.01;
const DEFAULT_MAX_PAYOUT_HBAR = 0.01;
const ABSOLUTE_MAX_PAYOUT_HBAR = 1;
const HBAR_DECIMALS = 8;

const AGENT_ACCOUNT_ENV_BY_ID: Record<string, string> = {
  "agent-alpha": "HEDERA_AGENT_ALPHA_ACCOUNT_ID",
  "agent-beta": "HEDERA_AGENT_BETA_ACCOUNT_ID",
  "agent-gamma": "HEDERA_AGENT_GAMMA_ACCOUNT_ID",
  "agent-delta": "HEDERA_AGENT_DELTA_ACCOUNT_ID",
  "agent-epsilon": "HEDERA_AGENT_EPSILON_ACCOUNT_ID",
};

function roundHbar(value: number): number {
  const precision = 10 ** HBAR_DECIMALS;
  return Math.round(Math.max(value, 0) * precision) / precision;
}

function getUsdToHbarRate(): number {
  const raw = Number(process.env.HEDERA_USD_TO_HBAR_RATE);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return DEFAULT_USD_TO_HBAR_RATE;
}

function getMaxPayoutHbar(): number {
  const raw = Number(process.env.HEDERA_MAX_PAYOUT_HBAR);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.min(raw, ABSOLUTE_MAX_PAYOUT_HBAR);
  }
  return DEFAULT_MAX_PAYOUT_HBAR;
}

function resolveAgentAccountId(agentId: string): string {
  const envKey = AGENT_ACCOUNT_ENV_BY_ID[agentId];
  const mapped = envKey ? process.env[envKey] : undefined;
  if (mapped) {
    return mapped;
  }

  const fallback = process.env.HEDERA_OPERATOR_PAYOUT_ACCOUNT_ID ?? process.env.HEDERA_ACCOUNT_ID;
  if (fallback) {
    return fallback;
  }

  throw new Error(
    envKey
      ? `Missing ${envKey} (or HEDERA_OPERATOR_PAYOUT_ACCOUNT_ID / HEDERA_ACCOUNT_ID fallback)`
      : `Missing payout account mapping for ${agentId}`,
  );
}

function toHashscanTxUrl(txId: string): string {
  const network = process.env.HEDERA_NETWORK === "mainnet" ? "mainnet" : "testnet";
  return `https://hashscan.io/${network}/transaction/${encodeURIComponent(txId)}`;
}

export async function releaseEscrowPaymentsOnHedera(
  taskId: string,
  drafts: PaymentReleaseInput[],
): Promise<PaymentReleaseInput[]> {
  const usdToHbarRate = getUsdToHbarRate();
  const maxPayoutHbar = getMaxPayoutHbar();

  return Promise.all(
    drafts.map(async (draft) => {
      const requestedAmountHbar = roundHbar(draft.amountUsd * usdToHbarRate);
      const amountHbar = roundHbar(Math.min(requestedAmountHbar, maxPayoutHbar));
      if (amountHbar <= 0) {
        throw new Error(
          `Computed non-positive HBAR amount for ${draft.phase} payment (${draft.agentId})`,
        );
      }

      const agentAccountId = resolveAgentAccountId(draft.agentId);
      const release = await escrowRelease(taskId, agentAccountId, amountHbar);

      return {
        ...draft,
        amountHbar,
        agentAccountId,
        txId: release.txId,
        txStatus: release.status,
        txUrl: toHashscanTxUrl(release.txId),
      };
    }),
  );
}
