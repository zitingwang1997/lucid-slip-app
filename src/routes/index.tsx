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
    <Shell intensity={0.55}>
      {/* central amber halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.74 0.13 55 / 0.18) 0%, oklch(0.68 0.16 45 / 0.08) 35%, transparent 70%)",
          filter: "blur(40px)",
          animation: "breathe 9s ease-in-out infinite",
        }}
      />

      <main className="relative flex flex-1 flex-col items-center justify-center px-8 pb-24">
        <div className="flex w-full max-w-sm flex-col items-center slow-fade-in">
          <p
            className="mb-10 text-center text-[10px] uppercase text-foreground/35"
            style={{ letterSpacing: "0.55em" }}
          >
            A Modern Ritual
          </p>

          <h1
            className="font-serif-sc text-center text-ivory"
            style={{
              fontWeight: 300,
              fontSize: "34px",
              lineHeight: 1.7,
              letterSpacing: "0.12em",
              textShadow:
                "0 0 30px oklch(0.74 0.13 55 / 0.35), 0 0 80px oklch(0.68 0.16 45 / 0.15)",
            }}
          >
            此刻，
            <br />
            你最想问什么？
          </h1>

          <div className="relative mt-16 w-full">
            {/* soft mist behind input */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-[-20px] inset-y-[-10px] rounded-full"
              style={{
                background:
                  "radial-gradient(ellipse at center, oklch(0.24 0.02 55 / 0.55) 0%, transparent 70%)",
                filter: "blur(18px)",
              }}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="输入你的困惑..."
              className="relative w-full border-0 bg-transparent text-center font-serif-sc text-[15px] text-ivory placeholder:text-foreground/30 focus:outline-none"
              style={{ letterSpacing: "0.08em", padding: "10px 0" }}
            />
            {/* hairline beneath */}
            <div
              aria-hidden
              className="relative mx-auto mt-1 h-px w-2/3"
              style={{
                background:
                  "linear-gradient(to right, transparent, oklch(0.74 0.13 55 / 0.35), transparent)",
              }}
            />
          </div>
        </div>

        <button
          onClick={proceed}
          className="mt-24 rounded-full border border-primary/35 bg-transparent px-14 py-3.5 font-serif-sc text-[15px] text-ivory transition-all hover:border-primary/70"
          style={{
            letterSpacing: "0.55em",
            paddingRight: "calc(3.5rem - 0.55em)",
            boxShadow:
              "0 0 28px oklch(0.74 0.13 55 / 0.18), inset 0 0 20px oklch(0.74 0.13 55 / 0.05)",
          }}
        >
          求一支签
        </button>
      </main>
    </Shell>
  );
}
