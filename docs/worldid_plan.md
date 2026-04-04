# World ID 4.0 Integration Plan

## Goal

Integrate World ID 4.0 into AgentCheck as a real product constraint, not a cosmetic identity badge.

For this app, World ID should directly control:

- eligibility: only verified humans can start a protected audit flow
- uniqueness: the same verified human cannot repeat a protected action in the same scope
- fairness: one human cannot approve the same audit multiple times
- rate limits: verified humans can be limited by day or by workflow stage
- reputation: repeated behavior can be tied to a World `session_id` without exposing personal identity

Proof validation must occur in a web backend or smart contract. For AgentCheck, the recommended first implementation is web-backend verification in Next.js route handlers.

---

## How World ID 4.0 Works

World ID is an anonymous proof-of-human credential. A user completes verification in the World ecosystem and holds a credential in their authenticator. When your app needs proof, it requests a zero-knowledge proof. Your app receives a cryptographic proof, not personal identity data.

### Core concepts

**Relying Party (RP)**  
Your application. In World ID 4.0, your app is identified by an `rp_id`.

**Action**  
A developer-defined operation protected by World ID, such as `create-audit` or `approve-payment`.

**RP Context**  
Each proof request must include a backend-signed `rp_context` containing `rp_id`, `nonce`, `created_at`, `expires_at`, and `signature`.

**Nullifier**  
A replay-protection and uniqueness primitive tied to the proof. In 4.0, you should treat nullifiers as one-time-use proof identifiers for gated actions, not as a stable long-lived user ID.

**Session ID**  
The continuity primitive in 4.0. If you need reputation, history, or recurring rate limits across multiple requests, store and reason about `session_id`.

**Signal**  
Optional context embedded into the proof request. Use it to bind a proof to a specific scope, such as a draft audit ID or `audit:{id}:agent:{id}`. Your backend should enforce the same scope.

**Verification level / preset**  
For this app, the practical choice is `orbLegacy` so the demo can support strong proof-of-human flows while remaining compatible with legacy proofs during the transition period.

---

## The World ID 4.0 Request Flow

```text
Client                         AgentCheck backend                 World verify API
  |                                   |                                |
  | POST /api/world-id/rp-signature   |                                |
  |---------------------------------->| signRequest(action)            |
  |<----------------------------------| rp_context                     |
  |                                   |                                |
  | open IDKit request with rp_context|                                |
  | user approves in World App        |                                |
  | receive IDKit result              |                                |
  |                                   |                                |
  | POST /api/world-id/verify         |                                |
  |---------------------------------->| POST /api/v4/verify/{rp_id}    |
  |                                   |------------------------------->|
  |                                   |<-------------------------------|
  |                                   | validate business rule         |
  |                                   | store used nullifier           |
  |                                   | store optional session_id      |
  |<----------------------------------| verified / rejected            |
```

Key rules:

- `signRequest()` must run server-side only
- `WORLD_RP_SIGNING_KEY` must never be exposed to the client
- the IDKit result should be forwarded to `POST /api/v4/verify/{rp_id}` from the backend
- the backend must enforce uniqueness and scope after verification
- use `environment: "staging"` and the simulator for local development

---

## What Changes for World ID 4.0

AgentCheck should follow the 4.0 migration guidance:

- do not treat `nullifier` as a stable per-user identifier across all flows
- use `nullifier` to reject replay or duplicate use of a specific gated proof
- use `session_id` for continuity, recurring rate limits, and reputation
- keep action scoping explicit on the server so fairness rules match the product behavior

This matters because a plain `UNIQUE (nullifier, action)` policy is often too coarse for product logic. If the action is `approve-payment`, that could accidentally block the user from approving any future payment in the entire app. AgentCheck should scope uniqueness to the business object being protected.

---

## Integration Points In AgentCheck

The current demo naturally has two gates:

| Gate | Stage | Action | Scope | Purpose |
|---|---|---|---|---|
| Gate 1 | Before auction starts | `create-audit` | `draft:{draftId}` or `day:{yyyy-mm-dd}` | eligibility and rate limit for audit creation |
| Gate 2 | Before payment approval | `approve-payment` | `audit:{auditId}` or `audit:{auditId}:agent:{agentId}` | fairness and uniqueness for approval |

### Recommended enforcement rules

**Gate 1: create audit**

