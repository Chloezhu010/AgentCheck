import { getGeminiClient } from "@/server/agents/gemini-client";
import type { SampleEvaluation, IntentWeights } from "@/types/audit";
import type { Content, Part } from "@google/genai";

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
1. A score from 0.00 to 1.00 (weighted by the criteria above)
2. A one-sentence recommendation explaining your score

Return ONLY valid JSON, no markdown fencing:
[{"agentId": "...", "score": 0.XX, "recommendation": "..."}]

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
    model: "gemini-3-flash-preview",
    contents,
  });

  const text = response.text ?? "";
  const jsonMatch = text.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) return samples;

  try {
    const scores = JSON.parse(jsonMatch[0]) as Array<{
      agentId: string;
      score: number;
      recommendation: string;
    }>;

    return samples
      .map((sample) => {
        const entry = scores.find((s) => s.agentId === sample.agentId);
        if (!entry) return sample;
        return {
          ...sample,
          score: Math.max(0, Math.min(1, entry.score)),
          recommendation: entry.recommendation || sample.recommendation,
        };
      })
      .sort((a, b) => b.score - a.score);
  } catch {
    return samples;
  }
}
