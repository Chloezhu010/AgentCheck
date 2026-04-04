# Intake Flow Plan

## Problem

The current flow skips the orchestrator intake phase entirely. When a user submits a task, it immediately creates a session in `bidding` stage — budget and weights are set via a hidden settings panel, not through conversation.

Per the demo script (Act 2), the orchestrator should act like a product manager:

1. User types initial prompt ("Build me a cyberpunk wallet connect UI")
2. Orchestrator asks 2–3 focused clarifying questions
3. User answers conversationally (budget, trial %, task details)
4. Orchestrator outputs a **structured task spec** with trial scope, budget split, and quality weights
5. **Then** the auction starts

This conversational intake is the "smart intake agent" framing — it proves the master agent is doing real work before any money moves.

---

## Current Flow (what exists)

```
User types task → [settings panel: budget, weights] → Submit
  → World ID check
  → POST /api/audit/session (taskDescription, budgetUsd, weights)
  → Session created in `bidding` stage
  → Bids stream in immediately
```

The settings panel (budget input + quality/price/speed sliders) is tucked behind a gear icon. Budget and weights are form inputs, not part of the conversation.

## Target Flow (what we're building)

```
User types initial prompt → POST /api/audit/session
  → Session created in `intake` stage
  → Orchestrator responds with first clarifying question

User replies → POST /api/audit/session/[id]/chat
  → Orchestrator asks follow-up (2–3 turns total)

User provides budget + trial % → POST /api/audit/session/[id]/chat
  → Orchestrator has enough info
  → Outputs structured task spec as a chat message
  → Session stays in `intake` with extractedSpec populated

User sees spec → World ID fires: "Verify you're human before $X is escrowed"
  → On success: POST /api/audit/session/[id]/confirm
  → Session transitions: intake → bidding
```

---

## Changes Required

### 1. Types (`src/types/audit.ts`)

- Add `"intake"` to `FlowStage` union
- Add intake variant to `AuditSessionState`:

```ts
| {
    stage: "intake";
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
    extractedSpec: IntakeSpec | null; // null until orchestrator has enough info
  }
```

- New type `IntakeSpec`:

```ts
export type IntakeSpec = {
  refinedTaskDescription: string; // full task description after clarification
  trialScope: string;             // what the trial task covers
  budgetUsd: number;              // total budget
  trialPercent: number;           // % of budget for trial (e.g. 20)
  weights: IntentWeights;         // quality/price/speed weights
};
```

### 2. Server: Intake Logic (`src/server/intake.ts` — new file)

Gemini-powered orchestrator conversation. Core function:

```ts
export async function runIntakeTurn(
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
): Promise<{ reply: string; spec: IntakeSpec | null }>
```

**How it works:**
- System prompt instructs Gemini to act as AgentCheck's orchestrator / product manager
- It should ask 2–3 focused clarifying questions (task details, wallet support, budget, trial %)
- When it has enough info, it appends a JSON block to its response: `{"ready": true, ...spec}`
- The server parses the response: if JSON block found → extract spec, transition to bidding
- If no JSON block → just a conversational reply, stay in intake

**System prompt outline:**
```
You are AgentCheck's orchestrator — a smart procurement agent.
The user wants to hire AI agents for a task. Your job:
1. Understand what they want built (ask 2-3 clarifying questions about scope)
2. Ask about their total budget and how much they'd spend on a trial run
3. When you have enough info, output the task spec

Keep responses short (2–3 sentences max). Be direct, like a product manager.

When ready, end your message with exactly this JSON on its own line:
```json
{"ready": true, "refinedTaskDescription": "...", "trialScope": "...", "budgetUsd": 50, "trialPercent": 20, "weights": {"quality": 40, "price": 30, "speed": 30}}
```
```

### 3. API: Chat Endpoint (`src/app/api/audit/session/[id]/chat/route.ts` — new file)

```ts
POST /api/audit/session/[id]/chat
Body: { message: string }
Response: { session: AuditSession }
```

- Validates session exists and is in `intake` stage
- Calls `runIntakeTurn()` with conversation history + new message
- Updates session state (appends messages, sets spec if extracted)
- If spec is extracted, session stays in `intake` with `extractedSpec` populated (does NOT auto-transition)

### 3b. API: Confirm Endpoint (`src/app/api/audit/session/[id]/confirm/route.ts` — new file)

```ts
POST /api/audit/session/[id]/confirm
Body: {} (empty — World ID proof already validated client-side)
Response: { session: AuditSession }
```

- Validates session is in `intake` stage with a non-null `extractedSpec`
- Transitions session from `intake` → `bidding` using the extracted spec
- This is called **after** World ID verification succeeds on the client

### 4. Orchestrator Updates (`src/server/orchestrator.ts`)

**`createSession` changes:**
- Accepts only `{ initialMessage: string }` instead of full `IntentInput`
- Creates session in `intake` stage (not `bidding`)
- Calls `runIntakeTurn()` to get the first orchestrator response
- Stores conversation history in session state

**New function: `chatIntake(sessionId, userMessage)`**
- Retrieves session, validates it's in `intake` stage
- Calls `runIntakeTurn()` with history + new message
- If spec extracted → transitions to `bidding` (reuses existing bidding setup logic)
- Adds orchestrator messages to session's message list

