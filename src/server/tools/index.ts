import type { FunctionDeclaration } from "@google/genai";
import { hederaFunctionDeclarations, executeHederaTool } from "./hedera";
import { businessFunctionDeclarations, executeBusinessTool } from "./business";
import { controlFunctionDeclarations } from "./control";

export const allFunctionDeclarations: FunctionDeclaration[] = [
  ...hederaFunctionDeclarations,
  ...businessFunctionDeclarations,
  ...controlFunctionDeclarations,
];

const HEDERA_TOOLS = new Set(hederaFunctionDeclarations.map((d) => d.name));
const BUSINESS_TOOLS = new Set(businessFunctionDeclarations.map((d) => d.name));

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  sessionId: string,
): Promise<unknown> {
  if (HEDERA_TOOLS.has(name)) {
    return executeHederaTool(name, args);
  }
  if (BUSINESS_TOOLS.has(name)) {
    return executeBusinessTool(name, args, sessionId);
  }
  // ask_user is handled specially by the orchestrator loop — never executed here
  return { error: `Unknown tool: ${name}` };
}
