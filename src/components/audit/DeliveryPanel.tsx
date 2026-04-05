"use client";

import type { DeliveryReport } from "@/types/audit";
import type { DeliveryComicFrame } from "@/types/audit";

type DeliveryPanelProps = {
  delivery: DeliveryReport;
  approvedAgentName: string;
  quoteUsd: number;
  taskDescription: string;
  layout?: "sidebar" | "main";
};

function sanitizeFileSegment(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "delivery";
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

function getPrimaryDeliveryDataUrl(delivery: DeliveryReport): string | null {
  return delivery.imageDataUrl ?? null;
}

function getOrderedComicFrames(delivery: DeliveryReport): DeliveryComicFrame[] {
  if (!delivery.comicFrames || delivery.comicFrames.length === 0) {
    return [];
  }

  return [...delivery.comicFrames].sort((a, b) => a.panelNumber - b.panelNumber);
}

function buildTextOutput(delivery: DeliveryReport, taskDescription: string, agentName: string): string {
  return [
    `Title: ${delivery.title}`,
    `Task: ${taskDescription}`,
    `Agent: ${agentName}`,
    "",
    "Highlights:",
    ...(delivery.highlights.length > 0 ? delivery.highlights.map((h) => `- ${h}`) : ["- (none)"]),
    "",
    "Generator Notes:",
    delivery.generatorNotes?.trim() || "(none)",
    "",
    "Markdown Preview:",
    delivery.markdownPreview.trim() || "(none)",
  ].join("\n");
}

export function DeliveryPanel({
  delivery,
  approvedAgentName,
  quoteUsd,
  taskDescription,
  layout = "main",
}: DeliveryPanelProps) {
  const comicFrames = getOrderedComicFrames(delivery);
  const hasComicFrames = comicFrames.length > 0;
  const primaryDataUrl = hasComicFrames ? null : getPrimaryDeliveryDataUrl(delivery);
  const finalFileName = hasComicFrames
    ? `final-output-panel-1..${comicFrames.length}.png`
    : primaryDataUrl
      ? "final-output.png"
      : "final-output.txt";

  function downloadFinalOutput(): void {
    const baseName = `${sanitizeFileSegment(approvedAgentName)}-${sanitizeFileSegment(delivery.title)}-${timestampLabel()}`;

    if (hasComicFrames) {
      comicFrames.forEach((frame) => {
        const fileName = `${baseName}-panel-${frame.panelNumber}.${extensionFromDataUrl(frame.imageDataUrl)}`;
        triggerDownload(frame.imageDataUrl, fileName);
      });
      return;
    }

    if (primaryDataUrl) {
      const fileName = `${baseName}.${extensionFromDataUrl(primaryDataUrl)}`;
      triggerDownload(primaryDataUrl, fileName);
      return;
    }

    const payload = buildTextOutput(delivery, taskDescription, approvedAgentName);
    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const fileName = `${baseName}.txt`;
    triggerDownload(blobUrl, fileName);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  }

  const containerClass =
    layout === "main"
      ? "flex h-full min-w-0 flex-1 flex-col overflow-y-auto border-l border-zinc-200 bg-white px-6 pt-6 pb-6 xl:px-8"
      : "flex h-full w-72 flex-shrink-0 flex-col overflow-y-auto border-l border-zinc-200 bg-white px-5 pt-6 pb-6 xl:w-80";

  return (
    <div className={containerClass}>
      <div className="mb-5">
        <p className="text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">Delivery Area</p>
        <p className="mt-1 text-xs text-zinc-500">
          Final output preview and file download.
        </p>
      </div>

      <div className="mb-3 rounded-lg border border-zinc-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-zinc-800">{finalFileName}</p>
            <p className="mt-0.5 truncate text-[10px] text-zinc-500">{delivery.title}</p>
          </div>
          <button
            type="button"
            onClick={downloadFinalOutput}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            {hasComicFrames ? `Download ${comicFrames.length} Panels` : "Download"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-zinc-900">{delivery.title}</p>
            <p className="mt-1 text-[10px] text-zinc-500">{approvedAgentName}</p>
          </div>
          <span className="font-mono text-sm font-bold text-zinc-700">${quoteUsd.toFixed(2)}</span>
        </div>

        <div className="mt-2 overflow-hidden rounded border border-zinc-200 bg-zinc-50">
          {hasComicFrames ? (
            <div className="grid grid-cols-2 gap-2 p-2">
              {comicFrames.map((frame) => (
                <figure
                  key={frame.panelNumber}
                  className="overflow-hidden rounded border border-zinc-200 bg-white"
                >
                  <img
                    src={frame.imageDataUrl}
                    alt={`Comic panel ${frame.panelNumber}`}
                    className="aspect-square w-full object-cover"
                  />
                  <figcaption className="border-t border-zinc-100 px-2 py-1 text-[10px] text-zinc-500">
                    Panel {frame.panelNumber}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : primaryDataUrl ? (
            <img src={primaryDataUrl} alt="Final output preview" className="w-full" />
          ) : (
            <div className="flex h-44 w-full items-center justify-center text-[11px] text-zinc-400">
              Visual preview unavailable
            </div>
          )}
        </div>

        {delivery.highlights.length > 0 && (
          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-2">
            <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">Highlights</p>
            <div className="mt-1.5 space-y-1">
              {delivery.highlights.map((highlight, idx) => (
                <p key={`${idx}-${highlight.slice(0, 20)}`} className="text-[11px] text-zinc-700">
                  • {highlight}
                </p>
              ))}
            </div>
          </div>
        )}

        {delivery.generatorNotes && (
          <div className="mt-3 rounded-md border border-zinc-200 bg-white p-2">
            <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">Generator Notes</p>
            <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-zinc-700">
              {delivery.generatorNotes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
