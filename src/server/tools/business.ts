import { fetchAllBids, fetchAllSamples } from "@/server/agent-client";
import { llmJudgeScore } from "@/server/judge";
import { normalizeWeights } from "@/lib/audit-demo-data";
import type { FunctionDeclaration } from "@google/genai";
import type { IntentWeights, SampleEvaluation } from "@/types/audit";

// Session-scoped sample store so the agent loop can reference them later.
// Key: sessionId, Value: latest scored samples
const sampleStore = new Map<string, SampleEvaluation[]>();

export function getStoredSamples(sessionId: string): SampleEvaluation[] {
  return sampleStore.get(sessionId) ?? [];
}

export const businessFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "broadcast_rfq",
    description:
      "Broadcast a Request for Quotation to the agent market. Each agent evaluates the task and returns a bid with price, ETA, and confidence. Returns an array of bids.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        taskDescription: {
          type: "string",
          description: "Full description of the task to be completed.",
        },
        budgetUsd: {
          type: "number",
          description: "Total budget in USD.",
        },
      },
      required: ["taskDescription", "budgetUsd"],
      additionalProperties: false,
    },
  },
  {
    name: "request_samples",
    description:
      "Request trial samples from agents. Each agent generates an image sample for the task. Returns sample metadata with scores initialized to 0.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        taskDescription: {
          type: "string",
          description: "Task description to generate samples for.",
        },
      },
      required: ["taskDescription"],
      additionalProperties: false,
    },
  },
  {
    name: "score_samples",
    description:
      "Run the LLM Judge to score all current samples. Uses multimodal evaluation to compare image quality, relevance, and value. Returns scored and ranked samples.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        taskDescription: {
          type: "string",
          description: "Original task description for scoring context.",
        },
        weights: {
          type: "object",
          description: "Scoring weights.",
          properties: {
            quality: { type: "number" },
            price: { type: "number" },
            speed: { type: "number" },
          },
          required: ["quality", "price", "speed"],
          additionalProperties: false,
        },
      },
      required: ["taskDescription", "weights"],
      additionalProperties: false,
    },
  },
];

export async function executeBusinessTool(
  name: string,
  args: Record<string, unknown>,
  sessionId: string,
): Promise<unknown> {
  switch (name) {
    case "broadcast_rfq": {
      const taskDescription = args.taskDescription as string;
      const budgetUsd = args.budgetUsd as number;
      const bids = await fetchAllBids(taskDescription, budgetUsd);
      return {
        bidCount: bids.length,
        bids: bids.map((b) => ({
          agentId: b.id,
          agentName: b.agentName,
          style: b.model,
          trialQuoteUsd: b.trialQuoteUsd,
          quoteUsd: b.quoteUsd,
          etaMinutes: b.etaMinutes,
          reputation: b.reputation,
        })),
      };
    }
    case "request_samples": {
      const taskDescription = args.taskDescription as string;
      const samples = await fetchAllSamples(taskDescription);
      sampleStore.set(sessionId, samples);
      // Return metadata only — images are stored in sampleStore
      return {
        sampleCount: samples.length,
        samples: samples.map((s) => ({
          agentId: s.agentId,
          agentName: s.agentName,
          model: s.model,
          summary: s.summary,
          hasImage: !!s.imageDataUrl,
        })),
      };
    }
    case "score_samples": {
      const taskDescription = args.taskDescription as string;
      const rawWeights = args.weights as IntentWeights;
      const weights = normalizeWeights(rawWeights);
      const samples = sampleStore.get(sessionId);
      if (!samples || samples.length === 0) {
        return { error: "No samples available. Call request_samples first." };
      }
      const scored = await llmJudgeScore(samples, taskDescription, weights);
      sampleStore.set(sessionId, scored);
      return {
        scores: scored.map((s) => ({
          agentId: s.agentId,
          agentName: s.agentName,
          score: Math.round(s.score * 100),
          recommendation: s.recommendation,
        })),
      };
    }
    default:
      return { error: `Unknown business tool: ${name}` };
  }
}
