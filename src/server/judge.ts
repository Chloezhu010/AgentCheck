import { getGeminiClient } from "@/server/agents/gemini-client";
import type { SampleEvaluation, IntentWeights } from "@/types/audit";
import { Type } from "@google/genai";
import type { Content, Part } from "@google/genai";

const TEXT_MODEL = process.env.AGENT_TEXT_MODEL ?? "gemini-3-flash-preview";

type JudgeScore = {
  agentId: string;
  score: number;
  qualityScore: number;
  priceScore: number;
  speedScore: number;
  recommendation: string;
};

// LLM judge: comparative scoring of samples using Gemini
export async function llmJudgeScore(
  samples: SampleEvaluation[],
  taskDescription: string,
  weights: IntentWeights,
): Promise<SampleEvaluation[]> {
  const client = getGeminiClient();

  const parts: Part[] = [
    {
      text: `You are an impartial judge evaluating AI-generated image samples.

Task requested: "${taskDescription}"

Scoring criteria weights:
- Visual quality: ${Math.round(weights.quality * 100)}%
- Value for price: ${Math.round(weights.price * 100)}%
- Speed/efficiency: ${Math.round(weights.speed * 100)}%

Below are ${samples.length} samples. For each, provide:
- score: number in [0, 1], weighted by the criteria above
- qualityScore: number in [0, 1]
- priceScore: number in [0, 1]
- speedScore: number in [0, 1]
- recommendation: one concise sentence

Samples:`,
    },
  ];

  for (const sample of samples) {
    parts.push({
      text: `\n--- ${sample.agentName} (${sample.agentId}) ---\nStyle: ${sample.model}\nDescription: ${sample.summary}`,
    });

    if (sample.imageDataUrl) {
      const match = sample.imageDataUrl.match(/^data:(.+?);base64,(.+)$/);
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }
  }

  const contents: Content[] = [{ role: "user", parts }];

  const response = await client.models.generateContent({
    model: TEXT_MODEL,
    contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scores: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                agentId: { type: Type.STRING },
                score: { type: Type.NUMBER },
                qualityScore: { type: Type.NUMBER },
                priceScore: { type: Type.NUMBER },
                speedScore: { type: Type.NUMBER },
                recommendation: { type: Type.STRING },
              },
              required: [
                "agentId",
                "score",
                "qualityScore",
                "priceScore",
                "speedScore",
                "recommendation",
              ],
            },
          },
        },
        required: ["scores"],
      },
      temperature: 0.2,
    },
  });

  const parsedScores = parseScores(response.text);
  if (!parsedScores) return samples;

  return samples
    .map((sample) => {
      const entry = parsedScores.find((s) => s.agentId === sample.agentId);
      if (!entry) return sample;
      return {
        ...sample,
        score: Math.max(0, Math.min(1, entry.score)),
        recommendation: entry.recommendation || sample.recommendation,
        scoreBreakdown: {
          quality: Math.max(0, Math.min(1, entry.qualityScore)),
          price: Math.max(0, Math.min(1, entry.priceScore)),
          speed: Math.max(0, Math.min(1, entry.speedScore)),
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}

function parseScores(rawText: string | undefined): JudgeScore[] | null {
  if (!rawText) return null;

  try {
    const value = JSON.parse(rawText) as unknown;
    const rawScores =
      Array.isArray(value)
        ? value
        : typeof value === "object" && value !== null && Array.isArray((value as { scores?: unknown }).scores)
          ? (value as { scores: unknown[] }).scores
          : null;

    if (!rawScores) return null;

    const scores = rawScores.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const obj = item as Record<string, unknown>;
      if (
        typeof obj.agentId !== "string" ||
        typeof obj.score !== "number" ||
        typeof obj.qualityScore !== "number" ||
        typeof obj.priceScore !== "number" ||
        typeof obj.speedScore !== "number" ||
        typeof obj.recommendation !== "string"
      ) {
        return [];
      }
      return [
        {
          agentId: obj.agentId,
          score: obj.score,
          qualityScore: obj.qualityScore,
          priceScore: obj.priceScore,
          speedScore: obj.speedScore,
          recommendation: obj.recommendation.trim(),
        } satisfies JudgeScore,
      ];
    });

    return scores.length > 0 ? scores : null;
  } catch {
    return null;
  }
}
