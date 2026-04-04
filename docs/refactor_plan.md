# Refactor Plan: From Hardcoded Demo to Dynamic Flow

> **Goal:** Turn every hardcoded path (UI, mock market, scoring, delivery, and audit logging) into a clean session-driven flow that lets x402-enabled agent endpoints and Hedera payment/audit plug in without friction.

---

## Architectural priorities

1. Keep the UI thin: `AuditFlowDemo` should only render props derived from a typed `AuditSession`. Polling, chat derivations, and scroll state belong inside hooks so the screen is easy to reason about and test.
2. Let the server own the flow: define explicit stages (`draft`, `bidding`, `sampling`, `evaluating`, `approved`, `delivering`, `settling`, `delivered`, `error`) and handle every transition inside the orchestrator.
3. Share precise contracts: define `AgentProfile`, `RfqRequest`, `SampleRequest`, `DeliveryRequest`, `PaymentIntent`, and related types so both the UI and orchestrator speak the same language.
4. Treat x402 as a transport adapter, not a UI concern: the orchestrator and agent client should call a shared `payments/x402.ts` adapter that handles challenges and receipts before the session advances.

---

## Phase 1: Split the UI monolith

**Why:** Clean interfaces make it safe to change the backend without pulling it all the way to the client.

- Extract `ChatThread`, `ScoreCard`, `TaskInput`, and `FlowHeader` so each component only renders the props it receives.
- Build `hooks/useAuditSession.ts` to own `sessionId`, polling, stage tracking, and expose `startAuction`, `approveAgent`, and `reset`.
- Build `hooks/useChatMessages.ts` to derive chat messages, typing indicators, and seen-bid tracking from session updates.
- Keep `AuditFlowDemo` as a stateless orchestrator that composes the above pieces.

Result: the client no longer reasons about timers or state transitions; it just renders the server-supplied `AuditSession`.

---

## Phase 2: Formalize the state machine and types

**Why:** The UI and orchestrator must agree on the stage payloads so the frontend can render payment/approval states without hidden booleans.

- Expand `src/types/audit.ts` with every stage listed above plus metadata (`paymentStatus`, `paymentReceipt`, `hederaAuditUrl`), sample/delivery request/response models, and audit events carrying topic IDs and timestamps.
- Keep API routes as thin adapters: validation happens in `lib/validation` and the handler calls orchestrator functions that return fully typed sessions.

Result: React renders whatever the session exposes, so backend changes stay contained.

---

## Phase 3: Plug in agent market + x402-aware agent client

**Why:** This is where your teammate’s x402 wrapping should land. RFQs, samples, and deliveries must flow through the same transport layer.

- Create `server/agent-registry.ts` and `server/rfq.ts` to register configurable agents and broadcast RFQs.
- Add `server/agent-client.ts` that:
  - Sends RFQ/sample/delivery requests per the shared contracts
  - Calls the x402 wrapper to include payment challenges and parse receipts
  - Falls back to `server/agents/stub-agent.ts` until real endpoints are ready
- Refactor `server/orchestrator.ts` so:
  - `createSession` initiates the RFQ broadcast via the agent client
  - Bidding stage collects live bids with timeouts
  - Sampling stage requests trial outputs and invokes the judge
  - Approval/delivery stages call the agent client and the x402 payment adapter, storing receipts in the session

Result: x402-related code lives in a shared adapter, and your teammate can finalize it without touching the UI or orchestrator logic.

---

## Phase 4: Introduce judging and delivery

**Why:** Real samples, judge feedback, and completed deliverables replace templated responses.

- Implement `server/judge.ts` (LLM-based or structured) that scores samples and issues recommendations.
- Update the orchestrator to move through `sampling`, `evaluating`, `approved`, and `delivering`, storing `SampleEvaluation[]`, judge notes, and the selected agent.
- During approval:
  - Request the full deliverable from the agent client
  - Pass any payment challenge through `payments/x402.ts`
  - Persist `DeliveryReport` (`content`, `contentType`, highlights) plus payment receipts and audit logs
- Update `ChatMessage` to support delivery canvases so the UI shows real output instead of placeholder text.

Result: the user sees actual deliverables, and payment state is visible alongside the Hedera audit link.

---

## Phase 5: Hedera + audit logging

**Why:** Every stage transition and payment release must be auditable on-chain.

- Build `server/hedera.ts` (or `server/audit-ledger.ts`) that logs transitions to an HCS topic and returns a Hashscan URL.
- Enhance `AuditEvent` and each session state to include `timestamp`, `topicId`, and `txUrl`.
- Have the orchestrator write to Hedera whenever it progresses stages or settles payment so the UI can surface `hederaAuditUrl`.
- Keep `audit-demo-data.ts` and `server/audit-log.ts` around as fallbacks toggled by `MOCK_HEDERA` until this layer is live.

Result: payment release and audit proofs are recorded in the session, letting the UI show “payment confirmed on Hedera” with the topic link.

---

## Integration and migration notes

- Keep `audit-demo-data.ts`, `server/mock-market.ts`, and other mocks behind feature flags (`MOCK_MARKET`, `MOCK_JUDGE`, `MOCK_HEDERA`) while each phase is in flight.
- Your teammate should finish the x402 wrap inside `server/agent-client.ts` or `server/payments/x402.ts`; the orchestrator only depends on the exported interface, so integration is straightforward.
- The UI should always render `AuditSession` props; that ensures the x402/agent work can add new fields (e.g., `paymentReceipt`) without extra UI changes.
- Document the shared RFQ/sample/delivery schema in `src/types/` so both teams agree on the payloads.

## Suggested order

```
Phase 1: UI split (pure refactor)
Phase 2: Types + state machine
Phase 3: Agent market + shared agent client (x402)
Phase 4: Judging + delivery
Phase 5: Hedera + audit logging
Phase 6: Intent parsing (stretch)
```

## Files to delete when done

- `lib/audit-demo-data.ts`
- `server/mock-market.ts`

## New files expected per phase

```
src/components/audit/
  ChatThread.tsx
  ScoreCard.tsx
  TaskInput.tsx
  FlowHeader.tsx
src/hooks/
  useAuditSession.ts
  useChatMessages.ts
src/server/
  agent-registry.ts
  agent-client.ts
  rfq.ts
  payments/x402.ts
  judge.ts
  hedera.ts
  agents/stub-agent.ts
src/types/
  expanded session/enums/contracts
```
