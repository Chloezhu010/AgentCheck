import type { OrchestratorMessage, SampleEvaluation } from "@/types/audit";

type UserMessageProps = { id: string; text: string };
type AssistantMessageProps = { id: string; text: string };
type BackendMessageProps = {
  messages: OrchestratorMessage[];
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
      <p className="mb-1 text-right text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
        You
      </p>
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-900 px-3.5 py-2.5 text-sm leading-relaxed text-white">
        {text}
      </div>
    </div>
  );
}

export function AssistantMessage({ id, text }: AssistantMessageProps) {
  return (
    <div key={id} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
        Agent
      </p>
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800">
        <p
          className="[&>strong]:font-semibold [&>strong]:text-zinc-900"
          dangerouslySetInnerHTML={{ __html: boldify(text) }}
        />
      </div>
    </div>
  );
}

export function BackendMessage({
  messages,
  canApprove,
  isPending,
  onApprove,
}: BackendMessageProps) {
  if (messages.length === 0) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
        <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
          Agent Activity
        </p>
        <div className="space-y-2">
          {messages.map((message) => (
            <div key={message.id}>
              {message.kind === "toolCall" ? (
                <div className="flex items-center gap-2 pl-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                  <span
                    className="text-[11px] text-zinc-500"
                    dangerouslySetInnerHTML={{ __html: boldify(message.text) }}
                  />
                </div>
              ) : message.text ? (
                <p
                  className="font-mono text-xs leading-relaxed text-zinc-600 [&>strong]:font-semibold [&>strong]:text-zinc-800"
                  dangerouslySetInnerHTML={{ __html: boldify(message.text) }}
                />
              ) : null}

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
                <div className="mt-2 space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
                  <p className="text-[11px] font-medium text-zinc-700">Samples received:</p>
                  {message.samples.map((sample, idx) => {
                    const scorePercent = Math.round(sample.score * 100);
                    return (
                      <div key={sample.id} className="text-[11px] text-zinc-600">
                        <span className="font-semibold text-zinc-800">{sample.agentName}</span>
                        {idx === 0 && (
                          <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-700">
                            Recommended
                          </span>
                        )}
                        <span className="ml-2 text-zinc-500">
                          {scorePercent > 0 ? `${scorePercent}/100` : "Scoring..."}
                        </span>
                        <p className="mt-0.5 line-clamp-2 text-zinc-500">{sample.recommendation}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
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
