import {
  AssistantMessage,
  BackendMessage,
  OrchestratorLabel,
  TypingIndicator,
  UserMessage,
} from "@/components/audit/ChatMessage";
import { IdleHero } from "@/components/audit/IdleHero";
import { AuditTrail } from "@/components/audit/AuditTrail";
import type { RefObject, ReactNode } from "react";
import type { AuditSession, DeliveryReport, OrchestratorMessage } from "@/types/audit";
import type { DisplayMessage } from "@/components/audit/useAuditFlowController";

type AuditConversationProps = {
  auditTrail: AuditSession["auditTrail"];
  chatEndRef: RefObject<HTMLDivElement | null>;
  delivery: DeliveryReport | null;
  displayMessages: DisplayMessage[];
  isTyping: boolean;
  onPickPrompt: (prompt: string) => void;
  sessionId: string | null;
  stage: AuditSession["state"]["stage"] | null;
  taskDescription: string;
};

export function AuditConversation({
  auditTrail,
  chatEndRef,
  delivery,
  displayMessages,
  isTyping,
  onPickPrompt,
  sessionId,
  stage,
  taskDescription,
}: AuditConversationProps) {
  const showIdleHero = !sessionId && displayMessages.length === 0 && !taskDescription.trim();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {showIdleHero && <IdleHero onPickPrompt={onPickPrompt} />}

      {!sessionId && !showIdleHero && (
        <div>
          <OrchestratorLabel />
          <p className="text-xs leading-relaxed text-zinc-500">
            Ready. Describe a task to start the auction pipeline.
          </p>
        </div>
      )}

      {renderConversationMessages(displayMessages)}

      {stage === "delivered" && delivery && <DeliveryShowcase delivery={delivery} />}
      {stage === "delivered" && <AuditTrail events={auditTrail} />}

      {isTyping && (
        <div>
          <OrchestratorLabel />
          <TypingIndicator />
        </div>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}

function DeliveryShowcase({ delivery }: { delivery: DeliveryReport }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <OrchestratorLabel />
      <div className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 text-sm text-zinc-800">
        <p className="text-xs font-semibold text-zinc-900">{delivery.title}</p>

        {delivery.taskKind === "four-panel-comic" && delivery.comicFrames && delivery.comicFrames.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {delivery.comicFrames.map((frame) => (
              <div key={`panel-${frame.panelNumber}`} className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                <div className="border-b border-zinc-200 px-2 py-1">
                  <p className="text-[10px] font-semibold text-zinc-700">
                    Panel {frame.panelNumber}
                  </p>
                  <p className="line-clamp-1 text-[10px] text-zinc-500">{frame.beat}</p>
                </div>
                <img
                  src={frame.imageDataUrl}
                  alt={`Comic panel ${frame.panelNumber}`}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        )}

        {delivery.taskKind !== "four-panel-comic" && delivery.imageDataUrl && (
          <img src={delivery.imageDataUrl} alt="Delivery output" className="mt-3 w-full rounded-lg border border-zinc-200" />
        )}

        {delivery.generatorNotes && (
          <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-zinc-600">
            {delivery.generatorNotes}
          </p>
        )}

        {delivery.highlights.length > 0 && (
          <div className="mt-3 space-y-1">
            {delivery.highlights.map((highlight, idx) => (
              <p key={`${idx}-${highlight.slice(0, 20)}`} className="text-xs text-zinc-600">
                • {highlight}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderConversationMessages(displayMessages: DisplayMessage[]): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;

  while (i < displayMessages.length) {
    const displayMessage = displayMessages[i];

    if (displayMessage.source === "user") {
      nodes.push(<UserMessage key={displayMessage.id} id={displayMessage.id} text={displayMessage.text} />);
      i += 1;
      continue;
    }

    if (displayMessage.source === "assistant") {
      nodes.push(
        <AssistantMessage key={displayMessage.id} id={displayMessage.id} text={displayMessage.text} />,
      );
      i += 1;
      continue;
    }

    if (displayMessage.source !== "backend") {
      i += 1;
      continue;
    }

    const backendCurrent = displayMessage.msg;
    if (backendCurrent.kind === "text" || backendCurrent.kind === "thought") {
      nodes.push(
        <AssistantMessage
          key={backendCurrent.id}
          id={backendCurrent.id}
          text={backendCurrent.text}
        />,
      );
      i += 1;
      continue;
    }

    const groupedMessages: OrchestratorMessage[] = [];
    while (i < displayMessages.length) {
      const candidate = displayMessages[i];
      if (candidate.source !== "backend") break;
      if (candidate.msg.kind === "text" || candidate.msg.kind === "thought") break;

      groupedMessages.push(candidate.msg);
      i += 1;
    }

    if (groupedMessages.length === 0) {
      i += 1;
      continue;
    }

    nodes.push(
      <BackendMessage
        key={`backend-group-${groupedMessages[0]?.id ?? i}`}
        messages={groupedMessages}
      />,
    );
  }

  return nodes;
}
