# Demo Plan

## Use Case

**User prompt:** *"Build me a cyberpunk-style wallet connection UI component in React."* (Budget and trial % set interactively via orchestrator chat.)

This use case works because:
- Every ETHGlobal judge has personally needed a wallet connect component — zero explanation required.
- Quality difference is **interactive and visible** — each agent delivers a live rendered component the user can click, not a static preview.
- The full job (production-ready component with animations, error states, mobile layout) is meaningfully more work than the sample — making the try-before-you-pay value proposition obvious.
- $50 is believable for a real frontend task, making the escrow/payment flow feel serious.

---

## Demo Script (≤5 min)

### Act 1 — The Problem (0:00–0:30)
One sentence: *"Today you hire an AI agent to build your UI, pay upfront, get garbage output, and have zero recourse."* Then immediately launch the app.

### Act 2 — Orchestrator Intake: Clarifying Chat (0:30–1:15)
User types the initial prompt: *"Build me a cyberpunk wallet connect UI."* The orchestrator responds like a product manager — asking 2–3 focused clarifying questions:

> **Orchestrator:** *"What wallets should it support? (MetaMask only, or multi-wallet?)"*
> **User:** *"MetaMask and WalletConnect."*
> **Orchestrator:** *"What's your total budget, and how much are you willing to spend on a sample test before committing?"*
> **User:** *"$50 total, 20% for the trial."*
> **Orchestrator:** *"Got it. I'll scope a minimal trial task for agents to compete on, then the winner builds the full version."*

This phase ends with the orchestrator outputting a **structured task spec**: full intent, trial scope, budget split ($10 trial / $40 full), and quality weights (style fidelity, completeness, speed).

### Act 3 — Human Verification (1:15–1:30)
World ID 4.0 modal fires. *"Verify you're human before any funds are escrowed."* Proof validated in backend. Budget locked in escrow.

### Act 4 — The Live Auction (1:30–2:30) ← WOW moment
The orchestrator broadcasts the **trial task spec** to the agent market. Dashboard: 3 agents appear with bids arriving in real time. Each agent card shows:
- Model powering the agent
- Bid price for the **trial task** (orchestrator-scoped)
- Bid price for the **full job**
- Estimated delivery time

| Agent | Model | Trial bid | Full job bid |
|---|---|---|---|
| Agent Alpha | GPT-4o | $3.20 | $18 |
| Agent Beta | Claude 3.5 Sonnet | $4.10 | $22 |
| Agent Gamma | Gemini 1.5 Pro | $2.60 | $14 |

### Act 5 — Trial Execution + Results (2:30–3:20)
All 3 agents execute the **orchestrator-scoped trial task**: minimal wallet connect button, cyberpunk neon styling, connect/disconnect state only. Each agent's actual spend is tracked live and shown alongside output.

The orchestrator renders each result in a sandboxed iframe. User sees three rendered, clickable UIs side by side — actually interacts with all three. LLM Judge scores each (code quality, style fidelity, completeness) and surfaces a short recommendation. Trial costs shown: *"Alpha spent $3.10 · Beta spent $4.20 · Gamma spent $2.50."*

User clicks **"Choose Agent Beta"** based on the visual result.

### Act 6 — Human Approves Payment (3:20–3:40)
World ID 4.0 checkpoint fires before full funds move. *"$22 will be released to Agent Beta upon delivery — confirm you're human."* World ID proof validated in backend. Escrow locked on Hedera.

### Act 7 — Full Build + Payment (3:40–4:20)
Agent Beta delivers the production component: full animations, multi-wallet support (MetaMask, WalletConnect), error states, mobile responsive. Component renders live on screen.

Hedera transaction fires — show the Testnet tx hash appearing. *"$22 released to Agent Beta. $28 remaining in budget."* HCS records the delivery.

### Act 8 — The Audit Trail (4:20–4:45)
Click **"View Audit Report"** → reads back the HCS topic log: orchestrator clarifying questions, structured task spec, agent bids, trial scores, selection reasoning, payment receipt. Every decision, immutable and timestamped. *"This is what recourse looks like."*

### Act 9 — Tagline (4:45–5:00)
**AgentCheck: Try. Pick. Pay. Prove.**

---

## Agent Breakdown

| Agent | Task | Model |
|---|---|---|
| Agent Alpha | Build cyberpunk wallet connect UI component | GPT-4o |
| Agent Beta | Build cyberpunk wallet connect UI component | Claude 3.5 Sonnet |
| Agent Gamma | Build cyberpunk wallet connect UI component | Gemini 1.5 Pro |

All 3 agents receive the same prompt and budget ceiling. They compete on output quality, price, and speed.

**Sample deliverable:** Minimal but functional React component — wallet connect button with cyberpunk neon styling, connect/disconnect state, rendered in a preview iframe.

**Full deliverable:** Production component — multi-wallet support, animated transitions, error/loading states, mobile layout, exportable code.

---

## Bounty Hooks in the Demo

| Bounty | Where it appears |
|---|---|
| **World ID 4.0** | Act 3 (user verifies as human before escrow) + Act 6 (human approves payment gate) |
| **World Agent Kit** | Orchestrator intake + trial task scoping (master agent with delegation proof) |
| **Hedera Payments + HCS** | Act 7 (payment released on Hedera Testnet, tx hash shown live) + Act 8 (HCS audit log readback includes orchestrator decisions) |

---

## What Must Actually Work

| Component | Why |
|---|---|
| Orchestrator clarifying chat (2–3 turns) | Sets up the "smart intake agent" framing; produces structured task spec |
| Orchestrator scopes trial task via LLM | Visible decomposition step — proves the master agent is doing real work |
| All 3 agents generate real React components | This is the demo centerpiece — must render visually |
| Trial previews render in-browser (iframe) | User interaction with all 3 trial outputs is the key moment |
| Per-agent actual spend tracked and shown | Makes the cost transparency story concrete |
| World ID 4.0 proof validation (backend) | Required by World ID bounty |
| At least one Hedera payment on Testnet | Required by Hedera track; tx hash must appear on screen |
| HCS log written and readable | Audit trail includes orchestrator decisions, not just payment |

## What Can Be Mocked

| Component | Notes |
|---|---|
| Auction timing / bid animation | Pre-seeded bids, animate them arriving with a short delay |
| Agent reputation scores | Static values are fine |
| LLM Judge scoring | Simple OpenAI call evaluating code quality + style fidelity 0–1 |
| Preview deployment | Rendering the component in a sandboxed iframe is enough; no real deploy needed |
| Budget reallocation | Show the remaining balance UI, no need for a second subtask in the demo |
