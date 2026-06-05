import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { loadEntries, type FortuneEntry } from "@/lib/fortune-store";

export const Route = createFileRoute("/temple")({
  head: () => ({ meta: [{ title: "心庙 · 一签" }] }),
  component: TemplePage,
});

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function TemplePage() {
  const [entries, setEntries] = useState<FortuneEntry[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  return (
    <Shell intensity={0.4} showTemple={false}>
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-6 pb-20 pt-8">
        <header className="slow-fade-in text-center">
          <p className="text-[10px] tracking-[0.5em] uppercase text-foreground/40">Personal Temple</p>
          <h1 className="mt-3 font-serif-sc text-3xl tracking-[0.4em] text-ivory">心 庙</h1>
          <p className="mt-4 font-serif-sc text-[12px] tracking-[0.2em] text-foreground/45">
            你走过的每一念，皆在此安放。
          </p>
        </header>

        {entries.length === 0 ? (
          <div className="mt-24 flex flex-col items-center text-center slow-fade-in">
            <span
              className="block h-2 w-2 rounded-full bg-primary breathe"
              style={{ boxShadow: "0 0 24px var(--primary)" }}
            />
            <p className="mt-8 font-serif-sc text-[14px] leading-[2] text-foreground/55">
              心庙尚空。<br />求一支签，便是第一念。
            </p>
            <Link
              to="/"
              className="mt-8 rounded-full border border-primary/40 bg-gradient-to-b from-primary/15 to-transparent px-8 py-3 font-serif-sc text-sm tracking-[0.5em] text-ivory transition-all hover:border-primary/70"
            >
              求 签
            </Link>
          </div>
        ) : (
          <div className="mt-12 flex flex-col gap-5">
            {entries.map((e, i) => {
              const expanded = open === e.id;
              return (
                <button
                  key={e.id}
                  onClick={() => setOpen(expanded ? null : e.id)}
                  className="paper-texture relative overflow-hidden rounded-2xl border border-border/40 px-6 py-6 text-left transition-all slow-fade-in"
                  style={{
                    animationDelay: `${i * 120}ms`,
                    boxShadow:
                      "0 20px 50px -25px oklch(0 0 0 / 0.6), 0 0 32px oklch(0.74 0.13 55 / 0.06), inset 0 1px 0 oklch(1 0 0 / 0.04)",
                  }}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif-sc text-sm tracking-[0.3em] text-foreground/65">
                      第{e.number}签
                    </span>
                    <span className="text-[9px] tracking-[0.3em] uppercase text-foreground/35">
                      {formatDate(e.createdAt)}
                    </span>
                  </div>

                  {e.question && (
                    <p className="mt-3 font-serif-sc text-[13px] leading-[1.9] text-foreground/55">
                      所问 · {e.question}
                    </p>
                  )}

                  <div className="mt-5 flex flex-col gap-1.5">
                    {(expanded ? e.poem : e.poem.slice(0, 2)).map((line, idx) => (
                      <p
                        key={idx}
                        className="font-serif-sc text-[16px] text-ivory"
                        style={{ letterSpacing: "0.3em", fontWeight: 400 }}
                      >
                        {line}
                      </p>
                    ))}
                  </div>

                  {expanded && e.reflection && (
                    <div className="mt-5 rounded-xl border border-border/40 bg-background/30 px-4 py-3 slow-fade-in">
                      <p className="text-[10px] tracking-[0.4em] uppercase text-primary/70">
                        {e.reflection.type}
                      </p>
                      {e.reflection.note ? (
                        <p className="mt-2 font-serif-sc text-[13px] leading-[1.9] text-ivory/80">
                          {e.reflection.note}
                        </p>
                      ) : (
                        <p className="mt-2 font-serif-sc text-[12px] text-foreground/45">
                          一念在心，未落于纸。
                        </p>
                      )}
                    </div>
                  )}

                  <p className="mt-4 text-[9px] tracking-[0.4em] uppercase text-foreground/30">
                    {expanded ? "Tap to fold" : "Tap to unfold"}
                  </p>
                </button>
              );
            })}

            <Link
              to="/"
              className="mt-4 self-center rounded-full border border-primary/40 bg-gradient-to-b from-primary/15 to-transparent px-8 py-3 font-serif-sc text-sm tracking-[0.5em] text-ivory transition-all hover:border-primary/70"
            >
              再 求 一 签
            </Link>
          </div>
        )}
      </main>
    </Shell>
  );
}
