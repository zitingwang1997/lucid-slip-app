import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  getInterpretation,
  getSelectedSlip,
  type InterpretationResult,
  type SelectedSlip,
} from "@/lib/fortune-store";

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

const REMEDIES: Remedy[] = [
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
    key: "scent",
    label: "今日香气",
    eyebrow: "Scent",
    title: "檀香 · 一缕",
    body: "点一支线香，或滴一滴精油。让气味先安顿空间，再来安顿你。",
    whisper: "香起处，杂念止。",
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

function InterpretPage() {
  const navigate = useNavigate();
  const [slip, setSlip] = useState<SelectedSlip | null>(null);
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const [open, setOpen] = useState<Remedy | null>(null);

  useEffect(() => {
    const s = getSelectedSlip();
    const r = getInterpretation();
    if (!s) {
      navigate({ to: "/" });
      return;
    }
    setSlip(s);
    setResult(r);
  }, [navigate]);

  if (!slip) return null;

  const xiang = result?.reading?.xiang?.content ?? "";
  const yi = result?.reading?.yi?.content ?? "";
  const xing = result?.reading?.xing?.content ?? "";

  return (
    <Shell intensity={0.4}>
      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-10 px-6 pb-24 pt-4">
        {/* Slip image card */}
        <section className="slow-fade-in pt-2">
          <div
            className="relative mx-auto w-full max-w-[320px] overflow-hidden rounded-[26px] border border-border/40"
            style={{
              boxShadow:
                "0 30px 80px -25px oklch(0 0 0 / 0.65), 0 0 50px oklch(0.74 0.13 55 / 0.16), inset 0 1px 0 oklch(1 0 0 / 0.05)",
            }}
          >
            {slip.image_url ? (
              <img
                src={slip.image_url as string}
                alt="签"
                className="block h-auto w-full select-none"
                draggable={false}
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center font-serif-sc text-sm text-foreground/45">
                签面缺失
              </div>
            )}
          </div>
        </section>

        <Section eyebrow="01" title="象" delay={200}>
          <ReadingBody text={xiang} placeholder="象意正在显现…" />
        </Section>

        <Section eyebrow="02" title="意" delay={400}>
          <ReadingBody text={yi} placeholder="意正在沉淀…" />
        </Section>

        <Section eyebrow="03" title="行" delay={600}>
          <ReadingBody text={xing} placeholder="行止待显…" />
        </Section>

        <Section eyebrow="04" title="解惑锦囊" delay={800}>
          <p className="-mt-3 mb-6 font-serif-sc text-[12px] tracking-[0.2em] text-foreground/45">
            从签中取一味解药
          </p>
          <div className="flex flex-wrap gap-2.5">
            {REMEDIES.map((r, i) => (
              <button
                key={r.key}
                onClick={() => setOpen(r)}
                className="slow-fade-in group relative rounded-full border px-4 py-2 font-serif-sc text-[13px] tracking-[0.18em] text-ivory/90 transition-all hover:text-ivory"
                style={{
                  borderColor: "oklch(0.74 0.13 55 / 0.32)",
                  background:
                    "linear-gradient(180deg, oklch(0.74 0.13 55 / 0.10), oklch(0.22 0.014 55 / 0.4))",
                  boxShadow:
                    "0 0 18px oklch(0.74 0.13 55 / 0.10), inset 0 1px 0 oklch(1 0 0 / 0.05)",
                  animationDelay: `${900 + i * 90}ms`,
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
          className="border-border/50 px-6 pb-10 pt-2"
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

function ReadingBody({ text, placeholder }: { text: string; placeholder: string }) {
  if (!text) {
    return (
      <p className="font-serif-sc text-[13px] leading-[2] text-foreground/40">{placeholder}</p>
    );
  }
  return (
    <div className="space-y-3">
      {text.split(/\n+/).map((para, i) => (
        <p key={i} className="font-serif-sc text-[14px] leading-[2] text-ivory/80">
          {para}
        </p>
      ))}
    </div>
  );
}
