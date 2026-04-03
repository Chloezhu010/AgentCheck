export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <section className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          AgentCheck
        </h1>
        <p className="mt-3 text-zinc-600">
          Next.js + React + TypeScript scaffold is ready. Start building the
          audit flow from here.
        </p>
        <div className="mt-6 rounded-xl bg-zinc-900 p-4 text-sm text-zinc-100">
          <p>npm run dev</p>
        </div>
      </section>
    </main>
  );
}
