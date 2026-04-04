import type { AuditSessionState } from "@/types/audit";

const stepLabels = ["Intake", "Live Bids", "Quality Gate", "Delivery"];

const stageToStepIndex: Record<AuditSessionState["stage"], number> = {
  intake: 0,
  bidding: 1,
  evaluating: 2,
  delivered: 3,
  error: 0,
};

const stageBadgeLabel: Record<AuditSessionState["stage"], string> = {
  intake: "Scoping Task",
  bidding: "Auction Running",
  evaluating: "Awaiting Approval",
  delivered: "Delivered",
  error: "Needs Fix",
};

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

type AuditHeaderProps = {
  stage: AuditSessionState["stage"] | null;
  usedBudget: number;
  totalBudget: number;
  countdownSeconds: number;
  onReset: () => void;
  devMode: boolean;
  onToggleDevMode: () => void;
};

export function AuditHeader({
  stage,
  usedBudget,
  totalBudget,
  countdownSeconds,
  onReset,
  devMode,
  onToggleDevMode,
}: AuditHeaderProps) {
  const activeStepIndex = stage ? stageToStepIndex[stage] : 0;
  const spendRatio =
    totalBudget > 0 ? Math.min((usedBudget / totalBudget) * 100, 100) : 0;

  return (
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
        <button
          type="button"
          onClick={onToggleDevMode}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
            devMode
              ? "bg-amber-100 text-amber-700 border border-amber-300"
              : "bg-zinc-100 text-zinc-400 border border-zinc-200"
          }`}
        >
          {devMode ? "Dev Mode" : "Dev"}
        </button>
        {stage && (
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
            {stageBadgeLabel[stage]}
          </span>
        )}
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-50"
        >
          Reset
        </button>
      </div>
    </header>
  );
}
