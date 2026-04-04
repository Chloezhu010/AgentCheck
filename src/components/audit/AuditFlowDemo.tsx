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
  IntakeSpec,
  IntentWeights,
  OrchestratorMessage,
  SampleEvaluation,
} from "@/types/audit";

const POLL_INTERVAL_MS = 1500;

type LocalMessage = {
  source: "assistant" | "user";
  id: string;
  text: string;
  ts: number;
};

type DisplayMessage = LocalMessage | { source: "backend"; msg: OrchestratorMessage };

export function AuditFlowDemo() {
  const [inputText, setInputText] = useState("");

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
  const isFlowRunning = stage === "bidding" || stage === "evaluating";

  const extractedSpec: IntakeSpec | null =
    session?.state.stage === "intake" ? session.state.extractedSpec : null;

  const totalBudget = extractedSpec?.budgetUsd ?? session?.input.budgetUsd ?? 0;

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

  // Polling — only during bidding/evaluating (intake uses request/response, not polling)
  useEffect(() => {
    if (!sessionId || stage === "delivered" || stage === "error" || stage === "intake" || !stage) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/audit/session/${sessionId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { session: AuditSession };
        setSession(data.session);
      } catch {
        // silently ignore transient fetch errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [sessionId, stage]);

  // Input disabled when: flow is running (bidding/evaluating), or spec is extracted (waiting for confirm)
  const inputDisabled = isFlowRunning || stage === "delivered" || !!extractedSpec;

  const inputRef = useRef<HTMLInputElement>(null);

  // Get suggestion options from the last backend message (only during intake, before spec)
  const suggestionOptions = useMemo(() => {
    if (stage !== "intake" || extractedSpec) return null;
    const backendMsgs = session?.messages ?? [];
    const lastMsg = backendMsgs[backendMsgs.length - 1];
    return lastMsg?.options ?? null;
  }, [session?.messages, stage, extractedSpec]);

  function sendMessage(text: string) {
    setSubmitError(null);

    const timestamp = Date.now();
    setLocalMessages((prev) => [
      ...prev,
      { source: "user", id: `user-${timestamp}`, text, ts: timestamp },
    ]);

    if (!sessionId) {
      startSubmit(async () => {
        const res = await fetch("/api/audit/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initialMessage: text }),
        });

        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error ?? "Failed to start session");
          return;
        }

        const { sessionId: newId, session: newSession } = data as {
          sessionId: string;
          session: AuditSession;
        };
        setSessionId(newId);
        setSession(newSession);
      });
    } else {
      startSubmit(async () => {
        const res = await fetch(`/api/audit/session/${sessionId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error ?? "Failed to send message");
          return;
        }

        setSession((data as { session: AuditSession }).session);
      });
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText("");
    sendMessage(text);
  }

  function handleOptionClick(option: string) {
    if (isSubmitting) return;
    sendMessage(option);
  }

  function handleWildcardClick() {
    inputRef.current?.focus();
  }

  function handleConfirmSpec() {
    if (!sessionId || !extractedSpec) return;

    startSubmit(async () => {
      // World ID verification before funds are escrowed
      if (!devMode) {
        setLocalMessages((prev) => [
          ...prev,
          {
            source: "assistant",
            id: `assistant-${Date.now()}`,
            text: "Verifying your identity with World ID before escrowing funds...",
            ts: Date.now(),
          },
        ]);
        try {
          await worldId.trigger({
            action: WORLD_ACTIONS.CREATE_AUDIT,
            scope: worldScope.draft(sessionId),
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

      // Confirm spec → transition to bidding
      const res = await fetch(`/api/audit/session/${sessionId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to confirm spec");
        return;
      }

      setSession((data as { session: AuditSession }).session);
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
              text="Hi! I'm AgentCheck's orchestrator. Tell me what you need built and I'll find the best AI agents for the job."
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

      {/* Confirm spec bar — shown when spec is extracted but not yet confirmed */}
      {extractedSpec && (
        <div className="border-t border-zinc-100 px-4 py-3 md:px-6">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">
              Ready to open the auction — <strong>${extractedSpec.budgetUsd * (extractedSpec.trialPercent / 100)}</strong> will be escrowed for the trial.
            </p>
            <button
              type="button"
              onClick={handleConfirmSpec}
              disabled={isSubmitting}
              className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
            >
              {isSubmitting ? "Verifying..." : "Start Auction"}
            </button>
          </div>
        </div>
      )}

      {/* Suggestion chips — shown during intake when orchestrator proposes options */}
      {suggestionOptions && !isSubmitting && (
        <div className="border-t border-zinc-50 px-4 pt-2 md:px-6">
          <div className="mx-auto flex max-w-2xl flex-wrap gap-2">
            {suggestionOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleOptionClick(option)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              onClick={handleWildcardClick}
              className="rounded-full border border-dashed border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-600"
            >
              Something else…
            </button>
          </div>
        </div>
      )}

      {/* Regular input — hidden when spec is extracted (confirm bar replaces it) */}
      {!extractedSpec && (
        <AuditInput
          inputRef={inputRef}
          taskDescription={inputText}
          onTaskChange={setInputText}
          disabled={inputDisabled}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          submitError={submitError}
        />
      )}

      <WorldIdModal gate={worldId} />
    </div>
  );
}
