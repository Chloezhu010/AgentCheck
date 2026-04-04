// Primitives

export type FlowStage = "idle" | "bidding" | "evaluating" | "delivered" | "error";

export type IntentWeights = {
  quality: number;
  price: number;
  speed: number;
};

// Domain models (used by server + lib)

export type AgentBid = {
  id: string;
  agentName: string;
  model: string;
  trialQuoteUsd: number;
  quoteUsd: number;
  etaMinutes: number;
  reputation: number;
  verified: boolean;
};

export type SampleEvaluation = {
  id: string;
  agentId: string;
  agentName: string;
  model: string;
  score: number;
  recommendation: string;
  sampleTitle: string;
  summary: string;
};

export type AuditEvent = {
  id: string;
  label: string;
  status: "logged" | "pending";
  txUrl: string;
};

export type DeliveryReport = {
  title: string;
  highlights: string[];
  markdownPreview: string;
};

// Session (server-owned state machine) 

export type IntentInput = {
  taskDescription: string;
  budgetUsd: number;
  weights: IntentWeights;
};

export type AuditSessionState =
  | { stage: "bidding"; visibleBids: AgentBid[]; countdownSeconds: number }
  | { stage: "evaluating"; bids: AgentBid[]; samples: SampleEvaluation[] }
  | {
      stage: "delivered";
      approvedAgentId: string;
      approvedAgentName: string;
      quoteUsd: number;
      delivery: DeliveryReport;
      auditEvents: AuditEvent[];
    }
  | { stage: "error"; message: string };

export type AuditSession = {
  id: string;
  input: IntentInput;
  state: AuditSessionState;
  createdAt: number;
  updatedAt: number;
};

// UI layer types

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  kind: "text" | "scoreCanvas";
  text: string;
  samples?: SampleEvaluation[];
};

// API response shapes

export type ApiError = { error: string };
export type SessionResponse = { session: AuditSession };
export type CreateSessionResponse = { sessionId: string; session: AuditSession };
