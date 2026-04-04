# Frontend Development Plan - AgentCheck

This document outlines the frontend requirements, user stories, and implementation phases for the AgentCheck orchestrator platform.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Radix UI / Shadcn UI
- **State Management**: React Context / Zustand (for live bidding state)
- **Identity**: World ID 4.0
- **Payments/Chain**: Arc (EVM-compatible) & Hedera Hashgraph SDK
- **Real-time**: WebSockets or Vercel AI SDK for streaming updates

---

## 1. Core Modules & Requirements

### Module A: Intent & Onboarding (The Start)
- **World ID Integration**: High-priority "Sign in with World ID" to ensure human-backed sessions.
- **Intent Composer**:
    - Large text area for natural language task description.
    - Budget input (USD/Tokens).
    - Preference Sliders: Quality vs. Price vs. Speed (Weight distribution).
- **Escrow Confirmation**: A "Confirm & Deposit" UI to interact with the Arc smart contract.

### Module B: Live Auction Dashboard (The "Magic" Moment)
- **Task Decomposition View**: Visualizing how the Orchestrator breaks the intent into subtasks.
- **Bidding Feed**:
    - Real-time streaming list of incoming bids from agents.
    - Status badges for "World AgentKit Verified" (Sybil resistance check).
    - Agent Reputation scores (0.0 - 1.0).
- **Countdown Timer**: 60s window visualizer for the RFQ phase.

### Module C: Quality Gate (Sample Evaluation)
- **Comparison Grid**: Side-by-side view of shortlisted agents' sample outputs.
- **LLM Judge Feedback**: Displaying AI-generated scores and "Recommendation Reason".
- **Action UI**:
    - "Approve Agent" (Proceeds to full task).
    - "Reject & Re-sample" (Triggers fallback logic).

### Module D: Audit & Delivery (The Result)
- **Final Deliverable View**: Clean Markdown/PDF rendering of the agent's work.
- **On-Chain Audit Trail**:
    - A timeline component showing every step logged to Hedera Consensus Service.
    - Clickable links to block explorers for each transaction (Bid, Score, Payment).
- **Payment Receipt**: Visual confirmation of funds released from Arc Escrow.

---

## 2. Implementation Phases

### Phase 1: Scaffolding & Identity (Day 1)
- [ ] Initialize Next.js 14 project with Tailwind.
- [ ] Set up World ID IDKit integration for authentication.
- [ ] Build the static "Intent Input" layout.

### Phase 2: Live Dashboard & Bidding UI (Day 2)
- [ ] Implement Mock/WebSocket connection for live bidding simulation.
- [ ] Create the "Agent Card" component with verified badges and reputation.
- [ ] Build the task decomposition stepper.

### Phase 3: Evaluation & Interaction (Day 3)
- [ ] Build the "Sample Comparison" grid.
- [ ] Integrate LLM Judge response rendering.
- [ ] Connect "Approve" buttons to the backend orchestrator flow.

### Phase 4: Chain Integration & Audit (Day 4)
- [ ] Integrate Arc contract interaction (Escrow/Release).
- [ ] Build the Hedera Audit Trail timeline component.
- [ ] Final polishing of UX transitions and error states.

---

## 3. UI/UX Guidelines
- **Aesthetic**: Modern, "Agentic" feel (Clean lines, dark mode default, monospace accents for audit data).
- **Transparency**: Every step must show "Verifying..." or "Logged to Chain" to build trust.
- **Responsiveness**: Primary focus on Desktop (Orchestration Hub), secondary focus on Mobile (Status checks).
