"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  biddingWindowSeconds,
  buildAuditEvents,
  buildDeliveryReport,
  normalizeWeights,
  sampleEvaluations,
  seededBids,
  validateIntentInput,
} from "@/lib/audit-demo-data";
import type {
  AgentBid,
  AuditEvent,
  ChatMessage,
  DeliveryReport,
  FlowStage,
  IntentWeights,
  SampleEvaluation,
} from "@/types/audit";

const defaultWeights: IntentWeights = {
  quality: 40,
  price: 30,
  speed: 30,
};

const stepLabels = ["Intent", "Live Bids", "Quality Gate", "Delivery"];

const stageToStepIndex: Record<FlowStage, number> = {
  idle: 0,
  bidding: 1,
  evaluating: 2,
  delivered: 3,
  error: 0,
};

const stageBadgeLabel: Record<FlowStage, string> = {
  idle: "Idle",
  bidding: "Auction Running",
  evaluating: "Awaiting Approval",
  delivered: "Delivered",
  error: "Needs Fix",
};

const weightControls: Array<{ key: keyof IntentWeights; label: string }> = [
  { key: "quality", label: "Quality" },
  { key: "price", label: "Price" },
  { key: "speed", label: "Speed" },
];

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    kind: "text",
    text: "Hi! I'm AgentCheck. Describe a task and I'll run the full auction, scoring, and audit pipeline for you.",
  },
];

function createMessage(
  role: ChatMessage["role"],
  kind: ChatMessage["kind"],
  text: string,
  samples?: SampleEvaluation[],
): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    kind,
    text,
    samples,
  };
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

