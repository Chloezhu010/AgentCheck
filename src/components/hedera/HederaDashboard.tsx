"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MirrorMessage } from "@/types/hedera";

const HASHSCAN = "https://hashscan.io/testnet";

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

export function HederaDashboard() {
  const [topicId, setTopicId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [messages, setMessages] = useState<MirrorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingAudit, setTestingAudit] = useState(false);
  const [testingEscrow, setTestingEscrow] = useState(false);
  const [escrowResult, setEscrowResult] = useState<EscrowTestResult>(null);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch("/api/hedera/audit?limit=25&order=desc");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setTopicId(data.topicId);
      setMessages(data.messages ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch audit");
    }
  }, []);

  const fetchBalances = useCallback(async () => {
    try {
      const res = await fetch("/api/hedera/balance");
      const data = await res.json();
      if (data.accounts) setAccounts(data.accounts);
    } catch {
      // non-critical
    }
  }, []);

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
    setTestingAudit(true);
    try {
      await fetch("/api/hedera/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          t: "TASK_INTENT",
          taskId: `demo-${Date.now()}`,
          d: { description: "Dashboard test event", budgetUsd: 10 },
        }),
      });
      // Wait for mirror propagation then refresh
      setTimeout(async () => {
        await fetchAudit();
        setTestingAudit(false);
      }, 6000);
    } catch {
      setTestingAudit(false);
    }
  }

  async function handleTestEscrow() {
    setTestingEscrow(true);
    setEscrowResult(null);
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
      const lockData = await lockRes.json();
      if (lockData.error) {
        setEscrowResult({ action: "lock", txId: "", status: lockData.error });
        setTestingEscrow(false);
        return;
      }
      setEscrowResult({ action: "lock", txId: lockData.txId, status: lockData.status });

      // Refresh after mirror propagation
      setTimeout(async () => {
        await Promise.all([fetchAudit(), fetchBalances()]);
        setTestingEscrow(false);
      }, 6000);
    } catch (e) {
      setEscrowResult({ action: "lock", txId: "", status: String(e) });
      setTestingEscrow(false);
    }
  }

  const eventColor: Record<string, string> = {
    TASK_INTENT: "bg-blue-100 text-blue-800",
    BID_RECEIVED: "bg-purple-100 text-purple-800",
    BID_REJECTED: "bg-red-100 text-red-800",
    SAMPLE_SCORED: "bg-amber-100 text-amber-800",
    AGENT_SELECTED: "bg-emerald-100 text-emerald-800",
    ESCROW_LOCKED: "bg-orange-100 text-orange-800",
    PAYMENT_RELEASED: "bg-green-100 text-green-800",
    TASK_COMPLETED: "bg-teal-100 text-teal-800",
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
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Hedera Testnet Dashboard</h2>
          {topicId && (
            <p className="text-xs text-zinc-400">
              Topic{" "}
              <a
                href={`${HASHSCAN}/topic/${topicId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 underline"
              >
                {topicId}
              </a>
            </p>
          )}
        </div>
        <Link
          href="/"
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50"
        >
          Back to Chat
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* ── Accounts ── */}
      <section className="grid gap-3 sm:grid-cols-2">
        {accounts.map((acc) => (
          <div key={acc.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              {acc.label}
            </p>
            <a
              href={`${HASHSCAN}/account/${acc.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block font-mono text-sm text-blue-600 underline"
            >
              {acc.id}
            </a>
            <p className="mt-2 font-mono text-2xl font-semibold text-zinc-900">
              {acc.balance !== null ? `${acc.balance.toFixed(2)} HBAR` : "..."}
            </p>
          </div>
        ))}
      </section>

      {/* Actions */}
      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleTestAudit}
          disabled={testingAudit}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {testingAudit ? "Logging to HCS..." : "Test HCS Audit Event"}
        </button>
        <button
          type="button"
          onClick={handleTestEscrow}
          disabled={testingEscrow}
          className="rounded-lg border border-zinc-900 px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
        >
          {testingEscrow ? "Locking 0.01 HBAR..." : "Test Escrow Lock (0.01 HBAR)"}
        </button>
        <button
          type="button"
          onClick={() => { fetchAudit(); fetchBalances(); }}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-xs text-zinc-500 hover:bg-zinc-50"
        >
          Refresh
        </button>
      </section>

      {escrowResult && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
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

      {/* ── Audit Trail ── */}
      <section className="flex-1">
        <h3 className="mb-2 text-sm font-semibold text-zinc-700">
          HCS Audit Trail
          <span className="ml-2 font-normal text-zinc-400">({messages.length} messages)</span>
        </h3>

        {messages.length === 0 ? (
          <p className="text-xs text-zinc-400">
            No audit messages yet. Click &quot;Test HCS Audit Event&quot; above.
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, i) => {
              // Agent-generated HCS messages may not match the strict type
              const evt = msg.content as Record<string, unknown>;
              const eventType = (evt.t ?? evt.event ?? "UNKNOWN") as string;
              const badge = eventColor[eventType] ?? "bg-zinc-100 text-zinc-600";
              const ts = formatConsensusTimestamp(msg.consensusTimestamp);
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
                      className="ml-auto text-[10px] text-blue-500 underline"
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
