import type {
  DeliveryReport,
  IntentWeights,
} from "@/types/audit";

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
): DeliveryReport {
  return {
    title: `${selectedAgent} — Full Delivery`,
    highlights: [
      "Production-ready React component with MetaMask + WalletConnect support.",
      "Animated neon glow transitions, error and loading states, mobile-responsive layout.",
      "All bid, trial scoring, and payment checkpoints include Hedera audit references.",
    ],
    markdownPreview: `# Delivery Summary\n\nTask: ${taskDescription}\n\n- Selected agent: ${selectedAgent}\n- Outcome: Delivered\n- Next step: Export component or trigger next subtask auction`,
  };
}
