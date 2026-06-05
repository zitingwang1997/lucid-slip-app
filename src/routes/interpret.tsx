import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { getPending, interpretFor, saveEntry, type FortuneEntry } from "@/lib/fortune-store";

export const Route = createFileRoute("/interpret")({
  head: () => ({ meta: [{ title: "解签 · 一签" }] }),
  component: InterpretPage,
});

const PATH_LABELS: Record<"问心" | "释念" | "行愿", string> = {
  问心: "听见真正的问题。",
  释念: "放下暂时不能控制的事。",
  行愿: "做一个小小的行动。",
};

function InterpretPage() {
  const navigate = useNavigate();
  const [entry, setEntry] = useState<FortuneEntry | null>(null);
  const [chosen, setChosen] = useState<"问心" | "释念" | "行愿" | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const p = getPending();
    if (!p) navigate({ to: "/" });
    else setEntry(p);
  }, [navigate]);

  const insight = useMemo(
    () => (entry ? interpretFor(entry.question, entry.poem) : null),
    [entry]
  );

  if (!entry || !insight) return null;

  const commit = () => {
    if (!chosen) return;
    const updated = { ...entry, reflection: { type: chosen, note: note.trim() } };
    saveEntry(updated);
    setSaved(true);
  };

  return (
    <Shell intensity={0.4}>
      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-12 px-6 pb-20 pt-6">
        <header className="slow-fade-in pt-4 text-center">
          <p className="text-[10px] tracking-[0.5em] uppercase text-foreground/40">Interpretation</p>
          <h1 className="mt-3 font-serif-sc text-2xl tracking-[0.3em] text-ivory">解 签</h1>
          <p className="mt-4 font-serif-sc text-[12px] tracking-[0.2em] text-foreground/45">
            第{entry.number}签 · {entry.poem[0]}
          </p>
        </header>

        <Section index={0} eyebrow="01" title="你真正的困惑">
          <p className="font-serif-sc text-[15px] leading-[2] text-ivory/85">
            {insight.deeperQuestion}
          </p>
        </Section>

        <Section index={1} eyebrow="02" title="签意">
          <p className="font-serif-sc text-[15px] leading-[2] text-ivory/85">
            {insight.poemMeaning}
          </p>
        </Section>

        <Section index={2} eyebrow="03" title="化解之道">
          <p className="font-serif-sc text-[12px] tracking-[0.15em] text-foreground/55">
            选择此刻最适合你的一步。
          </p>

          <div className="mt-7 flex flex-col gap-4">
            {insight.paths.map((p, i) => {
              const active = chosen === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => {
                    setChosen(p.key);
                    setNote("");
                    setSaved(false);
                  }}
                  className="paper-texture relative overflow-hidden rounded-2xl border px-6 py-5 text-left transition-all slow-fade-in"
                  style={{
                    borderColor: active
                      ? "oklch(0.74 0.13 55 / 0.55)"
                      : "oklch(0.30 0.014 60 / 0.5)",
                    boxShadow: active
                      ? "0 0 36px oklch(0.74 0.13 55 / 0.18), inset 0 1px 0 oklch(1 0 0 / 0.05)"
                      : "0 10px 30px -15px oklch(0 0 0 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.04)",
                    animationDelay: `${i * 220}ms`,
                  }}
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      className="font-serif-sc text-xl tracking-[0.3em] text-ivory"
                      style={{ fontWeight: 400 }}
                    >
                      {p.key}
                    </span>
                    <span className="text-[9px] tracking-[0.4em] uppercase text-foreground/35">
                      {["Listen", "Release", "Act"][i]}
                    </span>
                  </div>
                  <p className="mt-2 font-serif-sc text-[13px] text-foreground/65">
                    {PATH_LABELS[p.key]}
                  </p>
                </button>
              );
            })}
          </div>

          {chosen && (
            <div className="mt-8 slow-fade-in">
              <p className="font-serif-sc text-[14px] leading-[2] text-ivory/80">
                {insight.paths.find((p) => p.key === chosen)?.hint}
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="（可选）写下此刻的一念..."
                rows={3}
                className="mt-5 w-full resize-none rounded-xl border border-border/50 bg-card/40 px-4 py-3 font-serif-sc text-sm text-ivory placeholder:text-foreground/30 focus:border-primary/40 focus:outline-none"
                style={{ lineHeight: 1.8 }}
              />
              <button
                onClick={commit}
                className="mt-4 w-full rounded-full border border-primary/40 bg-gradient-to-b from-primary/15 to-transparent py-3 font-serif-sc text-sm tracking-[0.5em] text-ivory transition-all hover:border-primary/70"
              >
                {saved ? "已 收 入 心 庙" : "收 入 心 庙"}
              </button>
              {saved && (
                <Link
                  to="/temple"
                  className="mt-3 block text-center text-[10px] tracking-[0.4em] uppercase text-foreground/45 hover:text-foreground/75"
                >
                  前往心庙
                </Link>
              )}
            </div>
          )}
        </Section>

        <p className="mx-auto mt-6 max-w-[280px] text-center font-serif-sc text-[11px] leading-[2.2] text-foreground/35">
          我不能替你决定命运，<br />但我可以陪你看清此刻，<br />并轻轻走出一步。
        </p>
      </main>
    </Shell>
  );
}

function Section({
  index,
  eyebrow,
  title,
  children,
}: {
  index: number;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="slow-fade-in"
      style={{ animationDelay: `${200 + index * 280}ms` }}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="text-[10px] tracking-[0.4em] text-primary/70">{eyebrow}</span>
        <span className="h-px flex-1 bg-border/60" />
      </div>
      <h2
        className="mb-5 font-serif-sc text-lg tracking-[0.3em] text-ivory"
        style={{ fontWeight: 400 }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