/* ── streaming helper: queues messages with a delay between each ── */
function useStreamingMessages(
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
) {
  const queueRef = useRef<ChatMessage[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flush() {
    if (queueRef.current.length === 0) {
      timerRef.current = null;
      return;
    }
    const next = queueRef.current.shift()!;
    setChatMessages((prev) => [...prev, next]);
    timerRef.current = setTimeout(flush, 600);
  }

  function enqueue(...messages: ChatMessage[]) {
    queueRef.current.push(...messages);
    if (!timerRef.current) {
      flush();
    }
  }

  function enqueueImmediate(...messages: ChatMessage[]) {
    setChatMessages((prev) => [...prev, ...messages]);
  }

  return { enqueue, enqueueImmediate };
}

export function AuditFlowDemo() {
  const [taskDescription, setTaskDescription] = useState("");
  const [budgetUsd, setBudgetUsd] = useState("50");
  const [weights, setWeights] = useState<IntentWeights>(defaultWeights);
  const [showSettings, setShowSettings] = useState(false);

  const [stage, setStage] = useState<FlowStage>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(biddingWindowSeconds);
  const [liveBids, setLiveBids] = useState<AgentBid[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [approvedSample, setApprovedSample] = useState<SampleEvaluation | null>(
    null,
  );
  const [deliveryReport, setDeliveryReport] = useState<DeliveryReport | null>(
    null,
  );
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [isPending, startTransition] = useTransition();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const { enqueue, enqueueImmediate } = useStreamingMessages(setChatMessages);

  const activeStepIndex = stageToStepIndex[stage];
  const isFlowRunning = stage === "bidding" || stage === "evaluating";

  const normalizedWeights = useMemo(() => normalizeWeights(weights), [weights]);
  const weightPercentages = useMemo(
    () => ({
      quality: Math.round(normalizedWeights.quality * 100),
      price: Math.round(normalizedWeights.price * 100),
      speed: Math.round(normalizedWeights.speed * 100),
    }),
    [normalizedWeights],
  );

  const parsedBudget = Number.parseFloat(budgetUsd);
  const totalBudget = Number.isNaN(parsedBudget) ? 0 : parsedBudget;
  const approvedBid = approvedSample
    ? seededBids.find((bid) => bid.id === approvedSample.agentId)
    : null;
  const usedBudget = approvedBid?.quoteUsd ?? 0;
  const remainingBudget = Math.max(totalBudget - usedBudget, 0);
  const spendRatio =
    totalBudget > 0 ? Math.min((usedBudget / totalBudget) * 100, 100) : 0;

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isTyping]);

  useEffect(() => {
    if (stage !== "bidding") {
      return;
    }

    const bidTicker = setInterval(() => {
      setLiveBids((currentBids) => {
        if (currentBids.length >= seededBids.length) {
          return currentBids;
        }

        const nextBid = seededBids[currentBids.length];
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          enqueueImmediate(
            createMessage(
              "assistant",
              "text",
              `Received bid from **${nextBid.agentName}** — ${formatUsd(nextBid.quoteUsd)}, ETA ${nextBid.etaMinutes}min, rep ${nextBid.reputation.toFixed(2)}`,
            ),
          );
        }, 400);

        return [...currentBids, nextBid];
      });
    }, 1200);

    const countdownTicker = setInterval(() => {
      setCountdownSeconds((currentSeconds) =>
        currentSeconds > 0 ? currentSeconds - 1 : 0,
      );
    }, 1000);

    const nextStepTimer = setTimeout(() => {
      setStage("evaluating");
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        enqueue(
          createMessage(
            "assistant",
            "text",
            "Auction closed. Scoring top samples with LLM Judge...",
          ),
          createMessage(
            "assistant",
            "scoreCanvas",
            "",
            sampleEvaluations,
          ),
        );
      }, 800);
    }, biddingWindowSeconds * 1000);

    return () => {
      clearInterval(bidTicker);
      clearInterval(countdownTicker);
      clearTimeout(nextStepTimer);
    };
  }, [stage]);

  function handleStartAuction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!taskDescription.trim()) return;

    const validationError = validateIntentInput(taskDescription, budgetUsd);
    if (validationError) {
      setErrorMessage(validationError);
      setStage("error");
      enqueueImmediate(
        createMessage("assistant", "text", validationError),
      );
      return;
    }

    setErrorMessage(null);
    setStage("bidding");
    setCountdownSeconds(biddingWindowSeconds);
    setLiveBids([]);
    setApprovedSample(null);
    setDeliveryReport(null);
    setAuditEvents([]);

    // User message appears immediately
    enqueueImmediate(
      createMessage(
        "user",
        "text",
        taskDescription,
      ),
    );

    setTaskDescription("");

    // Agent steps stream in
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      enqueue(
        createMessage("assistant", "text", `Got it. Budget set to **${formatUsd(totalBudget)}**.`),
        createMessage(
          "assistant",
          "text",
          `Opening RFQ for ${biddingWindowSeconds}s — weights: quality ${weightPercentages.quality}%, price ${weightPercentages.price}%, speed ${weightPercentages.speed}%.`,
        ),
        createMessage(
          "assistant",
          "text",
          "Waiting for agent bids...",
        ),
      );
    }, 500);
  }

  function handleWeightChange(key: keyof IntentWeights, rawValue: string) {
    const parsedValue = Number.parseInt(rawValue, 10);

    setWeights((currentWeights) => ({
      ...currentWeights,
      [key]: Number.isNaN(parsedValue) ? 0 : parsedValue,
    }));
  }

  function handleApprove(sample: SampleEvaluation) {
    if (stage !== "evaluating") {
      return;
    }

    const selectedBid = seededBids.find((bid) => bid.id === sample.agentId);
    const nextRemainingBudget = Math.max(totalBudget - (selectedBid?.quoteUsd ?? 0), 0);

    startTransition(() => {
      setApprovedSample(sample);
      setDeliveryReport(buildDeliveryReport(sample.agentName, taskDescription));
      setAuditEvents(buildAuditEvents(sample.agentName));
      setStage("delivered");

      enqueueImmediate(
        createMessage("user", "text", `Approve ${sample.agentName}`),
      );

      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        enqueue(
          createMessage(
            "assistant",
            "text",
            `Approved! Executing ${sample.agentName}...`,
          ),
          createMessage(
            "assistant",
            "text",
            "Task delivered. Escrow released.",
          ),
          createMessage(
            "assistant",
            "text",
            `Audit complete. Remaining budget: **${formatUsd(nextRemainingBudget)}**.`,
          ),
        );
      }, 400);
    });
  }

  function handleReset() {
    setErrorMessage(null);
    setStage("idle");
    setCountdownSeconds(biddingWindowSeconds);
    setLiveBids([]);
    setApprovedSample(null);
    setDeliveryReport(null);
    setAuditEvents([]);
    setChatMessages(initialMessages);
    setIsTyping(false);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* ── Top bar: steps + compact budget ── */}
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3 md:px-6">
        {/* Step pills */}
        <ol className="flex gap-1.5">
          {stepLabels.map((label, index) => {
            const isActive = activeStepIndex === index;
            const isComplete = activeStepIndex > index;

            return (
              <li
                key={label}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium leading-none ${
                  isActive
                    ? "bg-zinc-900 text-white"
                    : isComplete
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {label}
              </li>
            );
          })}
        </ol>

        <span className="mx-1 hidden h-4 w-px bg-zinc-200 sm:block" />

        {/* Compact budget bar */}
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="font-medium text-zinc-700">Budget</span>
          <div className="h-1.5 w-16 rounded-full bg-zinc-200">
            <div
              style={{ width: `${spendRatio}%` }}
              className="h-1.5 rounded-full bg-zinc-900 transition-all"
            />
          </div>
          <span className="font-mono">
            {formatUsd(usedBudget)}/{formatUsd(totalBudget)}
          </span>
        </div>

        {stage === "bidding" && (
          <>
            <span className="mx-1 hidden h-4 w-px bg-zinc-200 sm:block" />
            <span className="font-mono text-[11px] text-zinc-500">
              {countdownSeconds}s
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
            {stageBadgeLabel[stage]}
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-50"
          >
            Reset
          </button>
        </div>
      </header>

      {/* ── Chat messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="mx-auto max-w-2xl space-y-3">
          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              } animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              {message.role === "assistant" && (
                <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                  A
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-800"
                }`}
              >
                {message.text && (
                  <p
                    className="whitespace-pre-wrap [&>strong]:font-semibold"
                    dangerouslySetInnerHTML={{
                      __html: message.text.replace(
                        /\*\*(.*?)\*\*/g,
                        "<strong>$1</strong>",
                      ),
                    }}
                  />
                )}

                {message.kind === "scoreCanvas" && message.samples ? (
                  <div className="mt-2 space-y-2">
                    {message.samples.map((sample) => {
                      const scorePercent = Math.round(sample.score * 100);

                      return (
                        <section
                          key={sample.id}
                          className="rounded-xl border border-zinc-200 bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-zinc-900">
                              {sample.agentName}
                            </p>
                            <p className="font-mono text-xs text-zinc-500">
                              {scorePercent}/100
                            </p>
                          </div>

                          <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-200">
                            <div
                              style={{ width: `${scorePercent}%` }}
                              className="h-1.5 rounded-full bg-emerald-500 transition-all duration-700"
                            />
                          </div>

                          <p className="mt-2 text-xs text-zinc-600">
                            {sample.recommendation}
                          </p>

                          <button
                            type="button"
                            onClick={() => handleApprove(sample)}
                            disabled={stage !== "evaluating" || isPending}
                            className="mt-2.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isPending ? "Approving..." : `Approve ${sample.agentName}`}
                          </button>
                        </section>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-start">
              <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                A
              </div>
              <div className="rounded-2xl bg-zinc-100 px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ── Bottom input bar ── */}
      <div className="border-t border-zinc-100 px-4 py-3 md:px-6">
        <form
          className="mx-auto flex max-w-2xl items-end gap-2"
          onSubmit={handleStartAuction}
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={taskDescription}
              onChange={(event) => setTaskDescription(event.target.value)}
              placeholder={isFlowRunning ? "Auction in progress..." : "Describe a task to audit..."}
              disabled={isFlowRunning}
              className="w-full rounded-xl border border-zinc-300 bg-zinc-50 py-2.5 pl-3 pr-20 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white disabled:opacity-50"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
                title="Settings"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                </svg>
              </button>
              <button
                type="submit"
                disabled={isFlowRunning || !taskDescription.trim()}
                className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </form>

        {/* Expandable settings */}
        {showSettings && (
          <div className="mx-auto mt-2 max-w-2xl rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600">Budget $</span>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={budgetUsd}
                  onChange={(event) => setBudgetUsd(event.target.value)}
                  className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500"
                />
              </label>
              {weightControls.map((item) => (
                <label key={item.key} className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500">
                    {item.label} {weightPercentages[item.key]}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={weights[item.key]}
                    onChange={(event) =>
                      handleWeightChange(item.key, event.target.value)
                    }
                    className="h-1 w-16 accent-zinc-900"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {stage === "error" && errorMessage ? (
          <p className="mx-auto mt-2 max-w-2xl rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
