import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { getRemedyKits, interpretSlip } from "@/lib/dify.functions";
import {
  getCurrentHistoryId,
  getHistoryEntry,
  getInterpretation,
  getInterpretCacheV2,
  getSelectedSlip,
  getUserQuestion,
  saveKitToHistory,
  setInterpretation,
  setInterpretCacheV2,
  slipCacheId,
  updateHistoryEntry,
  type InterpretationResult,
  type SelectedSlip,
} from "@/lib/fortune-store";

export const Route = createFileRoute("/interpret")({
  head: () => ({ meta: [{ title: "解签 · 一签" }] }),
  component: InterpretPage,
});

const guidanceItems = [
  { key: "daily_action", label: "今日行动" },
  { key: "book", label: "推荐书籍" },
  { key: "music", label: "今日乐曲" },
  { key: "guardian_color", label: "守护颜色" },
  { key: "amulet", label: "护身物" },
  { key: "daily_scent", label: "今日香气" },
] as const;

type KitKey = (typeof guidanceItems)[number]["key"];

interface RemedyKitResult {
  kit_title: string;
  kit_subtitle: string;
  kit_content: string;
  kit_action: string;
  disclaimer: string;
}

type KitCache = Partial<Record<KitKey, RemedyKitResult>>;

const KITS_STORAGE_PREFIX = "oneslip.remedyKits.v1.";

function kitCacheId(): string | null {
  return getCurrentHistoryId();
}

function readKitsFromStorage(): KitCache | null {
  if (typeof window === "undefined") return null;

  const id = kitCacheId();
  if (!id) return null;

  try {
    const raw = localStorage.getItem(KITS_STORAGE_PREFIX + id);
    return raw ? (JSON.parse(raw) as KitCache) : null;
  } catch {
    return null;
  }
}

function writeKitsToStorage(kits: KitCache) {
  if (typeof window === "undefined") return;

  const id = kitCacheId();
  if (!id) return;

  try {
    localStorage.setItem(KITS_STORAGE_PREFIX + id, JSON.stringify(kits));
  } catch {}
}

