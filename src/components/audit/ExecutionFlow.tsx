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
};

export function ExecutionFlow({ state, countdownSeconds }: ExecutionFlowProps) {
  const steps = stepsForStage(state.stage);
  const bids: AgentBid[] =
    state.stage === "bidding"
      ? state.visibleBids
      : state.stage === "evaluating" || state.stage === "delivered"
        ? (state as Extract<AuditSessionState, { stage: "evaluating" }>).bids ?? []
        : [];

  const samples: SampleEvaluation[] =
    state.stage === "evaluating" ? state.samples : [];

  return (
    <div className="flex h-full flex-col overflow-y-auto border-l border-zinc-100 bg-zinc-50 px-5 py-6 font-mono text-xs">
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
                className="flex items-center justify-between rounded border border-zinc-200 bg-white px-2.5 py-1.5"
              >
                <div>
                  <span className="font-semibold text-zinc-800">{bid.agentName}</span>
                  <span className="ml-1 text-zinc-400">({bid.model})</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-500">
                  <span>${bid.quoteUsd.toFixed(2)}</span>
                  <span>{bid.etaMinutes}min</span>
                  <span className="text-emerald-600">{bid.reputation.toFixed(2)}</span>
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
          <p className="text-emerald-600">// TASK_COMPLETE ✓</p>
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
