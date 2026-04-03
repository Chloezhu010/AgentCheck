# AgentProcure — Architecture Diagrams

---

## Overview: One-Line Concept

> **AgentProcure** is an AI orchestrator that breaks down a task, runs a live auction among verified agents, pays them automatically when quality is confirmed, and logs every decision on-chain.

---

## High-Level: Three-Layer Model

```mermaid
flowchart LR
    User(["User: Goal + Budget"])

    subgraph Core["AgentProcure"]
        direction TB
        Orch["Orchestrator: Break down · Bid · Evaluate · Retry"]
    end

    subgraph Agents["Agent Market"]
        A1["Agent A"]
        A2["Agent B"]
        A3["Agent C"]
    end

    subgraph Infrastructure["Trust Infrastructure"]
        W["World: Who is real?"]
        P["Arc/Hedera: How to pay?"]
        H["Hedera/0G: What happened?"]
    end

    User -->|"Intent + Budget"| Orch
    Orch -->|"RFQ"| Agents
    Agents -->|"Bid + Deliver"| Orch
    Orch -->|"Result + Audit Link"| User
    Infrastructure -. "identity · payment · audit" .-> Orch
```

---

## High-Level: The Procurement Loop

> Quality is gated at the **sample stage** — the user reviewing samples IS the quality check. Fallback triggers when the user is not satisfied. Payment is released after delivery — no separate quality check needed.

```mermaid
flowchart TD
    A(["User sets intent + budget"])
    A --> B["Parse intent: extract tasks, weights, constraints"]
    B --> C["Auction subtask to agent market"]
    C --> D["Auto-shortlist top 3 bids"]
    D --> E["Run sample test on shortlisted agents"]
    E --> F["LLM Judge scores + generate recommendation"]
    F --> G(["User reviews samples — this is the quality check (World ID verifies there's a human behind)"])
    G -->|Not satisfied — re-sample with fallback agent| E
    G -->|Confirms agent| J["Agent delivers full task"]
    J --> K["Release payment via Arc/Hedera"]
    K --> P["Log result to Hedera/0G"]
    P --> M{More subtasks?}
    M -->|Yes| C
    M -->|No| N(["Audit Report + Final Delivery"])
```

---

## High-Level: Sponsor Role Map

```mermaid
flowchart LR
    subgraph Problem["The Three Hard Problems"]
        P1["Who can I trust? Sybil agents flood the market"]
        P2["How do I pay without friction?"]
        P3["How do I prove what happened?"]
    end

    subgraph Solution["AgentProcure solves with"]
        S1["World AgentKit: Every bidder carries a human-backed proof"]
        S2["Arc Nanopayments: Escrow released only on quality confirmation"]
        S3["Hedera Consensus: Immutable log of every decision and payment"]
    end

    P1 --> S1
    P2 --> S2
    P3 --> S3
```

---

## Full System Flow

