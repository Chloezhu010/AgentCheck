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

## Project into
- Demo link:
- Short description: A max 100-character or less description of your project (it should fit in a tweet!)
- Description: Go in as much detail as you can about what this project is. Please be as clear as possible! (min 280 characters)
- How it's made: Tell us about how you built this project; the nitty-gritty details. What technologies did you use? How are they pieced together? If you used any partner technologies, how did it benefit your project? Did you do anything particuarly hacky that's notable and worth mentioning? (min 280 characters)

## Tech stack
- Are you using any Ethereum developer tools for your project? Select all that are applicable.
- Which blockchain networks will your project interact with?
- Describe how AI tools were used in your project (if applicable)
Be specific about which tools were used and explain which parts of the projects they were used for. This field may be left blank if no AI tools were used.