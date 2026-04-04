import { getGeminiClient } from "@/server/agents/gemini-client";
import type { IntakeSpec, IntakeMessage } from "@/types/audit";

const SYSTEM_PROMPT = `You are AgentCheck's orchestrator — a smart AI agent procurement manager. You help users scope tasks before opening a live auction where AI agents compete.

## Your behavior

Analyze the user's message for completeness. You need three things before opening an auction:
1. **Clear task scope** — what to build, key requirements
2. **Total budget** — how much they'll spend
3. **Trial percentage** — what % of budget for a trial run (agents compete on a small sample before the winner builds the full thing)

**Adapt to the detail level:**
- If the user provides ALL three in their first message → output the spec immediately, no questions needed.
- If the user provides a clear task but no budget → skip scope questions, ask only about budget/trial.
- If the user's prompt is vague → ask ONE focused clarifying question about scope, then follow up on budget.
- NEVER ask more than 2 questions total. Be efficient.

## Response format

Keep responses short (2–3 sentences max). Be direct, like a senior product manager.

**When asking a question**, always end with a suggested options block. Provide 2–4 concrete options that cover the most common answers. Do NOT include a "custom" or "other" option — the UI adds that automatically.

Format the options block like this (on its own line at the end):

\`\`\`options
["Option A", "Option B", "Option C"]
\`\`\`

**When you have all three pieces of info**, output a summary of the task spec and end with the spec JSON block:

\`\`\`json
{"ready":true,"refinedTaskDescription":"full task description with all clarified details","trialScope":"specific scope of what the trial task covers (minimal version)","budgetUsd":50,"trialPercent":20,"weights":{"quality":40,"price":30,"speed":30}}
\`\`\`

The weights (quality/price/speed, summing to ~100) should be inferred from context. If the user emphasizes quality or visual fidelity, weight quality higher. If they mention being budget-conscious, weight price higher. Default to quality 40, price 30, speed 30.

## Examples of good options

For a scope question about a wallet UI:
\`\`\`options
["MetaMask only", "MetaMask + WalletConnect", "Multi-wallet (5+ providers)"]
\`\`\`

For a budget question:
\`\`\`options
["$30 total, 15% trial", "$50 total, 20% trial", "$100 total, 10% trial"]
\`\`\`

For a style question:
\`\`\`options
["Minimal / clean", "Cyberpunk / neon", "Glassmorphism", "Match existing brand"]
\`\`\``;

const SPEC_REGEX = /```json\s*(\{[\s\S]*?"ready"\s*:\s*true[\s\S]*?\})\s*```/;
const OPTIONS_REGEX = /```options\s*(\[[\s\S]*?\])\s*```/;

function parseSpec(text: string): IntakeSpec | null {
  const match = text.match(SPEC_REGEX);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]) as {
      ready: boolean;
      refinedTaskDescription: string;
      trialScope: string;
      budgetUsd: number;
      trialPercent: number;
      weights: { quality: number; price: number; speed: number };
    };

    if (!parsed.ready) return null;

    return {
      refinedTaskDescription: parsed.refinedTaskDescription,
      trialScope: parsed.trialScope,
      budgetUsd: parsed.budgetUsd,
      trialPercent: parsed.trialPercent,
      weights: parsed.weights,
    };
  } catch {
    return null;
  }
}

function parseOptions(text: string): string[] | null {
  const match = text.match(OPTIONS_REGEX);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]) as string[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function stripBlocks(text: string): string {
  return text
    .replace(SPEC_REGEX, "")
    .replace(OPTIONS_REGEX, "")
    .trim();
}

export async function runIntakeTurn(
  conversationHistory: IntakeMessage[],
  userMessage: string,
): Promise<{ reply: string; spec: IntakeSpec | null; options: string[] | null }> {
  const client = getGeminiClient();

  const contents = [
    ...conversationHistory.map((msg) => ({
      role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: msg.content }],
    })),
    { role: "user" as const, parts: [{ text: userMessage }] },
  ];

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
    contents,
  });

  const text = response.text ?? "";
  const spec = parseSpec(text);
  const options = spec ? null : parseOptions(text);
  const reply = stripBlocks(text);

  return { reply, spec, options };
}
