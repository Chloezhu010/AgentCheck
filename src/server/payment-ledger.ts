import type { AgentBid, AuditSession, PaymentRelease, SampleEvaluation } from "@/types/audit";

export type PaymentReleaseInput = Omit<PaymentRelease, "id" | "releasedAt">;

function roundUsd(value: number): number {
  return Math.round(Math.max(value, 0) * 100) / 100;
}

function paymentKey(payment: Pick<PaymentReleaseInput, "phase" | "agentId">): string {
  return `${payment.phase}:${payment.agentId}`;
}

function ensurePaymentArray(session: AuditSession): PaymentRelease[] {
  if (!Array.isArray(session.paymentReleases)) {
    session.paymentReleases = [];
  }
  return session.paymentReleases;
}

export function appendPaymentReleases(
  session: AuditSession,
  releases: PaymentReleaseInput[],
): PaymentRelease[] {
  const existingPayments = ensurePaymentArray(session);
  const existingKeys = new Set(existingPayments.map((payment) => paymentKey(payment)));
  const now = Date.now();
  const added: PaymentRelease[] = [];

  for (const release of releases) {
    const amountUsd = roundUsd(release.amountUsd);
    if (amountUsd <= 0) {
      continue;
    }

    const key = paymentKey(release);
    if (existingKeys.has(key)) {
      continue;
    }

    const payment: PaymentRelease = {
      id: `payment-${release.phase}-${release.agentId}`,
      phase: release.phase,
      agentId: release.agentId,
      agentName: release.agentName,
      amountUsd,
      amountHbar: release.amountHbar,
      agentAccountId: release.agentAccountId,
      txId: release.txId,
      txStatus: release.txStatus,
      txUrl: release.txUrl,
      releasedAt: now,
    };
    existingPayments.push(payment);
    added.push(payment);
    existingKeys.add(key);
  }

  return added;
}

export function filterUnreleasedPaymentReleases(
  session: AuditSession,
  releases: PaymentReleaseInput[],
): PaymentReleaseInput[] {
  const existingPayments = ensurePaymentArray(session);
  const existingKeys = new Set(existingPayments.map((payment) => paymentKey(payment)));

  return releases.filter((release) => !existingKeys.has(paymentKey(release)));
}

export function buildTrialPaymentReleases(
  samples: SampleEvaluation[],
  bids: AgentBid[],
): PaymentReleaseInput[] {
  const bidByAgent = new Map(bids.map((bid) => [bid.id, bid]));

  return samples.flatMap((sample) => {
    const trialQuoteUsd = bidByAgent.get(sample.agentId)?.trialQuoteUsd ?? 0;
    if (trialQuoteUsd <= 0) {
      return [];
    }

    return [
      {
        phase: "trial" as const,
        agentId: sample.agentId,
        agentName: sample.agentName,
        amountUsd: trialQuoteUsd,
      },
    ];
  });
}

export function buildFinalPaymentRelease(
  agentId: string,
  agentName: string,
  bids: AgentBid[],
): PaymentReleaseInput | null {
  const quoteUsd = bids.find((bid) => bid.id === agentId)?.quoteUsd ?? 0;
  if (quoteUsd <= 0) {
    return null;
  }

  return {
    phase: "full",
    agentId,
    agentName,
    amountUsd: quoteUsd,
  };
}

export function summarizePaymentReleases(
  payments: PaymentRelease[],
  fallbackFinalUsd = 0,
): { trialPaidUsd: number; finalPaidUsd: number; totalPaidUsd: number } {
  const trialPaidUsd = roundUsd(
    payments
      .filter((payment) => payment.phase === "trial")
      .reduce((sum, payment) => sum + payment.amountUsd, 0),
  );

  const recordedFinalPaidUsd = roundUsd(
    payments
      .filter((payment) => payment.phase === "full")
      .reduce((sum, payment) => sum + payment.amountUsd, 0),
  );

  const finalPaidUsd =
    recordedFinalPaidUsd > 0 ? recordedFinalPaidUsd : roundUsd(fallbackFinalUsd);

  return {
    trialPaidUsd,
    finalPaidUsd,
    totalPaidUsd: roundUsd(trialPaidUsd + finalPaidUsd),
  };
}

export function computeTotalPaidUsd(payments: PaymentRelease[]): number {
  return roundUsd(payments.reduce((sum, payment) => sum + payment.amountUsd, 0));
}
