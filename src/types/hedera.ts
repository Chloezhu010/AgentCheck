// HCS Audit 

export type AuditEventType =
  | "TASK_INTENT"
  | "TASK_DECOMPOSED"
  | "RFQ_BROADCAST"
  | "BID_RECEIVED"
  | "BID_REJECTED"
  | "BID_VERIFIED"
  | "SAMPLE_REQUESTED"
  | "SAMPLE_SCORED"
  | "USER_DECISION_VERIFIED"
  | "AGENT_SELECTED"
  | "ESCROW_LOCKED"
  | "TASK_ASSIGNED"
  | "DELIVERY_RECEIVED"
  | "PAYMENT_RELEASED"
  | "TASK_COMPLETED";

export type HcsAuditMessage = {
  v: 1;
  t: AuditEventType;
  ts: number;
  taskId: string;
  subtaskId?: string;
  agentId?: string;
  d: Record<string, unknown>;
};

// Mirror Node 

export type MirrorMessage = {
  sequenceNumber: number;
  consensusTimestamp: string;
  content: HcsAuditMessage;
};

// Escrow

export type EscrowResult = {
  txId: string;
  status: string;
};
