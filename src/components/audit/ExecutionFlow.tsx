"use client";

import type { AuditSessionState, SampleEvaluation } from "@/types/audit";

type Step = {
  id: string;
  label: string;
  status: "done" | "active" | "pending";
};

function stepsForStage(stage: AuditSessionState["stage"]): Step[] {
  const all: Array<{ id: string; label: string }> = [
    { id: "PARSE_INTENT", label: "PARSE_INTENT" },
    { id: "OPEN_RFQ", label: "OPEN_RFQ" },
    { id: "COLLECT_BIDS", label: "COLLECT_BIDS" },
    { id: "RUN_SAMPLES", label: "RUN_SAMPLES" },
    { id: "CONFIRM_AGENT", label: "CONFIRM_AGENT" },
    { id: "FINALIZE", label: "FINALIZE_REPORT" },
  ];

  const activeIndex: Record<AuditSessionState["stage"], number> = {
    // Pre-RFQ reasoning phase: parsing intent and preparing RFQ.
    // COLLECT_BIDS should only become active once stage enters "bidding".
    agentic: 1,
    bidding: 2,
    evaluating: 4,
    delivered: 6,
    error: 0,
  };

  const active = activeIndex[stage];
  return all.map((s, i) => ({
    ...s,
    status: i < active ? "done" : i === active ? "active" : "pending",
  }));
}

type ExecutionFlowProps = {
  state: AuditSessionState;
  countdownSeconds: number;
  taskDescription: string;
  totalBudgetUsd: number;
  usedBudgetUsd: number;
  files?: SampleEvaluation[];
  selectedAgentId?: string | null;
  activeDeliveredPreview?: "sample" | "delivery" | null;
  onPreviewSampleFile?: (agentId: string) => void;
  onPreviewDeliveryFile?: () => void;
};

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

type DeliveryFile = {
  id: string;
  fileName: string;
  detail: string;
  format: "IMG" | "TXT";
};

function getDeliveryFile(state: Extract<AuditSessionState, { stage: "delivered" }>): DeliveryFile {
  const delivery = state.delivery;
  const hasImagePayload = Boolean(delivery.imageDataUrl || delivery.comicFrames?.[0]?.imageDataUrl);

  return {
    id: "delivery-main",
    fileName: hasImagePayload ? "final-output.png" : "final-output.txt",
    detail: delivery.title,
    format: hasImagePayload ? "IMG" : "TXT",
  };
}

