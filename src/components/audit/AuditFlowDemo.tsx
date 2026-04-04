"use client";

import { AgentConfirmPanel } from "@/components/audit/AgentConfirmPanel";
import { AuditConversation } from "@/components/audit/AuditConversation";
import { AuditHeader } from "@/components/audit/AuditHeader";
import { AuditInput } from "@/components/audit/AuditInput";
import { ExecutionFlow } from "@/components/audit/ExecutionFlow";
import { WorldIdModal } from "@/components/audit/WorldIdGate";
import { useAuditFlowController } from "@/components/audit/useAuditFlowController";

const FLOW_PANEL_WIDTH_CLASS = "lg:pr-60 xl:pr-72";

export function AuditFlowDemo() {
  const controller = useAuditFlowController();

  return (
    <div className="flex h-screen flex-col bg-white">
      <AuditHeader
        stage={controller.stage}
        usedBudget={controller.usedBudget}
        totalBudget={controller.totalBudget}
        countdownSeconds={controller.countdownSeconds}
        onReset={controller.handleReset}
        devMode={controller.devMode}
        onToggleDevMode={() => controller.setDevMode((enabled) => !enabled)}
      />

      <div
        className={`flex min-h-0 flex-1 overflow-hidden ${
          controller.isFlowOpen ? FLOW_PANEL_WIDTH_CLASS : ""
        }`}
      >
        <div
          className={`flex flex-col overflow-hidden ${
            controller.showMiddlePanel
              ? "w-full md:w-[38%] xl:w-[34%] md:flex-shrink-0"
              : controller.hasSession
                ? "flex-1"
                : "w-full"
          }`}
        >
          <div className="flex-1 overflow-y-auto px-6 py-8 md:px-12">
            <AuditConversation
              sessionId={controller.sessionId}
              displayMessages={controller.displayMessages}
              stage={controller.stage}
              auditTrail={controller.session?.auditTrail ?? []}
              isTyping={controller.isTyping}
              chatEndRef={controller.chatEndRef}
            />
          </div>

          <AuditInput
            taskDescription={controller.taskDescription}
            onTaskChange={controller.setTaskDescription}
            disabled={controller.isFlowRunning && !controller.hasPendingQuestion}
            isSubmitting={controller.isSubmitting}
            onSubmit={controller.handleSubmit}
            submitError={controller.submitError}
            placeholder={controller.hasPendingQuestion ? "Reply to the agent..." : undefined}
          />
        </div>

        {controller.showMiddlePanel && (
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="h-full">
              <AgentConfirmPanel
                samples={controller.evaluatingState?.samples ?? []}
                bids={controller.evaluatingState?.bids ?? []}
                isPending={controller.isPending}
                onApprove={controller.handleApprove}
                selectedAgentId={controller.selectedAgentId}
                onSelectAgent={controller.handleSelectSample}
                onEditRequirements={controller.handleEditRequirements}
                layout="main"
              />
            </div>
          </div>
        )}
      </div>

      <aside className="fixed top-14 right-0 bottom-0 z-20 hidden items-start lg:flex">
        <button
          type="button"
          onClick={() => controller.setIsFlowOpen((open) => !open)}
          className="mt-4 inline-flex items-center rounded-l-md border border-r-0 border-zinc-200 bg-white px-2.5 py-2 text-zinc-600 hover:bg-zinc-50"
          aria-label={controller.isFlowOpen ? "Collapse execution flow" : "Expand execution flow"}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            {controller.isFlowOpen ? (
              <>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 3v14" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 7l3 3-3 3" />
              </>
            ) : (
              <>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 3v14" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l-3 3 3 3" />
              </>
            )}
          </svg>
        </button>

        {controller.isFlowOpen && (
          <div className="h-full w-60 border-l border-zinc-200 bg-zinc-50 xl:w-72">
            {controller.session ? (
              <ExecutionFlow
                state={controller.session.state}
                countdownSeconds={controller.countdownSeconds}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[11px] text-zinc-400">
                EXECUTION_FLOW_IDLE
              </div>
            )}
          </div>
        )}
      </aside>

      <WorldIdModal gate={controller.worldId} />
    </div>
  );
}
