import { z } from "zod";

export const IntentWeightsSchema = z.object({
  quality: z.number().min(0).max(100),
  price: z.number().min(0).max(100),
  speed: z.number().min(0).max(100),
});

export const CreateSessionSchema = z.object({
  taskDescription: z.string().min(1, "Task description is required"),
  budgetUsd: z.number().positive("Budget must be greater than 0"),
  weights: IntentWeightsSchema,
});

export const ApproveAgentSchema = z.object({
  agentId: z.string().min(1, "Agent ID is required"),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type ApproveAgentInput = z.infer<typeof ApproveAgentSchema>;
