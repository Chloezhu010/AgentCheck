"use client";

import type { AgentBid, AuditSessionState, SampleEvaluation } from "@/types/audit";

type Step = {
  id: string;
  label: string;
  status: "done" | "active" | "pending";
};

function stepsForStage(stage: AuditSessionState["stage"]): Step[] {
  const all: Array<{ id: string; label: string }> = [
    { id: "PARSE_INTENT", label: "PARSE_INTENT" },
    { id: "OPEN_RFQ", label: "OPEN_RFQ" },
    { id: "COLLECT_BIDS", label: "COLLECT_BIDS" },
    { id: "RUN_SAMPLES", label: "RUN_SAMPLES" },
    { id: "CONFIRM_AGENT", label: "CONFIRM_AGENT" },
    { id: "FINALIZE", label: "FINALIZE_REPORT" },
  ];

  const activeIndex: Record<AuditSessionState["stage"], number> = {
    agentic: 3,
    bidding: 2,
    evaluating: 4,
    delivered: 6,
    error: 0,
  };

  const active = activeIndex[stage];
  return all.map((s, i) => ({
    ...s,
    status: i < active ? "done" : i === active ? "active" : "pending",
  }));
}

type ExecutionFlowProps = {
  state: AuditSessionState;
  countdownSeconds: number;
  taskDescription: string;
  totalBudgetUsd: number;
  usedBudgetUsd: number;
};

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function ExecutionFlow({
  state,
  countdownSeconds,
  taskDescription,
  totalBudgetUsd,
  usedBudgetUsd,
}: ExecutionFlowProps) {
  const steps = stepsForStage(state.stage);
  const bids: AgentBid[] =
    state.stage === "bidding"
      ? state.visibleBids
      : state.stage === "evaluating" || state.stage === "delivered"
        ? (state as Extract<AuditSessionState, { stage: "evaluating" }>).bids ?? []
        : [];

  const samples: SampleEvaluation[] =
    state.stage === "evaluating" ? state.samples : [];

  const remainingBudgetUsd = Math.max(totalBudgetUsd - usedBudgetUsd, 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto border-l border-zinc-100 bg-zinc-50 px-5 py-6 font-mono text-xs">
      <div className="sticky top-0 z-10 -mx-5 -mt-7 mb-12 border-b border-zinc-200 bg-zinc-50/95 px-5 pt-0 pb-7 backdrop-blur">
        <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
            Task_Brief
          </p>
          <p className="line-clamp-3 leading-relaxed text-zinc-700">
            {taskDescription}
          </p>

          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-[10px] text-zinc-500">
            <div className="flex items-center justify-between">
              <span>TOTAL / REMAINING</span>
              <span className="font-semibold text-zinc-700">
                {formatUsd(totalBudgetUsd)} / {formatUsd(remainingBudgetUsd)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>USED</span>
              <span className="font-semibold text-zinc-700">{formatUsd(usedBudgetUsd)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="mb-6">
        <p className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
          Execution_Flow
        </p>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={step.id} className="flex items-center gap-2">
              <span
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm text-[9px] font-bold ${
                  step.status === "done"
                    ? "bg-emerald-100 text-emerald-600"
                    : step.status === "active"
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-200 text-zinc-400"
                }`}
              >
                {step.status === "done" ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={
                  step.status === "done"
                    ? "text-zinc-400 line-through"
                    : step.status === "active"
                      ? "text-zinc-900"
                      : "text-zinc-400"
                }
              >
                {step.label}
              </span>
              {step.status === "active" && state.stage === "bidding" && (
                <span className="ml-auto text-amber-500">{countdownSeconds}s</span>
              )}
              {step.status === "active" && state.stage === "evaluating" && (
                <span className="ml-auto animate-pulse text-blue-500">…</span>
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* Auction market */}
      {bids.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
            Auction_Market
          </p>
          <div className="space-y-1.5">
            {bids.map((bid) => (
              <div
                key={bid.id}
                className="rounded border border-zinc-200 bg-white px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-800">{bid.agentName}</p>
                  <p className="truncate text-[10px] text-zinc-400">{bid.model}</p>
                </div>

                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
                    Price ${bid.quoteUsd.toFixed(2)}
                  </span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
                    ETA {bid.etaMinutes}m
                  </span>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                    Reputation {Math.round(bid.reputation * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quality evaluations */}
      {samples.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
            Quality_Evaluations
          </p>
          <div className="space-y-1.5">
            {samples.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded border border-zinc-200 bg-white px-2.5 py-1.5"
              >
                <span className="text-zinc-400">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 font-semibold text-zinc-800">{s.agentName}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      style={{ width: `${Math.round(s.score * 100)}%` }}
                      className="h-1 rounded-full bg-emerald-400 transition-all duration-700"
                    />
                  </div>
                  <span className="w-8 text-right text-emerald-600">
                    {s.score > 0 ? Math.round(s.score * 100) : "–"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.stage === "delivered" && (
        <div className="mt-auto pt-4">
          <p className="text-emerald-600">{"// TASK_COMPLETE ✓"}</p>
          <p className="mt-1 text-zinc-400">
            AGENT: {(state as Extract<AuditSessionState, { stage: "delivered" }>).approvedAgentName}
          </p>
          <p className="text-zinc-400">
            PAID: ${(state as Extract<AuditSessionState, { stage: "delivered" }>).quoteUsd.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}
