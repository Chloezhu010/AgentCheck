"use client";

import type { AgentBid, SampleEvaluation } from "@/types/audit";

type AgentConfirmPanelProps = {
  samples: SampleEvaluation[];
  bids: AgentBid[];
  isPending: boolean;
  onApprove: (sample: SampleEvaluation) => void;
};

export function AgentConfirmPanel({
  samples,
  bids,
  isPending,
  onApprove,
}: AgentConfirmPanelProps) {
  if (samples.length === 0) return null;

  const best = samples[0];
  const bestBid = bids.find((b) => b.id === best.agentId);

  return (
    <div className="flex h-full w-72 flex-shrink-0 flex-col overflow-y-auto border-l border-zinc-200 bg-white px-5 py-6 animate-in slide-in-from-right-4 duration-300 xl:w-80">
      {/* Header */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
          User_Confirms_Agent
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-500">
          // SELECT_AND_APPROVE
        </p>
      </div>

      {/* Agent list */}
      <div className="space-y-3">
        {samples.map((sample, i) => {
          const bid = bids.find((b) => b.id === sample.agentId);
          const scorePercent = Math.round(sample.score * 100);
          const isTop = i === 0;

          return (
            <div
              key={sample.id}
              className={`rounded-lg border p-3 ${
                isTop
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-zinc-200 bg-zinc-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isTop && (
                      <span className="rounded bg-emerald-500 px-1 py-0.5 text-[9px] font-bold text-white">
                        TOP
                      </span>
                    )}
                    <span className="font-mono text-xs font-semibold text-zinc-900">
                      {sample.agentName}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-400">
                    {sample.model}
                  </p>
                </div>
                <span
                  className={`font-mono text-sm font-bold ${
                    isTop ? "text-emerald-600" : "text-zinc-500"
                  }`}
                >
                  {scorePercent > 0 ? scorePercent : "–"}
                </span>
              </div>

              {scorePercent > 0 && (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-200">
                  <div
                    style={{ width: `${scorePercent}%` }}
                    className="h-1 rounded-full bg-emerald-400 transition-all duration-700"
                  />
                </div>
              )}

              {bid && (
                <div className="mt-2 flex gap-3 font-mono text-[10px] text-zinc-500">
                  <span>${bid.quoteUsd.toFixed(2)}</span>
                  <span>{bid.etaMinutes}min</span>
                  <span className="text-emerald-600">rep {bid.reputation.toFixed(2)}</span>
                </div>
              )}

              {sample.imageDataUrl && (
                <img
                  src={sample.imageDataUrl}
                  alt={`${sample.agentName} sample`}
                  className="mt-2 w-full rounded border border-zinc-200"
                />
              )}

              <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
                {sample.recommendation}
              </p>

              <button
                type="button"
                onClick={() => onApprove(sample)}
                disabled={isPending}
                className={`mt-3 w-full rounded-md py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${
                  isTop
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {isPending
                  ? "// VERIFYING..."
                  : `CONFIRM_${sample.agentName.toUpperCase().replace(/\s/g, "_")}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* World ID note */}
      <div className="mt-auto pt-5">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
            <p className="font-mono text-[10px] text-zinc-500">
              WORLD_ID_REQUIRED
            </p>
          </div>
          <p className="mt-1 text-[10px] text-zinc-400">
            Approval triggers on-chain payment via Hedera escrow
          </p>
        </div>

        {bestBid && (
          <div className="mt-3 flex justify-between font-mono text-[10px] text-zinc-500">
            <span>BUDGET_USED</span>
            <span className="font-semibold text-zinc-800">
              ${bestBid.quoteUsd.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
