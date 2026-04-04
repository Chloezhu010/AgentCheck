import { getGeminiClient } from "./gemini-client";
import { getPersona } from "./personas";
import { Type } from "@google/genai";
import type {
  AgentExecutionPhase,
  AgentExecutionPlanSummary,
  AgentPersona,
  AgentTaskKind,
  GenerateImageOptions,
  GenerateImageResult,
  GeneratedComicFrame,
  ImageAgentId,
} from "@/types/agent";

const IMAGE_MODEL = process.env.AGENT_IMAGE_MODEL ?? "gemini-2.5-flash-image";
const TEXT_MODEL = process.env.AGENT_TEXT_MODEL ?? "gemini-3-flash-preview";

type AgentExecutionPlan = {
  taskKind: AgentTaskKind;
  concept: string;
  imagePrompt: string;
  samplePlan: string;
  deliverPlan: string;
  panelFlow: string[];
  qualityRisk: string;
};

export async function generateImage(
  agentId: ImageAgentId,
  prompt: string,
  options: GenerateImageOptions = {},
): Promise<GenerateImageResult> {
  const persona = getPersona(agentId);
  if (!persona) throw new Error(`Unknown agent: ${agentId}`);

  const plan = await buildExecutionPlan(persona, prompt, options.taskKind);
  const taskKind = plan.taskKind;
  const phase = options.phase ?? "sample";
  const client = getGeminiClient();

  if (taskKind === "four-panel-comic" && phase === "deliver") {
    const comicFrames = await generateFourPanelComicFrames(client, persona, prompt, plan);
    const firstFrame = comicFrames[0];
    return {
      agentId,
      agentName: persona.name,
      imageBase64: firstFrame.imageBase64,
      mimeType: firstFrame.mimeType,
      textResponse: buildFourPanelNarration(plan, comicFrames),
      taskKind,
      plan: toPlanSummary(plan),
      comicFrames,
    };
  }

  const response = await client.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      { role: "user", parts: [{ text: buildTaskAwarePrompt(persona, prompt, phase, plan) }] },
    ],
    config: {
      systemInstruction: buildSystemInstruction(persona),
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  let { imageBase64, mimeType, textResponse } = extractImageAndText(
    response.candidates?.[0]?.content?.parts,
  );

  if (!imageBase64 && taskKind === "four-panel-comic" && phase === "sample") {
    const retryResponse = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Retry sample generation.

Task:
${prompt}

Planned concept:
${plan.concept}

Hard requirement: return exactly ONE sample image now. Do not output a text-only response.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: buildSystemInstruction(persona),
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    ({ imageBase64, mimeType, textResponse } = extractImageAndText(
      retryResponse.candidates?.[0]?.content?.parts,
    ));
  }

  if (!imageBase64) {
    throw new Error(`Agent ${persona.name} did not return an image`);
  }

  const narration = textResponse.trim() || buildPlanSummary(taskKind, phase, plan);

  return {
    agentId,
    agentName: persona.name,
    imageBase64,
    mimeType,
    textResponse: narration,
    taskKind,
    plan: toPlanSummary(plan),
  };
}

