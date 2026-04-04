"use client";

const IDLE_STEPS = [
  "PARSE_INTENT",
  "OPEN_RFQ",
  "COLLECT_BIDS",
  "RUN_SAMPLES",
  "CONFIRM_AGENT",
  "FINALIZE_REPORT",
];

export function ExecutionFlowIdle() {
  return (
    <div className="flex h-full flex-col overflow-y-auto border-l border-zinc-100 bg-zinc-50 px-5 py-6 font-mono text-xs">
      <div className="sticky top-0 z-10 -mx-5 -mt-7 mb-12 border-b border-zinc-200 bg-zinc-50/95 px-5 pt-0 pb-7 backdrop-blur">
        <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
            Task_Brief
          </p>
          <p className="leading-relaxed text-zinc-400">
            Waiting for task prompt...
          </p>

          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-[10px] text-zinc-400">
            <div className="flex items-center justify-between">
              <span>TOTAL / REMAINING</span>
              <span className="font-semibold">$50.00 / $50.00</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>USED</span>
              <span className="font-semibold">$0.00</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
          Execution_Flow
        </p>
        <ol className="space-y-2">
          {IDLE_STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-zinc-200 text-[9px] font-bold text-zinc-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-zinc-400">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
          Auction_Market
        </p>
        <div className="space-y-1.5">
          <div className="rounded border border-dashed border-zinc-200 bg-white px-2.5 py-2 text-zinc-400">
            BIDS_PENDING
          </div>
          <div className="rounded border border-dashed border-zinc-200 bg-white px-2.5 py-2 text-zinc-400">
            SCORES_PENDING
          </div>
        </div>
      </div>
    </div>
  );
}