**`transitionToBidding(session, spec)` — extracted helper:**
- Takes the extracted `IntakeSpec` and starts the bidding phase
- Sets `input` from the spec (budget, weights, task description)
- Adds the "Budget set to $X" / "Opening RFQ" messages
- Sets session state to `{ stage: "bidding", ... }`

### 5. Validation Updates (`src/lib/validation.ts`)

- New `CreateIntakeSessionSchema`:
```ts
export const CreateIntakeSessionSchema = z.object({
  initialMessage: z.string().min(1, "Message is required"),
});
```

- New `ChatMessageSchema`:
```ts
export const ChatMessageSchema = z.object({
  message: z.string().min(1, "Message is required"),
});
```

- Keep existing `CreateSessionSchema` for backwards compat (or remove if not needed)

### 6. Frontend Updates (`src/components/audit/AuditFlowDemo.tsx`)

**Key behavior changes:**

- **First message:** Creates session via `POST /api/audit/session` with just `{ initialMessage }`. No budget/weights needed upfront.
- **During intake:** User messages go to `POST /api/audit/session/[id]/chat`. Orchestrator responses appear as chat messages.
- **Spec output:** When the orchestrator extracts a spec, it appears as a formatted message showing the task breakdown, budget split, and weights. Session stays in `intake` with `extractedSpec` populated — it does NOT auto-transition to bidding yet.
- **World ID:** Fires **after** the spec is shown, **before** bidding starts. This is the "confirm you're human before money moves" checkpoint. The user sees the spec and the dollar amount, then World ID asks them to verify. Only after verification does the session transition to `bidding`. No gate on the conversation itself — that's free/no-risk.
- **Settings panel:** Remove as primary input method. Budget and weights now come from conversation. Could keep as an optional override, but not needed for demo.
- **Input state:** The input box is always active during `intake` (it's a conversation). Disabled during `bidding`/`evaluating` as before.

**`handleSubmit` logic (replaces `handleStartAuction`):**
```
if no session yet:
  POST /api/audit/session { initialMessage }
  → set sessionId, session (stage = intake)
elif stage === "intake" and no extractedSpec:
  POST /api/audit/session/[id]/chat { message }
  → update session
  → if extractedSpec now populated, show spec + "Start Auction" button
```

**`handleConfirmSpec` logic (new — triggered by "Start Auction" button):**
```
World ID check fires: "Verify you're human before $X is escrowed for the trial"
  → on success: POST /api/audit/session/[id]/confirm
  → session transitions to bidding
  → auction begins
```

The "Start Auction" button appears after the orchestrator outputs the task spec. It replaces the input box temporarily — the user's only action at that point is to confirm (via World ID) or reset.

**Welcome message update:**
```
"Hi! I'm AgentCheck's orchestrator. Tell me what you need built
and I'll find the best AI agents for the job."
```

### 7. Header Updates (`src/components/audit/AuditHeader.tsx`)

- Add "Intake" as the first step pill: **Intake → Live Bids → Quality Gate → Delivery**
- Highlight it when `stage === "intake"`

---

## Conversation Example (from demo script)

```
User: Build me a cyberpunk wallet connect UI

Orchestrator: Nice — a cyberpunk wallet connect component.
What wallets should it support? MetaMask only, or multi-wallet (WalletConnect, Coinbase, etc.)?

User: MetaMask and WalletConnect

Orchestrator: Got it. What's your total budget for this, and how much
are you willing to spend on a trial run before committing to the full build?

User: $50 total, 20% for trial

Orchestrator: Here's the plan:

**Task:** Cyberpunk-styled wallet connect UI (React) — MetaMask + WalletConnect support
**Trial scope:** Minimal connect button with neon styling, connect/disconnect state only
**Budget:** $50 total — $10 trial / $40 full build
**Weights:** Quality 50% · Price 25% · Speed 25%

Opening the auction now — confirm with World ID to escrow $10 for the trial.

[JSON spec extracted → "Start Auction" button appears]
[User clicks → World ID fires → POST /confirm → bidding starts]
```

---

## Files Changed Summary

| File | Change |
|---|---|
| `src/types/audit.ts` | Add `intake` to FlowStage, add `IntakeSpec` type, add intake state variant |
| `src/server/intake.ts` | **New** — Gemini-powered intake conversation |
| `src/server/orchestrator.ts` | Rewrite `createSession`, add `chatIntake`, extract `transitionToBidding` |
| `src/lib/validation.ts` | Add `CreateIntakeSessionSchema`, `ChatMessageSchema` |
| `src/app/api/audit/session/route.ts` | Update to accept `{ initialMessage }` |
| `src/app/api/audit/session/[id]/chat/route.ts` | **New** — chat endpoint for intake |
| `src/app/api/audit/session/[id]/confirm/route.ts` | **New** — confirm spec + transition to bidding (called after World ID) |
| `src/components/audit/AuditFlowDemo.tsx` | Rewrite submit logic for multi-turn intake |
| `src/components/audit/AuditHeader.tsx` | Add Intake step pill |

## Open Questions

1. **Should the settings panel remain as an optional override?** For the demo, conversation-driven is cleaner. But a power-user shortcut could be nice.
2. **How many clarifying turns?** The demo script shows 2 turns (wallets, budget). The Gemini prompt should aim for 2–3 max to keep the demo snappy.
3. **What if the user provides everything in one message?** (e.g. "Build me a cyberpunk wallet UI, $50 budget, 20% trial") — The orchestrator should recognize this and output the spec immediately without unnecessary follow-ups.
