import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { getPending, saveEntry, type FortuneEntry } from "@/lib/fortune-store";

export const Route = createFileRoute("/poem")({
  head: () => ({ meta: [{ title: "签诗 · 一签" }] }),
  component: PoemPage,
});

function toChineseNumeral(n: number) {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (n < 10) return digits[n];
  if (n < 20) return "十" + (n === 10 ? "" : digits[n - 10]);
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return digits[tens] + "十" + (ones ? digits[ones] : "");
}

function PoemPage() {
  const navigate = useNavigate();
  const [entry, setEntry] = useState<FortuneEntry | null>(null);
  const [phase, setPhase] = useState<0 | 1 | 2>(0); // 0 number, 1 poem, 2 cta

  useEffect(() => {
    const p = getPending();
    if (!p) {
      navigate({ to: "/" });
      return;
    }
    setEntry(p);
    saveEntry(p);
    const t1 = window.setTimeout(() => setPhase(1), 1600);
    const t2 = window.setTimeout(() => setPhase(2), 3400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [navigate]);

  if (!entry) return null;

  return (
    <Shell intensity={0.5}>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-12 pt-4">
        <div
          className="relative w-full max-w-[340px] paper-texture rounded-[28px] border border-border/40 px-7 py-12"
          style={{
            boxShadow:
              "0 30px 80px -20px oklch(0 0 0 / 0.6), 0 0 60px oklch(0.74 0.13 55 / 0.12), inset 0 1px 0 oklch(1 0 0 / 0.05)",
          }}
        >
          <div className="slow-fade-in flex flex-col items-center">
            <p className="text-[10px] tracking-[0.5em] uppercase text-foreground/40">
              Fortune
            </p>
            <h2
              className="mt-2 font-serif-sc text-[22px] tracking-[0.2em] text-ivory"
              style={{ fontWeight: 400 }}
            >
              第{toChineseNumeral(entry.number)}签
            </h2>
            <div
              className="mt-4 h-px w-16 bg-gradient-to-r from-transparent via-primary/60 to-transparent"
            />
          </div>

          {phase >= 1 && (
            <div className="mt-10 flex flex-col items-center gap-5">
              {entry.poem.map((line, i) => (
                <p
                  key={i}
                  className="font-serif-sc text-[22px] text-ivory slow-fade-in"
                  style={{
                    letterSpacing: "0.35em",
                    fontWeight: 400,
                    animationDelay: `${i * 350}ms`,
                    textIndent: "0.35em",
                  }}
                >
                  {line}
                </p>
              ))}
            </div>
          )}

          {phase >= 2 && entry.question && (
            <p
              className="mt-10 text-center font-serif-sc text-[11px] tracking-[0.25em] text-foreground/45 slow-fade-in"
            >
              所问 · {entry.question}
            </p>
          )}
        </div>

        {phase >= 2 && (
          <div className="mt-10 flex w-full max-w-[340px] flex-col items-center gap-3 slow-fade-in">
            <Link
              to="/interpret"
              className="w-full rounded-full border border-primary/40 bg-gradient-to-b from-primary/15 to-transparent py-3.5 text-center font-serif-sc text-sm tracking-[0.5em] text-ivory transition-all hover:border-primary/70"
              style={{ boxShadow: "0 0 28px oklch(0.74 0.13 55 / 0.15)" }}
            >
              解 签
            </Link>
            <Link
              to="/temple"
              className="text-[10px] tracking-[0.4em] uppercase text-foreground/40 hover:text-foreground/70 transition-colors"
            >
              收入心庙
            </Link>
          </div>
        )}
      </main>
    </Shell>
  );
}
