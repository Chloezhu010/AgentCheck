import type { SampleEvaluation } from "@/types/audit";

type ScoreCardProps = {
  sample: SampleEvaluation;
  canApprove: boolean;
  isPending: boolean;
  onApprove: (sample: SampleEvaluation) => void;
  compact?: boolean;
  selected?: boolean;
  onSelectSample?: (agentId: string) => void;
  recommended?: boolean;
};

export function ScoreCard({
  sample,
  canApprove,
  isPending,
  onApprove,
  compact = false,
  selected = false,
  onSelectSample,
  recommended = false,
}: ScoreCardProps) {
  const scorePercent = Math.round(sample.score * 100);
  const handleSelect = onSelectSample ?? (() => {});

  if (compact) {
    return (
      <section
        role="button"
        tabIndex={0}
        onClick={() => handleSelect(sample.agentId)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleSelect(sample.agentId);
          }
        }}
        className={`cursor-pointer rounded-xl border bg-white p-2.5 transition-colors ${
          selected ? "border-zinc-900 ring-1 ring-zinc-900/30" : "border-zinc-200 hover:bg-zinc-50"
        }`}
      >
        <div className="flex items-center gap-2.5">
          {sample.imageDataUrl ? (
            <img
              src={sample.imageDataUrl}
              alt={`${sample.agentName} thumbnail`}
              className="h-14 w-14 flex-shrink-0 rounded-md border border-zinc-100 object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border border-zinc-100 bg-zinc-50 text-[10px] text-zinc-400">
              IMG
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-xs font-semibold text-zinc-900">{sample.agentName}</p>
              {recommended && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                  Recommended
                </span>
              )}
            </div>
            <p className="truncate text-[10px] text-zinc-400">{sample.model}</p>
            <p className="mt-0.5 text-[10px] font-mono text-zinc-500">
              {scorePercent > 0 ? `${scorePercent}/100` : "Scoring..."}
            </p>
          </div>
          {selected && (
            <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              Selected
            </span>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      role="button"
      tabIndex={0}
      onClick={() => handleSelect(sample.agentId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelect(sample.agentId);
        }
      }}
      className={`cursor-pointer rounded-xl border bg-white p-3 transition-colors ${
        selected ? "border-zinc-900 ring-1 ring-zinc-900/30" : "border-zinc-200 hover:bg-zinc-50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900">{sample.agentName}</p>
            {recommended && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                Recommended
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400">{sample.model}</p>
        </div>
        <div className="flex items-center gap-2">
          {scorePercent > 0 && (
            <p className="font-mono text-xs text-zinc-500">{scorePercent}/100</p>
          )}
          {selected && (
            <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              Selected
            </span>
          )}
        </div>
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
    </section>
  );
}
