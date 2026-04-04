"use client";

import { useMemo } from "react";
import type { AgentBid, SampleEvaluation } from "@/types/audit";

type AgentConfirmPanelProps = {
  samples: SampleEvaluation[];
  bids: AgentBid[];
  isPending: boolean;
  onApprove: (sample: SampleEvaluation) => void;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onEditRequirements: () => void;
  layout?: "sidebar" | "main";
};

export function AgentConfirmPanel({
  samples,
  bids,
  isPending,
  onApprove,
  selectedAgentId,
  onSelectAgent,
  onEditRequirements,
  layout = "sidebar",
}: AgentConfirmPanelProps) {
  const selectedSample = useMemo(
    () => {
      if (samples.length === 0) return null;
      return (selectedAgentId
        ? samples.find((sample) => sample.agentId === selectedAgentId)
        : null) ?? samples[0];
    },
    [samples, selectedAgentId],
  );
  const selectedBid = useMemo(
    () => (selectedSample ? bids.find((bid) => bid.id === selectedSample.agentId) ?? null : null),
    [bids, selectedSample],
  );
  if (!selectedSample) return null;

  const scorePercent = Math.round(selectedSample.score * 100);
  const isComicTask = selectedSample.taskKind === "four-panel-comic";

  const containerClass =
    layout === "main"
      ? "flex h-full min-w-0 flex-1 flex-col overflow-y-auto border-l border-zinc-200 bg-white px-6 py-6 xl:px-8"
      : "flex h-full w-72 flex-shrink-0 flex-col overflow-y-auto border-l border-zinc-200 bg-white px-5 py-6 xl:w-80";

  return (
    <div className={containerClass}>
      <div className="mb-5">
        <p className="text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
          Agent Selection
        </p>
        <p className="mt-1 text-xs text-zinc-500">Compare agent style, plan, and sample quality.</p>
      </div>

      <div className="mb-3 space-y-2">
        <p className="text-[11px] font-medium text-zinc-600">Sample choices</p>
        <div className="grid grid-cols-3 gap-2">
          {samples.map((sample, idx) => {
            const isSelected = selectedSample.agentId === sample.agentId;
            const scorePercent = Math.round(sample.score * 100);
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => onSelectAgent(sample.agentId)}
                className={`h-16 w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
                  isSelected
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] font-semibold">{sample.agentName}</span>
                  {idx === 0 && (
                    <span
                      className={`rounded px-1 py-0.5 text-[9px] font-semibold ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      Recommended
                    </span>
                  )}
                </div>
                <p className={`text-[10px] ${isSelected ? "text-white/85" : "text-zinc-500"}`}>
                  {scorePercent > 0 ? `${scorePercent}/100` : "Scoring..."}
                </p>
                <p className={`line-clamp-1 text-[9px] ${isSelected ? "text-white/80" : "text-zinc-400"}`}>
                  {sample.sampleTitle}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-3 transition-all duration-200">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {samples[0]?.agentId === selectedSample.agentId && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                  Recommended
                </span>
              )}
              <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                Selected
              </span>
              <span className="font-mono text-xs font-semibold text-zinc-900">
                {selectedSample.agentName}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">{selectedSample.sampleTitle}</p>
            <p className="mt-0.5 font-mono text-[10px] text-zinc-400">{selectedSample.model}</p>
          </div>
          <span className="font-mono text-sm font-bold text-zinc-700">
            {scorePercent > 0 ? scorePercent : "–"}
          </span>
        </div>

        {isComicTask && (
          <div className="mt-2 inline-flex rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
            Keyframe Sample (1 image)
          </div>
        )}

        {scorePercent > 0 && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-200">
            <div
              style={{ width: `${scorePercent}%` }}
              className="h-1 rounded-full bg-emerald-400 transition-all duration-700"
            />
          </div>
        )}

        <div className="mt-2 overflow-hidden rounded border border-zinc-200">
          {selectedSample.imageDataUrl ? (
            <img
              src={selectedSample.imageDataUrl}
              alt={`${selectedSample.agentName} sample`}
              className="w-full bg-zinc-100"
            />
          ) : (
            <div className="flex h-36 w-full flex-col items-center justify-center bg-zinc-50 text-zinc-400">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 15l4-4 4 4 3-3 7 7" />
                <circle cx="15.5" cy="9.5" r="1.5" />
              </svg>
              <p className="mt-2 text-[10px] font-medium">No media preview</p>
              <p className="mt-0.5 text-[10px]">This agent returned text only.</p>
            </div>
          )}
        </div>

        {isComicTask && (
          <p className="mt-2 text-[11px] text-sky-700">
            Sample phase is one representative frame. Delivery phase should output a full 4-panel comic.
          </p>
        )}

        {selectedBid && (
          <div className="mt-2 flex gap-3 text-[11px] text-zinc-500">
            <span>${selectedBid.quoteUsd.toFixed(2)}</span>
            <span>{selectedBid.etaMinutes}min</span>
            <span className="text-emerald-700">{Math.round(selectedBid.reputation * 100)}% rep</span>
          </div>
        )}

        {selectedSample.scoreBreakdown && (
          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-2">
            <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
              Judge Breakdown
            </p>
            <div className="mt-2 space-y-1.5">
              <MetricBar label="Quality" value={selectedSample.scoreBreakdown.quality} />
              <MetricBar label="Price" value={selectedSample.scoreBreakdown.price} />
              <MetricBar label="Speed" value={selectedSample.scoreBreakdown.speed} />
            </div>
          </div>
        )}

        {selectedSample.persona && (
          <div className="mt-3 rounded-md border border-zinc-200 bg-white p-2">
            <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
              Agent Profile
            </p>
            <p className="mt-1 text-[11px] text-zinc-700">
              <span className="font-semibold">Personality:</span> {selectedSample.persona.personality}
            </p>
            <p className="mt-1 text-[11px] text-zinc-700">
              <span className="font-semibold">Taste:</span> {selectedSample.persona.taste}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedSample.persona.skills.slice(0, 4).map((skill) => (
                <span
                  key={skill}
                  className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {selectedSample.plan && (
          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-2">
            <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
              Execution Plan
            </p>
            <p className="mt-1 text-[11px] text-zinc-700">
              <span className="font-semibold">Concept:</span> {selectedSample.plan.concept}
            </p>
            <p className="mt-1 text-[11px] text-zinc-700">
              <span className="font-semibold">Sample:</span> {selectedSample.plan.samplePlan}
            </p>
            <p className="mt-1 text-[11px] text-zinc-700">
              <span className="font-semibold">Deliver:</span> {selectedSample.plan.deliverPlan}
            </p>
            <p className="mt-1 text-[11px] text-amber-700">
              <span className="font-semibold">Risk:</span> {selectedSample.plan.qualityRisk}
            </p>
            {selectedSample.plan.panelFlow.length > 0 && (
              <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase">Panel Flow</p>
                <div className="mt-1 space-y-0.5">
                  {selectedSample.plan.panelFlow.map((step, idx) => (
                    <p key={`${idx}-${step}`} className="text-[11px] text-zinc-700">
                      Panel {idx + 1}: {step}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
          {selectedSample.recommendation}
        </p>
      </div>

      <div className="mt-auto pt-5">
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="5" />
                  <path d="M3 12h2m14 0h2M12 3v2m0 14v2" />
                </svg>
              </div>
              <span className="text-[11px] font-semibold text-sky-700">Secured by World ID</span>
            </div>
            <p className="mt-1 text-[11px] text-sky-700/90">
              Identity verification is required before approval.
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 7h16M6 11h12M8 15h8" />
                </svg>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700">Backed by Hedera</span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-700/90">
              Payment escrow and audit records are guaranteed on Hedera.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onApprove(selectedSample)}
          disabled={isPending}
          className="w-full rounded-md bg-emerald-500 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending
            ? "Verifying..."
            : `Confirm ${selectedSample.agentName} · $${(selectedBid?.quoteUsd ?? 0).toFixed(2)}`}
        </button>

        <button
          type="button"
          onClick={onEditRequirements}
          className="mt-3 w-full rounded-md border border-zinc-300 bg-white py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Edit requirements
        </button>
      </div>
    </div>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-[10px] text-zinc-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
        <div style={{ width: `${percent}%` }} className="h-1.5 rounded-full bg-emerald-400" />
      </div>
      <span className="w-8 text-right text-[10px] text-zinc-600">{percent}</span>
    </div>
  );
}
