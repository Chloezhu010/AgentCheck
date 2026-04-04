import { HederaDashboard } from "@/components/hedera/HederaDashboard";

export default function HederaPage() {
  return (
    <main className="flex h-screen flex-col bg-zinc-50 px-3 py-3 md:px-6 md:py-4">
      <header className="mb-3 flex items-center gap-3 px-2">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
          AgentCheck
        </h1>
        <span className="text-sm text-zinc-400">
          Hedera Testnet — Payments & Audit
        </span>
      </header>
      <div className="min-h-0 flex-1 rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <HederaDashboard />
      </div>
    </main>
  );
}
