import type { AgentTaskKind } from "@/types/agent";

// Primitives
import type { ImageAgentId } from "@/types/agent";

export type FlowStage = "idle" | "agentic" | "bidding" | "evaluating" | "delivered" | "error";

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
  avatar: string;
  bidLine: string;
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
  imageDataUrl?: string;
  taskKind?: AgentTaskKind;
  persona?: SamplePersonaProfile;
  plan?: SampleExecutionPlan;
  scoreBreakdown?: SampleScoreBreakdown;
};

export type SamplePersonaProfile = {
  personality: string;
  taste: string;
  skills: string[];
};

export type SampleExecutionPlan = {
  concept: string;
  samplePlan: string;
  deliverPlan: string;
  qualityRisk: string;
  panelFlow: string[];
};

export type SampleScoreBreakdown = {
  quality: number;
  price: number;
  speed: number;
};

export type AuditEvent = {
  id: string;
  label: string;
  status: "logged" | "pending" | "failed";
  txUrl: string;
  hcsSequenceNumber?: number;
};

export type DeliveryReport = {
  title: string;
  highlights: string[];
  markdownPreview: string;
  taskKind?: AgentTaskKind;
  imageDataUrl?: string;
  comicFrames?: DeliveryComicFrame[];
  generatorNotes?: string;
};

export type DeliveryComicFrame = {
  panelNumber: number;
  beat: string;
  imageDataUrl: string;
};

export type AgentShortlist = {
  shortlistedAgentIds: ImageAgentId[];
  rationale: string;
};

// Orchestrator-generated messages (backend owns the narrative)

export type OrchestratorMessage = {
  id: string;
  ts: number;
  text: string;
  kind: "text" | "scoreCanvas" | "thought" | "toolCall";
  samples?: SampleEvaluation[];
  options?: string[];
};

// Session (server-owned state machine)

export type IntentInput = {
  taskDescription: string;
  budgetUsd: number;
  weights: IntentWeights;
};

export type AuditSessionState =
  | { stage: "agentic" }
  | {
      stage: "bidding";
      visibleBids: AgentBid[];
      countdownSeconds: number;
      shortlist?: AgentShortlist;
    }
  | {
      stage: "evaluating";
      bids: AgentBid[];
      samples: SampleEvaluation[];
      shortlist?: AgentShortlist;
    }
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
  pendingQuestion?: { question: string; options?: string[] };
  messages: OrchestratorMessage[];
  auditTrail: AuditEvent[];
  createdAt: number;
  updatedAt: number;
};

// UI layer types

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  kind: "text" | "scoreCanvas" | "thought" | "toolCall";
  text: string;
  samples?: SampleEvaluation[];
  options?: string[];
};

// API response shapes

export type ApiError = { error: string };
export type SessionResponse = { session: AuditSession };
export type CreateSessionResponse = { sessionId: string; session: AuditSession };
