import type { Content } from "@google/genai";
import type { ImageAgentId } from "@/types/agent";
import type { AgentBid, AuditSession, OrchestratorMessage } from "@/types/audit";

export type SelectedAgent = {
  agentId: string;
  agentName: string;
  quoteUsd: number;
};

export type SessionEntry = {
  session: AuditSession;
  agentHistory: Content[];
  loopRunning: boolean;
  currentBids: AgentBid[];
  trialAgentIds?: ImageAgentId[];
  selectedAgent?: SelectedAgent;
  pendingAskCallId?: string;
};

export const sessions = new Map<string, SessionEntry>();

export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function makeMsg(
  text: string,
  kind: OrchestratorMessage["kind"] = "text",
  extras?: Partial<OrchestratorMessage>,
): OrchestratorMessage {
  return { id: generateMessageId(), ts: Date.now(), text, kind, ...extras };
}
