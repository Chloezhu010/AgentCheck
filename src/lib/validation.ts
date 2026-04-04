import { z } from "zod";
import type { AuditEventType } from "@/types/hedera";

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

const HederaAuditEventTypes = [
  "TASK_INTENT",
  "TASK_DECOMPOSED",
  "RFQ_BROADCAST",
  "BID_RECEIVED",
  "BID_REJECTED",
  "BID_VERIFIED",
  "SAMPLE_REQUESTED",
  "SAMPLE_SCORED",
  "USER_DECISION_VERIFIED",
  "AGENT_SELECTED",
  "ESCROW_LOCKED",
  "TASK_ASSIGNED",
  "DELIVERY_RECEIVED",
  "PAYMENT_RELEASED",
  "TASK_COMPLETED",
] as const satisfies readonly AuditEventType[];

export const HederaAuditEventTypeSchema = z.enum(HederaAuditEventTypes);

export const HederaAuditEventSchema = z.object({
  t: HederaAuditEventTypeSchema,
  taskId: z.string().min(1, "taskId is required"),
  subtaskId: z.string().min(1, "subtaskId cannot be empty").optional(),
  agentId: z.string().min(1, "agentId cannot be empty").optional(),
  d: z.record(z.string(), z.unknown()).optional().default({}),
});

export const HederaAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const BasePaymentSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  amountHbar: z.number().positive("amountHbar must be greater than 0"),
});

export const HederaPaymentRequestSchema = z.discriminatedUnion("action", [
  BasePaymentSchema.extend({
    action: z.literal("lock"),
  }),
  BasePaymentSchema.extend({
    action: z.literal("release"),
    agentAccountId: z
      .string()
      .min(1, "agentAccountId is required for release"),
  }),
]);

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type ApproveAgentInput = z.infer<typeof ApproveAgentSchema>;
export type HederaAuditEventInput = z.infer<typeof HederaAuditEventSchema>;
export type HederaAuditQueryInput = z.infer<typeof HederaAuditQuerySchema>;
export type HederaPaymentRequestInput = z.infer<typeof HederaPaymentRequestSchema>;