function InterpretPage() {
  const navigate = useNavigate();
  const remedyKitsFn = useServerFn(getRemedyKits);
  const [slip, setSlip] = useState<SelectedSlip | null>(null);
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const [openItem, setOpenItem] = useState<{ key: KitKey; label: string } | null>(null);
  const [kitCache, setKitCache] = useState<KitCache>({});
  const [kitsLoading, setKitsLoading] = useState(false);
  const [kitsError, setKitsError] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const fetchedRef = useRef(false);

  const interpretSlipFn = useServerFn(interpretSlip);
  const [interpretLoading, setInterpretLoading] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);
  const interpretInflight = useRef(false);

  const persistToHistory = useCallback((r: InterpretationResult) => {
    const histId = getCurrentHistoryId();
    if (!histId) return;
    const entry = getHistoryEntry(histId);
    if (!entry) return;
    if (!entry.interpretation) {
      updateHistoryEntry(histId, { interpretation: r });
    }
    if (entry.savedKits) {
      setSavedKeys(new Set(Object.keys(entry.savedKits)));
    }
  }, []);

  const fallbackFetchInterpret = useCallback(
    async (s: SelectedSlip, q: string) => {
      if (interpretInflight.current) return;
      interpretInflight.current = true;
      setInterpretLoading(true);
      setInterpretError(null);
      try {
        const res = await interpretSlipFn({
          data: {
            user_question: q,
            qian_data: JSON.stringify({
              id: s.id,
              number: s.number,
              title: s.title,
              poem: s.poem,
              allusion: s.allusion,
              meaning_seed: (s as any).meaning_seed ?? s.keywords,
            }),
          },
        });
        const hasContent = res?.xiang_content || res?.yi_content || res?.xing_content;
        if (!hasContent) throw new Error("解签结果为空，请重试");
        setInterpretation(res);
        setInterpretCacheV2({
          slipId: slipCacheId(s),
          user_question: q,
          interpret: res,
          createdAt: Date.now(),
        });
        setResult(res);
        persistToHistory(res);
      } catch (e: any) {
        console.error("[Workflow B fallback] failed:", e);
        setInterpretError(e?.message ?? "解签失败，请稍后再试");
      } finally {
        interpretInflight.current = false;
        setInterpretLoading(false);
      }
    },
    [interpretSlipFn, persistToHistory],
  );

  useEffect(() => {
    const q = getUserQuestion();
    const s = getSelectedSlip();
    if (!q || !q.trim()) {
      navigate({ to: "/" });
      return;
    }
    if (!s) {
      navigate({ to: "/draw" });
      return;
    }
    setSlip(s);

    // Prefer v2 cache when slipId + question match
    const v2 = getInterpretCacheV2();
    const sid = slipCacheId(s);
    let r: InterpretationResult | null = null;
    if (
      v2 &&
      v2.slipId === sid &&
      v2.user_question === q &&
      (v2.interpret?.xiang_content || v2.interpret?.yi_content || v2.interpret?.xing_content)
    ) {
      r = v2.interpret;
      setInterpretation(r);
    } else {
      const legacy = getInterpretation();
      if (legacy && (legacy.xiang_content || legacy.yi_content || legacy.xing_content)) {
        r = legacy;
      }
    }

    const kitsCached = readKitsFromStorage();
    if (kitsCached) setKitCache(kitsCached);

    if (r) {
      setResult(r);
      persistToHistory(r);
    } else {
      void fallbackFetchInterpret(s, q);
    }
  }, [navigate, fallbackFetchInterpret, persistToHistory]);

  const fetchKits = useCallback(
    async (s: SelectedSlip, r: InterpretationResult) => {
      setKitsLoading(true);
      setKitsError(null);
      try {
        const question = getUserQuestion();
        const qianData = {
          id: s.id,
          number: s.number,
          realm: s.realm,
          title: s.title,
          poem: s.poem,
          keywords: s.keywords,
          allusion: s.allusion,
        };
        const interpretationPayload = {
          xiang_content: r.xiang_content ?? "",
          yi_content: r.yi_content ?? "",
          xing_content: r.xing_content ?? "",
        };
        const res = await remedyKitsFn({
          data: {
            user_question: question,
            qian_data: JSON.stringify(qianData),
            interpretation: JSON.stringify(interpretationPayload),
          },
        });
        const kits = (res?.kits ?? {}) as KitCache;
        setKitCache(kits);
        writeKitsToStorage(kits);
      } catch (err) {
        console.error("[remedy kits] error", err);
        setKitsError(err instanceof Error ? err.message : "锦囊生成失败，请稍后再试");
      } finally {
        setKitsLoading(false);
      }
    },
    [remedyKitsFn],
  );

  useEffect(() => {
    if (!slip || !result) return;
    if (fetchedRef.current) return;
    const cached = readKitsFromStorage();
    const hasAll = cached && guidanceItems.every((g) => cached[g.key]);
    if (hasAll) return;
    fetchedRef.current = true;
    void fetchKits(slip, result);
  }, [slip, result, fetchKits]);

  function retryKits() {
    if (slip && result) {
      fetchedRef.current = true;
      void fetchKits(slip, result);
    }
  }

  function onSaveKit() {
    if (!openItem) return;
    const kit = kitCache[openItem.key];
    if (!kit) return;
    const histId = getCurrentHistoryId();
    if (!histId) return;
    if (savedKeys.has(openItem.key)) return;
    saveKitToHistory(histId, openItem.key, {
      key: openItem.key,
      label: openItem.label,
      kit_title: kit.kit_title,
      kit_subtitle: kit.kit_subtitle,
      kit_content: kit.kit_content,
      kit_action: kit.kit_action,
      disclaimer: kit.disclaimer,
      savedAt: Date.now(),
    });
    setSavedKeys((prev) => new Set(prev).add(openItem.key));
  }

  if (!slip) return null;

  const xiang = result?.xiang_content ?? "";
  const yi = result?.yi_content ?? "";
  const xing = result?.xing_content ?? "";
  const disclaimer = result?.disclaimer ?? "我不能替你决定命运，\n但我可以陪你看清此刻。";

  const kitResult = openItem ? kitCache[openItem.key] : undefined;

  const normalizePoemColumn = (text: string) => {
    if (!text) return "";
    return /[，。！？；]$/.test(text) ? text : `${text}。`;
  };

  const poemSentences =
    (slip.poem ?? "")
      .match(/[^。！？]+[。！？]?/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? [];

  const midpoint = Math.ceil(poemSentences.length / 2);

  const rightColumn = normalizePoemColumn(poemSentences.slice(0, midpoint).join(""));

  const leftColumn = normalizePoemColumn(poemSentences.slice(midpoint).join(""));

  const longestColumnLength = Math.max(rightColumn.length, leftColumn.length);

  const poemFontSize =
    longestColumnLength > 22
      ? "1.6cqi"
      : longestColumnLength > 20
        ? "1.8cqi"
        : longestColumnLength > 18
          ? "2.2cqi"
          : longestColumnLength > 14
            ? "2.4cqi"
            : "2.6cqi";

  return (
    <Shell intensity={0.4}>
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-10 px-6 pb-24 pt-4">
        <section className="slow-fade-in pt-2">
          <div className="mx-auto w-full" style={{ maxWidth: 520 }}>
            {slip.image_url ? (
              <div
                className="relative mx-auto w-[88%] select-none"
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  aspectRatio: "848 / 1489",
                  maxWidth: 460,
                  containerType: "inline-size",
                  filter: "drop-shadow(0 30px 60px oklch(0 0 0 / 0.6)) drop-shadow(0 0 50px oklch(0.74 0.13 55 / 0.2))",
                }}
              >
                <div
                  aria-label={slip.title ?? "签"}
                  className="pointer-events-none absolute inset-0 h-full w-full select-none"
                  style={{
                    backgroundImage: `url(${slip.image_url})`,
                    backgroundSize: "contain",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    WebkitTouchCallout: "none",
                    WebkitUserSelect: "none",
                    userSelect: "none",
                  }}
                />

                <div
                  className="pointer-events-none absolute font-serif-sc text-[rgba(55,38,24,0.82)]"
                  style={{
                    left: "8%",
                    top: "3.8%",
                    fontSize: "3.8cqi",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    lineHeight: 1.15,
                  }}
                >
                  {slip.number}
                </div>

                <div
                  className="pointer-events-none absolute flex flex-col items-center font-serif-sc text-[rgba(55,38,24,0.82)]"
                  style={{
                    right: "8%",
                    top: "3.8%",
                    lineHeight: 1.15,
                    letterSpacing: "0.08em",
                  }}
                >
                  <span style={{ fontSize: "3.8cqi", fontWeight: 500 }}>{slip.title}</span>
                </div>

                <div
                  className="pointer-events-none absolute flex flex-row-reverse"
                  style={{
                    right: "7%",
                    top: "20%",
                    height: "78%",
                    gap: "clamp(4px, 1.6cqi, 14px)",
                  }}
                >
                  <span
                    className="font-serif-sc text-[rgba(55,38,24,0.86)]"
                    style={{
                      writingMode: "vertical-rl",
                      textOrientation: "mixed",
                      letterSpacing: "0.12em",
                      fontSize: poemFontSize,
                      fontWeight: 600,
                      lineHeight: 1.25,
                    }}
                  >
                    {rightColumn}
                  </span>
                </div>

                <div
                  className="pointer-events-none absolute flex flex-row-reverse"
                  style={{
                    left: "7%",
                    top: "20%",
                    height: "78%",
                    gap: "clamp(4px, 1.6cqi, 14px)",
                  }}
                >
                  <span
                    className="font-serif-sc text-[rgba(55,38,24,0.86)]"
                    style={{
                      writingMode: "vertical-rl",
                      textOrientation: "mixed",
                      letterSpacing: "0.12em",
                      fontSize: poemFontSize,
                      fontWeight: 600,
                      lineHeight: 1.25,
                    }}
                  >
                    {leftColumn}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex aspect-[848/1489] w-full max-w-[360px] items-center justify-center rounded-[28px] border border-border/40 font-serif-sc text-sm text-foreground/45">
                签面缺失
              </div>
            )}
          </div>
        </section>

        <Section eyebrow="象" title={result?.xiang_title || "象"} delay={200}>
          <ReadingBody text={xiang} placeholder="象意正在显现…" />
        </Section>

        <Section eyebrow="意" title={result?.yi_title || "意"} delay={400}>
          <ReadingBody text={yi} placeholder="意正在沉淀…" />
        </Section>

        <Section eyebrow="行" title={result?.xing_title || "行"} delay={600}>
          <ReadingBody text={xing} placeholder="行止待显…" />
        </Section>

        <Section eyebrow="解惑锦囊" title="解惑锦囊" delay={800}>
          <p className="-mt-3 mb-6 font-serif-sc text-[12px] tracking-[0.2em] text-foreground/45">从签中取一味解药</p>
          <div className="flex flex-wrap gap-2.5">
            {guidanceItems.map((r, i) => (
              <button
                key={r.key}
                onClick={() => setOpenItem({ key: r.key, label: r.label })}
                className="slow-fade-in group relative rounded-full border px-4 py-2 font-serif-sc text-[13px] tracking-[0.18em] text-ivory/90 transition-all hover:text-ivory"
                style={{
                  borderColor: "oklch(0.74 0.13 55 / 0.32)",
                  background: "linear-gradient(180deg, oklch(0.74 0.13 55 / 0.10), oklch(0.22 0.014 55 / 0.4))",
                  boxShadow: "0 0 18px oklch(0.74 0.13 55 / 0.10), inset 0 1px 0 oklch(1 0 0 / 0.05)",
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
            background: "linear-gradient(180deg, oklch(0.20 0.018 55) 0%, oklch(0.16 0.012 50) 100%)",
            boxShadow: "0 -30px 80px -20px oklch(0.74 0.13 55 / 0.18)",
          }}
        >
          {openItem && (
            <div className="mx-auto w-full max-w-[380px] slow-fade-in">
              <DrawerTitle className="sr-only">{openItem.label}</DrawerTitle>
              <div className="mt-4 flex items-center justify-center gap-3">
                <span className="h-px w-8 bg-gradient-to-r from-transparent to-primary/50" />
                <span className="text-[10px] tracking-[0.5em] uppercase text-primary/70">Pouch</span>
                <span className="h-px w-8 bg-gradient-to-l from-transparent to-primary/50" />
              </div>
              <p
                className="mt-3 text-center font-serif-sc text-[14px] tracking-[0.3em] text-ivory/90"
                style={{ fontWeight: 400 }}
              >
                {kitResult?.kit_title || openItem.label}
              </p>

              {kitResult ? (
                <div className="mt-6 space-y-5">
                  {kitResult.kit_subtitle && openItem?.key === "guardian_color" ? (
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="h-14 w-14 rounded-full border border-white/15 shadow-lg"
                        style={{
                          backgroundColor: kitResult.kit_subtitle,
                          boxShadow: `0 0 28px ${kitResult.kit_subtitle}55`,
                        }}
                      />
                    </div>
                  ) : kitResult.kit_subtitle ? (
                    <p className="text-center font-serif-sc text-[12px] tracking-[0.25em] text-primary/70">
                      {kitResult.kit_subtitle}
                    </p>
                  ) : null}
                  {kitResult.kit_content && (
                    <div className="space-y-3">
                      {kitResult.kit_content.split(/\n+/).map((p, i) => (
                        <p key={i} className="font-serif-sc text-[14px] leading-[2] text-ivory/80">
                          {p}
                        </p>
                      ))}
                    </div>
                  )}
                  {kitResult.kit_action && (
                    <div
                      className="rounded-2xl border px-5 py-4"
                      style={{
                        borderColor: "oklch(0.74 0.13 55 / 0.28)",
                        background: "linear-gradient(180deg, oklch(0.74 0.13 55 / 0.08), oklch(0.22 0.014 55 / 0.35))",
                      }}
                    >
                      <p className="mb-2 text-center font-serif-sc text-[11px] tracking-[0.4em] uppercase text-primary/70">
                        Action
                      </p>
                      <p className="text-center font-serif-sc text-[14px] leading-[2] text-ivory/85">
                        {kitResult.kit_action}
                      </p>
                    </div>
                  )}
                  {kitResult.disclaimer && (
                    <p className="mx-auto max-w-[300px] whitespace-pre-line text-center font-serif-sc text-[11px] leading-[2] text-foreground/40">
                      {kitResult.disclaimer}
                    </p>
                  )}
                  <div className="flex justify-center pt-2">
                    {openItem && savedKeys.has(openItem.key) ? (
                      <span
                        className="rounded-full border px-6 py-2 font-serif-sc text-[12px] tracking-[0.4em] text-ivory/55"
                        style={{ borderColor: "oklch(0.74 0.13 55 / 0.18)" }}
                      >
                        已 安 放
                      </span>
                    ) : (
                      <button
                        onClick={onSaveKit}
                        className="rounded-full border px-6 py-2 font-serif-sc text-[12px] tracking-[0.4em] text-ivory/90 transition-all hover:text-ivory"
                        style={{
                          borderColor: "oklch(0.74 0.13 55 / 0.32)",
                          background: "linear-gradient(180deg, oklch(0.74 0.13 55 / 0.10), oklch(0.22 0.014 55 / 0.4))",
                        }}
                      >
                        收 入 心 庙
                      </button>
                    )}
                  </div>
                </div>
              ) : kitsLoading ? (
                <>
                  <p className="mx-auto mt-8 max-w-[300px] text-center font-serif-sc text-[14px] leading-[2.2] text-ivory/70">
                    六味锦囊正在备好。
                  </p>
                  <p className="mx-auto mt-6 max-w-[260px] text-center font-serif-sc text-[11px] tracking-[0.3em] text-foreground/40">
                    — 稍候片刻 —
                  </p>
                </>
              ) : kitsError ? (
                <div className="mt-8 flex flex-col items-center gap-5">
                  <p className="mx-auto max-w-[300px] text-center font-serif-sc text-[13px] leading-[2] text-ivory/70">
                    {kitsError}
                  </p>
                  <button
                    onClick={retryKits}
                    className="rounded-full border px-5 py-2 font-serif-sc text-[12px] tracking-[0.3em] text-ivory/90 transition-all hover:text-ivory"
                    style={{
                      borderColor: "oklch(0.74 0.13 55 / 0.32)",
                      background: "linear-gradient(180deg, oklch(0.74 0.13 55 / 0.10), oklch(0.22 0.014 55 / 0.4))",
                    }}
                  >
                    重新求取
                  </button>
                </div>
              ) : (
                <p className="mx-auto mt-8 max-w-[300px] text-center font-serif-sc text-[14px] leading-[2.2] text-ivory/70">
                  锦囊尚未备好，请稍后再试。
                </p>
              )}
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
      <h2 className="mb-4 font-serif-sc text-lg tracking-[0.3em] text-ivory" style={{ fontWeight: 400 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ReadingBody({ text, placeholder }: { text: string; placeholder: string }) {
  if (!text) {
    return <p className="font-serif-sc text-[13px] leading-[2] text-foreground/40">{placeholder}</p>;
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