async function generateFourPanelComicFrames(
  client: ReturnType<typeof getGeminiClient>,
  persona: AgentPersona,
  prompt: string,
  plan: AgentExecutionPlan,
): Promise<GeneratedComicFrame[]> {
  const panelFlow =
    plan.panelFlow.length === 4
      ? plan.panelFlow
      : ["Setup", "Escalation", "Twist", "Resolution"];
  const frames: GeneratedComicFrame[] = [];

  for (let i = 0; i < panelFlow.length; i += 1) {
    const beat = panelFlow[i];
    const previousPanels = panelFlow
      .slice(0, i)
      .map((step, idx) => `Panel ${idx + 1}: ${step}`)
      .join("\n");

    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Task:
${prompt}

Global concept:
${plan.concept}

Delivery phase: FINAL COMIC (4 sequential images)

Panel to generate now: Panel ${i + 1} of 4
Current beat: ${beat}

Planned panel flow:
${panelFlow.map((step, idx) => `Panel ${idx + 1}: ${step}`).join("\n")}

Continuity rules (strict):
- Keep the same main characters, outfits, and proportions across all panels.
- Keep visual style, lighting logic, and environment identity consistent.
- Treat this panel as one frame in a coherent sequence, not an isolated artwork.
- Maintain left-to-right narrative readability for a comic.

Previous panels already generated:
${previousPanels || "None yet (this is panel 1)."}

Output requirements:
- Return exactly ONE image for Panel ${i + 1}.
- Also return one concise line describing panel action for continuity tracking.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: buildSystemInstruction(persona),
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    let { imageBase64, mimeType } = extractImageAndText(
      response.candidates?.[0]?.content?.parts,
    );

    if (!imageBase64) {
      const retryResponse = await client.models.generateContent({
        model: IMAGE_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Retry Panel ${i + 1}.
Return exactly one image for the beat "${beat}".
No text-only output.`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: buildSystemInstruction(persona),
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      ({ imageBase64, mimeType } = extractImageAndText(
        retryResponse.candidates?.[0]?.content?.parts,
      ));
    }

    if (!imageBase64) {
      throw new Error(`Agent ${persona.name} did not return image for panel ${i + 1}`);
    }

    frames.push({
      panelNumber: i + 1,
      beat,
      imageBase64,
      mimeType,
    });
  }

  return frames;
}

function buildFourPanelNarration(
  plan: AgentExecutionPlan,
  frames: GeneratedComicFrame[],
): string {
  const flow = frames
    .map((frame) => `Panel ${frame.panelNumber}: ${frame.beat}`)
    .join("\n");
  return `Final delivery generated as 4 coherent comic panels.\nConcept: ${plan.concept}\n${flow}`;
}

function buildSystemInstruction(persona: AgentPersona): string {
  return `${persona.systemPrompt}

You are operating as an independent sub-agent in a multi-agent creative market.
Profile:
- Personality: ${persona.personality}
- Taste: ${persona.taste}
- Skills: ${persona.skills.join(", ")}
- Sample playbook: ${persona.samplePlaybook}
- Deliver playbook: ${persona.deliverPlaybook}

Keep your own taste and decision-making style. Do not imitate the other agents.`;
}

function buildTaskAwarePrompt(
  persona: AgentPersona,
  prompt: string,
  phase: AgentExecutionPhase,
  plan: AgentExecutionPlan,
): string {
  if (plan.taskKind === "four-panel-comic") {
    if (phase === "sample") {
      return `Main task request:
${prompt}

Execution phase: SAMPLE

Goal:
- Provide one representative sample image for your four-panel comic approach.
- This is not final delivery yet.

Structured plan (from Gemini 3 Flash):
- Concept: ${plan.concept}
- Image prompt draft: ${plan.imagePrompt}
- Panel flow: ${plan.panelFlow.join(" | ")}
- Sample plan: ${plan.samplePlan}
- Delivery plan: ${plan.deliverPlan}
- Main risk: ${plan.qualityRisk}

Requirements:
- Return exactly ONE image.
- The image should be a key frame that demonstrates your style, characters, and tone for the comic.
- Do NOT deliver all four panels in sample phase.
- Also return short text with:
  1) one-line concept,
  2) planned panel flow (Panel 1-4),
  3) main quality risk to watch in final delivery.

Follow your persona playbook:
- Sample playbook: ${persona.samplePlaybook}`;
    }

    return `Main task request:
${prompt}

Execution phase: DELIVER

Goal:
- Deliver the final four-panel comic.

Structured plan (from Gemini 3 Flash):
- Concept: ${plan.concept}
- Image prompt draft: ${plan.imagePrompt}
- Panel flow: ${plan.panelFlow.join(" | ")}
- Delivery plan: ${plan.deliverPlan}
- Main risk: ${plan.qualityRisk}

Requirements:
- Return one final image that contains all 4 panels in a readable 2x2 layout.
- Keep character identity and visual language consistent across all panels.
- Ensure text/dialog is clear and panel progression is easy to follow.
- Also return a short self-check summary for story clarity and continuity.

Follow your persona playbook:
- Deliver playbook: ${persona.deliverPlaybook}`;
  }

  if (phase === "deliver") {
    return `Main task request:
${prompt}

Execution phase: DELIVER

Structured plan (from Gemini 3 Flash):
- Concept: ${plan.concept}
- Image prompt draft: ${plan.imagePrompt}
- Delivery plan: ${plan.deliverPlan}
- Main risk: ${plan.qualityRisk}

Return one final high-quality image and a short quality self-check summary.`;
  }

  return `Main task request:
${prompt}

Execution phase: SAMPLE

Structured plan (from Gemini 3 Flash):
- Concept: ${plan.concept}
- Image prompt draft: ${plan.imagePrompt}
- Sample plan: ${plan.samplePlan}
- Main risk: ${plan.qualityRisk}

Return exactly one sample image plus brief notes about your creative approach.`;
}

async function buildExecutionPlan(
  persona: AgentPersona,
  taskDescription: string,
  forcedTaskKind?: AgentTaskKind,
): Promise<AgentExecutionPlan> {
  const client = getGeminiClient();

  const response = await client.models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are the planning module for ${persona.name}.

Task:
${taskDescription}

Persona profile:
- Personality: ${persona.personality}
- Taste: ${persona.taste}
- Skills: ${persona.skills.join(", ")}
- Sample playbook: ${persona.samplePlaybook}
- Deliver playbook: ${persona.deliverPlaybook}

Decide the task kind and return an execution plan for sample + deliver phases.
If this is a four-panel comic task, panelFlow must have exactly 4 concise beats.
If it is not a comic task, still provide panelFlow as an empty array.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          taskKind: {
            type: Type.STRING,
            format: "enum",
            enum: ["generic-image", "four-panel-comic"],
          },
          concept: {
            type: Type.STRING,
            description: "One sentence creative direction.",
          },
          imagePrompt: {
            type: Type.STRING,
            description: "Detailed image prompt to pass to the image model.",
          },
          samplePlan: {
            type: Type.STRING,
            description: "How to produce one representative sample image.",
          },
          deliverPlan: {
            type: Type.STRING,
            description: "How to execute full delivery after selection.",
          },
          panelFlow: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          qualityRisk: {
            type: Type.STRING,
            description: "Main risk to monitor in output quality.",
          },
        },
        required: [
          "taskKind",
          "concept",
          "imagePrompt",
          "samplePlan",
          "deliverPlan",
          "panelFlow",
          "qualityRisk",
        ],
      },
      temperature: 0.2,
    },
  });

  const parsed = safeParsePlan(response.text);
  const fallback = buildFallbackPlan(taskDescription, forcedTaskKind);
  const plan = parsed ?? fallback;

  return {
    ...plan,
    taskKind: forcedTaskKind ?? plan.taskKind,
  };
}

function safeParsePlan(rawText: string | undefined): AgentExecutionPlan | null {
  if (!rawText) return null;

  try {
    const value = JSON.parse(rawText) as Record<string, unknown>;
    if (!isTaskKind(value.taskKind)) return null;
    if (typeof value.concept !== "string" || value.concept.trim().length === 0) return null;
    if (typeof value.imagePrompt !== "string" || value.imagePrompt.trim().length === 0) return null;
    if (typeof value.samplePlan !== "string" || value.samplePlan.trim().length === 0) return null;
    if (typeof value.deliverPlan !== "string" || value.deliverPlan.trim().length === 0) return null;
    if (typeof value.qualityRisk !== "string" || value.qualityRisk.trim().length === 0) return null;

    const panelFlow = Array.isArray(value.panelFlow)
      ? value.panelFlow.filter((item): item is string => typeof item === "string")
      : [];
    const normalizedPanelFlow =
      value.taskKind === "four-panel-comic" && panelFlow.length === 4
        ? panelFlow
        : value.taskKind === "four-panel-comic"
          ? ["Setup", "Escalation", "Twist", "Resolution"]
          : [];

    return {
      taskKind: value.taskKind,
      concept: value.concept.trim(),
      imagePrompt: value.imagePrompt.trim(),
      samplePlan: value.samplePlan.trim(),
      deliverPlan: value.deliverPlan.trim(),
      panelFlow: normalizedPanelFlow,
      qualityRisk: value.qualityRisk.trim(),
    };
  } catch {
    return null;
  }
}

function buildFallbackPlan(
  taskDescription: string,
  forcedTaskKind?: AgentTaskKind,
): AgentExecutionPlan {
  const taskKind = forcedTaskKind ?? "generic-image";
  return {
    taskKind,
    concept: "Produce a strong visual direction aligned with the prompt and persona style.",
    imagePrompt: taskDescription,
    samplePlan: "Return one representative sample image that proves style and quality.",
    deliverPlan:
      taskKind === "four-panel-comic"
        ? "Deliver a complete 2x2 four-panel comic with coherent narrative progression."
        : "Deliver one final high-quality image aligned with the approved sample direction.",
    panelFlow:
      taskKind === "four-panel-comic"
        ? ["Setup", "Escalation", "Twist", "Resolution"]
        : [],
    qualityRisk: "Character or style consistency may drift between iterations.",
  };
}

function buildPlanSummary(
  taskKind: AgentTaskKind,
  phase: AgentExecutionPhase,
  plan: AgentExecutionPlan,
): string {
  if (taskKind === "four-panel-comic") {
    return `Concept: ${plan.concept}\nPanel flow: ${plan.panelFlow.join(" -> ")}\nRisk: ${plan.qualityRisk}`;
  }

  if (phase === "deliver") {
    return `Delivery plan: ${plan.deliverPlan}\nRisk: ${plan.qualityRisk}`;
  }

  return `Sample plan: ${plan.samplePlan}\nRisk: ${plan.qualityRisk}`;
}

function toPlanSummary(plan: AgentExecutionPlan): AgentExecutionPlanSummary {
  return {
    concept: plan.concept,
    samplePlan: plan.samplePlan,
    deliverPlan: plan.deliverPlan,
    qualityRisk: plan.qualityRisk,
    panelFlow: plan.panelFlow,
  };
}

function isTaskKind(value: unknown): value is AgentTaskKind {
  return value === "generic-image" || value === "four-panel-comic";
}

function extractImageAndText(
  parts: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> | undefined,
): {
  imageBase64: string;
  mimeType: string;
  textResponse: string;
} {
  let imageBase64 = "";
  let mimeType = "image/png";
  let textResponse = "";

  if (parts) {
    for (const part of parts) {
      if (part.inlineData) {
        imageBase64 = part.inlineData.data ?? "";
        mimeType = part.inlineData.mimeType ?? "image/png";
      } else if (part.text) {
        textResponse += part.text;
      }
    }
  }

  return { imageBase64, mimeType, textResponse };
}