- verify proof in backend
- reject invalid or duplicate proof for the chosen scope
- allow the auction to start only after verification succeeds
- optionally rate-limit recurring usage by `session_id`

**Gate 2: approve payment**

- verify proof in backend
- reject if the same human already approved this audit scope
- release payment only after verification succeeds

This satisfies the World bounty better than adding a generic sign-in step, because it makes the proof a condition of progressing through the workflow.

---

## Recommended Repo Shape

Keep the integration small and aligned with this repo's existing structure.

```text
src/
  app/
    api/
      world-id/
        rp-signature/
          route.ts
        verify/
          route.ts
  components/
    audit/
      WorldIdGate.tsx
  lib/
    world-id.ts
  server/
    world-id-store.ts
```

Notes:

- namespace the routes under `/api/world-id/*`
- keep pure validation and types in `src/lib`
- keep storage and business-rule enforcement in `src/server`
- wire the gates into existing audit routes instead of creating a separate auth subsystem

---

## Environment Variables

```env
NEXT_PUBLIC_WORLD_APP_ID=app_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WORLD_RP_ID=rp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WORLD_RP_SIGNING_KEY=0xdeadbeef...
WORLD_ACTION_CREATE_AUDIT=create-audit
WORLD_ACTION_APPROVE_PAYMENT=approve-payment
```

Rules:

- `NEXT_PUBLIC_WORLD_APP_ID` is safe for the client
- `WORLD_RP_ID` can stay server-side and be returned from the RP signature route
- `WORLD_RP_SIGNING_KEY` is server-only
- never create a `NEXT_PUBLIC_` variant for the signing key

How to get the signing key:

1. Open the World Developer Portal
2. Create a new app or upgrade an existing app to World ID 4.0
3. Copy the generated `app_id`, `rp_id`, and `signing_key`
4. Store the signing key only in `.env.local` or your deployment secret manager

If the portal does not show a signing key, the app usually has not been upgraded or registered for the 4.0 flow yet.

---

## Implementation Plan

## Step 1: Install The SDK

Use the current core SDK flow:

```bash
npm install @worldcoin/idkit-core
```

If you specifically want the React widget abstraction, add `@worldcoin/idkit`. Otherwise, `@worldcoin/idkit-core` is enough for the official 4.x request flow.

---

## Step 2: Add A Backend RP Signature Route

This route signs a short-lived RP context for a requested action.

```ts
// src/app/api/world-id/rp-signature/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { signRequest } from "@worldcoin/idkit-core/signing";

const BodySchema = z.object({
  action: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  const body = BodySchema.parse(await request.json());

  const { sig, nonce, createdAt, expiresAt } = signRequest({
    signingKeyHex: process.env.WORLD_RP_SIGNING_KEY!,
    action: body.action,
  });

  return NextResponse.json({
    rp_id: process.env.WORLD_RP_ID!,
    nonce,
    created_at: createdAt,
    expires_at: expiresAt,
    signature: sig,
  });
}
```

This route must remain server-only.

---

## Step 3: Add A Backend Verification Route

This route forwards the IDKit payload to World's verify endpoint, then applies AgentCheck's business rule.

```ts
// src/app/api/world-id/verify/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkAndStoreWorldProof,
  type WorldProofScope,
} from "@/server/world-id-store";

const BodySchema = z.object({
  action: z.string().min(1),
  scope: z.string().min(1),
  proof: z.unknown(),
});

export async function POST(request: Request): Promise<Response> {
  const body = BodySchema.parse(await request.json());

  const response = await fetch(
    `https://developer.world.org/api/v4/verify/${process.env.WORLD_RP_ID!}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body.proof),
    },
  );

  const payload = await response.json();

  if (!response.ok || payload.success !== true) {
    return NextResponse.json(
      { error: "world_id_verification_failed", details: payload },
      { status: 400 },
    );
  }

  const result = checkAndStoreWorldProof({
    action: body.action,
    scope: body.scope,
    nullifier: payload.nullifier,
    sessionId: payload.session_id ?? null,
  } satisfies WorldProofScope);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({
    success: true,
    nullifier: payload.nullifier,
    session_id: payload.session_id ?? null,
  });
}
```

Important:

- verify first with World
- then enforce your business rule
- then store the nullifier usage

---

## Step 4: Add A Scoped Proof Store

For the demo, an in-memory store is acceptable. It should still model the correct business rule.

```ts
// src/server/world-id-store.ts
export type WorldProofScope = {
  action: string;
  scope: string;
  nullifier: string;
  sessionId: string | null;
};

