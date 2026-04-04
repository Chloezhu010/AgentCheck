import type { SampleEvaluation } from "@/types/audit";

type ScoreCardProps = {
  sample: SampleEvaluation;
  canApprove: boolean;
  isPending: boolean;
  onApprove: (sample: SampleEvaluation) => void;
  compact?: boolean;
  onOpenDetails?: (agentId: string) => void;
};

export function ScoreCard({
  sample,
  canApprove,
  isPending,
  onApprove,
  compact = false,
  onOpenDetails,
}: ScoreCardProps) {
  const scorePercent = Math.round(sample.score * 100);
  const openDetails = onOpenDetails ?? (() => {});

  if (compact) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-2.5">
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
            <p className="truncate text-xs font-semibold text-zinc-900">{sample.agentName}</p>
            <p className="truncate text-[10px] text-zinc-400">{sample.model}</p>
            <p className="mt-0.5 text-[10px] font-mono text-zinc-500">
              {scorePercent > 0 ? `${scorePercent}/100` : "Scoring..."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openDetails(sample.agentId)}
          className="mt-2.5 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Open Detailed Review
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{sample.agentName}</p>
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
        onClick={() => onApprove(sample)}
        disabled={!canApprove || isPending}
        className="mt-2.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? "Verifying & Approving..." : `Approve ${sample.agentName}`}
      </button>
    </section>
  );
}
