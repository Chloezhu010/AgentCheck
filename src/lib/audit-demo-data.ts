import type {
  AgentBid,
  AuditEvent,
  DeliveryReport,
  IntentWeights,
  SampleEvaluation,
} from "@/types/audit";

export const biddingWindowSeconds = 15;

export const seededBids: AgentBid[] = [
  {
    id: "agent-alpha",
    agentName: "Agent Alpha",
    model: "GPT-5.4",
    trialQuoteUsd: 3.20,
    quoteUsd: 18,
    etaMinutes: 45,
    reputation: 0.85,
    verified: true,
  },
  {
    id: "agent-beta",
    agentName: "Agent Beta",
    model: "Claude 4.6 Sonnet",
    trialQuoteUsd: 4.10,
    quoteUsd: 22,
    etaMinutes: 60,
    reputation: 0.91,
    verified: true,
  },
  {
    id: "agent-gamma",
    agentName: "Agent Gamma",
    model: "Gemini 2.5 Pro",
    trialQuoteUsd: 2.60,
    quoteUsd: 14,
    etaMinutes: 90,
    reputation: 0.78,
    verified: true,
  },
];

export const sampleEvaluations: SampleEvaluation[] = [
  {
    id: "sample-agent-beta",
    agentId: "agent-beta",
    agentName: "Agent Beta",
    model: "Claude 4.6 Sonnet",
    score: 0.92,
    recommendation:
      "Best neon styling and cleanest connect/disconnect state. Slightly higher cost but strongest visual fidelity.",
    sampleTitle: "Cyberpunk Wallet Connect — Trial",
    summary:
      "Neon cyan/magenta border glow, monospace font, animated pulse on hover. MetaMask + WalletConnect buttons with correct connected/disconnected states.",
  },
  {
    id: "sample-agent-alpha",
    agentId: "agent-alpha",
    agentName: "Agent Alpha",
    model: "GPT-5.4",
    score: 0.85,
    recommendation:
      "Good cyberpunk aesthetic, solid state handling. Neon effects slightly muted vs Beta.",
    sampleTitle: "Cyberpunk Wallet Connect — Trial",
    summary:
      "Dark background with green neon accents, connect/disconnect toggle works. Missing WalletConnect icon treatment.",
  },
  {
    id: "sample-agent-gamma",
    agentId: "agent-gamma",
    agentName: "Agent Gamma",
    model: "Gemini 2.5 Pro",
    score: 0.71,
    recommendation:
      "Functional but minimal styling. Doesn't capture the cyberpunk aesthetic well enough.",
    sampleTitle: "Cyberpunk Wallet Connect — Trial",
    summary:
      "Basic button with purple border. Connect state works but no animations, no wallet icons, generic look.",
  },
];

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

export function buildAuditEvents(selectedAgent: string): AuditEvent[] {
  return [
    {
      id: "intent-log",
      label: "Intent parsed and RFQ opened",
      status: "logged",
      txUrl: "https://hashscan.io/testnet/transaction/0.0.1001-1710000000",
    },
    {
      id: "sample-log",
      label: `Trial scores logged — ${selectedAgent} selected`,
      status: "logged",
      txUrl: "https://hashscan.io/testnet/transaction/0.0.1001-1710000001",
    },
    {
      id: "payment-log",
      label: "Escrow release receipt",
      status: "logged",
      txUrl: "https://hashscan.io/testnet/transaction/0.0.1001-1710000002",
    },
  ];
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
