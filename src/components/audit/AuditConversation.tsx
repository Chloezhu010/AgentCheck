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
import type { AuditSession, OrchestratorMessage } from "@/types/audit";
import type { DisplayMessage } from "@/components/audit/useAuditFlowController";

type AuditConversationProps = {
  auditTrail: AuditSession["auditTrail"];
  chatEndRef: RefObject<HTMLDivElement | null>;
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

    const groupedMessages: OrchestratorMessage[] = [];
    while (i < displayMessages.length && displayMessages[i].source === "backend") {
      const backendMessage = displayMessages[i] as Extract<DisplayMessage, { source: "backend" }>;
      groupedMessages.push(backendMessage.msg);
      i += 1;
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
