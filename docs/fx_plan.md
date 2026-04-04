# FX Linkage Plan: USD ↔ HBAR

## Problem

The frontend displays USD everywhere (budget, bids, quotes), while the backend settles payments in HBAR on Hedera Testnet. The conversion module (`src/lib/fx.ts`) exists with `usdToHbar()` and `hbarToUsd()` but is not imported anywhere — the two currency worlds are disconnected.

## Current State

```
FRONTEND (USD)                         BACKEND (HBAR)
─────────────                         ──────────────
Budget: $50                           hbar_transfer(amount: HBAR)
Bid: $22.00                           escrowLock(amountHbar)
Header: $22/$50                       escrowRelease(amountHbar)

        ↕ nothing connects them ↕

        fx.ts exists but is unused
        usdToHbar() / hbarToUsd()
```

## Design Principle

**Single conversion boundary:** every layer above the Hedera tool speaks USD, everything below speaks HBAR. `fx.ts` sits at that boundary. This avoids scattered conversions and rounding errors — there is exactly one place where USD becomes HBAR.

```
User ($50 budget)
  → Orchestrator agent (thinks in USD)
    → hbar_transfer(amount: 0.22)  ← agent passes USD
      → usdToHbar(0.22) = ~2.52 HBAR  ← conversion happens HERE
        → Hedera SDK sends HBAR on-chain
```

## Changes Required

| File | Change |
|---|---|
| `src/server/tools/hedera.ts` | `hbar_transfer` accepts USD, calls `usdToHbar()` internally before hitting Hedera SDK |
| `src/lib/fx.ts` | Already done — no changes needed |
| `src/server/orchestrator.ts` | Update system prompt: say "amount in USD" instead of "amount in HBAR" |
| `src/types/audit.ts` | No change — keep `quoteUsd`, `budgetUsd` as-is |
| Frontend components (optional) | Show `(≈ X HBAR)` next to USD amounts for transparency |

## Implementation Detail

### 1. `src/server/tools/hedera.ts` — hbar_transfer tool

Current (broken — agent thinks in USD but tool expects HBAR):

```ts
amount: { type: "number", description: "Amount in HBAR to transfer. Max 1 on testnet." }
```

Updated:

```ts
amount: { type: "number", description: "Amount in USD to transfer." }
```

Handler change:

```ts
import { usdToHbar } from "@/lib/fx";

// inside hbar_transfer case:
const amountUsd = args.amount as number;
const amountHbar = usdToHbar(amountUsd);
if (amountHbar > 1) {
  return { error: `Transfer ${amountHbar.toFixed(4)} HBAR exceeds 1 HBAR testnet safety limit` };
}
// ... proceed with amountHbar
```

### 2. `src/server/orchestrator.ts` — system prompt

Update the `hbar_transfer` description in the system prompt from:

> Transfer HBAR between accounts

To:

> Transfer payment in USD (auto-converted to HBAR for on-chain settlement)

### 3. Frontend (optional) — dual display

Anywhere USD is shown, optionally add HBAR equivalent:

```ts
import { usdToHbar, formatHbar } from "@/lib/fx";

// e.g. in AuditHeader, ExecutionFlow, AgentConfirmPanel:
// $22.00 (≈ 251.9 HBAR)
```

## FX Rate

Currently hardcoded in `fx.ts`:

```ts
const HBAR_TO_USD_RATE = 0.08733; // 1 HBAR = $0.08733
```

For production, swap with a live oracle (e.g. CoinGecko API). For the hackathon demo, the hardcoded rate is fine.
