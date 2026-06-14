import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  getInterpretCacheV2,
  getSelectedSlip,
  getUserQuestion,
  setInterpretCacheV2,
  setInterpretation,
  slipCacheId,
  type SelectedSlip,
} from "@/lib/fortune-store";
import { interpretSlip } from "@/lib/dify.functions";

export const Route = createFileRoute("/poem")({
  head: () => ({ meta: [{ title: "签诗 · 一签" }] }),
  component: PoemPage,
});

function buildQianData(slip: SelectedSlip) {
  return {
    id: slip.id,
    number: slip.number,
    title: slip.title,
    poem: slip.poem,
    allusion: slip.allusion,
    meaning_seed: (slip as any).meaning_seed ?? slip.keywords,
  };
}

type InterpretStatus = "idle" | "loading" | "success" | "error";

function PoemPage() {
  const navigate = useNavigate();
  const interpretSlipFn = useServerFn(interpretSlip);
  const [slip, setSlip] = useState<SelectedSlip | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [interpretStatus, setInterpretStatus] = useState<InterpretStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [awaitingInterpret, setAwaitingInterpret] = useState(false);
  const inflight = useRef(false);
  const holdRaf = useRef<number | null>(null);
  const holdStart = useRef<number>(0);
  const holdCompleted = useRef(false);
  const HOLD_MS = 1800;

  const runInterpret = useCallback(
    async (s: SelectedSlip, q: string) => {
      console.log("[PRELOAD] runInterpret called");
      console.log("[PRELOAD] slip:", s);
      console.log("[PRELOAD] question:", q);

      if (inflight.current) {
        console.warn("[PRELOAD] already inflight, skip");
        return;
      }

      inflight.current = true;
      setInterpretStatus("loading");
      setError(null);

      try {
        const payload = {
          user_question: q,
          qian_data: JSON.stringify(buildQianData(s)),
        };

        console.log("[PRELOAD] payload to Workflow B:", payload);

        const res = await interpretSlipFn({ data: payload });

        console.log("[PRELOAD] raw Workflow B response:", res);

        const hasContent = res?.xiang_content || res?.yi_content || res?.xing_content;

        console.log("[PRELOAD] hasContent:", hasContent);

        if (!hasContent) {
          throw new Error("解签结果为空，请重试");
        }

        setInterpretation(res);

        const cachePayload = {
          slipId: slipCacheId(s),
          user_question: q,
          interpret: res,
          createdAt: Date.now(),
        };

        console.log("[PRELOAD] saving interpret cache:", cachePayload);

        setInterpretCacheV2(cachePayload);

        console.log("[PRELOAD] saved cache now:", getInterpretCacheV2());

        setInterpretStatus("success");
      } catch (e: any) {
        console.error("[Workflow B] failed:", e);
        setError(e?.message ?? "解签失败，请稍后再试");
        setInterpretStatus("error");
      } finally {
        inflight.current = false;
      }
    },
    [interpretSlipFn],
  );

  useEffect(() => {
    console.log("[POEM] mounted");

    const allKeys = Object.keys(localStorage).filter((k) => k.includes("oneslip"));
    console.log("[POEM] oneslip localStorage keys:", allKeys);
    allKeys.forEach((k) => {
      console.log(`[POEM] ${k}:`, localStorage.getItem(k));
    });

    const q = getUserQuestion();
    console.log("[POEM] user question:", q);

    if (!q || !q.trim()) {
      console.warn("[POEM] missing user question, redirect to /");
      navigate({ to: "/" });
      return;
    }

    const s = getSelectedSlip();
    console.log("[POEM] selected slip:", s);
    console.log("[POEM] slip cache id:", s ? slipCacheId(s) : null);

    if (!s) {
      console.warn("[POEM] missing selected slip, redirect to /draw");
      navigate({ to: "/draw" });
      return;
    }

    setSlip(s);

    const t = window.setTimeout(() => setRevealed(true), 600);

    const cached = getInterpretCacheV2();
    console.log("[POEM] interpret cache:", cached);

    if (
      cached &&
      cached.slipId === slipCacheId(s) &&
      cached.user_question === q &&
      (cached.interpret?.xiang_content || cached.interpret?.yi_content || cached.interpret?.xing_content)
    ) {
      console.log("[POEM] cache hit, skip Workflow B");
      setInterpretation(cached.interpret);
      setInterpretStatus("success");
    } else {
      console.log("[POEM] cache miss, start Workflow B");
      void runInterpret(s, q);
    }

    return () => window.clearTimeout(t);
  }, [navigate, runInterpret]);

  // Auto-navigate when interpretation finishes AFTER user already completed the hold.
  useEffect(() => {
    if (awaitingInterpret && interpretStatus === "success") {
      navigate({ to: "/interpret" });
    }
  }, [awaitingInterpret, interpretStatus, navigate]);

  const stopHoldRaf = () => {
    if (holdRaf.current != null) {
      cancelAnimationFrame(holdRaf.current);
      holdRaf.current = null;
    }
  };

  const beginHold = () => {
    if (holdCompleted.current) return;
    if (interpretStatus === "error") return;
    setHolding(true);
    holdStart.current = 0;
    stopHoldRaf();
    const tick = (ts: number) => {
      if (!holdStart.current) holdStart.current = ts;
      const p = Math.min(1, (ts - holdStart.current) / HOLD_MS);
      setHoldProgress(p);
      if (p >= 1) {
        holdCompleted.current = true;
        setHolding(false);
        if (interpretStatus === "success") {
          navigate({ to: "/interpret" });
        } else {
          setAwaitingInterpret(true);
        }
        return;
      }
      holdRaf.current = requestAnimationFrame(tick);
    };
    holdRaf.current = requestAnimationFrame(tick);
  };

  const endHold = () => {
    if (holdCompleted.current) return;
    setHolding(false);
    stopHoldRaf();
    // gentle decay back to 0
    const start = performance.now();
    const from = holdProgress;
    const decayMs = Math.max(300, from * 700);
    const decayTick = (ts: number) => {
      const t = Math.min(1, (ts - start) / decayMs);
      const v = from * (1 - t);
      setHoldProgress(v);
      if (t < 1) holdRaf.current = requestAnimationFrame(decayTick);
    };
    holdRaf.current = requestAnimationFrame(decayTick);
  };

  const onRestart = () => {
    navigate({ to: "/" });
  };

  const retryInterpret = () => {
    const q = getUserQuestion();
    if (slip && q) void runInterpret(slip, q);
  };

  if (!slip) return null;

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

  console.log("poemSentences", poemSentences);
  console.log("rightColumn", rightColumn);
  console.log("leftColumn", leftColumn);

  const longestColumnLength = Math.max(rightColumn.length, leftColumn.length);

  const poemFontSize = longestColumnLength > 22 ? "2.2cqi" : longestColumnLength > 18 ? "2.4cqi" : "2.9cqi";

  const realm = String(slip.realm ?? "").trim();
  const realmLevelMatch = realm.match(/(上吉|吉|中平|平|下)/);
  const realmLevel = realmLevelMatch?.[1] ?? "";
  const realmName = realmLevel
    ? realm
        .replace(realmLevel, "")
        .replace(/[·\-\s]+$/, "")
        .trim() || realm
    : realm;

  return (
    <Shell intensity={0.5}>
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-12 pt-4">
        <div
          className="slow-fade-in w-full"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 1.4s ease, transform 1.4s ease",
            maxWidth: 520,
            margin: "0 auto",
          }}
        >
          {slip.image_url ? (
            <div
              className="relative mx-auto w-[88%] touch-none select-none cursor-pointer"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                beginHold();
              }}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              style={{
                aspectRatio: "848 / 1489",
                maxWidth: 460,
                containerType: "inline-size",
                WebkitTouchCallout: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
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

              {/* Top-left: Chinese number */}
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

              {/* Top-right: poem title */}
              <div
                className="pointer-events-none absolute flex flex-col items-center font-serif-sc text-[rgba(55,38,24,0.82)]"
                style={{ right: "8%", top: "3.8%", lineHeight: 1.15, letterSpacing: "0.08em" }}
              >
                <span style={{ fontSize: "3.8cqi", fontWeight: 500 }}>{slip.title}</span>
              </div>

              {/* Right vertical column: lines 1-2 (rightmost line first) */}
              <div
                className="pointer-events-none absolute flex flex-row-reverse"
                style={{ right: "7%", top: "20%", height: "75%", gap: "clamp(4px, 1.6cqi, 14px)" }}
              >
                <span
                  className="poem-line-reveal font-serif-sc text-[rgba(55,38,24,0.86)]"
                  style={{
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    letterSpacing: "0.12em",
                    fontSize: poemFontSize,
                    lineHeight: 1.25,
                    fontWeight: 600,
                    animationDelay: "1.2s",
                  }}
                >
                  {rightColumn}
                </span>
              </div>

              {/* Left vertical column: lines 3-4 (rightmost line first) */}
              <div
                className="pointer-events-none absolute flex flex-row-reverse"
                style={{ left: "7%", top: "20%", height: "75%", gap: "clamp(4px, 1.6cqi, 14px)" }}
              >
                <span
                  className="poem-line-reveal font-serif-sc text-[rgba(55,38,24,0.86)]"
                  style={{
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    letterSpacing: "0.12em",
                    fontSize: poemFontSize,
                    lineHeight: 1.25,
                    fontWeight: 600,
                    animationDelay: "3.2s",
                  }}
                >
                  {leftColumn}
                </span>
              </div>

              {/* Golden hold feedback */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  opacity: holdProgress > 0 || awaitingInterpret ? 1 : 0,
                  transition: "opacity 160ms ease",
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `rgba(214,172,96,${0.1 * holdProgress})`,
                    boxShadow: `
                      inset 0 0 ${40 + holdProgress * 80}px rgba(214,172,96,${0.25 + holdProgress * 0.45}),
                      0 0 ${20 + holdProgress * 50}px rgba(214,172,96,${0.18 + holdProgress * 0.35})
                    `,
                  }}
                />

                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(
                      115deg,
                      transparent 0%,
                      transparent ${Math.max(0, holdProgress * 100 - 28)}%,
                      rgba(255,220,140,0.0) ${Math.max(0, holdProgress * 100 - 16)}%,
                      rgba(255,220,140,0.55) ${holdProgress * 100}%,
                      rgba(255,220,140,0.0) ${Math.min(100, holdProgress * 100 + 16)}%,
                      transparent ${Math.min(100, holdProgress * 100 + 28)}%,
                      transparent 100%
                    )`,
                    mixBlendMode: "screen",
                  }}
                />

                <div
                  className="absolute left-1/2 top-1/2 rounded-full"
                  style={{
                    width: `${36 + holdProgress * 88}px`,
                    height: `${36 + holdProgress * 88}px`,
                    transform: "translate(-50%, -50%)",
                    background: `rgba(214,172,96,${0.55 + holdProgress * 0.25})`,
                    filter: `blur(${14 + holdProgress * 14}px)`,
                    boxShadow: `0 0 ${50 + holdProgress * 90}px rgba(214,172,96,0.85)`,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="mx-auto flex aspect-[848/1489] w-full max-w-[360px] items-center justify-center rounded-[28px] border border-border/40 font-serif-sc text-sm text-foreground/45">
              签面缺失
            </div>
          )}
        </div>

        {revealed && (
          <div className="mt-8 flex w-full max-w-[340px] flex-col items-center gap-2 slow-fade-in">
            {interpretStatus === "error" ? (
              <>
                {error && <p className="font-serif-sc text-[11px] tracking-[0.25em] text-destructive/70">{error}</p>}
                <button
                  onClick={retryInterpret}
                  className="font-serif-sc text-[12px] tracking-[0.35em] text-foreground/45 transition-colors hover:text-foreground/70"
                >
                  重 新 解 签
                </button>
                <button
                  onClick={onRestart}
                  className="mt-1 font-serif-sc text-[11px] tracking-[0.3em] text-foreground/30 transition-colors hover:text-foreground/55"
                >
                  重 启 仪 式
                </button>
              </>
            ) : (
              <div
                className="flex flex-col items-center font-serif-sc text-[12px] leading-[1.9] tracking-[0.5em] text-foreground/40"
                style={{
                  opacity: awaitingInterpret ? 0.7 : 1,
                  transition: "opacity 600ms ease",
                }}
              >
                <span>长 按 签 文</span>
                <span>静 观 其 意</span>
              </div>
            )}
          </div>
        )}
      </main>
    </Shell>
  );
}