export function ExecutionFlow({
  state,
  countdownSeconds,
  taskDescription,
  totalBudgetUsd,
  usedBudgetUsd,
  files = [],
  selectedAgentId = null,
  activeDeliveredPreview = null,
  onPreviewSampleFile,
  onPreviewDeliveryFile,
}: ExecutionFlowProps) {
  const steps = stepsForStage(state.stage);

  const stateSamples: SampleEvaluation[] = state.stage === "evaluating" ? state.samples : [];
  const sampleFiles = files.length > 0 ? files : stateSamples;
  const deliveredState = state.stage === "delivered" ? state : null;
  const deliveryFile = deliveredState ? getDeliveryFile(deliveredState) : null;

  const remainingBudgetUsd = Math.max(totalBudgetUsd - usedBudgetUsd, 0);
  const usageRatio = totalBudgetUsd > 0 ? Math.min(Math.max(usedBudgetUsd / totalBudgetUsd, 0), 1) : 0;
  const leftRatio =
    totalBudgetUsd > 0 ? Math.min(Math.max(remainingBudgetUsd / totalBudgetUsd, 0), 1) : 0;
  const leftPercent = Math.round(leftRatio * 100);
  const usageTextClass =
    usageRatio >= 0.9 ? "text-rose-600" : usageRatio >= 0.6 ? "text-amber-600" : "text-emerald-600";
  const leftBarClass =
    leftRatio <= 0.1 ? "bg-rose-500" : leftRatio <= 0.4 ? "bg-amber-500" : "bg-emerald-500";
  const leftTextClass =
    leftRatio <= 0.1 ? "text-rose-600" : leftRatio <= 0.4 ? "text-amber-600" : "text-emerald-600";
  const remainingTextClass = remainingBudgetUsd > 0 ? "text-emerald-600" : "text-rose-600";

  return (
    <div className="flex h-full flex-col overflow-y-auto border-l border-zinc-100 bg-zinc-50 px-5 py-6 font-mono text-xs">
      <div className="sticky top-0 z-10 -mx-5 -mt-7 mb-12 border-b border-zinc-200 bg-zinc-50/95 px-5 pt-0 pb-7 backdrop-blur">
        <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
            Task_Brief
          </p>
          <p className="line-clamp-3 leading-relaxed text-zinc-700">{taskDescription}</p>

          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-[10px] text-zinc-500">
            <div className="flex items-center justify-between">
              <span>TOTAL / REMAINING</span>
              <span className="font-semibold text-zinc-700">
                <span className="text-zinc-700">{formatUsd(totalBudgetUsd)}</span>
                <span className="text-zinc-400"> / </span>
                <span className={remainingTextClass}>{formatUsd(remainingBudgetUsd)}</span>
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>USED</span>
              <span className={`font-semibold ${usageTextClass}`}>{formatUsd(usedBudgetUsd)}</span>
            </div>
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-[9px] tracking-wide text-zinc-400 uppercase">
                <span>Budget left</span>
                <span className={`font-semibold ${leftTextClass}`}>{leftPercent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                <div
                  style={{ width: `${leftPercent}%` }}
                  className={`h-1.5 rounded-full transition-all duration-500 ${leftBarClass}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
          Execution_Flow
        </p>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={step.id} className="flex items-center gap-2">
              <span
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm text-[9px] font-bold ${
                  step.status === "done"
                    ? "bg-emerald-100 text-emerald-600"
                    : step.status === "active"
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-200 text-zinc-400"
                }`}
              >
                {step.status === "done" ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={
                  step.status === "done"
                    ? "text-zinc-400 line-through"
                    : step.status === "active"
                      ? "text-zinc-900"
                      : "text-zinc-400"
                }
              >
                {step.label}
              </span>
              {step.status === "active" && state.stage === "bidding" && (
                <span className="ml-auto text-amber-500">{countdownSeconds}s</span>
              )}
              {step.status === "active" && state.stage === "evaluating" && (
                <span className="ml-auto animate-pulse text-blue-500">…</span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-6">
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">Files</p>
        {sampleFiles.length > 0 || deliveryFile ? (
          <div className="space-y-3">
            {sampleFiles.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] tracking-wide text-zinc-500 uppercase">Sample Files</p>
                <div className="space-y-1.5">
                  {sampleFiles.map((sample, i) => {
                    const scorePercent = Math.round(sample.score * 100);
                    const isSelected =
                      deliveredState
                        ? activeDeliveredPreview === "sample" && selectedAgentId === sample.agentId
                        : selectedAgentId === sample.agentId;
                    const canPreview = typeof onPreviewSampleFile === "function";

                    return (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => onPreviewSampleFile?.(sample.agentId)}
                        disabled={!canPreview}
                        className={`flex w-full items-center gap-2 rounded border px-2.5 py-2 text-left ${
                          isSelected
                            ? "border-zinc-800 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        } disabled:cursor-default`}
                      >
                        <span className={`text-[10px] ${isSelected ? "text-white/75" : "text-zinc-400"}`}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate font-semibold ${isSelected ? "text-white" : "text-zinc-800"}`}>
                            {sample.sampleTitle}
                          </p>
                          <p className={`truncate text-[10px] ${isSelected ? "text-white/75" : "text-zinc-500"}`}>
                            {sample.agentName}
                          </p>
                        </div>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            isSelected ? "bg-white/15 text-white" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          SAMPLE
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            isSelected ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {scorePercent > 0 ? `${scorePercent}` : "–"}
                        </span>
                        <span className={`text-[10px] font-semibold ${isSelected ? "text-white" : "text-zinc-600"}`}>
                          Preview
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {deliveryFile && (
              <div>
                <p className="mb-1.5 text-[10px] tracking-wide text-zinc-500 uppercase">Delivery Files</p>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => onPreviewDeliveryFile?.()}
                    disabled={typeof onPreviewDeliveryFile !== "function"}
                    className={`flex w-full items-center gap-2 rounded border px-2.5 py-2 text-left ${
                      activeDeliveredPreview === "delivery"
                        ? "border-zinc-800 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    } disabled:cursor-default`}
                  >
                    <span className={`text-[10px] ${activeDeliveredPreview === "delivery" ? "text-white/75" : "text-zinc-400"}`}>
                      01
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-semibold ${activeDeliveredPreview === "delivery" ? "text-white" : "text-zinc-800"}`}>
                        {deliveryFile.fileName}
                      </p>
                      <p className={`truncate text-[10px] ${activeDeliveredPreview === "delivery" ? "text-white/75" : "text-zinc-500"}`}>
                        {deliveryFile.detail}
                      </p>
                    </div>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        activeDeliveredPreview === "delivery"
                          ? "bg-white/15 text-white"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      DELIVERY
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        activeDeliveredPreview === "delivery"
                          ? "bg-white/15 text-white"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {deliveryFile.format}
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${activeDeliveredPreview === "delivery" ? "text-white" : "text-zinc-600"}`}
                    >
                      Preview
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="rounded border border-dashed border-zinc-200 bg-white px-2.5 py-2 text-zinc-400">
              SAMPLE_FILES_PENDING
            </div>
            <div className="rounded border border-dashed border-zinc-200 bg-white px-2.5 py-2 text-zinc-400">
              DELIVERY_FILES_PENDING
            </div>
          </div>
        )}
      </div>

      {deliveredState && (
        <div className="mt-auto pt-4">
          <p className="text-emerald-600">{"// TASK_COMPLETE ✓"}</p>
          <p className="mt-1 text-zinc-400">AGENT: {deliveredState.approvedAgentName}</p>
          <p className="text-zinc-400">PAID: ${deliveredState.quoteUsd.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}
