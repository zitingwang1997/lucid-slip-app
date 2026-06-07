import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  loadHistory,
  restoreHistoryEntry,
  runHistoryMigration,
  type HistoryEntry,
} from "@/lib/fortune-store";

export const Route = createFileRoute("/temple")({
  head: () => ({ meta: [{ title: "心庙 · 一签" }] }),
  component: TemplePage,
});

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

interface OpenKitState {
  entryId: string;
  entryQuestion: string;
  entryCreatedAt: number;
  kitKey: string;
  kitLabel: string;
  kit: {
    label?: string;
    kit_title?: string;
    kit_subtitle?: string;
    kit_content?: string;
    kit_action?: string;
    disclaimer?: string;
  };
}

function TemplePage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [openKit, setOpenKit] = useState<OpenKitState | null>(null);

  useEffect(() => {
    runHistoryMigration();
    setEntries(loadHistory());
  }, []);

  function openEntry(entry: HistoryEntry) {
    restoreHistoryEntry(entry.id);
    if (entry.interpretation) {
      navigate({ to: "/interpret" });
    } else {
      navigate({ to: "/poem" });
    }
  }

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
          <div className="mt-12 flex flex-col gap-6">
            {entries.map((e, i) => {
              const savedKits = e.savedKits ? Object.values(e.savedKits) : [];
              const slipNumber = e.slip?.number;
              const slipTitle = e.slip?.title;
              return (
                <div
                  key={e.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEntry(e)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openEntry(e);
                    }
                  }}
                  className="slow-fade-in group block w-full cursor-pointer overflow-hidden rounded-2xl border border-border/40 text-left transition-all hover:border-primary/45"
                  style={{
                    animationDelay: `${i * 90}ms`,
                    background:
                      "linear-gradient(180deg, oklch(0.20 0.018 55 / 0.55) 0%, oklch(0.15 0.012 50 / 0.6) 100%)",
                    boxShadow:
                      "0 20px 50px -25px oklch(0 0 0 / 0.6), 0 0 32px oklch(0.74 0.13 55 / 0.08)",
                  }}
                >
                  <div className="flex gap-4 p-4">
                    <div className="shrink-0">
                      {(e.slip?.image_url as string | undefined) ? (
                        <img
                          src={e.slip.image_url as string}
                          alt="签"
                          className="block h-28 w-20 rounded-md object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-28 w-20 items-center justify-center rounded-md border border-border/40 font-serif-sc text-[10px] text-foreground/40">
                          签面缺失
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] tracking-[0.35em] uppercase text-foreground/35">
                        {formatDate(e.createdAt)}
                      </p>
                      {(slipNumber || slipTitle) && (
                        <p className="mt-2 font-serif-sc text-[13px] tracking-[0.2em] text-ivory/85">
                          {slipNumber ? `第 ${slipNumber} 签` : ""}
                          {slipNumber && slipTitle ? " · " : ""}
                          {slipTitle ?? ""}
                        </p>
                      )}
                      {e.question && (
                        <p className="mt-2 line-clamp-2 font-serif-sc text-[13px] leading-[1.7] text-foreground/65">
                          {e.question}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-border/30 px-4 py-3">
                    {savedKits.length === 0 ? (
                      <p className="font-serif-sc text-[11px] tracking-[0.3em] text-foreground/35">
                        尚未收入锦囊
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {savedKits.map((k) => (
                          <button
                            key={k.key}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenKit({
                                entryId: e.id,
                                entryQuestion: e.question,
                                kitKey: k.key,
                                kitLabel: k.label ?? k.kit_title ?? k.key,
                                kit: k,
                              });
                            }}
                            className="rounded-full border px-2.5 py-1 font-serif-sc text-[11px] tracking-[0.18em] text-ivory/80 transition-all hover:border-primary/60 hover:text-ivory"
                            style={{
                              borderColor: "oklch(0.74 0.13 55 / 0.28)",
                              background:
                                "linear-gradient(180deg, oklch(0.74 0.13 55 / 0.10), oklch(0.22 0.014 55 / 0.35))",
                            }}
                          >
                            {k.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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

      {openKit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          onClick={() => setOpenKit(null)}
          style={{
            background: "oklch(0 0 0 / 0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="relative z-10 w-full max-w-[360px] rounded-[28px] border px-7 py-8 text-center shadow-2xl slow-fade-in"
            onClick={(event) => event.stopPropagation()}
            style={{
              borderColor: "oklch(0.74 0.13 55 / 0.24)",
              background:
                "radial-gradient(circle at 50% 0%, oklch(0.74 0.13 55 / 0.12), transparent 42%), linear-gradient(180deg, oklch(0.20 0.018 55) 0%, oklch(0.14 0.012 50) 100%)",
              boxShadow:
                "0 30px 90px oklch(0 0 0 / 0.55), 0 0 50px oklch(0.74 0.13 55 / 0.12)",
            }}
          >
            <button
              type="button"
              onClick={() => setOpenKit(null)}
              className="absolute right-5 top-4 text-[18px] text-foreground/35 transition hover:text-foreground/70"
              aria-label="关闭"
            >
              ×
            </button>

            <div className="flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-primary/50" />
              <span className="text-[10px] tracking-[0.5em] uppercase text-primary/70">
                POUCH
              </span>
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-primary/50" />
            </div>

            <p
              className="mt-4 font-serif-sc text-[15px] tracking-[0.3em] text-ivory/90"
              style={{ fontWeight: 400 }}
            >
              {openKit.kit.label ?? openKit.kit.kit_title ?? openKit.kitLabel}
            </p>

            {openKit.kit.kit_subtitle && (
              <p className="mt-3 font-serif-sc text-[12px] tracking-[0.2em] text-primary/70">
                {openKit.kit.kit_subtitle}
              </p>
            )}

            {openKit.kit.kit_content && (
              <p className="mx-auto mt-7 max-w-[290px] whitespace-pre-line font-serif-sc text-[14px] leading-[2.2] text-ivory/75">
                {openKit.kit.kit_content}
              </p>
            )}

            {openKit.kit.kit_action && (
              <p className="mx-auto mt-5 max-w-[290px] whitespace-pre-line font-serif-sc text-[13px] leading-[2.1] text-ivory/65">
                {openKit.kit.kit_action}
              </p>
            )}

            {openKit.entryQuestion && (
              <p className="mx-auto mt-7 max-w-[260px] font-serif-sc text-[10px] leading-[2] text-foreground/35">
                来自：{openKit.entryQuestion}
              </p>
            )}

            {openKit.kit.disclaimer && (
              <p className="mx-auto mt-4 max-w-[240px] whitespace-pre-line font-serif-sc text-[10px] leading-[2] text-foreground/30">
                {openKit.kit.disclaimer}
              </p>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}
