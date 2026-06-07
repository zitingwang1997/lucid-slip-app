import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  getInterpretation,
  getSelectedSlip,
  getUserQuestion,
  type InterpretationResult,
  type SelectedSlip,
} from "@/lib/fortune-store";


export const Route = createFileRoute("/interpret")({
  head: () => ({ meta: [{ title: "解签 · 一签" }] }),
  component: InterpretPage,
});

const guidanceItems = [
  { key: "color", label: "守护颜色" },
  { key: "object", label: "护身物" },
  { key: "number", label: "幸运数字" },
  { key: "book", label: "书籍推荐" },
  { key: "meditation", label: "静心练习" },
  { key: "scent", label: "今日香气" },
  { key: "music", label: "音乐疗愈" },
  { key: "action", label: "今日行动" },
];

function InterpretPage() {
  const navigate = useNavigate();
  const [slip, setSlip] = useState<SelectedSlip | null>(null);
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const [openItem, setOpenItem] = useState<{ key: string; label: string } | null>(null);

  useEffect(() => {
    const q = (typeof window !== "undefined"
      ? (localStorage.getItem("oneslip.question.v2") ?? "")
      : "");
    const s = getSelectedSlip();
    const r = getInterpretation();
    if (!q || q === '""') {
      navigate({ to: "/" });
      return;
    }
    if (!s) {
      navigate({ to: "/draw" });
      return;
    }
    if (!r || (!r.xiang_content && !r.yi_content && !r.xing_content)) {
      navigate({ to: "/poem" });
      return;
    }
    setSlip(s);
    setResult(r);
  }, [navigate]);


  if (!slip) return null;

  const xiang = result?.xiang_content ?? "";
  const yi = result?.yi_content ?? "";
  const xing = result?.xing_content ?? "";
  const disclaimer =
    result?.disclaimer ?? "我不能替你决定命运，\n但我可以陪你看清此刻。";

  return (
    <Shell intensity={0.4}>
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-10 px-6 pb-24 pt-4">
        <section className="slow-fade-in pt-2">
          <div className="mx-auto w-full" style={{ maxWidth: 520 }}>
            {slip.image_url ? (
              <img
                src={slip.image_url}
                alt="签"
                className="block select-none"
                draggable={false}
                style={{
                  width: "100%",
                  maxWidth: 520,
                  height: "auto",
                  objectFit: "contain",
                  filter:
                    "drop-shadow(0 30px 60px oklch(0 0 0 / 0.55)) drop-shadow(0 0 40px oklch(0.74 0.13 55 / 0.18))",
                }}
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded-[26px] border border-border/40 font-serif-sc text-sm text-foreground/45">
                签面缺失
              </div>
            )}
          </div>
        </section>

        <Section eyebrow="01" title={result?.xiang_title || "象"} delay={200}>
          <ReadingBody text={xiang} placeholder="象意正在显现…" />
        </Section>

        <Section eyebrow="02" title={result?.yi_title || "意"} delay={400}>
          <ReadingBody text={yi} placeholder="意正在沉淀…" />
        </Section>

        <Section eyebrow="03" title={result?.xing_title || "行"} delay={600}>
          <ReadingBody text={xing} placeholder="行止待显…" />
        </Section>

        <Section eyebrow="04" title="解惑锦囊" delay={800}>
          <p className="-mt-3 mb-6 font-serif-sc text-[12px] tracking-[0.2em] text-foreground/45">
            从签中取一味解药
          </p>
          <div className="flex flex-wrap gap-2.5">
            {guidanceItems.map((r, i) => (
              <button
                key={r.key}
                onClick={() => setOpenItem(r)}
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

        <p className="mx-auto mt-2 max-w-[320px] whitespace-pre-line text-center font-serif-sc text-[11px] leading-[2.2] text-foreground/35">
          {disclaimer}
        </p>

        <Link
          to="/temple"
          className="mx-auto text-[10px] tracking-[0.4em] uppercase text-foreground/40 hover:text-foreground/75"
        >
          前往心庙
        </Link>
      </main>

      <Drawer open={!!openItem} onOpenChange={(o) => !o && setOpenItem(null)}>
        <DrawerContent
          className="border-border/50 px-6 pb-12 pt-2"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.20 0.018 55) 0%, oklch(0.16 0.012 50) 100%)",
            boxShadow: "0 -30px 80px -20px oklch(0.74 0.13 55 / 0.18)",
          }}
        >
          {openItem && (
            <div className="mx-auto w-full max-w-[380px] slow-fade-in">
              <DrawerTitle className="sr-only">{openItem.label}</DrawerTitle>
              <div className="mt-4 flex items-center justify-center gap-3">
                <span className="h-px w-8 bg-gradient-to-r from-transparent to-primary/50" />
                <span className="text-[10px] tracking-[0.5em] uppercase text-primary/70">
                  Pouch
                </span>
                <span className="h-px w-8 bg-gradient-to-l from-transparent to-primary/50" />
              </div>
              <p
                className="mt-3 text-center font-serif-sc text-[14px] tracking-[0.3em] text-ivory/90"
                style={{ fontWeight: 400 }}
              >
                {openItem.label}
              </p>
              <p className="mx-auto mt-8 max-w-[300px] text-center font-serif-sc text-[14px] leading-[2.2] text-ivory/70">
                这一味锦囊正在生成中。
              </p>
              <p className="mx-auto mt-6 max-w-[260px] text-center font-serif-sc text-[11px] tracking-[0.3em] text-foreground/40">
                — 稍候片刻 —
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
