import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Shell } from "@/components/Shell";
import {
  getHistoryEntry,
  restoreHistoryEntry,
  type HistoryEntry,
} from "@/lib/fortune-store";

const searchSchema = z.object({
  id: z.string(),
  q: z.string().optional().default(""),
});

export const Route = createFileRoute("/today-guidance")({
  head: () => ({ meta: [{ title: "今日此问 · 一签" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: TodayGuidancePage,
});

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function TodayGuidancePage() {
  const navigate = useNavigate();
  const { id, q } = Route.useSearch();
  const [entry, setEntry] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    const e = getHistoryEntry(id);
    if (!e) {
      navigate({ to: "/" });
      return;
    }
    setEntry(e);
  }, [id, navigate]);

  if (!entry) return null;

  const goToSlip = () => {
    restoreHistoryEntry(entry.id);
    if (entry.interpretation) navigate({ to: "/interpret" });
    else navigate({ to: "/poem" });
  };

  const askDifferent = () => navigate({ to: "/" });

  return (
    <Shell intensity={0.35} showTemple={false}>
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-between px-7 pb-16 pt-10">
        <header className="slow-fade-in text-center">
          <p className="text-[10px] tracking-[0.55em] uppercase text-foreground/35">
            Today · One Question
          </p>
          <h1
            className="mt-6 font-serif-sc text-ivory/95"
            style={{
              fontWeight: 300,
              fontSize: "clamp(20px, 5vw, 24px)",
              letterSpacing: "0.28em",
              lineHeight: 1.9,
              textShadow: "0 0 40px oklch(0.75 0.04 80 / 0.12)",
            }}
          >
            今日此问，
            <br />
            已有一签
          </h1>
          <div
            aria-hidden
            className="mx-auto mt-7 h-px w-24"
            style={{
              background:
                "linear-gradient(to right, transparent, oklch(0.75 0.04 80 / 0.28), transparent)",
            }}
          />
        </header>

        <section
          className="slow-fade-in mt-10 space-y-7 text-center"
          style={{ animationDelay: "200ms" }}
        >
          {q && q !== entry.question && (
            <p className="font-serif-sc text-[12px] leading-[2] tracking-[0.18em] text-foreground/45">
              你方才写下：<br />
              <span className="text-ivory/75">「{q}」</span>
            </p>
          )}

          <div
            className="mx-auto max-w-[320px] rounded-2xl border px-6 py-5"
            style={{
              borderColor: "oklch(0.74 0.13 55 / 0.22)",
              background:
                "linear-gradient(180deg, oklch(0.74 0.13 55 / 0.06), oklch(0.22 0.014 55 / 0.35))",
            }}
          >
            <p className="text-[10px] tracking-[0.45em] uppercase text-primary/70">
              {formatDate(entry.createdAt)}
            </p>
            <p className="mt-3 font-serif-sc text-[14px] leading-[2] tracking-[0.16em] text-ivory/90">
              「{entry.question}」
            </p>
            {entry.slip?.title && (
              <p className="mt-4 font-serif-sc text-[12px] tracking-[0.3em] text-primary/75">
                {entry.slip.number ? `第 ${entry.slip.number} 签 · ` : ""}
                {entry.slip.title}
              </p>
            )}
          </div>

          <p className="mx-auto max-w-[300px] whitespace-pre-line font-serif-sc text-[13px] leading-[2.2] text-foreground/55">
            {`有些困惑，不适合反复追问。\n今日的签意已经给出，\n不妨先带着它走一段路。\n反复求问，也许不是为了得到新的答案，\n而是为了安放心里的不安。`}
          </p>
        </section>

        <section
          className="slow-fade-in mt-10 flex flex-col items-center gap-3"
          style={{ animationDelay: "400ms" }}
        >
          <GuidanceAction onClick={goToSlip}>回看今日之签</GuidanceAction>
          <GuidanceAction onClick={goToSlip}>换一个角度看此签</GuidanceAction>
          <GuidanceAction onClick={goToSlip}>给我一个可行的下一步</GuidanceAction>
          <button
            onClick={askDifferent}
            className="mt-3 text-[10px] tracking-[0.45em] uppercase text-foreground/40 hover:text-foreground/75"
          >
            问一个真正不同的问题
          </button>
        </section>
      </main>
    </Shell>
  );
}

function GuidanceAction({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full max-w-[280px] rounded-full border px-6 py-2.5 font-serif-sc text-[13px] tracking-[0.32em] text-ivory/90 transition-all hover:text-ivory"
      style={{
        borderColor: "oklch(0.74 0.13 55 / 0.28)",
        background:
          "linear-gradient(180deg, oklch(0.74 0.13 55 / 0.08), oklch(0.22 0.014 55 / 0.4))",
        boxShadow: "0 0 18px oklch(0.74 0.13 55 / 0.08)",
      }}
    >
      {children}
    </button>
  );
}
