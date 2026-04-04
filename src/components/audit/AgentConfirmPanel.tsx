"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  readOnly?: boolean;
};

function sanitizeFileSegment(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "sample";
}

function extensionFromDataUrl(dataUrl: string): string {
  const mimeType = dataUrl.match(/^data:([^;,]+)[;,]/)?.[1] ?? "image/png";
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}

function getDownloadFileName(sample: SampleEvaluation, timestampLabel: string): string {
  const prefix = `${sanitizeFileSegment(sample.agentName)}-${sanitizeFileSegment(sample.sampleTitle)}`;
  if (sample.imageDataUrl) {
    return `${prefix}-${timestampLabel}.${extensionFromDataUrl(sample.imageDataUrl)}`;
  }
  return `${prefix}-${timestampLabel}.txt`;
}

function triggerDownload(href: string, fileName: string): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function timestampLabel(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function AgentConfirmPanel({
  samples,
  bids,
  isPending,
  onApprove,
  selectedAgentId,
  onSelectAgent,
  onEditRequirements,
  layout = "sidebar",
  readOnly = false,
}: AgentConfirmPanelProps) {
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

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

  const downloadSample = (sample: SampleEvaluation, suffix = "") => {
    const ts = suffix ? `${timestampLabel()}-${suffix}` : timestampLabel();
    const fileName = getDownloadFileName(sample, ts);
    if (sample.imageDataUrl) {
      triggerDownload(sample.imageDataUrl, fileName);
      return;
    }

    const textPayload = [
      `Title: ${sample.sampleTitle}`,
      `Agent: ${sample.agentName}`,
      `Model: ${sample.model}`,
      `Score: ${Math.round(sample.score * 100)}`,
      "",
      `Summary: ${sample.summary}`,
      "",
      `Recommendation: ${sample.recommendation}`,
    ].join("\n");

    const blob = new Blob([textPayload], { type: "text/plain;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    triggerDownload(blobUrl, fileName);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  };

  const downloadAllSamples = () => {
    samples.forEach((sample, index) => {
      window.setTimeout(() => {
        downloadSample(sample, String(index + 1).padStart(2, "0"));
      }, index * 120);
    });
  };

  useEffect(() => {
    if (!downloadMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!downloadMenuRef.current) return;
      if (!downloadMenuRef.current.contains(event.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDownloadMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [downloadMenuOpen]);

  if (!selectedSample) return null;

  const scorePercent = Math.round(selectedSample.score * 100);
  const isComicTask = selectedSample.taskKind === "four-panel-comic";

  const containerClass =
    layout === "main"
      ? "flex h-full min-w-0 flex-1 flex-col overflow-y-auto border-l border-zinc-200 bg-white px-6 pt-6 pb-0 xl:px-8"
      : "flex h-full w-72 flex-shrink-0 flex-col overflow-y-auto border-l border-zinc-200 bg-white px-5 pt-6 pb-0 xl:w-80";
  const stickyFooterClass =
    layout === "main"
      ? "sticky -bottom-px z-10 -mx-6 mt-auto border-t border-zinc-200 bg-white px-6 pt-4 pb-6 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] xl:-mx-8 xl:px-8"
      : "sticky -bottom-px z-10 -mx-5 mt-auto border-t border-zinc-200 bg-white px-5 pt-4 pb-6 shadow-[0_-8px_20px_rgba(15,23,42,0.08)]";

  return (
    <div className={containerClass}>
      <div className="mb-5">
        <p className="text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
          Sample Area
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {readOnly
            ? "Viewing selected sample details."
            : "Review style, execution plan, and quality before confirmation."}
        </p>
      </div>

      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-zinc-600">Sample choices</p>
          <div className="relative" ref={downloadMenuRef}>
            <button
              type="button"
              onClick={() => setDownloadMenuOpen((open) => !open)}
              className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-600 hover:bg-zinc-50"
              aria-expanded={downloadMenuOpen}
              aria-haspopup="menu"
            >
              Download
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" />
              </svg>
            </button>

            {downloadMenuOpen && (
              <div
                className="absolute top-[calc(100%+4px)] right-0 z-20 w-52 rounded-md border border-zinc-200 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
                role="menu"
              >
                {samples.map((sample) => (
                  <button
                    key={`download-option-${sample.id}`}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      downloadSample(sample);
                      setDownloadMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[11px] text-zinc-700 hover:bg-zinc-50"
                  >
                    <span className="truncate">Download {sample.agentName}</span>
                    <span className="ml-2 text-[10px] text-zinc-400">single</span>
                  </button>
                ))}
                <div className="my-1 h-px bg-zinc-200" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    downloadAllSamples();
                    setDownloadMenuOpen(false);
                  }}
                  className="w-full rounded px-2 py-1.5 text-left text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Download all samples
                </button>
              </div>
            )}
          </div>
        </div>
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

      {!readOnly && (
        <div className={stickyFooterClass}>
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

            <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-white">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M4 7h16M6 11h12M8 15h8" />
                  </svg>
                </div>
                <span className="text-[11px] font-semibold text-purple-700">Backed by Hedera</span>
              </div>
              <p className="mt-1 text-[11px] text-purple-700/90">
                Payment escrow and audit records are guaranteed on Hedera.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onApprove(selectedSample)}
            disabled={isPending}
            className="w-full rounded-md bg-emerald-500 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-45"
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
      )}
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
