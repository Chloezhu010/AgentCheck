type AuditHeaderProps = {
  stage: string | null;
  usedBudget: number;
  totalBudget: number;
  countdownSeconds: number;
  onReset: () => void;
  devMode: boolean;
  onToggleDevMode: () => void;
};

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function AuditHeader({
  stage,
  usedBudget,
  totalBudget,
  countdownSeconds,
  onReset,
  devMode,
  onToggleDevMode,
}: AuditHeaderProps) {
  return (
    <header className="flex items-center border-b border-zinc-100 px-5 py-3">
      {/* Logo */}
      <div className="flex items-center gap-2 min-w-0">
        <svg
          className="h-5 w-5 flex-shrink-0 text-emerald-500"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M13 2L4.09 12.97H11L10 22L20.91 11H14L13 2Z" />
        </svg>
        <span className="font-bold tracking-widest text-sm text-zinc-900 uppercase">
          Agentick
        </span>
      </div>

      {/* Center: status */}
      <div className="flex flex-1 items-center justify-center gap-3">
        {stage === "bidding" && (
          <span className="text-xs text-amber-600">Bidding ends in {countdownSeconds}s</span>
        )}

        {stage === "evaluating" && (
          <span className="text-xs text-blue-600 animate-pulse">Evaluating samples...</span>
        )}

        {stage === "delivered" && (
          <span className="text-xs text-emerald-600">Task complete</span>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {totalBudget > 0 && (
          <span className="font-mono text-[11px] text-zinc-400">
            {formatUsd(usedBudget)}/{formatUsd(totalBudget)}
          </span>
        )}

        <button
          type="button"
          onClick={onToggleDevMode}
          className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors border ${
            devMode
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-zinc-200 bg-zinc-50 text-zinc-400"
          }`}
        >
          DEV
        </button>

        {stage && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-500 hover:bg-zinc-50"
          >
            RESET
          </button>
        )}

        {/* Audit trail icon button */}
        <a
          href="/hedera"
          className="flex items-center justify-center rounded-md bg-emerald-500 p-1.5 text-white hover:bg-emerald-600"
          title="Hedera Audit Trail"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h6M9 12h6M9 15h4" />
          </svg>
        </a>
      </div>
    </header>
  );
}
