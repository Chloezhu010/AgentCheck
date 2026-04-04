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
    title: "Cinematic Launch Key Visual",
    brief: "Single hero image for an AI study app launch campaign.",
    tags: ["Single image", "Cinematic", "Marketing-ready"],
    prompt: [
      "Generate one cinematic launch key visual for an AI study app called FocusPilot.",
      "Scene: late-night desk setup, laptop glow, floating handwritten notes becoming clean digital cards.",
      "Style: photoreal, teal + warm amber contrast, shallow depth of field, high-detail lighting.",
      "Mood: hopeful breakthrough after frustration.",
      "Output: single image composition suitable for a website hero banner.",
    ].join("\n"),
  },
  {
    title: "4-Panel Comic Storyboard",
    brief: "Narrative comic showing before/after with an AI creative assistant.",
    tags: ["Four-panel comic", "Story-first", "Expressive style"],
    prompt: [
      "Create a four-panel comic about an indie creator using an AI design assistant.",
      "Panel 1: creator overwhelmed by messy ideas and tight deadline.",
      "Panel 2: assistant suggests a clear visual direction and plan.",
      "Panel 3: creator rapidly iterates with confidence.",
      "Panel 4: polished launch post goes live and gets strong engagement.",
      "Style: clean line art, vivid colors, readable expressions, consistent character design.",
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
