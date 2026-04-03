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
    id: "agent-a",
    agentName: "Agent A",
    quoteUsd: 16,
    etaMinutes: 90,
    reputation: 0.82,
    verified: true,
  },
  {
    id: "agent-b",
    agentName: "Agent B",
    quoteUsd: 22,
    etaMinutes: 120,
    reputation: 0.91,
    verified: true,
  },
  {
    id: "agent-c",
    agentName: "Agent C",
    quoteUsd: 13,
    etaMinutes: 150,
    reputation: 0.74,
    verified: false,
  },
];

export const sampleEvaluations: SampleEvaluation[] = [
  {
    id: "sample-agent-b",
    agentId: "agent-b",
    agentName: "Agent B",
    score: 0.89,
    recommendation:
      "Best structure and strongest evidence trail. Slightly higher cost.",
    sampleTitle: "Competitor Positioning Snapshot",
    summary:
      "Summarizes three competitors, tags pricing angles, and highlights UX conversion risks with citations.",
  },
  {
    id: "sample-agent-a",
    agentId: "agent-a",
    agentName: "Agent A",
    score: 0.84,
    recommendation:
      "Good speed/cost tradeoff. Needs tighter source confidence labels.",
    sampleTitle: "Rapid Market Brief",
    summary:
      "Fast outline with actionable bullets; fewer references and less ranking rationale.",
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
      label: `Sample scores logged and ${selectedAgent} selected`,
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
    title: `${selectedAgent} Final Delivery`,
    highlights: [
      "Top 3 competitors mapped by pricing and UX conversion risk.",
      "Recommendation includes first two experiments for quick validation.",
      "All bid, scoring, and payment checkpoints include audit references.",
    ],
    markdownPreview: `# Audit Summary\n\nTask: ${taskDescription}\n\n- Selected agent: ${selectedAgent}\n- Outcome: Delivered\n- Next step: Review report and trigger the next subtask auction`,
  };
}
