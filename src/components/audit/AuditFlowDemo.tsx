"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { normalizeWeights } from "@/lib/audit-demo-data";
import { useWorldIdGate, WorldIdModal } from "@/components/audit/WorldIdGate";
import { WORLD_ACTIONS, worldScope } from "@/lib/world-id";
import { AuditHeader } from "@/components/audit/AuditHeader";
import { AuditInput } from "@/components/audit/AuditInput";
import { AuditTrail } from "@/components/audit/AuditTrail";
import {
  AssistantMessage,
  BackendMessage,
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

const defaultWeights: IntentWeights = { quality: 40, price: 30, speed: 30 };

type LocalMessage = {
  source: "assistant" | "user";
  id: string;
  text: string;
  ts: number;
};

type DisplayMessage = LocalMessage | { source: "backend"; msg: OrchestratorMessage };

export function AuditFlowDemo() {
  const [taskDescription, setTaskDescription] = useState("");
  const [budgetUsd, setBudgetUsd] = useState("50");
  const [weights, setWeights] = useState<IntentWeights>(defaultWeights);
  const [showSettings, setShowSettings] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<AuditSession | null>(null);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [isPending, startApprove] = useTransition();
  const [devMode, setDevMode] = useState(false);
  const worldId = useWorldIdGate();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);

  const stage = session?.state.stage ?? null;
  const hasPendingQuestion =
    session?.state.stage === "agentic" && !!session.state.pendingQuestion;
  const isAgentWorking = stage === "agentic" && !hasPendingQuestion;
  const isFlowRunning = stage === "bidding" || stage === "evaluating" || isAgentWorking;

  const parsedBudget = Number.parseFloat(budgetUsd);
  const totalBudget = Number.isNaN(parsedBudget) ? 0 : parsedBudget;

  const usedBudget =
    session?.state.stage === "delivered" ? session.state.quoteUsd : 0;

  const countdownSeconds =
    session?.state.stage === "bidding"
      ? (session.state as Extract<AuditSessionState, { stage: "bidding" }>).countdownSeconds
      : 0;

  const normalizedWeights = useMemo(() => normalizeWeights(weights), [weights]);
  const weightPercentages = useMemo(
    () => ({
      quality: Math.round(normalizedWeights.quality * 100),
      price: Math.round(normalizedWeights.price * 100),
      speed: Math.round(normalizedWeights.speed * 100),
    }),
    [normalizedWeights],
  );

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
          weights,
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

  function handleWeightChange(key: keyof IntentWeights, rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10);
    setWeights((w) => ({ ...w, [key]: Number.isNaN(parsed) ? 0 : parsed }));
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
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <AuditHeader
        stage={stage}
        usedBudget={usedBudget}
        totalBudget={totalBudget}
        countdownSeconds={countdownSeconds}
        onReset={handleReset}
        devMode={devMode}
        onToggleDevMode={() => setDevMode((d) => !d)}
      />

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="mx-auto max-w-2xl space-y-3">
          {!sessionId && (
            <AssistantMessage
              id="welcome"
              text="Hi! I'm AgentCheck. Describe a task and I'll run the full auction, scoring, and audit pipeline for you."
            />
          )}

          {displayMessages.map((dm) => {
            if (dm.source === "user") {
              return <UserMessage key={dm.id} id={dm.id} text={dm.text} />;
            }
            if (dm.source === "assistant") {
              return <AssistantMessage key={dm.id} id={dm.id} text={dm.text} />;
            }
            const backend = dm as Extract<DisplayMessage, { source: "backend" }>;
            return (
              <BackendMessage
                key={backend.msg.id}
                message={backend.msg}
                canApprove={stage === "evaluating"}
                isPending={isPending}
                onApprove={handleApprove}
              />
            );
          })}

          {stage === "delivered" && <AuditTrail events={session?.auditTrail ?? []} />}

          {isTyping && <TypingIndicator />}

          <div ref={chatEndRef} />
        </div>
      </div>

      <AuditInput
        taskDescription={taskDescription}
        onTaskChange={setTaskDescription}
        disabled={isFlowRunning && !hasPendingQuestion}
        isSubmitting={isSubmitting}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        budgetUsd={budgetUsd}
        onBudgetChange={setBudgetUsd}
        weights={weights}
        weightPercentages={weightPercentages}
        onWeightChange={handleWeightChange}
        onSubmit={handleSubmit}
        submitError={submitError}
        placeholder={hasPendingQuestion ? "Reply to the agent..." : undefined}
      />

      <WorldIdModal gate={worldId} />
    </div>
  );
}
