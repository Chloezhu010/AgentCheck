export type WorldProofScope = {
  action: string;
  scope: string;
  nullifier: string;
  sessionId: string | null;
};

// In-memory store — acceptable for demo; replace with DB in production.
// Production schema: UNIQUE(action, scope, nullifier), indexes on session_id + verified_at.
const usedProofs = new Set<string>();
const seenSessions = new Map<string, { proofCount: number; lastSeenAt: number }>();

function keyOf(input: Pick<WorldProofScope, "action" | "scope" | "nullifier">): string {
  return `${input.action}:${input.scope}:${input.nullifier.toLowerCase()}`;
}

export function checkAndStoreWorldProof(
  input: WorldProofScope,
): { ok: true } | { ok: false; error: string } {
  const proofKey = keyOf(input);

  if (usedProofs.has(proofKey)) {
    return { ok: false, error: "This verified human already used this action in this scope." };
  }

  usedProofs.add(proofKey);

  if (input.sessionId) {
    const existing = seenSessions.get(input.sessionId);
    seenSessions.set(input.sessionId, {
      proofCount: (existing?.proofCount ?? 0) + 1,
      lastSeenAt: Date.now(),
    });
  }

  return { ok: true };
}
