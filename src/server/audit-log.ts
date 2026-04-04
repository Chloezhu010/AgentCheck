import { buildAuditEvents } from "@/lib/audit-demo-data";
import type { AuditEvent } from "@/types/audit";

// Stub: returns mock HCS audit events.
// Replace with real Hedera Agent Kit writes when integrating the Hedera track.
export function logAndGetAuditEvents(selectedAgentName: string): AuditEvent[] {
  return buildAuditEvents(selectedAgentName);
}
