import type { OrchestratorMessage, SampleEvaluation } from "@/types/audit";
import { ScoreCard } from "@/components/audit/ScoreCard";

type UserMessageProps = { id: string; text: string };
type AssistantMessageProps = { id: string; text: string };
type BackendMessageProps = {
  message: OrchestratorMessage;
  canApprove: boolean;
  isPending: boolean;
  onApprove: (sample: SampleEvaluation) => void;
  compactSamples?: boolean;
  onOpenDetails?: (agentId: string) => void;
};

function boldify(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

export function UserMessage({ id, text }: UserMessageProps) {
  return (
    <div key={id} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
        You
      </p>
      <p className="text-sm leading-relaxed text-zinc-900">{text}</p>
    </div>
  );
}

export function AssistantMessage({ id, text }: AssistantMessageProps) {
  return (
    <div key={id} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
        Orchestrator
      </p>
      <p
        className="font-mono text-xs leading-relaxed text-zinc-500"
        dangerouslySetInnerHTML={{ __html: boldify(text) }}
      />
    </div>
  );
}

export function BackendMessage({
  message,
  canApprove,
  isPending,
  onApprove,
  compactSamples = false,
  onOpenDetails,
}: BackendMessageProps) {
  // Tool calls render as compact action pills, not full chat bubbles
  if (message.kind === "toolCall") {
    return (
      <div
        key={message.id}
        className="flex items-center gap-2 pl-8 animate-in fade-in duration-200"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
        <span
          className="text-[11px] text-zinc-400"
          dangerouslySetInnerHTML={{ __html: boldify(message.text) }}
        />
      </div>
    );
  }

  // Regular text message
  if (!message.text && !(message.kind === "scoreCanvas" && message.samples?.length)) return null;

  return (
    <div
      key={message.id}
      className="animate-in fade-in slide-in-from-bottom-1 duration-200"
    >
      {message.text && (
        <p
          className="font-mono text-xs leading-relaxed text-zinc-500 [&>strong]:font-semibold [&>strong]:text-zinc-800"
          dangerouslySetInnerHTML={{ __html: boldify(message.text) }}
        />
      )}

      {message.options && message.options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {message.options.map((opt) => (
            <span
              key={opt}
              className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-zinc-600"
            >
              {opt}
            </span>
          ))}
        </div>
      )}

      {message.kind === "scoreCanvas" && message.samples && message.samples.length > 0 && (
        <div className="mt-3 space-y-2">
          {message.samples.map((sample) => (
            <ScoreCard
              key={sample.id}
              sample={sample}
              canApprove={canApprove}
              isPending={isPending}
              onApprove={onApprove}
              compact={compactSamples}
              onOpenDetails={onOpenDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrchestratorLabel() {
  return (
    <p className="mb-1.5 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
      Orchestrator
    </p>
  );
}

export function TypingIndicator() {
  return (
    <div className="animate-in fade-in duration-200">
      <p className="font-mono text-xs text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          // PROCESSING...
        </span>
      </p>
    </div>
  );
}
