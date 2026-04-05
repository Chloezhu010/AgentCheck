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
  const thumbnail =
    delivery.taskKind === "four-panel-comic"
      ? delivery.comicFrames?.[0]?.imageDataUrl
      : delivery.imageDataUrl;
  const fileGuide = [thumbnail ? "final-output.png" : "final-output.txt"];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <OrchestratorLabel />
      <div className="max-w-[95%] rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 text-sm text-zinc-800">
        <p className="text-xs font-semibold text-zinc-900">{delivery.title}</p>
        <div className="mt-3 flex items-start gap-3">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt="Delivery thumbnail"
              className="h-16 w-16 flex-shrink-0 rounded-md border border-zinc-200 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-[10px] text-zinc-400">
              No image
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs text-zinc-700">Delivery files are ready.</p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Open the middle <span className="font-semibold text-zinc-700">Delivery Area</span> for full preview and downloads.
            </p>
            <p className="mt-2 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">Files</p>
            <p className="mt-1 text-[11px] text-zinc-500">{fileGuide.join(" · ")}</p>
          </div>
        </div>
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
