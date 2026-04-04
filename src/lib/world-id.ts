// World ID 4.0 — shared types and constants used across client and server.
// Keep this file free of server-only imports (no signing key, no store).

export const WORLD_ACTIONS = {
  CREATE_AUDIT: process.env.WORLD_ACTION_CREATE_AUDIT ?? "create-audit",
  APPROVE_PAYMENT: process.env.WORLD_ACTION_APPROVE_PAYMENT ?? "approve-payment",
} as const;

export type WorldAction = (typeof WORLD_ACTIONS)[keyof typeof WORLD_ACTIONS];

/** Scope helpers — keeps scope format consistent across client + server. */
export const worldScope = {
  /** Gate 1: one audit creation per day per human */
  dailyAudit: (date: string) => `day:${date}`,
  /** Gate 1 alternative: one creation per draft ID */
  draft: (draftId: string) => `draft:${draftId}`,
  /** Gate 2: one approval per audit */
  audit: (sessionId: string) => `audit:${sessionId}`,
  /** Gate 2 alternative: one approval per agent selection within an audit */
  auditAgent: (sessionId: string, agentId: string) => `audit:${sessionId}:agent:${agentId}`,
};
