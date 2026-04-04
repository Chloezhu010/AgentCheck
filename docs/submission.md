# Submission File
## Bounty tracks
### AI & Agentic Payments on Hedera ⸺ $6,000
Up to 2 teams will receive $3,000
Build AI agents that move value autonomously on Hedera. The agentic economy needs payment infrastructure that works at machine speed: sub-second finality, predictable sub-cent fees, and native token operations without smart contract overhead. Hedera is built for this.
Use the Hedera Agent Kit, OpenClaw's Agent Commerce Protocol, the x402 payment standard, or any combination of agentic tooling to build agents that discover services, negotiate terms, and settle payments on Hedera. Whether it's micropayment streaming, agent-to-agent commerce, or autonomous DeFi, the best projects will demonstrate real payment flows between agents or between agents and services.
Qualification Requirements
1. Build an AI agent or multi-agent system that executes at least one payment, token transfer, or financial operation on Hedera Testnet.
2. Use one or more of the following: Hedera Agent Kit (JS/TS or Python), OpenClaw ACP, x402, A2A protocol, or Hedera SDKs directly.
3. Provide source code in a public GitHub repo with a README covering setup, architecture, and how the payment flow works.
4. Include a ≤ 5-minute demo video showing the agent performing autonomous payment actions.
Optional enhancements:
- Multi-agent payment negotiation and settlement using A2A or OpenClaw ACP
- Implementation of x402 for pay-per-request API or service access
- On-chain agent identity using ERC-8004 or HCS-14 (Universal Agent IDs via Hedera Consensus Service)
- Agent discovery and communication via UCP (Universal Commerce Protocol)
- Token creation, custom fee schedules, or royalty flows via the Hedera Token Service (HTS)
- Scheduled or recurring payments using Hedera Scheduled Transactions
- Verifiable payment audit trails using Hedera Consensus Service (HCS)
- Use of the Hedera CLI for agent workflow automation
Links:
- https://github.com/hashgraph/hedera-agent-kit-js
- https://www.x402.org/

#### How are you using this Protocol / API?

We qualify for **two Hedera tracks**: AI & Agentic Payments ($6k) and "No Solidity Allowed" ($3k).

**Track 1 — AI & Agentic Payments:**

An autonomous orchestrator agent (Gemini function-calling) manages the full procurement lifecycle. It has three Hedera-native tools that it calls autonomously during the flow:

