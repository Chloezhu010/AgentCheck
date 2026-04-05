"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useWorldIdGate } from "@/components/audit/WorldIdGate";
import { WORLD_ACTIONS, worldScope } from "@/lib/world-id";
import type {
  AgentBid,
  AuditSession,
  AuditSessionState,
  IntentWeights,
  OrchestratorMessage,
  SampleEvaluation,
} from "@/types/audit";

const POLL_INTERVAL_MS = 1500;
const DEFAULT_BUDGET_USD = 50;
const DEFAULT_WEIGHTS: IntentWeights = { quality: 40, price: 30, speed: 30 };

type LocalMessage = {
  source: "assistant" | "user";
  id: string;
  text: string;
  ts: number;
};

export type DisplayMessage = LocalMessage | { source: "backend"; msg: OrchestratorMessage };

export function useAuditFlowController() {
  const [taskDescription, setTaskDescription] = useState("");
  const [lastSubmittedTask, setLastSubmittedTask] = useState("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<AuditSession | null>(null);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [isPending, startApprove] = useTransition();
  const [devMode, setDevMode] = useState(true);
  const [isFlowOpen, setIsFlowOpen] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [fileSamples, setFileSamples] = useState<SampleEvaluation[]>([]);
  const [fileBids, setFileBids] = useState<AgentBid[]>([]);
  const [isSampleDetailsOpen, setIsSampleDetailsOpen] = useState(false);
  const [isMdUp, setIsMdUp] = useState(false);
  const [hasPromptedSampleSelection, setHasPromptedSampleSelection] = useState(false);
  const worldId = useWorldIdGate();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);

  const stage = session?.state.stage ?? null;
  const hasPendingQuestion = !!session?.pendingQuestion;
  const isAgentWorking = stage === "agentic" && !hasPendingQuestion;
  const isFlowRunning = stage === "bidding" || stage === "evaluating" || isAgentWorking;

  const totalBudget = DEFAULT_BUDGET_USD;
  const usedBudget = session?.state.stage === "delivered" ? session.state.quoteUsd : 0;

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

  const isTyping = Boolean(
    isFlowRunning &&
      session?.messages &&
      session.messages.length === prevMsgCount.current,
  );

  const hasSession = !!session;
  const biddingState = session?.state.stage === "bidding" ? session.state : null;
  const evaluatingState = session?.state.stage === "evaluating" ? session.state : null;
  const hasSamplesReady = !!evaluatingState && evaluatingState.samples.length > 0;
  const hasFiles = fileSamples.length > 0;
  const middlePanelMode = !isMdUp
    ? null
    : biddingState
      ? ("groupChat" as const)
      : hasSamplesReady || (hasFiles && isSampleDetailsOpen)
        ? ("samples" as const)
        : null;
  const showMiddlePanel = middlePanelMode !== null;

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

  useEffect(() => {
    if (!evaluatingState || evaluatingState.samples.length === 0) return;
    setFileSamples(evaluatingState.samples);
    setFileBids(evaluatingState.bids);
    setIsSampleDetailsOpen(true);
  }, [evaluatingState]);

  useEffect(() => {
    if (fileSamples.length === 0) return;
    if (!selectedAgentId || !fileSamples.some((sample) => sample.agentId === selectedAgentId)) {
      setSelectedAgentId(fileSamples[0].agentId);
    }
  }, [fileSamples, selectedAgentId]);

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskDescription.trim()) return;

    if (sessionId && hasPendingQuestion) {
      handleChat();
      return;
    }

    startAuction(taskDescription);
  }

  function handleChat() {
    if (!sessionId) return;

    const userText = taskDescription;
    setTaskDescription("");
    void sendChatMessage(userText);
  }

  function handleSubmitShortlist(agentIds: string[]) {
    if (!sessionId || stage !== "bidding" || !hasPendingQuestion) return;

    const normalizedIds = Array.from(new Set(agentIds));
    const validBids = biddingState?.visibleBids ?? [];
    const selectedBids = validBids.filter((bid) => normalizedIds.includes(bid.id));

    const fallbackShortlistIds = biddingState?.shortlist?.shortlistedAgentIds ?? [];
    const fallbackShortlistIdSet = new Set<string>(fallbackShortlistIds);
    const fallbackSelectedBids =
      selectedBids.length > 0
        ? selectedBids
        : validBids.filter((bid) => fallbackShortlistIdSet.has(bid.id));

    const message =
      fallbackSelectedBids.length > 0
        ? `Run sample generation with ${fallbackSelectedBids
            .map((bid) => `${bid.agentName} (${bid.id})`)
            .join(", ")}.`
        : "Proceed with your recommended shortlist for sample generation.";

    void sendChatMessage(message);
  }

  async function sendChatMessage(userText: string): Promise<void> {
    if (!sessionId) return;

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

  function startAuction(task: string) {
    const userTask = task.trim();
    if (!userTask) return;

    setSubmitError(null);
    setFileSamples([]);
    setFileBids([]);
    setSelectedAgentId(null);
    setIsSampleDetailsOpen(false);

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

  function handleStartAuctionWithPrompt(prompt: string) {
    startAuction(prompt);
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
    setFileSamples([]);
    setFileBids([]);
    setSelectedAgentId(null);
    setIsSampleDetailsOpen(false);
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
    setIsSampleDetailsOpen(true);
  }

  return {
    chatEndRef,
    countdownSeconds,
    biddingState,
    devMode,
    displayMessages,
    evaluatingState,
    fileBids,
    fileSamples,
    hasPendingQuestion,
    hasSession,
    isFlowOpen,
    isFlowRunning,
    isPending,
    isSubmitting,
    isTyping,
    middlePanelMode,
    selectedAgentId,
    session,
    sessionId,
    showMiddlePanel,
    stage,
    submitError,
    taskDescription,
    totalBudget,
    usedBudget,
    worldId,
    handleApprove,
    handleEditRequirements,
    handleReset,
    handleSelectSample,
    handleStartAuctionWithPrompt,
    handleSubmitShortlist,
    handleSubmit,
    setDevMode,
    setIsFlowOpen,
    setTaskDescription,
  };
}
