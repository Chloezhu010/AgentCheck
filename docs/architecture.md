# AgentCheck — Architecture Diagrams

---

## Overview: One-Line Concept

> **AgentCheck** is an AI orchestrator that breaks down a task, runs a live auction among verified agents, pays them automatically when quality is confirmed, and logs every decision on-chain.

---

## High-Level: Three-Layer Model

```mermaid
flowchart LR
    User(["User: Goal + Budget"])

    subgraph Core["AgentCheck"]
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
