import type { OrchestratorMessage, SampleEvaluation } from "@/types/audit";
import { ScoreCard } from "@/components/audit/ScoreCard";

type UserMessageProps = { id: string; text: string };
type AssistantMessageProps = { id: string; text: string };
type BackendMessageProps = {
  message: OrchestratorMessage;
  canApprove: boolean;
  isPending: boolean;
  onApprove: (sample: SampleEvaluation) => void;
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
}: BackendMessageProps) {
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

      {message.kind === "scoreCanvas" && message.samples && message.samples.length > 0 && (
        <div className="mt-3 space-y-2">
          {message.samples.map((sample) => (
            <ScoreCard
              key={sample.id}
              sample={sample}
              canApprove={canApprove}
              isPending={isPending}
              onApprove={onApprove}
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
