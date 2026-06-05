import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { getPending, saveEntry, type FortuneEntry } from "@/lib/fortune-store";

export const Route = createFileRoute("/interpret")({
  head: () => ({ meta: [{ title: "解签 · 一签" }] }),
  component: InterpretPage,
});

type Remedy = {
  key: string;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  whisper: string;
};

const REMEDY_POOL: Remedy[] = [
  {
    key: "action",
    label: "今日行动",
    eyebrow: "Today's Step",
    title: "走一小步，胜过想十遍。",
    body: "选一件你拖了很久的小事，用十分钟去做它。不必完成，只需开始。",
    whisper: "起身的那一刻，路就出现了。",
  },
  {
    key: "book",
    label: "书籍推荐",
    eyebrow: "A Book",
    title: "《被讨厌的勇气》",
    body: "当你被他人眼光所困，这本书会轻轻提醒你：人生是自己的课题。",
    whisper: "翻开一页，便已是答复。",
  },
  {
    key: "music",
    label: "音乐疗愈",
    eyebrow: "Sound",
    title: "古琴 · 《平沙落雁》",
    body: "在安静的时刻播放一遍。让琴声替你把心里乱掉的事，一件件放回原处。",
    whisper: "音止时，你会松一口气。",
  },
  {
    key: "stillness",
    label: "静心练习",
    eyebrow: "Stillness",
    title: "三分钟呼吸",
    body: "吸气四秒，停两秒，呼气六秒。重复九次。把注意力放在呼气最末端的那点空。",
    whisper: "空，是新的开始。",
  },
  {
    key: "color",
    label: "守护颜色",
    eyebrow: "Color",
    title: "黛青",
    body: "今日若需做选择，看一眼这个颜色。它会让你从急躁中退回半步，看见全局。",
    whisper: "深而不暗，静而不冷。",
  },
  {
    key: "scent",
    label: "今日香气",
    eyebrow: "Scent",
    title: "檀香 · 一缕",
    body: "点一支线香，或滴一滴精油。让气味先安顿空间，再来安顿你。",
    whisper: "香起处，杂念止。",
  },
  {
    key: "number",
    label: "幸运数字",
    eyebrow: "Number",
    title: "七",
    body: "今日若遇到选择题，倾向于第七个出现的可能。它未必最好，但与你此刻同频。",
    whisper: "七，是回旋的数。",
  },
  {
    key: "charm",
    label: "护身物",
    eyebrow: "Charm",
    title: "一枚旧硬币",
    body: "随身带一枚你用了很久的小物。它替你记得：你已走过那么多，没什么过不去。",
    whisper: "旧物里藏着你的勇气。",
  },
];

// Deterministic per-fortune order so each draw feels curated
function remediesFor(n: number): Remedy[] {
  const seed = n || 1;
  return [...REMEDY_POOL].sort(
    (a, b) =>
      ((a.key.charCodeAt(0) * seed) % 17) - ((b.key.charCodeAt(0) * seed) % 17),
  );
}

function oneLineInsight(poem: string[]) {
  // first + last line distilled — quotable, two-line
  return { a: poem[0] ?? "", b: poem[poem.length - 1] ?? "" };
}

function meaningFor(poem: string[]) {
  return `${poem[0]}，写的是此刻；${poem[poem.length - 1]}，写的是去处。中间的迷雾，是路，不是墙。心先安住，方向自现。`;
}