```mermaid
flowchart TD
    User(["User: Competitor analysis report, $50 budget, quality first"])

    subgraph Orchestrator["Orchestrator Agent"]
        A1["Step 1 - Parse Intent: Decompose task + compute preference weights {quality: 0.4, price: 0.3, speed: 0.3}"]
        A2["Step 2 - Issue RFQ: Broadcast task spec + budget ceiling"]
        A3["Step 3 - Collect Bids: 60s timeout, live Dashboard"]
        A4["Step 4 - Run Samples: Shortlist top 3, LLM Judge scores each sample"]
        A5["Step 5 - User Confirms Agent: Human reviews samples and approves"]
        A6["Step 6 - Assign Full Task: Selected agent delivers complete work"]
        A7["Step 7 - Reallocate Budget: Remaining funds flow to next subtask"]
        A8["Step 8 - Generate Audit Report: Full decision trail recorded on-chain"]
    end

    subgraph Market["Sub-Agent Market"]
        B1["Agent A: Data Collection Specialist, $15 bid, reputation 0.82"]
        B2["Agent B: Analysis & Report Specialist, $22 bid, reputation 0.91"]
        B3["Agent C: Generalist, $12 bid, reputation 0.74"]
        B4["Agent B-prime: Fallback Analysis Agent, activated on sample failure"]
    end

    subgraph WorldLayer["World - Identity Layer"]
        W1["World ID 4.0: Proof-of-human for the user, human approval checkpoint"]
        W2["World AgentKit: Sub-agents carry delegated proof, Sybil-resistant bidding"]
    end

    subgraph ArcLayer["Arc - Payment Layer"]
        P1["Budget Escrow Contract: $50 locked into Arc smart contract"]
        P2["Conditional Micropayment: Delivery confirmed -> auto release, Sample fail -> funds held"]
        P3["Reserve Pool: $5 reserved for re-procurement"]
    end

    subgraph HederaLayer["Hedera - Audit Layer"]
        H1["Consensus Service: Every action written to Topic, $0.0001 per message"]
        H2["Immutable Ledger: Bid records + sample scores + selection reasoning + payment receipts"]
    end

    User -->|"Submit intent + budget"| A1
    A1 -->|"Structured task"| A2
    A2 -->|"Broadcast RFQ"| Market
    B1 & B2 & B3 -->|"Bid + World AgentKit proof"| A3
    A3 --> A4

    W2 -.->|"Verify sub-agent is human-delegated"| A3
    A4 -->|"Sample score 0.85+ — PASS"| A5
    A4 -->|"Sample score below 0.85 — FAIL"| P3
    P3 -->|"Activate fallback"| B4
    B4 -->|"Re-sample"| A4

    W1 -.->|"Human confirms agent"| A5
    A5 -->|"Confirm Agent B, lock $22 + $5 reserve"| P1
    P1 --> A6

    B2 -->|"Deliver full report"| A6
    A6 -->|"Delivery complete"| P2
    P2 -->|"Release $22 to Agent B"| B2
    A6 -->|"Remaining budget"| A7
    A7 -->|"Reallocate to next subtask"| A2

    A1 & A3 & A4 & A5 & P2 -->|"Write to chain"| H1
    H1 --> H2
    H2 -->|"Feed audit report"| A8
    A8 -->|"Final report + audit link"| User
```

---

## Technology Stack

```mermaid
flowchart LR
    subgraph Frontend["Frontend - Next.js 14"]
        F1["Intent Input UI"]
        F2["Live Bidding Dashboard: WebSocket streaming"]
        F3["Audit Report Viewer"]
    end

    subgraph Backend["Backend - Node.js"]
        B1["Orchestrator Core Logic"]
        B2["LLM Judge: OpenAI / 0G OpenClaw"]
        B3["x402 Middleware: World AgentKit verification"]
    end

    subgraph Chain["On-Chain"]
        C1["Arc Escrow Contract: Base / Ethereum"]
        C2["Hedera Consensus Service: Topic log"]
    end

    subgraph Identity["Identity"]
        I1["World ID 4.0: @worldcoin/idkit"]
        I2["World AgentKit: @worldcoin/agentkit"]
    end

    F1 --> B1
    B1 --> B2
    B1 --> B3
    B3 --> I2
    B1 --> C1
    B1 --> C2
    C2 --> F3
    I1 --> F1
```

---

## Data Flow Sequence

```mermaid
sequenceDiagram
    actor User as User
    participant Orch as Orchestrator
    participant World as World AgentKit
    participant Agents as Sub-Agents
    participant Arc as Arc Contract
    participant Hedera as Hedera CS

    User->>Orch: Competitor analysis, $50, quality first
    Orch->>Hedera: Log [task intent + preference weights]
    Orch->>Agents: Broadcast RFQ (60s timeout)

    par Concurrent bidding
        Agents->>World: Fetch AgentKit delegation proof
        World-->>Agents: Return signed proof
        Agents->>Orch: Submit bid + World proof + reputation score
    end

    Orch->>Hedera: Log [bid results]

    loop Sample evaluation
        Orch->>Agents: Request sample from shortlisted agents
        Agents-->>Orch: Submit sample output
        Orch->>Orch: LLM Judge scores sample
        alt Sample score below 0.85
            Orch->>Agents: Activate fallback agent, request re-sample
        end
    end

    Orch->>Hedera: Log [sample scores + shortlist]
    Orch->>User: Present samples + recommendation, await approval
    User->>World: World ID 4.0 verification (human confirms)
    World-->>Orch: Verification passed

    Orch->>Arc: Lock $50 budget in escrow
    Arc-->>Orch: Escrow confirmed
    Orch->>Hedera: Log [selection decision + reasoning]

    Orch->>Agents: Assign full task to Agent B
    Agents->>Orch: Submit full deliverable
    Orch->>Hedera: Log [delivery confirmation]
    Orch->>Arc: Trigger release of $22 to Agent B
    Arc-->>Agents: Payment complete

    Orch->>Hedera: Log [payment receipt]
    Orch->>User: Deliver report + on-chain audit link
```
