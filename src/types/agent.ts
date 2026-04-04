// Image generation agent types

export type ImageAgentId = "agent-alpha" | "agent-beta" | "agent-gamma";

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
