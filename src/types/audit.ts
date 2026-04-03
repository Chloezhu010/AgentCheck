export type FlowStage = "idle" | "bidding" | "evaluating" | "delivered" | "error";

export type IntentWeights = {
  quality: number;
  price: number;
  speed: number;
};

export type AgentBid = {
  id: string;
  agentName: string;
  quoteUsd: number;
  etaMinutes: number;
  reputation: number;
  verified: boolean;
};

export type SampleEvaluation = {
  id: string;
  agentId: string;
  agentName: string;
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

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  kind: "text" | "scoreCanvas";
  text: string;
  samples?: SampleEvaluation[];
};
