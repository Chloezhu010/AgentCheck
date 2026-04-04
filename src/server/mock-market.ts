import { seededBids, biddingWindowSeconds } from "@/lib/audit-demo-data";
import type { AgentBid } from "@/types/audit";

// Bids are revealed progressively based on elapsed time.
// Each bid arrives 1200ms after the previous one.
const BID_INTERVAL_MS = 1200;

export function getVisibleBids(sessionStartedAt: number): AgentBid[] {
  const elapsed = Date.now() - sessionStartedAt;
  const revealed = Math.floor(elapsed / BID_INTERVAL_MS);
  return seededBids.slice(0, Math.min(revealed, seededBids.length));
}

export function getCountdownSeconds(sessionStartedAt: number): number {
  const elapsed = Date.now() - sessionStartedAt;
  const remaining = biddingWindowSeconds * 1000 - elapsed;
  return Math.max(0, Math.ceil(remaining / 1000));
}

export function isBiddingComplete(sessionStartedAt: number): boolean {
  return Date.now() - sessionStartedAt >= biddingWindowSeconds * 1000;
}
