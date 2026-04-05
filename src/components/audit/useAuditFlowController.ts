"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
const UI_STATE_STORAGE_KEY = "agentick.audit.ui-state.v1";

type LocalMessage = {
  source: "assistant" | "user";
  id: string;
  text: string;
  ts: number;
};

export type DisplayMessage = LocalMessage | { source: "backend"; msg: OrchestratorMessage };

type PersistedAuditUiState = {
  sessionId: string | null;
  localMessages: LocalMessage[];
  lastSubmittedTask: string;
};

function isLocalMessage(value: unknown): value is LocalMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<LocalMessage>;
  const validSource = candidate.source === "assistant" || candidate.source === "user";
  return (
    validSource &&
    typeof candidate.id === "string" &&
    typeof candidate.text === "string" &&
    typeof candidate.ts === "number"
  );
}

export function useAuditFlowController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get("session");

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
  const [deliveredPreviewTarget, setDeliveredPreviewTarget] = useState<"sample" | "delivery">(
    "delivery",
  );
  const [isMdUp, setIsMdUp] = useState(false);
  const [hasPromptedSampleSelection, setHasPromptedSampleSelection] = useState(false);
  const [hasRestoredPersistedState, setHasRestoredPersistedState] = useState(false);
  const worldId = useWorldIdGate();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);

  const stage = session?.state.stage ?? null;
  const hasPendingQuestion = !!session?.pendingQuestion;
  const isAgentWorking = stage === "agentic" && !hasPendingQuestion;
  const isFlowRunning = stage === "bidding" || stage === "evaluating" || isAgentWorking;

  const totalBudget = DEFAULT_BUDGET_USD;
  const usedBudget = useMemo(() => {
    if (!session) return 0;
    if (session.state.stage === "delivered") {
      return session.state.totalPaidUsd;
    }
    const paymentReleases = Array.isArray(session.paymentReleases)
      ? session.paymentReleases
      : [];
    return Number(
      paymentReleases
        .reduce((sum, payment) => sum + payment.amountUsd, 0)
        .toFixed(2),
    );
  }, [session]);

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
  const middlePanelMode: "groupChat" | "samples" | "delivery" | null = !isMdUp
    ? null
    : stage === "delivered"
      ? deliveredPreviewTarget === "sample" && hasFiles
        ? "samples"
        : "delivery"
      : biddingState
        ? "groupChat"
        : hasSamplesReady || (hasFiles && isSampleDetailsOpen)
          ? "samples"
          : null;
  const showMiddlePanel = middlePanelMode !== null;

  useEffect(() => {
    if (hasRestoredPersistedState) return;

    let restoredSessionId: string | null = null;
    let restoredLocalMessages: LocalMessage[] = [];
    let restoredLastSubmittedTask = "";

    try {
      const raw = window.sessionStorage.getItem(UI_STATE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedAuditUiState>;
        if (typeof parsed.sessionId === "string") {
          restoredSessionId = parsed.sessionId;
        }
        if (Array.isArray(parsed.localMessages)) {
          restoredLocalMessages = parsed.localMessages.filter(isLocalMessage);
        }
        if (typeof parsed.lastSubmittedTask === "string") {
          restoredLastSubmittedTask = parsed.lastSubmittedTask;
        }
      }
    } catch {
      // Ignore invalid persisted state and continue with fresh defaults.
    }

    if (restoredLocalMessages.length > 0) {
      setLocalMessages(restoredLocalMessages);
    }

    if (restoredLastSubmittedTask) {
      setLastSubmittedTask(restoredLastSubmittedTask);
    }

    if (sessionIdFromUrl) {
      setSessionId(sessionIdFromUrl);
    } else if (restoredSessionId) {
      setSessionId(restoredSessionId);
    }

    setHasRestoredPersistedState(true);
  }, [hasRestoredPersistedState, sessionIdFromUrl]);

  useEffect(() => {
    if (!hasRestoredPersistedState) return;

    const persistedState: PersistedAuditUiState = {
      sessionId,
      localMessages,
      lastSubmittedTask,
    };

    window.sessionStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(persistedState));
  }, [hasRestoredPersistedState, lastSubmittedTask, localMessages, sessionId]);

  useEffect(() => {
    if (!hasRestoredPersistedState) return;

    if (sessionId && sessionIdFromUrl !== sessionId) {
      router.replace(`${pathname}?session=${encodeURIComponent(sessionId)}`, {
        scroll: false,
      });
      return;
    }

    if (!sessionId && sessionIdFromUrl) {
      router.replace(pathname, { scroll: false });
    }
  }, [hasRestoredPersistedState, pathname, router, sessionId, sessionIdFromUrl]);

  useEffect(() => {
    if (!sessionId || session?.id === sessionId) return;

    let cancelled = false;
    const controller = new AbortController();

    async function restoreSession(): Promise<void> {
      try {
        const res = await fetch(`/api/audit/session/${sessionId}`, {
          signal: controller.signal,
        });
        if (cancelled) return;
        if (res.status === 404) {
          setSessionId(null);
          setSession(null);
          return;
        }
        if (!res.ok) return;

        const data = (await res.json()) as { session: AuditSession };
        if (!cancelled) {
          setSession(data.session);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [session?.id, sessionId]);

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
    if (stage !== "delivered") return;
    setDeliveredPreviewTarget("delivery");
  }, [stage]);

  useEffect(() => {
    if (stage !== "delivered") return;
    const approvedAgentId = session?.state.stage === "delivered" ? session.state.approvedAgentId : null;
    if (!approvedAgentId) return;
    setSelectedAgentId((currentId) => currentId ?? approvedAgentId);
  }, [session?.state, stage]);

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
    setDeliveredPreviewTarget("delivery");

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
    setDeliveredPreviewTarget("delivery");
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
    if (stage === "delivered") {
      setDeliveredPreviewTarget("sample");
    }
  }

  function handleSelectDelivery() {
    if (stage === "delivered") {
      setDeliveredPreviewTarget("delivery");
    }
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
    deliveredPreviewTarget,
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
    handleSelectDelivery,
    handleSelectSample,
    handleStartAuctionWithPrompt,
    handleSubmitShortlist,
    handleSubmit,
    setDevMode,
    setIsFlowOpen,
    setTaskDescription,
  };
}