function InterpretPage() {
  const navigate = useNavigate();
  const [entry, setEntry] = useState<FortuneEntry | null>(null);
  const [open, setOpen] = useState<Remedy | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const p = getPending();
    if (!p) navigate({ to: "/" });
    else setEntry(p);
  }, [navigate]);

  const remedies = useMemo(() => (entry ? remediesFor(entry.number) : []), [entry]);
  const insight = useMemo(() => (entry ? oneLineInsight(entry.poem) : null), [entry]);

  if (!entry || !insight) return null;

  const keep = () => {
    if (!open) return;
    saveEntry({
      ...entry,
      reflection: { type: "问心", note: `${open.label} · ${open.title}` },
    });
    setSaved(true);
  };

  return (
    <Shell intensity={0.4}>
      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-10 px-6 pb-24 pt-4">
        {/* Fortune card */}
        <section className="slow-fade-in pt-2">
          <div
            className="paper-texture relative mx-auto w-full max-w-[320px] overflow-hidden rounded-[26px] border border-border/40 px-7 pb-7 pt-8"
            style={{
              boxShadow:
                "0 30px 80px -25px oklch(0 0 0 / 0.65), 0 0 50px oklch(0.74 0.13 55 / 0.12), inset 0 1px 0 oklch(1 0 0 / 0.05)",
            }}
          >
            {/* artwork: ember orb */}
            <div className="relative mx-auto mb-5 h-20 w-20">
              <div
                className="absolute inset-0 rounded-full breathe"
                style={{
                  background:
                    "radial-gradient(circle at 40% 35%, oklch(0.85 0.15 60 / 0.9), oklch(0.55 0.16 45 / 0.4) 55%, transparent 75%)",
                  filter: "blur(2px)",
                }}
              />
              <div
                className="absolute inset-3 rounded-full glow-pulse"
                style={{
                  background:
                    "radial-gradient(circle at 50% 45%, oklch(0.92 0.08 75), oklch(0.7 0.16 50) 70%)",
                }}
              />
              <span
                className="absolute inset-0 flex items-center justify-center font-serif-sc text-[15px] tracking-[0.1em] text-background/85"
                style={{ fontWeight: 500 }}
              >
                第{entry.number}
              </span>
            </div>

            <p className="text-center text-[10px] tracking-[0.5em] uppercase text-foreground/40">
              Fortune
            </p>
            <h1
              className="mt-2 text-center font-serif-sc text-[20px] tracking-[0.3em] text-ivory"
              style={{ fontWeight: 400 }}
            >
              第 {entry.number} 签
            </h1>
            <div className="mx-auto mt-3 h-px w-12 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <p
              className="mt-4 text-center font-serif-sc text-[15px] tracking-[0.3em] text-ivory/90"
              style={{ fontWeight: 400 }}
            >
              {entry.poem[0]}
            </p>
          </div>
        </section>

        {/* 一句点醒 */}
        <Section eyebrow="01" title="一句点醒" delay={200}>
          <p
            className="font-serif-sc text-[19px] leading-[1.9] text-ivory"
            style={{ fontWeight: 400, letterSpacing: "0.08em" }}
          >
            {insight.a}，
            <br />
            {insight.b}。
          </p>
        </Section>

        {/* 签意 */}
        <Section eyebrow="02" title="签意" delay={400}>
          <p className="font-serif-sc text-[14px] leading-[2] text-ivory/75">
            {meaningFor(entry.poem)}
          </p>
        </Section>

        {/* 解惑锦囊 */}
        <Section eyebrow="03" title="解惑锦囊" delay={600}>
          <p className="-mt-3 mb-6 font-serif-sc text-[12px] tracking-[0.2em] text-foreground/45">
            从签中取一味解药
          </p>
          <div className="flex flex-wrap gap-2.5">
            {remedies.map((r, i) => (
              <button
                key={r.key}
                onClick={() => {
                  setOpen(r);
                  setSaved(false);
                }}
                className="slow-fade-in group relative rounded-full border px-4 py-2 font-serif-sc text-[13px] tracking-[0.18em] text-ivory/90 transition-all hover:text-ivory"
                style={{
                  borderColor: "oklch(0.74 0.13 55 / 0.32)",
                  background:
                    "linear-gradient(180deg, oklch(0.74 0.13 55 / 0.10), oklch(0.22 0.014 55 / 0.4))",
                  boxShadow:
                    "0 0 18px oklch(0.74 0.13 55 / 0.10), inset 0 1px 0 oklch(1 0 0 / 0.05)",
                  animationDelay: `${700 + i * 90}ms`,
                }}
              >
                <span
                  className="mr-1.5 inline-block h-1 w-1 -translate-y-[2px] rounded-full bg-primary/80 align-middle"
                  style={{ boxShadow: "0 0 8px var(--primary)" }}
                />
                {r.label}
              </button>
            ))}
          </div>
        </Section>

        <p className="mx-auto mt-2 max-w-[280px] text-center font-serif-sc text-[11px] leading-[2.2] text-foreground/35">
          我不能替你决定命运，
          <br />
          但我可以陪你看清此刻。
        </p>

        <Link
          to="/temple"
          className="mx-auto text-[10px] tracking-[0.4em] uppercase text-foreground/40 hover:text-foreground/75"
        >
          前往心庙
        </Link>
      </main>

      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DrawerContent
          className="paper-texture border-border/50 px-6 pb-10 pt-2"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.20 0.018 55) 0%, oklch(0.16 0.012 50) 100%)",
            boxShadow: "0 -30px 80px -20px oklch(0.74 0.13 55 / 0.18)",
          }}
        >
          {open && (
            <div className="mx-auto w-full max-w-[380px] slow-fade-in">
              <DrawerTitle className="sr-only">{open.label}</DrawerTitle>
              <div className="mt-4 flex items-center justify-center gap-3">
                <span className="h-px w-8 bg-gradient-to-r from-transparent to-primary/50" />
                <span className="text-[10px] tracking-[0.5em] uppercase text-primary/70">
                  {open.eyebrow}
                </span>
                <span className="h-px w-8 bg-gradient-to-l from-transparent to-primary/50" />
              </div>

              <p
                className="mt-3 text-center font-serif-sc text-[13px] tracking-[0.3em] text-foreground/55"
                style={{ fontWeight: 400 }}
              >
                {open.label}
              </p>

              <div
                className="relative mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 40% 35%, oklch(0.85 0.15 60 / 0.85), oklch(0.55 0.16 45 / 0.25) 65%, transparent 80%)",
                }}
              >
                <span
                  className="h-2 w-2 rounded-full bg-primary glow-pulse"
                  style={{ boxShadow: "0 0 24px var(--primary)" }}
                />
              </div>

              <h3
                className="mt-6 text-center font-serif-sc text-[20px] leading-[1.7] text-ivory"
                style={{ fontWeight: 400, letterSpacing: "0.1em" }}
              >
                {open.title}
              </h3>

              <p className="mx-auto mt-5 max-w-[300px] text-center font-serif-sc text-[14px] leading-[2] text-ivory/75">
                {open.body}
              </p>

              <p className="mx-auto mt-6 max-w-[260px] text-center font-serif-sc text-[11px] tracking-[0.3em] text-foreground/45">
                — {open.whisper} —
              </p>

              <button
                onClick={keep}
                className="mt-8 w-full rounded-full border border-primary/40 bg-gradient-to-b from-primary/15 to-transparent py-3 font-serif-sc text-sm tracking-[0.5em] text-ivory transition-all hover:border-primary/70"
              >
                {saved ? "已 收 入 心 庙" : "收 入 心 庙"}
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </Shell>
  );
}

function Section({
  eyebrow,
  title,
  delay,
  children,
}: {
  eyebrow: string;
  title: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <section className="slow-fade-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-4 flex items-center gap-3">
        <span className="text-[10px] tracking-[0.4em] text-primary/70">{eyebrow}</span>
        <span className="h-px flex-1 bg-border/60" />
      </div>
      <h2
        className="mb-4 font-serif-sc text-lg tracking-[0.3em] text-ivory"
        style={{ fontWeight: 400 }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
