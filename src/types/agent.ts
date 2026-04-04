// Image generation agent types

export const IMAGE_AGENT_IDS = [
  "agent-alpha",
  "agent-beta",
  "agent-gamma",
  "agent-delta",
  "agent-epsilon",
] as const;

export type ImageAgentId = (typeof IMAGE_AGENT_IDS)[number];

export type AgentPersona = {
  id: ImageAgentId;
  name: string;
  style: string;
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
};
