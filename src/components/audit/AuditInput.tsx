"use client";

type AuditInputProps = {
  taskDescription: string;
  onTaskChange: (value: string) => void;
  disabled: boolean;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitError: string | null;
  placeholder?: string;
};

export function AuditInput({
  taskDescription,
  onTaskChange,
  disabled,
  isSubmitting,
  onSubmit,
  submitError,
  placeholder,
}: AuditInputProps) {
  return (
    <div className="border-t border-zinc-100 px-6 py-4 md:px-12">
      <form
        className="mx-auto flex max-w-2xl items-center gap-2"
        onSubmit={onSubmit}
      >
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 focus-within:border-zinc-400 focus-within:bg-white">
          <input
            type="text"
            value={taskDescription}
            onChange={(e) => onTaskChange(e.target.value)}
<<<<<<< HEAD
            placeholder={placeholder ?? (disabled ? "Auction in progress..." : "Describe what you want built...")}
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

      {submitError && (
        <p className="mx-auto mt-2 max-w-2xl rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {submitError}
        </p>
      )}
    </div>
  );
}