- **`hbar_transfer`** — Executes `TransferTransaction` via `@hashgraph/sdk`. Supports `fromAccount: "operator"` for escrow lock (operator → escrow account) and `fromAccount: "escrow"` for payment release (escrow → agent's Hedera account). The orchestrator converts the winning agent's USD quote to HBAR at a fixed FX rate (1 HBAR = $0.08733) and decides when to call this tool.
- **`hcs_submit_message`** — Submits structured audit events to an HCS topic via `TopicMessageSubmitTransaction`. Every orchestrator decision — intent, bids received, scores, agent selection, escrow lock, payment release, task completion — is a JSON message with event type, timestamp, and detail payload.
- **`hbar_get_balance`** — Queries account balances via the Mirror Node REST API.

The payment flow: user sets budget in USD → agents bid in USD → user approves winner (World ID gate) → orchestrator converts USD to HBAR → locks HBAR in escrow → confirms delivery → releases HBAR to agent account → logs everything to HCS.

**Track 2 — "No Solidity Allowed":**

The entire application uses `@hashgraph/sdk` directly — zero Solidity, zero smart contracts. We use three native Hedera services:

1. **Crypto Service (HBAR transfers)** — `TransferTransaction` for two-phase escrow: lock (operator → escrow) then release (escrow → agent)
2. **Hedera Consensus Service (HCS)** — `TopicCreateTransaction` to create the audit topic + `TopicMessageSubmitTransaction` to log every decision as structured JSON with immutable sequence numbers
3. **Mirror Node REST API** — `/api/v1/topics/{topicId}/messages` for reading back audit trail + `/api/v1/balances` for account balances, displayed in a dedicated Hedera Dashboard page

#### Link of the code where the tech is used

- **`src/server/hedera/client.ts`** — Hedera SDK client setup for operator + escrow accounts (`Client.forTestnet()`, `setOperator()`)
- **`src/server/hedera/payment.ts`** — `escrowLock()` and `escrowRelease()` using `TransferTransaction` with `Hbar.from()` amounts
- **`src/server/hedera/audit.ts`** — `createAuditTopic()` via `TopicCreateTransaction` + `logAuditEvent()` via `TopicMessageSubmitTransaction`
- **`src/server/hedera/mirror.ts`** — Mirror Node queries: `getAuditMessages()` reads HCS topic, `getAccountBalance()` reads tinybars and converts to HBAR
- **`src/server/tools/hedera.ts`** — Gemini function declarations + executors for `hbar_transfer`, `hcs_submit_message`, `hbar_get_balance` — these are the tools the orchestrator agent calls autonomously
- **`src/server/orchestrator.ts`** — System prompt with Hedera account IDs, FX rate, and payment flow instructions for the autonomous agent
- **`src/lib/fx.ts`** — USD-to-HBAR conversion (`1 HBAR = $0.08733`)
- **`src/app/api/hedera/audit/route.ts`** — API route: POST submits HCS events, GET reads them back via Mirror Node
- **`src/app/api/hedera/payment/route.ts`** — API route for escrow lock/release
- **`src/app/api/hedera/balance/route.ts`** — API route for account balance queries
- **`src/components/hedera/HederaDashboard.tsx`** — Dashboard UI: account balances, test buttons, HCS audit trail with event type badges and HashScan links

#### Feedback: How easy is it to use the API / Protocol?

**Overall: `@hashgraph/sdk` is well-designed and the Mirror Node API is excellent.**

**What worked well:**
- `TransferTransaction` is clean — adding HBAR transfers between accounts is just `.addHbarTransfer()` calls. Much simpler than writing a Solidity contract for the same thing.
- `TopicMessageSubmitTransaction` for HCS is straightforward — submit a string, get back a sequence number. Perfect for audit logging.
- The Mirror Node REST API is fast, well-documented, and easy to query. Reading back HCS messages with base64 decoding just works.
- HashScan (the block explorer) makes it easy to verify transactions during development and demos.
- Testnet accounts from the Hedera portal come with 10,000 HBAR — plenty for development without worrying about faucet limits.

**What was tricky:**
- Mirror Node propagation delay (~3-6 seconds) means you can't read back an HCS message immediately after submitting it. This required adding polling/timeouts in the dashboard UI, which isn't obvious from the SDK docs.
- `PrivateKey.fromStringDer()` vs `fromStringED25519()` vs `fromStringECDSA()` — the correct method depends on how the key was generated, but the error messages when you use the wrong one are unhelpful.
- Managing two separate clients (operator + escrow) with different key pairs requires careful handling — the SDK doesn't have a built-in multi-account pattern, so we built our own singleton clients.

### 👥 Best use of World ID 4.0 ⸺ $8,000
🥇
1st place
$4,000
🥈
2nd place
$2,500
🥉
3rd place
$1,500
Leverage the new World ID 4.0 building products that break without proof of human
Qualification Requirements
Uses World ID 4.0 as a real constraint (eligibility, uniqueness, fairness, reputation, rate limits).
Proof validation is required and needs to occur in a web backend or smart contract.
Link: https://docs.world.org/world-id/overview

#### Our Implementation

World ID 4.0 is used as two workflow gates that block progression unless a real human verifies. The app breaks without proof of human — removing the gates would let bots spam auctions and drain escrow.

**Gate 1 — Create Audit (before auction starts)**
- Action: `create-audit`, Scope: `draft:{uuid}` (unique per attempt)
- A user cannot start an auction without proving they are human
- Satisfies: eligibility

**Gate 2 — Approve Payment (before escrow release)**
- Action: `approve-payment`, Scope: `audit:{sessionId}`
- The same human cannot approve the same audit twice (nullifier + scope uniqueness)
- Satisfies: uniqueness, fairness

**Backend proof validation flow:**
1. Client requests a signed RP context from `POST /api/world-id/rp-signature` (signed with `WORLD_RP_SIGNING_KEY`, never exposed to client)
2. IDKit React widget opens a QR modal; user scans with World App / Simulator
3. ZK proof is forwarded to `POST /api/world-id/verify`, which calls World's `POST /api/v4/verify/{rp_id}` server-side
4. After World confirms, backend enforces scoped uniqueness: `UNIQUE(action, scope, nullifier)` — rejects duplicates with 409
5. Optional `session_id` tracking is stored for future rate-limiting and reputation

**4.0-specific patterns used:**
- `rp_context` with backend-signed nonce (required in 4.0)
- Nullifiers treated as one-time proof identifiers, not stable user IDs (4.0 migration guidance)
- `session_id` stored for continuity/reputation (4.0 primitive)
- `orbLegacy` preset with `allow_legacy_proofs: true` for staging compatibility
- `environment: "staging"` for simulator-based development and demo

**Key files:**
- `src/app/api/world-id/rp-signature/route.ts` — signs RP context (server-only)
- `src/app/api/world-id/verify/route.ts` — verifies proof with World API + enforces business rules
- `src/server/world-id-store.ts` — scoped nullifier store (in-memory for demo, schema for production)
- `src/components/audit/WorldIdGate.tsx` — React hook + QR modal widget
- `src/lib/world-id.ts` — shared action names and scope helpers

**Why this satisfies the bounty:**

| Requirement | How we meet it |
|---|---|
| **"Products that break without proof of human"** | Remove the gates and any bot can spam auctions and drain escrow. World ID is not a cosmetic badge — it is a hard prerequisite at two critical payment moments. |
| **Eligibility** | Gate 1 blocks unverified users from starting auctions. No proof = no auction. |
| **Uniqueness** | Scoped nullifier store prevents the same human from approving the same audit twice (`action + scope + nullifier`). |
| **Fairness** | One human, one approval per audit. A user cannot game the system by approving multiple times or from multiple sessions. |
| **Rate limits** | `session_id` tracking is wired and ready for per-session rate limiting (e.g., max N auctions per session). |
| **Proof validation in web backend** | Proofs are verified server-side via World's `POST /api/v4/verify/{rp_id}` — never trusted on the client. Business rules enforced after verification. |

#### How are you using this Protocol / API?

World ID 4.0 is used as **two hard workflow gates** that block the app's critical payment path unless a real human verifies:

1. **Gate 1 (Create Audit):** Before a user can start an auction and commit budget, they must verify with World ID. Action: `create-audit`, scoped per draft UUID. This prevents bots from spamming auctions.

2. **Gate 2 (Approve Payment):** Before escrow releases HBAR to the winning agent, the same human must verify again. Action: `approve-payment`, scoped per session ID. The nullifier + scope uniqueness guarantee means the same person cannot approve the same audit twice.

The full 4.0 flow is implemented: client requests a backend-signed `rp_context` (using `signRequest` from `@worldcoin/idkit-core/signing`), the `IDKitRequestWidget` opens a QR modal, user scans with World App, ZK proof comes back, and the backend verifies it server-side against World's `POST /api/v4/verify/{rp_id}` endpoint. After World confirms, we enforce scoped uniqueness locally (action + scope + nullifier).

#### Link of the code where the tech is used

- **`src/components/audit/WorldIdGate.tsx`** — React hook (`useWorldIdGate`) + `IDKitRequestWidget` modal. Handles the full client-side flow: fetch RP context, open QR widget, forward proof to backend.
- **`src/app/api/world-id/rp-signature/route.ts`** — Signs `rp_context` with `WORLD_RP_SIGNING_KEY` via `signRequest()` from `@worldcoin/idkit-core/signing`. Never exposes the key to the client.
- **`src/app/api/world-id/verify/route.ts`** — Server-side proof verification against World's v4 API + business rule enforcement (scoped nullifier uniqueness, 409 on duplicates).
- **`src/server/world-id-store.ts`** — Scoped nullifier store with `UNIQUE(action, scope, nullifier)` semantics + `session_id` tracking for rate limiting.
- **`src/lib/world-id.ts`** — Shared action names (`create-audit`, `approve-payment`) and scope helpers.
- **`src/components/audit/AuditFlowDemo.tsx:141-170`** (Gate 1) and **`:213-240`** (Gate 2) — where the gates are triggered in the UI flow.

#### Feedback: How easy is it to use the API / Protocol?

**Overall: straightforward once you understand the 4.0 migration, but the docs have gaps.**

**What worked well:**
- `@worldcoin/idkit` React widget is plug-and-play — the QR modal just works with minimal config.
- `signRequest()` from `@worldcoin/idkit-core/signing` is clean and well-typed.
- The verify API (`POST /api/v4/verify/{rp_id}`) is simple — send the proof, get back a nullifier. Easy to build business rules on top.
- The staging environment + World App simulator makes local dev practical without a real Orb credential.

**What was tricky:**
- The 4.0 migration from 3.x isn't fully documented yet. Figuring out that `rp_context` must be signed server-side (not optional) took some digging through the SDK source code.
- The relationship between `rp_id`, `app_id`, and `WORLD_RP_SIGNING_KEY` isn't explained clearly in one place — we had to piece it together from the developer portal, SDK types, and example repos.
- `allow_legacy_proofs` and the `orbLegacy` preset were needed for staging but this isn't called out in the migration guide.
- Error codes from `IDKitErrorCodes` are not well-documented — when something fails in the widget, the error messages are opaque.

### 🤖 Best use of Agent Kit ⸺ $8,000
🥇
1st place
$4,000
🥈
2nd place
$2,500
🥉
3rd place
$1,500
Apps that use AgentKit to ship agentic experiences where World ID improves safety, fairness, or trust.
Qualification Requirements
Submissions must integrate World's Agent Kit to meaningfully distinguish human-backed agents from bots or automated scripts.
Submissions that only use World ID or MiniKit without the Agent Kit layer will not qualify for this specific track.
Link: https://docs.world.org/agents/agent-kit/integrate

## Project intro

**Demo link:** TODO

**Short description:** Auction, sample, and pay AI agents on-chain — with World ID human gates and a Hedera audit trail.

**Description:**

AgenTick is a try-before-you-buy AI agent marketplace. You describe a task and set a budget. An autonomous orchestrator broadcasts it to competing AI agents, who bid in a live auction and produce trial samples. An LLM judge scores them. You review the results, pick a winner, and confirm with World ID. Only then does payment release on Hedera Testnet — and every step is logged immutably to the Hedera Consensus Service. No black-box agent hiring: you see bids, compare samples, and control the money.

**How it's made:**

The app is built on Next.js 16 (React 19, Tailwind CSS v4) with a chatbot-first interface. Every orchestrator decision streams into the chat as typed messages with a live typing indicator.

The core of the system is a master orchestrator agent with function-calling. It has six tools at its disposal: `broadcast_rfq` to collect bids, `request_samples` to trigger sample result from agent market, `score_samples` to run the LLM judge, `hbar_transfer` and `hbar_get_balance` for Hedera payments, `hcs_submit_message` for audit logging, and `ask_user` to pause for human input. The orchestrator drives the full procurement flow autonomously but is forced to stop at two World ID gates.

The agent market hosts competing sub-agents, each with a distinct skill and pricing strategy. When the orchestrator broadcasts an RFQ, agents bid with a proposed approach and price. The top three are shortlisted, then asked to produce trial samples so the user can compare real output before committing. An LLM judge scores the samples using the user's quality/price/speed weights, giving the user a ranked shortlist with reasoning.

World ID 4.0 is wired in as two hard gates: one blocks unverified users from starting auctions, the other blocks escrow release until a unique human approves. Proofs are verified server-side via World's v4 verify API with backend-signed `rp_context` nonces — never trusted on the client.

Hedera integration uses `@hashgraph/sdk` directly. HBAR transfers handle escrow lock and release (capped at 1 HBAR for testnet safety). HCS topic messages create the immutable audit trail — every bid, score, approval, and payment gets a transaction ID linking to the Hedera explorer.

## Tech stack

**Ethereum developer tools:** None — we use Hedera-native tooling (`@hashgraph/sdk`), not EVM/Solidity.

**Blockchain networks:** Hedera Testnet — HBAR transfers for escrow payments, Hedera Consensus Service for the immutable audit trail.

**AI tools used:**

- **Gemini 2.5 Flash** (`@google/genai`): Powers the autonomous orchestrator agent via function-calling — it drives the entire procurement loop (broadcasting RFQs, analyzing bids, requesting samples, scoring results, managing payments, logging audit events). Also powers the LLM judge that scores and ranks competing agent samples.
- **Gemini 3.1 Flash Image Preview** (`@google/genai`): Each sub-agent persona generates real image samples through this model. Three personas with distinct creative styles produce competing outputs for head-to-head comparison.
- **Claude Code** (Anthropic): Primary development tool used throughout the hackathon for building and iterating on the application.