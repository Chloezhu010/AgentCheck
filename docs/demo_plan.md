# Demo Plan

## Use Case

**User prompt:** *"Build me a cyberpunk-style wallet connection UI component in React, budget $50."*

This use case works because:
- Every ETHGlobal judge has personally needed a wallet connect component — zero explanation required.
- Quality difference is **interactive and visible** — each agent delivers a live rendered component the user can click, not a static preview.
- The full job (production-ready component with animations, error states, mobile layout) is meaningfully more work than the sample — making the try-before-you-pay value proposition obvious.
- $50 is believable for a real frontend task, making the escrow/payment flow feel serious.

---

## Demo Script (≤5 min)

### Act 1 — The Problem (0:00–0:30)
One sentence: *"Today you hire an AI agent to build your UI, pay upfront, get garbage output, and have zero recourse."* Then immediately launch the app.

### Act 2 — Submit the Task + Human Verification (0:30–1:00)
User types the prompt and sets $50 budget. World ID 4.0 modal appears → user verifies as human. Establishes that the budget holder is a real person before any agent is hired or any money escrow'd.

### Act 3 — The Live Auction (1:00–2:00) ← WOW moment
Dashboard: 3 agents appear with bids arriving in real time. Each agent card shows:
- Model powering the agent (e.g. GPT-4o, Claude 3.5 Sonnet)
- Bid price for the full component
- **World AgentKit badge** — human-delegated, verified, not a bot
- Estimated delivery time

| Agent | Model | Full job bid | AgentKit |
|---|---|---|---|
| Agent Alpha | GPT-4o | $18 | ✅ Verified |
| Agent Beta | Claude 3.5 Sonnet | $22 | ✅ Verified |

An unverified agent attempt appears and is visibly **rejected** from the auction — this is the Sybil resistance moment.

### Act 4 — Sample Test (2:00–3:00)
Both shortlisted agents build a **sample version** of the component: functional wallet connect button, cyberpunk neon styling, connect/disconnect state. The orchestrator deploys each sample to a live preview URL.

User sees two rendered, clickable UIs side by side — actually interacts with both. LLM Judge scores each sample (code quality, style fidelity, completeness) and surfaces a short recommendation.

User clicks **"Choose Agent Beta"** based on the visual result.

### Act 5 — Human Approves Payment (3:00–3:20)
World ID 4.0 checkpoint fires before funds move. *"$22 will be released to Agent Beta upon delivery — confirm you're human."* World ID proof validated in backend. Escrow locked on Hedera.

### Act 6 — Full Build + Payment (3:20–4:00)
Agent Beta delivers the production component: full animations, multi-wallet support (MetaMask, WalletConnect), error states, mobile responsive. Component renders live on screen.

Hedera transaction fires — show the Testnet tx hash appearing. *"$22 released to Agent Beta. $28 remaining in budget."* HCS records the delivery.

### Act 7 — The Audit Trail (4:00–4:40)
Click **"View Audit Report"** → reads back the HCS topic log: agent bids, AgentKit proofs, sample scores, selection reasoning, payment receipt. Every decision, immutable and timestamped. *"This is what recourse looks like."*

### Act 8 — Tagline (4:40–5:00)
**AgentCheck: Try. Pick. Pay. Prove.**

---

## Agent Breakdown

| Agent | Task | Model |
|---|---|---|
| Agent Alpha | Build cyberpunk wallet connect UI component | GPT-4o |
| Agent Beta | Build cyberpunk wallet connect UI component | Claude 3.5 Sonnet |

Both agents receive the same prompt and budget ceiling. They compete on output quality, price, and speed.

**Sample deliverable:** Minimal but functional React component — wallet connect button with cyberpunk neon styling, connect/disconnect state, rendered in a preview iframe.

**Full deliverable:** Production component — multi-wallet support, animated transitions, error/loading states, mobile layout, exportable code.

---

## Bounty Hooks in the Demo

| Bounty | Where it appears |
|---|---|
| **World ID 4.0** | Act 2 (user verifies as human before job starts) + Act 5 (human approves payment gate) |
| **World Agent Kit** | Act 3 (each bidding agent carries a signed AgentKit proof; unverified agent visibly rejected) |
| **Hedera Payments + HCS** | Act 6 (payment released on Hedera Testnet, tx hash shown live) + Act 7 (HCS audit log readback) |

---

## What Must Actually Work

| Component | Why |
|---|---|
| Both agents generate real React components | This is the demo centerpiece — must render visually |
| Sample preview renders in-browser | User interaction with the sample is the key moment |
| World ID 4.0 proof validation (backend) | Required by both World bounties |
| World AgentKit proof on each agent bid | Mandatory for Agent Kit track; unverified rejection must be demonstrable |
| At least one Hedera payment on Testnet | Required by Hedera track; tx hash must appear on screen |
| HCS log written and readable | Audit trail is the closing moment of the demo |

## What Can Be Mocked

| Component | Notes |
|---|---|
| Auction timing / bid animation | Pre-seeded bids, animate them arriving with a short delay |
| Agent reputation scores | Static values are fine |
| LLM Judge scoring | Simple OpenAI call evaluating code quality + style fidelity 0–1 |
| Preview deployment | Rendering the component in a sandboxed iframe is enough; no real deploy needed |
| Budget reallocation | Show the remaining balance UI, no need for a second subtask in the demo |
