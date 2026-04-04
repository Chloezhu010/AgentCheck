"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useWorldIdGate, WorldIdModal } from "@/components/audit/WorldIdGate";
import { WORLD_ACTIONS, worldScope } from "@/lib/world-id";
import { AuditHeader } from "@/components/audit/AuditHeader";
import { AuditInput } from "@/components/audit/AuditInput";
import { AuditTrail } from "@/components/audit/AuditTrail";
import { ExecutionFlow } from "@/components/audit/ExecutionFlow";
import { AgentConfirmPanel } from "@/components/audit/AgentConfirmPanel";
import {
  AssistantMessage,
  BackendMessage,
  OrchestratorLabel,
  TypingIndicator,
  UserMessage,
} from "@/components/audit/ChatMessage";
import type {
  AuditSession,
  AuditSessionState,
  IntentWeights,
  OrchestratorMessage,
  SampleEvaluation,
} from "@/types/audit";

const POLL_INTERVAL_MS = 1500;
const DEFAULT_BUDGET_USD = 50;
const DEFAULT_WEIGHTS: IntentWeights = { quality: 40, price: 30, speed: 30 };
const FLOW_PANEL_WIDTH_CLASS = "lg:pr-60 xl:pr-72";

type LocalMessage = {
  source: "assistant" | "user";
  id: string;
  text: string;
  ts: number;
};

type DisplayMessage = LocalMessage | { source: "backend"; msg: OrchestratorMessage };

