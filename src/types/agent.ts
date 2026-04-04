// Image generation agent types

export type ImageAgentId = "agent-alpha" | "agent-beta" | "agent-gamma";
export type AgentTaskKind = "generic-image" | "four-panel-comic";
export type AgentExecutionPhase = "sample" | "deliver";
export type AgentExecutionPlanSummary = {
  concept: string;
  samplePlan: string;
  deliverPlan: string;
  qualityRisk: string;
  panelFlow: string[];
};

export type GeneratedComicFrame = {
  panelNumber: number;
  beat: string;
  imageBase64: string;
  mimeType: string;
};

export type AgentPersona = {
  id: ImageAgentId;
  name: string;
  style: string;
  personality: string;
  taste: string;
  skills: string[];
  samplePlaybook: string;
  deliverPlaybook: string;
  systemPrompt: string;
  pricingHint: string;
};

export type GenerateImageRequest = {
  agentId: ImageAgentId;
  prompt: string;
};

export type GenerateImageResult = {
  agentId: ImageAgentId;
  agentName: string;
  imageBase64: string;
  mimeType: string;
  textResponse: string;
  taskKind: AgentTaskKind;
  plan: AgentExecutionPlanSummary;
  comicFrames?: GeneratedComicFrame[];
};

export type GenerateImageOptions = {
  taskKind?: AgentTaskKind;
  phase?: AgentExecutionPhase;
};
