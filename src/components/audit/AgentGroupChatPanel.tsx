"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgentBid, AgentShortlist, AuditSession } from "@/types/audit";

const QUOTE_START_DELAY_MS = 420;
const QUOTE_REVEAL_INTERVAL_MS = 520;
const ANALYSIS_LOADING_MS = 1700;

type AgentGroupChatPanelProps = {
  taskDescription: string;
  bids: AgentBid[];
  shortlist?: AgentShortlist;
  pendingQuestion?: AuditSession["pendingQuestion"];
  isAwaitingSelection: boolean;
  isSubmittingSelection: boolean;
  onSubmitSelection: (agentIds: string[]) => void;
};

export function AgentGroupChatPanel({
  taskDescription,
  bids,
  shortlist,
  pendingQuestion,
  isAwaitingSelection,
  isSubmittingSelection,
  onSubmitSelection,
}: AgentGroupChatPanelProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [showAnalysisLoading, setShowAnalysisLoading] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const revealKey = useMemo(
    () =>
      bids
        .map((bid) => `${bid.id}:${bid.quoteUsd}:${bid.etaMinutes}:${Math.round(bid.reputation * 1000)}`)
        .join("|"),
    [bids],
  );

  useEffect(() => {
    if (bids.length === 0) return;

    let quotesCurrent = 0;
    let quotesIntervalId: number | null = null;
    let analysisTimerId: number | null = null;

    const resetTimerId = window.setTimeout(() => {
      setRevealedCount(0);
      setShowAnalysisLoading(false);
      setAnalysisReady(false);
    }, 0);

    const startQuotesTimerId = window.setTimeout(() => {
      quotesIntervalId = window.setInterval(() => {
        quotesCurrent += 1;
        setRevealedCount(Math.min(quotesCurrent, bids.length));

        if (quotesCurrent >= bids.length) {
          if (quotesIntervalId) {
            window.clearInterval(quotesIntervalId);
          }
          setShowAnalysisLoading(true);
          analysisTimerId = window.setTimeout(() => {
            setShowAnalysisLoading(false);
            setAnalysisReady(true);
          }, ANALYSIS_LOADING_MS);
        }
      }, QUOTE_REVEAL_INTERVAL_MS);
    }, QUOTE_START_DELAY_MS);

    return () => {
      window.clearTimeout(resetTimerId);
      window.clearTimeout(startQuotesTimerId);
      if (quotesIntervalId) {
        window.clearInterval(quotesIntervalId);
      }
      if (analysisTimerId) {
        window.clearTimeout(analysisTimerId);
      }
    };
  }, [bids.length, revealKey]);

  const visibleBids = bids.slice(0, revealedCount);
  const isMarketLive = bids.length > 0 && revealedCount < bids.length;

  const shortlistedBids = useMemo(() => {
    const shortlistIds = shortlist?.shortlistedAgentIds ?? [];
    if (shortlistIds.length === 0) {
      return bids.slice(0, 3);
    }

    const bidsById = new Map(bids.map((bid) => [bid.id, bid]));
    return shortlistIds
      .map((agentId) => bidsById.get(agentId))
      .filter((bid): bid is AgentBid => Boolean(bid))
      .slice(0, 3);
  }, [bids, shortlist?.shortlistedAgentIds]);

  const shortlistSummary =
    shortlist?.rationale ??
    "Waiting for enough quotes to run shortlist analysis on quality, speed, and price.";
  const shortlistPickerKey = shortlistedBids.map((bid) => bid.id).join("|") || "empty-shortlist";

  const promptText =
    taskDescription.trim().length > 0
      ? `Who can take this RFQ: "${taskDescription.trim()}"? Post trial quote, full quote, ETA, and one-line bid.`
      : "Who can take this RFQ? Post trial quote, full quote, ETA, and one-line bid.";

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto border-l border-zinc-200 bg-white px-6 py-6 xl:px-8">
      <div className="mb-4">
        <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold tracking-widest text-emerald-700 uppercase">
          <span className="rfq-breath-dot" />
          Live RFQ Broadcast
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Live RFQ broadcast. Specialist agents quote in-channel, then the orchestrator shortlists 3.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        <MainAgentBubble
          align="right"
          className="animate-in-right"
          title="Orchestrator"
          text={promptText}
        />

        {visibleBids.map((bid) => (
          <SpecialistQuoteBubble key={bid.id} bid={bid} />
        ))}

        {isMarketLive && <TypingBubble />}

        {showAnalysisLoading && (
          <MainAgentBubble
            align="right"
            className="animate-in-right"
            title="Orchestrator Analysis"
            text={`Reviewing ${bids.length} bids and ranking shortlist...`}
            loading
          />
        )}

        {analysisReady && bids.length > 0 && (
          <MainAgentBubble
            align="right"
            className="animate-in-right"
            title="Orchestrator Analysis"
            text={shortlistSummary}
          />
        )}
      </div>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-zinc-700">Shortlist ready for sample</p>
          <span className="text-[10px] text-zinc-500">{shortlistedBids.length} candidates</span>
        </div>
        {analysisReady && shortlistedBids.length > 0 ? (
          <ShortlistPicker
            key={shortlistPickerKey}
            bids={shortlistedBids}
            prompt={pendingQuestion?.question}
            isAwaitingSelection={isAwaitingSelection}
            isSubmittingSelection={isSubmittingSelection}
            onSubmitSelection={onSubmitSelection}
          />
        ) : showAnalysisLoading ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-white px-2 py-3 text-center text-[11px] text-zinc-500">
            Running shortlist analysis...
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-zinc-300 bg-white px-2 py-3 text-center text-[11px] text-zinc-500">
            Waiting for full quote feed...
          </div>
        )}
      </div>
    </div>
  );
}

