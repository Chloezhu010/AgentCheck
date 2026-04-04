"use client";

import type { IntentWeights } from "@/types/audit";

const weightControls: Array<{ key: keyof IntentWeights; label: string }> = [
  { key: "quality", label: "Quality" },
  { key: "price", label: "Price" },
  { key: "speed", label: "Speed" },
];

type AuditInputProps = {
  taskDescription: string;
  onTaskChange: (value: string) => void;
  disabled: boolean;
  isSubmitting: boolean;
  showSettings: boolean;
  onToggleSettings: () => void;
  budgetUsd: string;
  onBudgetChange: (value: string) => void;
  weights: IntentWeights;
  weightPercentages: Record<keyof IntentWeights, number>;
  onWeightChange: (key: keyof IntentWeights, value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitError: string | null;
};

export function AuditInput({
  taskDescription,
  onTaskChange,
  disabled,
  isSubmitting,
  showSettings,
  onToggleSettings,
  budgetUsd,
  onBudgetChange,
  weights,
  weightPercentages,
  onWeightChange,
  onSubmit,
  submitError,
}: AuditInputProps) {
  return (
    <div className="border-t border-zinc-100 px-6 py-4 md:px-12">
      <form
        className="mx-auto flex max-w-2xl items-center gap-2"
        onSubmit={onSubmit}
      >
        <button
          type="button"
          onClick={onToggleSettings}
          className="flex-shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          title="Budget & weights"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
        </button>

        <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 focus-within:border-zinc-400 focus-within:bg-white">
          <span className="flex-shrink-0 font-mono text-xs text-zinc-300">//</span>
          <input
            type="text"
            value={taskDescription}
            onChange={(e) => onTaskChange(e.target.value)}
            placeholder={disabled ? "AUCTION_IN_PROGRESS..." : "ENTER_TASK_PROMPT..."}
            disabled={disabled || isSubmitting}
            className="flex-1 bg-transparent font-mono text-xs text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={disabled || isSubmitting || !taskDescription.trim()}
          className="flex-shrink-0 rounded-md bg-emerald-500 p-2 text-white hover:bg-emerald-600 disabled:opacity-40"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </form>

      {showSettings && (
        <div className="mx-auto mt-2 max-w-2xl rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-600">Budget $</span>
              <input
                type="number"
                min={1}
                step="1"
                value={budgetUsd}
                onChange={(e) => onBudgetChange(e.target.value)}
                className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500"
              />
            </label>
            {weightControls.map((item) => (
              <label key={item.key} className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-500">
                  {item.label} {weightPercentages[item.key]}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights[item.key]}
                  onChange={(e) => onWeightChange(item.key, e.target.value)}
                  className="h-1 w-16 accent-zinc-900"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {submitError && (
        <p className="mx-auto mt-2 max-w-2xl rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {submitError}
        </p>
      )}
    </div>
  );
}
