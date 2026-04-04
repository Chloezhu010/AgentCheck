import type { SampleEvaluation } from "@/types/audit";

type ScoreCardProps = {
  sample: SampleEvaluation;
  canApprove: boolean;
  isPending: boolean;
  onApprove: (sample: SampleEvaluation) => void;
};

export function ScoreCard({ sample, canApprove, isPending, onApprove }: ScoreCardProps) {
  const scorePercent = Math.round(sample.score * 100);

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
