import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { drawFortune, setPending } from "@/lib/fortune-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "一签 OneSlip — 一个安静的现代仪式" },
      { name: "description", content: "提一个问题，求一支签，与AI一同安静地解签。" },
      { property: "og:title", content: "一签 OneSlip" },
      { property: "og:description", content: "现代心灵仪式 · 提问 · 求签 · 解签" },
    ],
  }),
  component: QuestionPage,
});

const SUGGESTIONS = [
  "我该离开现在的工作吗？",
  "我为什么总是焦虑？",
  "我要不要开始新的关系？",
];

function QuestionPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const proceed = () => {
    const fortune = drawFortune();
    setPending({
      id: crypto.randomUUID(),
      number: fortune.number,
      poem: fortune.lines,
      question: q.trim(),
      createdAt: Date.now(),
    });
    navigate({ to: "/draw" });
  };

  return (
    <Shell intensity={0.7}>
      <main className="flex flex-1 flex-col items-center justify-center px-7 pb-14 pt-8">
        <div className="w-full max-w-md slow-fade-in">
          <p className="mb-6 text-center text-[10px] tracking-[0.5em] uppercase text-foreground/40">
            此 刻
          </p>
          <h1
            className="font-serif-sc text-center text-[28px] leading-[1.6] text-ivory"
            style={{ fontWeight: 400, letterSpacing: "0.05em" }}
          >
            此刻，你最想问什么？
          </h1>
          <p className="mt-4 text-center text-xs text-foreground/45 tracking-wider">
            一个问题 · 一支签 · 一念清明
          </p>

          <div className="mt-12">
            <div
              className="relative rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm transition-all focus-within:border-primary/40"
              style={{ boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.04)" }}
            >
              <textarea
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="输入你的困惑..."
                rows={3}
                className="w-full resize-none bg-transparent px-5 py-4 font-serif-sc text-base text-ivory placeholder:text-foreground/30 focus:outline-none"
                style={{ letterSpacing: "0.03em", lineHeight: 1.8 }}
              />
              <button
                type="button"
                aria-label="语音输入"
                className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full border border-border/60 text-foreground/50 transition-colors hover:text-primary"
                onClick={() => {
                  // graceful no-op for first cut
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="9" y="3" width="6" height="12" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setQ(s)}
                  className="rounded-full border border-border/40 bg-background/40 px-3 py-1.5 font-serif-sc text-[11px] text-foreground/55 transition-colors hover:border-primary/40 hover:text-foreground/85"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={proceed}
            className="group mt-12 w-full rounded-full border border-primary/40 bg-gradient-to-b from-primary/15 to-transparent py-4 font-serif-sc text-base tracking-[0.5em] text-ivory transition-all hover:border-primary/70 hover:from-primary/25"
            style={{
              boxShadow: "0 0 36px oklch(0.74 0.13 55 / 0.15), inset 0 1px 0 oklch(1 0 0 / 0.06)",
            }}
          >
            求 一 支 签
          </button>
          <p className="mt-6 text-center text-[10px] tracking-[0.3em] uppercase text-foreground/30">
            Draw a Slip
          </p>
        </div>
      </main>
    </Shell>
  );
}
