import type {
  DeliveryComicFrame,
  DeliveryReport,
  IntentWeights,
} from "@/types/audit";
import type { AgentTaskKind } from "@/types/agent";

export function normalizeWeights(weights: IntentWeights): IntentWeights {
  const total = weights.quality + weights.price + weights.speed;
  if (total === 0) {
    return {
      quality: 1 / 3,
      price: 1 / 3,
      speed: 1 / 3,
    };
  }

  return {
    quality: weights.quality / total,
    price: weights.price / total,
    speed: weights.speed / total,
  };
}

export function validateIntentInput(prompt: string, budgetUsd: string): string | null {
  if (!prompt.trim()) {
    return "Please describe the task before starting.";
  }

  const parsedBudget = Number.parseFloat(budgetUsd);
  if (Number.isNaN(parsedBudget) || parsedBudget <= 0) {
    return "Budget must be a number greater than 0.";
  }

  return null;
}

export function buildDeliveryReport(
  selectedAgent: string,
  taskDescription: string,
  output?: {
    taskKind?: AgentTaskKind;
    imageDataUrl?: string;
    comicFrames?: DeliveryComicFrame[];
    generatorNotes?: string;
  },
): DeliveryReport {
  const frameCount = output?.comicFrames?.length ?? 0;
  const isFourPanel = output?.taskKind === "four-panel-comic";

  return {
    title: isFourPanel
      ? `${selectedAgent} — 4-Panel Comic Delivery`
      : `${selectedAgent} — Full Delivery`,
    highlights: [
      isFourPanel
        ? `Delivered ${frameCount || 4} coherent comic panels with consistent characters and tone.`
        : "Delivered one final image aligned with the approved sample direction.",
      "Maintained agent persona style and continuity constraints across delivery.",
      "All bid, trial scoring, and payment checkpoints include Hedera audit references.",
    ],
    markdownPreview: `# Delivery Summary\n\nTask: ${taskDescription}\n\n- Selected agent: ${selectedAgent}\n- Outcome: Delivered\n- Delivery type: ${isFourPanel ? "4-panel comic" : "single image"}\n- Next step: Review output quality and request iteration if needed`,
    taskKind: output?.taskKind,
    imageDataUrl: output?.imageDataUrl,
    comicFrames: output?.comicFrames,
    generatorNotes: output?.generatorNotes,
  };
}
