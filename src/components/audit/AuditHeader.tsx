type AuditHeaderProps = {
  stage: string | null;
  countdownSeconds: number;
  onReset: () => void;
  devMode: boolean;
  onToggleDevMode: () => void;
};

function getStageBadge(stage: string | null, countdownSeconds: number): string | null {
  if (stage === "bidding") {
    return countdownSeconds > 0 ? `Bidding ${countdownSeconds}s` : null;
  }

  if (stage === "evaluating") {
    return "Evaluating samples";
  }

  if (stage === "delivered") {
    return "Task complete";
  }

  return null;
}

export function AuditHeader({
  stage,
  countdownSeconds,
  onReset,
  devMode,
  onToggleDevMode,
}: AuditHeaderProps) {
  const stageBadge = getStageBadge(stage, countdownSeconds);

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

      <div className="flex-1" />

      {/* Right controls */}
      <div className="ml-auto flex items-center gap-2">
        {stageBadge && (
          <span
            className={`hidden rounded-full border px-2 py-0.5 text-[10px] font-medium md:inline-flex ${
              stage === "evaluating"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : stage === "delivered"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {stageBadge}
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

        {/* HCS dashboard entry */}
        <a
          href="/hedera"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
          title="Open Agentick HCS Dashboard"
        >
          <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L4.09 12.97H11L10 22L20.91 11H14L13 2Z" />
          </svg>
          HCS Dashboard
        </a>
      </div>
    </header>
  );
}
