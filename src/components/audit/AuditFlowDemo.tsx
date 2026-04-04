"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { normalizeWeights } from "@/lib/audit-demo-data";
import { useWorldIdGate, WorldIdModal } from "@/components/audit/WorldIdGate";
import { WORLD_ACTIONS, worldScope } from "@/lib/world-id";
import type {
  AuditSession,
  AuditSessionState,
  IntentWeights,
  OrchestratorMessage,
  SampleEvaluation,
} from "@/types/audit";

const POLL_INTERVAL_MS = 1500;

const defaultWeights: IntentWeights = { quality: 40, price: 30, speed: 30 };

const stepLabels = ["Intent", "Live Bids", "Quality Gate", "Delivery"];

const stageToStepIndex: Record<AuditSessionState["stage"], number> = {
  bidding: 1,
  evaluating: 2,
  delivered: 3,
  error: 0,
};

const stageBadgeLabel: Record<AuditSessionState["stage"], string> = {
  bidding: "Auction Running",
  evaluating: "Awaiting Approval",
  delivered: "Delivered",
  error: "Needs Fix",
};

const weightControls: Array<{ key: keyof IntentWeights; label: string }> = [
  { key: "quality", label: "Quality" },
  { key: "price", label: "Price" },
  { key: "speed", label: "Speed" },
];

type LocalMessage = {
  source: "assistant" | "user";
  id: string;
  text: string;
  ts: number;
};

