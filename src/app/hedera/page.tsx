"use client";

import Link from "next/link";
import { useState } from "react";
import { HederaDashboard } from "@/components/hedera/HederaDashboard";

export default function HederaPage() {
  const [topicId, setTopicId] = useState<string | null>(null);

  return (
    <main className="flex h-screen flex-col bg-zinc-50 px-3 py-3 md:px-6 md:py-4">
      <header className="mb-3 flex flex-col items-start gap-2 px-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 4.5L7 10l5.5 5.5" />
          </svg>
          Back to Chat
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <svg
            className="h-5 w-5 flex-shrink-0 text-emerald-500"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M13 2L4.09 12.97H11L10 22L20.91 11H14L13 2Z" />
          </svg>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
            Agentick HCS Audit Trail
          </h1>
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            <span>Hedera Testnet</span>
            {topicId && (
              <>
                <span className="text-emerald-300">•</span>
                <a
                  href={`https://hashscan.io/testnet/topic/${topicId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="max-w-[280px] truncate font-mono text-emerald-700 underline"
                  title={topicId}
                >
                  Topic {topicId}
                </a>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <HederaDashboard onTopicIdChange={setTopicId} />
      </div>
    </main>
  );
}