const usedProofs = new Set<string>();
const seenSessions = new Map<string, { proofCount: number; lastSeenAt: number }>();

function keyOf(input: Pick<WorldProofScope, "action" | "scope" | "nullifier">): string {
  return `${input.action}:${input.scope}:${input.nullifier.toLowerCase()}`;
}

export function checkAndStoreWorldProof(input: WorldProofScope):
  | { ok: true }
  | { ok: false; error: string } {
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
```

### Production storage recommendation

Use a real table with at least:

- `action`
- `scope`
- `nullifier`
- `session_id`
- `verified_at`

Recommended uniqueness constraint:

```sql
UNIQUE (action, scope, nullifier)
```

If you need recurring rate limits, add indexes over `session_id` and `verified_at`.

Store nullifiers as `NUMERIC(78, 0)` or another normalized canonical form so casing and parsing do not create security bugs.

---

## Step 5: Add A Small Client Gate Component

Keep the client component narrow. It should only:

- fetch RP context
- open the World proof flow
- submit the proof to backend verification
- invoke a callback on success

Example with `@worldcoin/idkit-core`:

```tsx
// src/components/audit/WorldIdGate.tsx
"use client";

import { IDKit, orbLegacy } from "@worldcoin/idkit-core";

type WorldIdGateProps = {
  action: string;
  scope: string;
  signal?: string;
  onVerified: () => Promise<void> | void;
};

export async function verifyWorldId({
  action,
  scope,
  signal,
}: Pick<WorldIdGateProps, "action" | "scope" | "signal">) {
  const rpContext = await fetch("/api/world-id/rp-signature", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  }).then((res) => res.json());

  const request = await IDKit.request({
    app_id: process.env.NEXT_PUBLIC_WORLD_APP_ID!,
    action,
    rp_context: rpContext,
    allow_legacy_proofs: true,
    environment: process.env.NODE_ENV === "production" ? "production" : "staging",
  }).preset(signal ? orbLegacy({ signal }) : orbLegacy());

  const proof = await request.pollUntilCompletion();

  const verifyResponse = await fetch("/api/world-id/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, scope, proof }),
  });

  if (!verifyResponse.ok) {
    throw new Error("World ID verification failed");
  }
}
```

Note:

- do not put business logic in this component
- the backend remains the source of truth

---

## Step 6: Wire It Into AgentCheck

AgentCheck already has backend-controlled routes:

- `POST /api/audit/session`
- `GET /api/audit/session/[id]`
- `POST /api/audit/session/[id]/approve`

That is where World ID becomes a real constraint.

### Gate 1: create audit

Recommended flow:

1. create a draft audit ID or pending session ID
2. use that ID as the proof scope
3. verify World ID
4. only then allow auction creation to continue

Do not bind the proof to `sessionId` before a session exists.

Example scope:

```ts
const scope = `draft:${draftId}`;
```

or for rate limiting:

```ts
const scope = `day:${new Date().toISOString().slice(0, 10)}`;
```

### Gate 2: approve payment

Recommended scope:

```ts
const scope = `audit:${sessionId}`;
```

If the product rule is one approval per agent selection instead of one approval per audit, use:

```ts
const scope = `audit:${sessionId}:agent:${agentId}`;
```

---

## Why This Version Is Better For AgentCheck

This plan is stronger than a generic World ID integration because it:

- keeps proof verification in the backend, which is required
- uses World ID as an actual workflow gate
- models fairness and uniqueness at the right scope
- avoids the 3.0 mistake of treating nullifier as a permanent user identifier
- leaves room to use `session_id` for recurring reputation and rate-limit logic later

---

## Local Development And Demo Notes

Use the World simulator with `environment: "staging"` during development.

Suggested demo path:

1. user describes task and budget
2. AgentCheck creates a draft scope
3. World ID gate appears before auction start
4. backend verifies proof and records scoped nullifier
5. auction runs
6. user selects winning agent
7. World ID gate appears again before approval
8. backend verifies proof and enforces one-human-one-approval for that audit

This gives a clean story for the bounty:

- proof of human is required
- proof is validated in the backend
- the app would behave differently without the proof
- fairness and anti-abuse are enforced by product logic, not marketing copy