type MainAgentBubbleProps = {
  align?: "left" | "right";
  className?: string;
  title: string;
  text: string;
  loading?: boolean;
};

function MainAgentBubble({
  align = "left",
  className,
  title,
  text,
  loading = false,
}: MainAgentBubbleProps) {
  const wrapperClass = align === "right" ? "flex justify-end" : "flex justify-start";

  return (
    <div className={`${wrapperClass} ${className ?? ""}`.trim()}>
      <div className="max-w-[92%] rounded-xl border border-zinc-200 bg-zinc-900 px-3 py-2.5 text-zinc-100">
        <p className="text-[10px] font-semibold tracking-widest text-zinc-300 uppercase">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-100">
          {text}
          {loading && (
            <span className="ml-1 inline-flex items-center gap-1 align-middle">
              <span className="h-1 w-1 animate-pulse rounded-full bg-zinc-200" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-zinc-200 [animation-delay:120ms]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-zinc-200 [animation-delay:240ms]" />
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

type SpecialistQuoteBubbleProps = {
  bid: AgentBid;
};

function SpecialistQuoteBubble({ bid }: SpecialistQuoteBubbleProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200 flex gap-2">
      <div
        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm ${avatarToneClass(
          bid.id,
        )}`}
        aria-hidden
      >
        {bid.avatar || initialsFromName(bid.agentName)}
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-zinc-800">{bid.agentName}</p>
            <p className="truncate text-[10px] text-zinc-400">{bid.model}</p>
          </div>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            {Math.round(bid.reputation * 100)}% rep
          </span>
        </div>
        <p className="mt-1 text-[11px] italic text-zinc-600">{`"${bid.bidLine}"`}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
            Trial ${bid.trialQuoteUsd.toFixed(2)}
          </span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
            Quote ${bid.quoteUsd.toFixed(2)}
          </span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
            ETA {bid.etaMinutes}m
          </span>
          <span
            className={`rounded px-1.5 py-0.5 ${
              bid.verified ? "bg-sky-50 text-sky-700" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {bid.verified ? "Verified" : "Unverified"}
          </span>
        </div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-center gap-2 pl-8">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
      <span className="font-mono text-[11px] text-zinc-500">agents posting quotes...</span>
    </div>
  );
}

function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "AG";
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

type ShortlistPickerProps = {
  bids: AgentBid[];
  prompt?: string;
  isAwaitingSelection: boolean;
  isSubmittingSelection: boolean;
  onSubmitSelection: (agentIds: string[]) => void;
};

function ShortlistPicker({
  bids,
  prompt,
  isAwaitingSelection,
  isSubmittingSelection,
  onSubmitSelection,
}: ShortlistPickerProps) {
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(() => bids.map((bid) => bid.id));

  const canSubmit = isAwaitingSelection && selectedAgentIds.length > 0 && !isSubmittingSelection;

  function toggleAgent(agentId: string) {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId],
    );
  }

  return (
    <div className="animate-in-right">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-600">
          {prompt ?? "Select the agents you want for sample generation."}
        </p>
        <span className="flex-shrink-0 text-[10px] text-zinc-500">
          {selectedAgentIds.length}/{bids.length} selected
        </span>
      </div>
      <div className="space-y-1.5">
        {bids.map((bid, index) => {
          const checked = selectedAgentIds.includes(bid.id);
          return (
            <button
              key={`shortlist-select-${bid.id}`}
              type="button"
              onClick={() => toggleAgent(bid.id)}
              className={`flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left transition-colors ${
                checked
                  ? "border-zinc-800 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold">
                  {index + 1}. {bid.agentName}
                </p>
                <p className={`truncate text-[10px] ${checked ? "text-zinc-300" : "text-zinc-500"}`}>
                  {bid.id} · ${bid.quoteUsd.toFixed(2)} · {bid.etaMinutes}m
                </p>
              </div>
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold ${
                  checked
                    ? "border-white/60 bg-white/20 text-white"
                    : "border-zinc-300 bg-white text-zinc-400"
                }`}
                aria-hidden
              >
                {checked ? "✓" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmitSelection(selectedAgentIds)}
        className="mt-3 w-full rounded-md bg-emerald-500 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isSubmittingSelection
          ? "Submitting..."
          : isAwaitingSelection
            ? "Continue to sample phase"
            : "Waiting for orchestrator..."}
      </button>
    </div>
  );
}

function avatarToneClass(agentId: string): string {
  switch (agentId) {
    case "agent-alpha":
      return "bg-amber-100 text-amber-700";
    case "agent-beta":
      return "bg-pink-100 text-pink-700";
    case "agent-gamma":
      return "bg-cyan-100 text-cyan-700";
    case "agent-delta":
      return "bg-violet-100 text-violet-700";
    case "agent-epsilon":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}
