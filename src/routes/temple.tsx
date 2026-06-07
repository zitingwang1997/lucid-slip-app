import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { loadHistory, runHistoryMigration, type HistoryEntry } from "@/lib/fortune-store";

export const Route = createFileRoute("/temple")({
  head: () => ({ meta: [{ title: "心庙 · 一签" }] }),
  component: TemplePage,
});

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function TemplePage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    runHistoryMigration();
    setEntries(loadHistory());
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
          <div className="mt-12 grid grid-cols-2 gap-5">
            {entries.map((e, i) => (
              <div
                key={e.id}
                className="slow-fade-in overflow-hidden rounded-2xl border border-border/40"
                style={{
                  animationDelay: `${i * 100}ms`,
                  boxShadow:
                    "0 20px 50px -25px oklch(0 0 0 / 0.6), 0 0 32px oklch(0.74 0.13 55 / 0.08)",
                }}
              >
                {(e.slip?.image_url as string | undefined) ? (
                  <img
                    src={e.slip.image_url as string}
                    alt="签"
                    className="block h-auto w-full"
                    draggable={false}
                  />
                ) : (
                  <div className="flex aspect-[2/3] items-center justify-center font-serif-sc text-xs text-foreground/40">
                    签面缺失
                  </div>
                )}
                <div className="px-3 py-3">
                  <p className="text-[9px] tracking-[0.3em] uppercase text-foreground/35">
                    {formatDate(e.createdAt)}
                  </p>
                  {e.question && (
                    <p className="mt-1 truncate font-serif-sc text-[12px] text-foreground/60">
                      {e.question}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {entries.length > 0 && (
          <Link
            to="/"
            className="mt-10 self-center rounded-full border border-primary/40 bg-gradient-to-b from-primary/15 to-transparent px-8 py-3 font-serif-sc text-sm tracking-[0.5em] text-ivory transition-all hover:border-primary/70"
          >
            再 求 一 签
          </Link>
        )}
      </main>
    </Shell>
  );
}