type DisplayMessage = LocalMessage | { source: "backend"; msg: OrchestratorMessage };

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function AuditFlowDemo() {
  const [taskDescription, setTaskDescription] = useState("");
  const [budgetUsd, setBudgetUsd] = useState("50");
  const [weights, setWeights] = useState<IntentWeights>(defaultWeights);
  const [showSettings, setShowSettings] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<AuditSession | null>(null);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [isPending, startApprove] = useTransition();
  const worldId = useWorldIdGate();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);

  const stage = session?.state.stage ?? null;
  const activeStepIndex = stage ? stageToStepIndex[stage] : 0;
  const isFlowRunning = stage === "bidding" || stage === "evaluating";

  const parsedBudget = Number.parseFloat(budgetUsd);
  const totalBudget = Number.isNaN(parsedBudget) ? 0 : parsedBudget;

  const usedBudget =
    session?.state.stage === "delivered" ? session.state.quoteUsd : 0;

  const spendRatio = totalBudget > 0 ? Math.min((usedBudget / totalBudget) * 100, 100) : 0;
  const countdownSeconds =
    session?.state.stage === "bidding"
      ? (session.state as Extract<AuditSessionState, { stage: "bidding" }>).countdownSeconds
      : 0;

  const normalizedWeights = useMemo(() => normalizeWeights(weights), [weights]);
  const weightPercentages = useMemo(
    () => ({
      quality: Math.round(normalizedWeights.quality * 100),
      price: Math.round(normalizedWeights.price * 100),
      speed: Math.round(normalizedWeights.speed * 100),
    }),
    [normalizedWeights],
  );

  // Merge local UI messages + backend messages chronologically
  const displayMessages: DisplayMessage[] = useMemo(() => {
    const backendMsgs: DisplayMessage[] = (session?.messages ?? []).map((msg) => ({
      source: "backend" as const,
      msg,
    }));

    const all: Array<DisplayMessage & { ts: number }> = [
      ...backendMsgs.map((d) => ({ ...d, ts: d.source === "backend" ? d.msg.ts : 0 })),
      ...localMessages.map((msg) => ({ ...msg, ts: msg.ts })),
    ];
    all.sort((a, b) => a.ts - b.ts);
    return all;
  }, [localMessages, session?.messages]);

  // Show typing indicator when new backend messages might be arriving
  const isTyping =
    isFlowRunning &&
    session?.messages &&
    session.messages.length === prevMsgCount.current;

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages.length]);

  // Track message count for typing indicator
  useEffect(() => {
    prevMsgCount.current = session?.messages?.length ?? 0;
  }, [session?.messages?.length]);

  // Polling
  useEffect(() => {
    if (!sessionId || stage === "delivered" || stage === "error") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/audit/session/${sessionId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { session: AuditSession };
        setSession(data.session);
      } catch {
        // silently ignore transient fetch errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [sessionId, stage]);

  function handleStartAuction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskDescription.trim()) return;

    setSubmitError(null);

    const userTask = taskDescription;
    setTaskDescription("");

    const timestamp = Date.now();

    setLocalMessages((prev) => [
      ...prev,
      { source: "user", id: `user-${timestamp}`, text: userTask, ts: timestamp },
    ]);

    startSubmit(async () => {
      // Gate 1: prove human identity before starting the auction
      setLocalMessages((prev) => [
        ...prev,
        {
          source: "assistant",
          id: `assistant-${Date.now()}`,
          text: "Verifying your identity with World ID before opening the auction...",
          ts: Date.now(),
        },
      ]);
      try {
        await worldId.trigger({
          action: WORLD_ACTIONS.CREATE_AUDIT,
          scope: worldScope.draft(crypto.randomUUID()),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "World ID verification failed";
        setSubmitError(message);
        setLocalMessages((prev) => [
          ...prev,
          {
            source: "assistant",
            id: `assistant-${Date.now()}`,
            text: `Identity check failed: ${message}`,
            ts: Date.now(),
          },
        ]);
        return;
      }

      const res = await fetch("/api/audit/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskDescription: userTask,
          budgetUsd: totalBudget,
          weights,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to start auction");
        return;
      }

      const { sessionId: newId, session: newSession } = data as {
        sessionId: string;
        session: AuditSession;
      };

      setSessionId(newId);
      setSession(newSession);
    });
  }

  function handleWeightChange(key: keyof IntentWeights, rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10);
    setWeights((w) => ({ ...w, [key]: Number.isNaN(parsed) ? 0 : parsed }));
  }

  function handleApprove(sample: SampleEvaluation) {
    if (stage !== "evaluating" || !sessionId) return;

    setLocalMessages((prev) => [
      ...prev,
      {
        source: "user",
        id: `user-${Date.now()}`,
        text: `Approve ${sample.agentName}`,
        ts: Date.now(),
      },
    ]);

    startApprove(async () => {
      // Gate 2: prove human identity before releasing payment
      setLocalMessages((prev) => [
        ...prev,
        {
          source: "assistant",
          id: `assistant-${Date.now()}`,
          text: "Verifying your identity with World ID before releasing payment...",
          ts: Date.now(),
        },
      ]);
      try {
        await worldId.trigger({
          action: WORLD_ACTIONS.APPROVE_PAYMENT,
          scope: worldScope.audit(sessionId),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "World ID verification failed";
        setLocalMessages((prev) => [
          ...prev,
          {
            source: "assistant",
            id: `assistant-${Date.now()}`,
            text: `Identity check failed: ${message}`,
            ts: Date.now(),
          },
        ]);
        return;
      }

      const res = await fetch(`/api/audit/session/${sessionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: sample.agentId }),
      });

      const data = await res.json();
      if (!res.ok) return;

      setSession((data as { session: AuditSession }).session);
    });
  }

  function handleReset() {
    setSessionId(null);
    setSession(null);
    setLocalMessages([]);
    setSubmitError(null);
    prevMsgCount.current = 0;
  }

  // Audit trail panel (shown in delivered stage)
  const auditTrail = session?.auditTrail ?? [];

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3 md:px-6">
        <ol className="flex gap-1.5">
          {stepLabels.map((label, index) => {
            const isActive = activeStepIndex === index;
            const isComplete = activeStepIndex > index;
            return (
              <li
                key={label}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium leading-none ${
                  isActive
                    ? "bg-zinc-900 text-white"
                    : isComplete
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {label}
              </li>
            );
          })}
        </ol>

        <span className="mx-1 hidden h-4 w-px bg-zinc-200 sm:block" />

        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="font-medium text-zinc-700">Budget</span>
          <div className="h-1.5 w-16 rounded-full bg-zinc-200">
            <div
              style={{ width: `${spendRatio}%` }}
              className="h-1.5 rounded-full bg-zinc-900 transition-all"
            />
          </div>
          <span className="font-mono">
            {formatUsd(usedBudget)}/{formatUsd(totalBudget)}
          </span>
        </div>

        {stage === "bidding" && (
          <>
            <span className="mx-1 hidden h-4 w-px bg-zinc-200 sm:block" />
            <span className="font-mono text-[11px] text-zinc-500">{countdownSeconds}s</span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {stage && (
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
              {stageBadgeLabel[stage]}
            </span>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-50"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="mx-auto max-w-2xl space-y-3">
          {/* Welcome message (always shown) */}
          {!sessionId && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                A
              </div>
              <div className="max-w-[85%] rounded-2xl bg-zinc-100 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800">
                <p>Hi! I&apos;m AgentCheck. Describe a task and I&apos;ll run the full auction, scoring, and audit pipeline for you.</p>
              </div>
            </div>
          )}

          {displayMessages.map((dm) => {
            if (dm.source === "user") {
              return (
                <div
                  key={dm.id}
                  className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="max-w-[85%] rounded-2xl bg-zinc-900 px-3.5 py-2.5 text-sm leading-relaxed text-white">
                    <p>{dm.text}</p>
                  </div>
                </div>
              );
            }

            if (dm.source === "assistant") {
              return (
                <div
                  key={dm.id}
                  className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                    A
                  </div>
                  <div className="max-w-[85%] rounded-2xl bg-zinc-100 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800">
                    <p
                      className="whitespace-pre-wrap [&>strong]:font-semibold"
                      dangerouslySetInnerHTML={{
                        __html: dm.text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                      }}
                    />
                  </div>
                </div>
              );
            }

            const message = dm.msg;
            return (
              <div
                key={message.id}
                className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                  A
                </div>
                <div className="max-w-[85%] rounded-2xl bg-zinc-100 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800">
                  {message.text && (
                    <p
                      className="whitespace-pre-wrap [&>strong]:font-semibold"
                      dangerouslySetInnerHTML={{
                        __html: message.text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                      }}
                    />
                  )}

                  {message.kind === "scoreCanvas" && message.samples && message.samples.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {message.samples.map((sample) => {
                        const scorePercent = Math.round(sample.score * 100);
                        return (
                          <section
                            key={sample.id}
                            className="rounded-xl border border-zinc-200 bg-white p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-zinc-900">
                                  {sample.agentName}
                                </p>
                                <p className="text-[11px] text-zinc-400">{sample.model}</p>
                              </div>
                              {scorePercent > 0 && (
                                <p className="font-mono text-xs text-zinc-500">{scorePercent}/100</p>
                              )}
                            </div>

                            {scorePercent > 0 && (
                              <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-200">
                                <div
                                  style={{ width: `${scorePercent}%` }}
                                  className="h-1.5 rounded-full bg-emerald-500 transition-all duration-700"
                                />
                              </div>
                            )}

                            {sample.imageDataUrl && (
                              <img
                                src={sample.imageDataUrl}
                                alt={`${sample.agentName} sample`}
                                className="mt-2 w-full rounded-lg border border-zinc-100"
                              />
                            )}

                            <p className="mt-2 text-xs text-zinc-600">{sample.recommendation}</p>

                            <button
                              type="button"
                              onClick={() => handleApprove(sample)}
                              disabled={stage !== "evaluating" || isPending}
                              className="mt-2.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {isPending ? "Verifying & Approving..." : `Approve ${sample.agentName}`}
                            </button>
                          </section>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Audit trail (shown in delivered stage) */}
          {stage === "delivered" && auditTrail.length > 0 && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                A
              </div>
              <div className="max-w-[85%] rounded-2xl bg-zinc-100 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800">
                <p className="mb-2 font-semibold">Hedera HCS Audit Trail</p>
                <ul className="space-y-1">
                  {auditTrail.map((event) => (
                    <li key={event.id} className="flex items-center gap-2 text-xs">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          event.status === "logged" ? "bg-emerald-500" : "bg-amber-400"
                        }`}
                      />
                      <span className="text-zinc-600">{event.label}</span>
                      {event.txUrl && (
                        <a
                          href={event.txUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline"
                        >
                          hashscan
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {isTyping && (
            <div className="flex items-start">
              <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                A
              </div>
              <div className="rounded-2xl bg-zinc-100 px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-zinc-100 px-4 py-3 md:px-6">
        <form
          className="mx-auto flex max-w-2xl items-end gap-2"
          onSubmit={handleStartAuction}
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder={
                isFlowRunning ? "Auction in progress..." : "Describe a task to audit..."
              }
              disabled={isFlowRunning || isSubmitting}
              className="w-full rounded-xl border border-zinc-300 bg-zinc-50 py-2.5 pl-3 pr-20 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white disabled:opacity-50"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
                title="Settings"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                </svg>
              </button>
              <button
                type="submit"
                disabled={isFlowRunning || isSubmitting || !taskDescription.trim()}
                className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
              >
                {isSubmitting ? "Verifying..." : "Send"}
              </button>
            </div>
          </div>
        </form>

        {showSettings && (
          <div className="mx-auto mt-2 max-w-2xl rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600">Budget $</span>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={budgetUsd}
                  onChange={(e) => setBudgetUsd(e.target.value)}
                  className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500"
                />
              </label>
              {weightControls.map((item) => (
                <label key={item.key} className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500">
                    {item.label} {weightPercentages[item.key]}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={weights[item.key]}
                    onChange={(e) => handleWeightChange(item.key, e.target.value)}
                    className="h-1 w-16 accent-zinc-900"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {submitError && (
          <p className="mx-auto mt-2 max-w-2xl rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {submitError}
          </p>
        )}
      </div>

      {/* World ID QR modal — renders the IDKit widget overlay */}
      <WorldIdModal gate={worldId} />
    </div>
  );
}