export function AuditFlowDemo() {
  const [taskDescription, setTaskDescription] = useState("");
  const [lastSubmittedTask, setLastSubmittedTask] = useState("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<AuditSession | null>(null);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [isPending, startApprove] = useTransition();
  const [devMode, setDevMode] = useState(false);
  const [isFlowOpen, setIsFlowOpen] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isMdUp, setIsMdUp] = useState(false);
  const [hasPromptedSampleSelection, setHasPromptedSampleSelection] = useState(false);
  const worldId = useWorldIdGate();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const samplePanelRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);

  const stage = session?.state.stage ?? null;
  const hasPendingQuestion =
    session?.state.stage === "agentic" && !!session.state.pendingQuestion;
  const isAgentWorking = stage === "agentic" && !hasPendingQuestion;
  const isFlowRunning = stage === "bidding" || stage === "evaluating" || isAgentWorking;

  const totalBudget = DEFAULT_BUDGET_USD;

  const usedBudget =
    session?.state.stage === "delivered" ? session.state.quoteUsd : 0;

  const countdownSeconds =
    session?.state.stage === "bidding"
      ? (session.state as Extract<AuditSessionState, { stage: "bidding" }>).countdownSeconds
      : 0;

  const displayMessages: DisplayMessage[] = useMemo(() => {
    const backendMsgs: DisplayMessage[] = (session?.messages ?? []).map((msg) => ({
      source: "backend" as const,
      msg,
    }));

    const all: Array<DisplayMessage & { ts: number }> = [
      ...backendMsgs.map((d) => ({ ...d, ts: d.source === "backend" ? d.msg.ts : 0 })),
      ...localMessages.map((msg) => ({ ...msg, ts: msg.ts })),
    ];
    all.sort((a, b) => a.ts - b.ts);
    return all;
  }, [localMessages, session?.messages]);

  const isTyping =
    isFlowRunning &&
    session?.messages &&
    session.messages.length === prevMsgCount.current;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages.length]);

  useEffect(() => {
    prevMsgCount.current = session?.messages?.length ?? 0;
  }, [session?.messages?.length]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => setIsMdUp(event.matches);
    setIsMdUp(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!sessionId || !isFlowRunning) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let inFlightController: AbortController | null = null;

    const poll = async () => {
      inFlightController = new AbortController();

      try {
        const res = await fetch(`/api/audit/session/${sessionId}`, {
          signal: inFlightController.signal,
        });
        if (!res.ok || cancelled) return;

        const data = (await res.json()) as { session: AuditSession };
        if (!cancelled) {
          setSession(data.session);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        // silently ignore transient fetch errors
      } finally {
        inFlightController = null;
        if (!cancelled) {
          timeoutId = setTimeout(() => {
            void poll();
          }, POLL_INTERVAL_MS);
        }
      }
    };

    timeoutId = setTimeout(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      inFlightController?.abort();
    };
  }, [isFlowRunning, sessionId]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskDescription.trim()) return;

    // If a session exists and the agent is waiting for user input, chat instead
    if (sessionId && hasPendingQuestion) {
      handleChat();
      return;
    }

    handleStartAuction();
  }

  function handleChat() {
    if (!sessionId) return;

    const userText = taskDescription;
    setTaskDescription("");
    setSubmitError(null);

    const timestamp = Date.now();
    setLocalMessages((prev) => [
      ...prev,
      { source: "user", id: `user-${timestamp}`, text: userText, ts: timestamp },
    ]);

    startSubmit(async () => {
      const res = await fetch(`/api/audit/session/${sessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to send message");
        return;
      }

      setSession((data as { session: AuditSession }).session);
    });
  }

  function handleStartAuction() {
    setSubmitError(null);

    const userTask = taskDescription;
    setTaskDescription("");
    setLastSubmittedTask(userTask);
    setHasPromptedSampleSelection(false);

    const timestamp = Date.now();

    setLocalMessages((prev) => [
      ...prev,
      { source: "user", id: `user-${timestamp}`, text: userTask, ts: timestamp },
    ]);

    startSubmit(async () => {
      if (!devMode) {
        setLocalMessages((prev) => [
          ...prev,
          {
            source: "assistant",
            id: `assistant-${Date.now()}`,
            text: "Verifying your identity with World ID before opening the auction...",
            ts: Date.now(),
          },
        ]);
        try {
          await worldId.trigger({
            action: WORLD_ACTIONS.CREATE_AUDIT,
            scope: worldScope.draft(crypto.randomUUID()),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "World ID verification failed";
          setSubmitError(message);
          setLocalMessages((prev) => [
            ...prev,
            {
              source: "assistant",
              id: `assistant-${Date.now()}`,
              text: `Identity check failed: ${message}`,
              ts: Date.now(),
            },
          ]);
          return;
        }
      }

      const res = await fetch("/api/audit/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskDescription: userTask,
          budgetUsd: totalBudget,
          weights: DEFAULT_WEIGHTS,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to start auction");
        return;
      }

      const { sessionId: newId, session: newSession } = data as {
        sessionId: string;
        session: AuditSession;
      };

      setSessionId(newId);
      setSession(newSession);
    });
  }

  function handleApprove(sample: SampleEvaluation) {
    if (stage !== "evaluating" || !sessionId) return;

    setLocalMessages((prev) => [
      ...prev,
      {
        source: "user",
        id: `user-${Date.now()}`,
        text: `Approve ${sample.agentName}`,
        ts: Date.now(),
      },
    ]);

    startApprove(async () => {
      if (!devMode) {
        setLocalMessages((prev) => [
          ...prev,
          {
            source: "assistant",
            id: `assistant-${Date.now()}`,
            text: "Verifying your identity with World ID before releasing payment...",
            ts: Date.now(),
          },
        ]);
        try {
          await worldId.trigger({
            action: WORLD_ACTIONS.APPROVE_PAYMENT,
            scope: worldScope.audit(sessionId),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "World ID verification failed";
          setLocalMessages((prev) => [
            ...prev,
            {
              source: "assistant",
              id: `assistant-${Date.now()}`,
              text: `Identity check failed: ${message}`,
              ts: Date.now(),
            },
          ]);
          return;
        }
      }

      const res = await fetch(`/api/audit/session/${sessionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: sample.agentId }),
      });

      const data = await res.json();
      if (!res.ok) return;

      setSession((data as { session: AuditSession }).session);
    });
  }

  function handleReset() {
    setSessionId(null);
    setSession(null);
    setLocalMessages([]);
    setSubmitError(null);
    prevMsgCount.current = 0;
    setSelectedAgentId(null);
    setHasPromptedSampleSelection(false);
  }

  function handleEditRequirements() {
    handleReset();
    if (lastSubmittedTask) {
      setTaskDescription(lastSubmittedTask);
    }
  }

  function handleSelectSample(agentId: string) {
    setSelectedAgentId(agentId);
  }

  const hasSession = !!session;
  const evaluatingState = session?.state.stage === "evaluating" ? session.state : null;
  const hasSamplesReady = stage === "evaluating" && !!evaluatingState && evaluatingState.samples.length > 0;
  const showMiddlePanel = hasSamplesReady && isMdUp;

  useEffect(() => {
    if (!evaluatingState || evaluatingState.samples.length === 0) return;
    if (!selectedAgentId || !evaluatingState.samples.some((s) => s.agentId === selectedAgentId)) {
      setSelectedAgentId(evaluatingState.samples[0].agentId);
    }
  }, [evaluatingState, selectedAgentId]);

  useEffect(() => {
    if (!hasSamplesReady || hasPromptedSampleSelection) return;
    setLocalMessages((prev) => [
      ...prev,
      {
        source: "assistant",
        id: `assistant-${Date.now()}`,
        text: "Please choose one sample in the Sample Area, then confirm to continue.",
        ts: Date.now(),
      },
    ]);
    setHasPromptedSampleSelection(true);
  }, [hasPromptedSampleSelection, hasSamplesReady]);

  return (
    <div className="flex h-screen flex-col bg-white">
      <AuditHeader
        stage={stage}
        usedBudget={usedBudget}
        totalBudget={totalBudget}
        countdownSeconds={countdownSeconds}
        onReset={handleReset}
        devMode={devMode}
        onToggleDevMode={() => setDevMode((d) => !d)}
      />

      {/* Main body: chat + optional execution flow panel */}
      <div
        className={`flex min-h-0 flex-1 overflow-hidden ${
          isFlowOpen ? FLOW_PANEL_WIDTH_CLASS : ""
        }`}
      >
        {/* Chat column */}
        <div
          className={`flex flex-col overflow-hidden ${
            showMiddlePanel
              ? "w-full md:w-[38%] xl:w-[34%] md:flex-shrink-0"
              : hasSession
                ? "flex-1"
                : "w-full"
          }`}
        >
          <div className="flex-1 overflow-y-auto px-6 py-8 md:px-12">
            <div className="mx-auto max-w-2xl space-y-6">
              {!sessionId && (
                <div>
                  <OrchestratorLabel />
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Ready. Describe a task to start the auction pipeline.
                  </p>
                </div>
              )}

              {(() => {
                const nodes: React.ReactNode[] = [];
                let i = 0;
                while (i < displayMessages.length) {
                  const dm = displayMessages[i];

                  if (dm.source === "user") {
                    nodes.push(<UserMessage key={dm.id} id={dm.id} text={dm.text} />);
                    i += 1;
                    continue;
                  }

                  if (dm.source === "assistant") {
                    nodes.push(<AssistantMessage key={dm.id} id={dm.id} text={dm.text} />);
                    i += 1;
                    continue;
                  }

                  const grouped: OrchestratorMessage[] = [];
                  while (i < displayMessages.length && displayMessages[i].source === "backend") {
                    const backend = displayMessages[i] as Extract<DisplayMessage, { source: "backend" }>;
                    grouped.push(backend.msg);
                    i += 1;
                  }

                  nodes.push(
                    <BackendMessage
                      key={`backend-group-${grouped[0]?.id ?? i}`}
                      messages={grouped}
                      canApprove={stage === "evaluating"}
                      isPending={isPending}
                      onApprove={handleApprove}
                    />,
                  );
                }
                return nodes;
              })()}

              {stage === "delivered" && <AuditTrail events={session?.auditTrail ?? []} />}

              {isTyping && (
                <div>
                  <OrchestratorLabel />
                  <TypingIndicator />
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          <AuditInput
            taskDescription={taskDescription}
            onTaskChange={setTaskDescription}
            disabled={isFlowRunning && !hasPendingQuestion}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            submitError={submitError}
            placeholder={hasPendingQuestion ? "Reply to the agent..." : undefined}
          />
        </div>

        {/* Middle detail panel */}
        {showMiddlePanel && (
          <div ref={samplePanelRef} className="hidden min-w-0 flex-1 md:block">
            <div className="h-full">
              <AgentConfirmPanel
                samples={evaluatingState?.samples ?? []}
                bids={evaluatingState?.bids ?? []}
                isPending={isPending}
                onApprove={handleApprove}
                selectedAgentId={selectedAgentId}
                onSelectAgent={handleSelectSample}
                onEditRequirements={handleEditRequirements}
                layout="main"
              />
            </div>
          </div>
        )}
      </div>

      <aside className="fixed top-14 right-0 bottom-0 z-20 hidden items-start lg:flex">
        <button
          type="button"
          onClick={() => setIsFlowOpen((open) => !open)}
          className="mt-4 inline-flex items-center rounded-l-md border border-r-0 border-zinc-200 bg-white px-2.5 py-2 text-zinc-600 hover:bg-zinc-50"
          aria-label={isFlowOpen ? "Collapse execution flow" : "Expand execution flow"}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            {isFlowOpen ? (
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

        {isFlowOpen && (
          <div className="h-full w-60 border-l border-zinc-200 bg-zinc-50 xl:w-72">
            {session ? (
              <ExecutionFlow
                state={session.state}
                countdownSeconds={countdownSeconds}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[11px] text-zinc-400">
                EXECUTION_FLOW_IDLE
              </div>
            )}
          </div>
        )}
      </aside>

      <WorldIdModal gate={worldId} />
    </div>
  );
}
