import type { FunctionDeclaration } from "@google/genai";

export const controlFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "ask_user",
    description:
      "Pause the agent loop and ask the user a question. Use this when you need user confirmation or a decision, such as approving a shortlist or selecting an agent. The loop will resume when the user responds.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The question to ask the user.",
        },
        options: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional suggested answer options for the user to pick from.",
        },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },
];
