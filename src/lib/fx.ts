// Hardcoded demo FX rate: 1 HBAR = $0.08733 USD
// So 1 USD = 1/0.08733 ≈ 11.451 HBAR
// A $4 quote ≈ 45.8 HBAR, $2.50 escrow ≈ 28.6 HBAR
// Swap for a live oracle (e.g. CoinGecko) in production.
const HBAR_TO_USD_RATE = 0.08733;

export function usdToHbar(usd: number): number {
  return Math.round((usd / HBAR_TO_USD_RATE) * 1e8) / 1e8;
}

export function hbarToUsd(hbar: number): number {
  return Math.round(hbar * HBAR_TO_USD_RATE * 100) / 100;
}

export function formatHbar(hbar: number): string {
  return `${hbar.toFixed(4)} HBAR`;
}
