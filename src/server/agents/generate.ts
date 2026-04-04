import { getGeminiClient } from "./gemini-client";
import { getPersona } from "./personas";
import type { GenerateImageResult, ImageAgentId } from "@/types/agent";

const MODEL = "gemini-3.1-flash-image-preview";

export async function generateImage(
  agentId: ImageAgentId,
  prompt: string,
): Promise<GenerateImageResult> {
  const persona = getPersona(agentId);
  if (!persona) throw new Error(`Unknown agent: ${agentId}`);

  const client = getGeminiClient();

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      { role: "user", parts: [{ text: prompt }] },
    ],
    config: {
      systemInstruction: persona.systemPrompt,
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  let imageBase64 = "";
  let mimeType = "image/png";
  let textResponse = "";

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageBase64 = part.inlineData.data ?? "";
        mimeType = part.inlineData.mimeType ?? "image/png";
      } else if (part.text) {
        textResponse += part.text;
      }
    }
  }

  if (!imageBase64) {
    throw new Error(`Agent ${persona.name} did not return an image`);
  }

  return {
    agentId,
    agentName: persona.name,
    imageBase64,
    mimeType,
    textResponse: textResponse.trim(),
  };
}
