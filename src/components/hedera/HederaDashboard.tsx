"use client";

import { useCallback, useEffect, useState } from "react";
import type { MirrorMessage } from "@/types/hedera";

const HASHSCAN = "https://hashscan.io/testnet";
const POLL_INTERVAL_MS = 1500;
const MAX_SYNC_ATTEMPTS = 8;

type AccountInfo = {
  id: string;
  label: string;
  balance: number | null;
};

type EscrowTestResult = {
  action: string;
  txId: string;
  status: string;
} | null;

type ActionStatusTone = "info" | "success" | "warning" | "error";
type ActionStatus = { tone: ActionStatusTone; text: string } | null;
type HederaDashboardProps = {
  onTopicIdChange?: (topicId: string | null) => void;
};

type AccountMeta = {
  title: string;
  description: string;
  icon: "platform" | "escrow";
};

const accountMeta: Record<string, AccountMeta> = {
  Orchestrator: {
    title: "Platform Wallet",
    description: "Main platform wallet that starts tasks and funds escrow locks.",
    icon: "platform",
  },
  Escrow: {
    title: "Protected Escrow",
    description: "Holds locked funds safely until payment release is approved.",
    icon: "escrow",
  },
};

function getLatestSequence(items: MirrorMessage[]): number {
  return items.reduce((max, item) => Math.max(max, item.sequenceNumber), 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatConsensusTimestamp(consensusTimestamp: string): string {
  const [secondsRaw, nanosRaw = "0"] = consensusTimestamp.split(".");
  const seconds = Number(secondsRaw);
  const nanos = Number(nanosRaw.padEnd(9, "0").slice(0, 9));
  if (!Number.isFinite(seconds) || !Number.isFinite(nanos)) {
    return "";
  }

  const ms = seconds * 1000 + Math.floor(nanos / 1_000_000);
  return new Date(ms).toLocaleString();
}

function AccountRoleIcon({ icon }: { icon: AccountMeta["icon"] }) {
  if (icon === "platform") {
    return (
      <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L4.09 12.97H11L10 22L20.91 11H14L13 2Z" />
      </svg>
    );
  }

  return (
    <svg className="h-3.5 w-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V8a4 4 0 118 0v2" />
    </svg>
  );
}

export function HederaDashboard({ onTopicIdChange }: HederaDashboardProps) {
  const [topicId, setTopicId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [messages, setMessages] = useState<MirrorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingAudit, setTestingAudit] = useState(false);
  const [testingEscrow, setTestingEscrow] = useState(false);
  const [escrowResult, setEscrowResult] = useState<EscrowTestResult>(null);
  const [actionStatus, setActionStatus] = useState<ActionStatus>(null);

  const fetchAudit = useCallback(async (): Promise<MirrorMessage[]> => {
    try {
      const res = await fetch("/api/hedera/audit?limit=25&order=desc");
      const data = (await res.json()) as {
        error?: string;
        topicId?: string;
        messages?: MirrorMessage[];
      };
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to fetch audit");
        return [];
      }
      const nextMessages = data.messages ?? [];
      setTopicId(data.topicId ?? null);
      onTopicIdChange?.(data.topicId ?? null);
      setMessages(nextMessages);
      setError(null);
      return nextMessages;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch audit");
      return [];
    }
  }, [onTopicIdChange]);

  const fetchBalances = useCallback(async (): Promise<AccountInfo[]> => {
    try {
      const res = await fetch("/api/hedera/balance");
      const data = (await res.json()) as { accounts?: AccountInfo[] };
      const nextAccounts = data.accounts ?? [];
      if (nextAccounts.length > 0) {
        setAccounts(nextAccounts);
      }
      return nextAccounts;
    } catch {
      return [];
    }
  }, []);

  const waitForMirrorSync = useCallback(async (baselineSequence: number): Promise<number | null> => {
    for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt += 1) {
      await sleep(POLL_INTERVAL_MS);
      const [nextMessages] = await Promise.all([fetchAudit(), fetchBalances()]);
      const nextSequence = getLatestSequence(nextMessages);
      if (nextSequence > baselineSequence) {
        return nextSequence;
      }
    }
    return null;
  }, [fetchAudit, fetchBalances]);

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        await Promise.all([fetchAudit(), fetchBalances()]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      active = false;
    };
  }, [fetchAudit, fetchBalances]);

  async function handleTestAudit() {
    const baselineSequence = getLatestSequence(messages);
    setTestingAudit(true);
    setActionStatus({ tone: "info", text: "Submitting test audit event to Hedera..." });

    try {
      const response = await fetch("/api/hedera/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          t: "TASK_INTENT",
          taskId: `demo-${Date.now()}`,
          d: { description: "Dashboard test event", budgetUsd: 10 },
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok || payload.error) {
        setActionStatus({
          tone: "error",
          text: payload.error ?? "Failed to submit test audit event.",
        });
        return;
      }

      setActionStatus({
        tone: "info",
        text: "Event submitted. Waiting for mirror node confirmation...",
      });
      const syncedSequence = await waitForMirrorSync(baselineSequence);
      if (syncedSequence !== null) {
        setActionStatus({
          tone: "success",
          text: `Mirror synced. New audit message detected at #${syncedSequence}.`,
        });
      } else {
        setActionStatus({
          tone: "warning",
          text: "Event submitted, but mirror sync is delayed. You can use Refresh Data.",
        });
      }
    } catch (e) {
      setActionStatus({
        tone: "error",
        text: e instanceof Error ? e.message : "Failed to submit test audit event.",
      });
    } finally {
      setTestingAudit(false);
    }
  }

  async function handleTestEscrow() {
    const baselineSequence = getLatestSequence(messages);
    setTestingEscrow(true);
    setEscrowResult(null);
    setActionStatus({ tone: "info", text: "Submitting escrow lock transaction (0.01 HBAR)..." });

    try {
      const lockRes = await fetch("/api/hedera/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lock",
          taskId: `demo-${Date.now()}`,
          amountHbar: 0.01,
        }),
      });
      const lockData = (await lockRes.json()) as {
        error?: string;
        txId?: string;
        status?: string;
      };

      if (!lockRes.ok || lockData.error || !lockData.txId || !lockData.status) {
        const message = lockData.error ?? "Failed to lock escrow";
        setEscrowResult({ action: "lock", txId: "", status: message });
        setActionStatus({ tone: "error", text: message });
        return;
      }

      setEscrowResult({ action: "lock", txId: lockData.txId, status: lockData.status });
      setActionStatus({
        tone: "info",
        text: "Escrow lock submitted. Waiting for mirror node and balance updates...",
      });

      const syncedSequence = await waitForMirrorSync(baselineSequence);
      if (syncedSequence !== null) {
        setActionStatus({
          tone: "success",
          text: `Escrow lock confirmed in mirror feed at #${syncedSequence}.`,
        });
      } else {
        setActionStatus({
          tone: "warning",
          text: "Escrow transaction sent, but mirror sync is delayed. You can use Refresh Data.",
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to process escrow test";
      setEscrowResult({ action: "lock", txId: "", status: message });
      setActionStatus({ tone: "error", text: message });
    } finally {
      setTestingEscrow(false);
    }
  }

  const isActionBusy = testingAudit || testingEscrow;

  const eventColor: Record<string, string> = {
    TASK_INTENT: "bg-blue-100 text-blue-800",
    BID_RECEIVED: "bg-violet-100 text-violet-800",
    BID_REJECTED: "bg-rose-100 text-rose-800",
    SAMPLE_SCORED: "bg-amber-100 text-amber-800",
    AGENT_SELECTED: "bg-emerald-100 text-emerald-800",
    ESCROW_LOCKED: "bg-orange-100 text-orange-800",
    PAYMENT_RELEASED: "bg-teal-100 text-teal-800",
    TASK_COMPLETED: "bg-cyan-100 text-cyan-800",
  };

  const actionStatusToneClass: Record<ActionStatusTone, string> = {
    info: "border-blue-200 bg-blue-50 text-blue-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    error: "border-rose-200 bg-rose-50 text-rose-700",
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        Connecting to Hedera testnet...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 md:p-6">
      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Demo Actions</h3>
            <p className="text-xs text-zinc-500">
              Trigger controlled testnet operations and watch mirror sync progress.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { void fetchAudit(); void fetchBalances(); }}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Refresh Data
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleTestAudit}
            disabled={isActionBusy}
            className="rounded-lg border border-emerald-600 bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testingAudit ? "Submitting audit event..." : "Test HCS Audit Event"}
          </button>
          <button
            type="button"
            onClick={handleTestEscrow}
            disabled={isActionBusy}
            className="rounded-lg border border-emerald-500 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testingEscrow ? "Submitting escrow lock..." : "Test Escrow Lock (0.01 HBAR)"}
          </button>
        </div>

        {actionStatus && (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${actionStatusToneClass[actionStatus.tone]}`}>
            {actionStatus.text}
          </div>
        )}

        {escrowResult && (
          <div className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs">
            <span className="font-medium">Escrow {escrowResult.action}:</span>{" "}
            {escrowResult.txId ? (
              <>
                <a
                  href={`${HASHSCAN}/transaction/${escrowResult.txId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-600 underline"
                >
                  {escrowResult.txId}
                </a>{" "}
                — {escrowResult.status}
              </>
            ) : (
              <span className="text-rose-600">{escrowResult.status}</span>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {accounts.map((acc) => (
          <div key={acc.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                {accountMeta[acc.label] ? (
                  <AccountRoleIcon icon={accountMeta[acc.label].icon} />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-zinc-300" />
                )}
                <span>{accountMeta[acc.label]?.title ?? acc.label}</span>
              </div>

              <a
                href={`${HASHSCAN}/account/${acc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] text-zinc-600 underline underline-offset-2 decoration-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 hover:decoration-zinc-700"
                title={`Open account ${acc.id} in HashScan`}
              >
                Account {acc.id}
              </a>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {accountMeta[acc.label]?.description ?? "Hedera account status"}
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold text-zinc-900">
              {acc.balance !== null ? `${acc.balance.toFixed(2)} HBAR` : "..."}
            </p>
          </div>
        ))}
      </section>

      <section className="flex-1">
        <h3 className="mb-2 text-sm font-semibold text-zinc-700">
          HCS Audit Trail
          <span className="ml-2 font-normal text-zinc-400">({messages.length} messages)</span>
        </h3>

        {messages.length === 0 ? (
          <p className="text-xs text-zinc-400">
            No audit messages yet. Click &quot;Test HCS Audit Event&quot; in Demo Actions.
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, i) => {
              const evt = msg.content as Record<string, unknown>;
              const eventType = (evt.t ?? evt.event ?? "UNKNOWN") as string;
              const badge = eventColor[eventType] ?? "bg-zinc-100 text-zinc-700";
              const ts =
                typeof evt.ts === "number"
                  ? new Date(evt.ts).toLocaleString()
                  : formatConsensusTimestamp(msg.consensusTimestamp);
              const detail = (evt.d ?? evt.data ?? {}) as Record<string, unknown>;
              return (
                <div
                  key={`${msg.sequenceNumber}-${i}`}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-zinc-300">
                      #{msg.sequenceNumber}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge}`}>
                      {eventType}
                    </span>
                    {ts && <span className="text-[11px] text-zinc-400">{ts}</span>}
                    <a
                      href={`${HASHSCAN}/topic/${topicId}?p=1&k=${msg.sequenceNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-[10px] text-blue-600 underline"
                    >
                      HashScan
                    </a>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                    {typeof evt.taskId === "string" && (
                      <span>
                        <span className="text-zinc-400">task:</span>{" "}
                        <span className="font-mono">{evt.taskId}</span>
                      </span>
                    )}
                    {typeof evt.agentId === "string" && (
                      <span>
                        <span className="text-zinc-400">agent:</span>{" "}
                        <span className="font-mono">{evt.agentId}</span>
                      </span>
                    )}
                  </div>
                  {Object.keys(detail).length > 0 && (
                    <pre className="mt-1.5 overflow-x-auto rounded-md bg-zinc-50 p-2 text-[11px] text-zinc-500">
                      {JSON.stringify(detail, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
