"use client";

import type { RefObject } from "react";

type AuditInputProps = {
  inputRef?: RefObject<HTMLInputElement | null>;
  taskDescription: string;
  onTaskChange: (value: string) => void;
  disabled: boolean;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitError: string | null;
};

export function AuditInput({
  inputRef,
  taskDescription,
  onTaskChange,
  disabled,
  isSubmitting,
  onSubmit,
  submitError,
}: AuditInputProps) {
  return (
    <div className="border-t border-zinc-100 px-4 py-3 md:px-6">
      <form
        className="mx-auto flex max-w-2xl items-end gap-2"
        onSubmit={onSubmit}
      >
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={taskDescription}
            onChange={(e) => onTaskChange(e.target.value)}
            placeholder={disabled ? "Auction in progress..." : "Describe a task to audit..."}
            disabled={disabled || isSubmitting}
            className="w-full rounded-xl border border-zinc-300 bg-zinc-50 py-2.5 pl-3 pr-20 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white disabled:opacity-50"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            <button
              type="submit"
              disabled={disabled || isSubmitting || !taskDescription.trim()}
              className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
            >
              {isSubmitting ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </form>

      {submitError && (
        <p className="mx-auto mt-2 max-w-2xl rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {submitError}
        </p>
      )}
    </div>
  );
}
