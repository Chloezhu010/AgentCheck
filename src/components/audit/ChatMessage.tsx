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

function Avatar() {
  return (
    <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
      A
    </div>
  );
}

function boldify(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

export function UserMessage({ id, text }: UserMessageProps) {
  return (
    <div
      key={id}
      className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="max-w-[85%] rounded-2xl bg-zinc-900 px-3.5 py-2.5 text-sm leading-relaxed text-white">
        <p>{text}</p>
      </div>
    </div>
  );
}

export function AssistantMessage({ id, text }: AssistantMessageProps) {
  return (
    <div
      key={id}
      className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <Avatar />
      <div className="max-w-[85%] rounded-2xl bg-zinc-100 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800">
        <p
          className="whitespace-pre-wrap [&>strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: boldify(text) }}
        />
      </div>
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
      className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <Avatar />
      <div className="max-w-[85%] rounded-2xl bg-zinc-100 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800">
        {message.text && (
          <p
            className="whitespace-pre-wrap [&>strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: boldify(message.text) }}
          />
        )}

        {message.kind === "scoreCanvas" && message.samples && message.samples.length > 0 && (
          <div className="mt-2 space-y-2">
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
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-start">
      <Avatar />
      <div className="rounded-2xl bg-zinc-100 px-4 py-3">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
