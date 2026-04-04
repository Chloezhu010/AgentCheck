import { AuditFlowDemo } from "@/components/audit/AuditFlowDemo";

export default function Home() {
  return (
    <main className="flex h-screen flex-col bg-zinc-50 px-3 py-3 md:px-6 md:py-4">
      <header className="mb-3 flex items-center gap-3 px-2">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
          AgentCheck
        </h1>
        <span className="text-sm text-zinc-400">
          Chat-first agent audit orchestration
        </span>
        <a
          href="/hedera"
          className="ml-auto rounded-lg border border-zinc-200 px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-50"
        >
          Hedera Dashboard
        </a>
      </header>
      <div className="min-h-0 flex-1">
        <AuditFlowDemo />
      </div>
    </main>
  );
}
