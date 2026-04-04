"use client";

import { useEffect, useState } from "react";

const ASCII_FRAMES = [
  String.raw`      z
  .------------.
 /  [ -  - ]   \__
|   /|_||_|\      )
 \__/  \/  \_____/`,
  String.raw`     zZ
  .------------.
 /  [ -  - ]   \__
|   /|_||_|\      )
 \__/  \/  \_____/`,
  String.raw`    z z
  .------------.
 /  [ -  - ]   \__
|   /|_||_|\      )
 \__/  \/  \_____/`,
  String.raw`        
  .------------.
 /  [ o  o ]   \__
|   /|_||_|\      )
 \__/  \/  \_____/`,
  String.raw`      .
  .------------.
 /  [ o  - ]   \__
|   /|_||_|\      )
 \__/  \/  \_____/`,
  String.raw`      z
  .------------.
 /  [ -  - ]   \__
|   /|_||_|\      )
 \__/  \/  \_____/`,
  String.raw`     zz
  .------------.
 /  [ -  - ]   \__
|   /|_||_|\      )
 \__/  \/  \_____/`,
  String.raw`      z
  .------------.
 /  [ -  - ]   \__
|   /|_||_|\      )
 \__/  \/  \_____/`,
];

type SuggestedPrompt = {
  title: string;
  brief: string;
  tags: string[];
  prompt: string;
};

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    title: "Launch Landing Page",
    brief: "AI writing tool for solo creators and small agencies.",
    tags: ["$550 budget", "5-day deadline", "Conversion-focused"],
    prompt: [
      "Build a marketing landing page for a new AI writing tool.",
      "Audience: solo creators and small agencies.",
      "Budget: $550. Deadline: 5 days.",
      "Need: hero, pricing, social proof, FAQ, sticky CTA.",
      "Output: page spec, component list, and copy draft.",
    ].join("\n"),
  },
  {
    title: "Checkout UX Revamp",
    brief: "Benchmark competitors and improve conversion in checkout.",
    tags: ["$700 budget", "7-day deadline", "A/B test plan"],
    prompt: [
      "Audit checkout UX and propose a conversion-focused revamp.",
      "Analyze 3 competitor funnels and our current flow.",
      "Budget: $700. Deadline: 7 days.",
      "Need: friction map, trust gap analysis, A/B test plan.",
      "Output: prioritized fixes with expected conversion impact.",
    ].join("\n"),
  },
];

type IdleHeroProps = {
  onPickPrompt: (prompt: string) => void;
};

export function IdleHero({ onPickPrompt }: IdleHeroProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const activeFrameIndex = reduceMotion ? 0 : frameIndex;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = (matches: boolean) => setReduceMotion(matches);

    sync(media.matches);

    const onChange = (event: MediaQueryListEvent) => sync(event.matches);
    media.addEventListener("change", onChange);

    return () => {
      media.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    const timer = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % ASCII_FRAMES.length);
    }, 700);

    return () => {
      window.clearInterval(timer);
    };
  }, [reduceMotion]);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 md:p-5">
      <div className="relative">
        <pre className="h-[116px] overflow-hidden rounded-lg bg-zinc-900/95 px-3 py-2 font-mono text-[11px] leading-5 text-emerald-300">
          {ASCII_FRAMES[activeFrameIndex]}
        </pre>

        <span className="pointer-events-none absolute top-3 right-3 font-mono text-[10px] leading-3 whitespace-pre text-emerald-300">
          {"   +\n      x\n  *   +\n        x\n    +"}
        </span>
      </div>

      <h2 className="mt-4 text-base font-semibold text-zinc-900 md:text-lg">
        Start with one clear task
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-zinc-500">
        Pick a template below or type your own brief in one sentence.
      </p>

      <div className="mt-4 space-y-2.5">
        {SUGGESTED_PROMPTS.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => onPickPrompt(item.prompt)}
            className="w-full rounded-lg border border-zinc-200 bg-white text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50"
          >
            <div className="px-3 py-2.5">
              <p className="text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
                Template {index + 1}
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{item.brief}</p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
