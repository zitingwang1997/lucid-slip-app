import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import { RitualErrorScreen } from "@/components/RitualErrorScreen";
import { SlipImage } from "@/components/SlipImage";

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
import { getAnonymousUserId } from "@/lib/anonymous-user";
import { trackClarityEvent } from "@/lib/clarity";

export const Route = createFileRoute("/poem")({
  head: () => ({ meta: [{ title: "签诗 · 一签" }] }),
  component: PoemPage,
});

function buildQianData(slip: SelectedSlip) {
  return {
    id: slip.id,
    number: slip.number,
    realm: slip.realm,
    sign_level: (slip as any).sign_level,
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
  const [imageRetrying, setImageRetrying] = useState(false);
  const [interpretStatus, setInterpretStatus] = useState<InterpretStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [awaitingInterpret, setAwaitingInterpret] = useState(false);
  const [holdHintVisible, setHoldHintVisible] = useState(false);
  const inflight = useRef(false);
  const holdRaf = useRef<number | null>(null);
  const holdStart = useRef<number>(0);
  const holdProgress = useRef(0);
  const holdCompleted = useRef(false);
  const holdVisual = useRef<HTMLDivElement | null>(null);
  const holdWash = useRef<HTMLDivElement | null>(null);
  const holdSweep = useRef<HTMLDivElement | null>(null);
  const holdCore = useRef<HTMLDivElement | null>(null);
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
          anonymous_user_id: getAnonymousUserId(),
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
        trackClarityEvent("interpret_failed");
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
    setRevealed(false);
    setImageRetrying(false);

    const cached = getInterpretCacheV2();
    console.log("[POEM] interpret cache:", cached);

    if (
      cached &&
      cached.slipId === slipCacheId(s) &&
      cached.user_question === q &&
      (cached.interpret?.xiang_content ||
        cached.interpret?.yi_content ||
        cached.interpret?.xing_content)
    ) {
      console.log("[POEM] cache hit, skip Workflow B");
      setInterpretation(cached.interpret);
      setInterpretStatus("success");
    } else {
      console.log("[POEM] cache miss, start Workflow B");
      void runInterpret(s, q);
    }

    return () => {
      if (holdRaf.current != null) cancelAnimationFrame(holdRaf.current);
    };
  }, [navigate, runInterpret]);

  // Auto-navigate when interpretation finishes AFTER user already completed the hold.
  useEffect(() => {
    if (awaitingInterpret && interpretStatus === "success") {
      navigate({ to: "/interpret" });
    }
  }, [awaitingInterpret, interpretStatus, navigate]);

  // Hold-hint should only draw the eye once the poem lines have nearly finished
  // revealing (right column finishes ~2.6s in, left column ~4.2s in) — never at
  // the moment the slip image first appears.
  useEffect(() => {
    if (!revealed) return;
    setHoldHintVisible(false);
    const timer = setTimeout(() => setHoldHintVisible(true), 3800);
    return () => clearTimeout(timer);
  }, [revealed]);

  const stopHoldRaf = () => {
    if (holdRaf.current != null) {
      cancelAnimationFrame(holdRaf.current);
      holdRaf.current = null;
    }
  };

  const setHoldVisualProgress = (progress: number) => {
    const normalized = Math.max(0, Math.min(1, progress));
    holdProgress.current = normalized;

    if (!holdVisual.current) return;
    holdVisual.current.style.opacity = normalized > 0 ? "1" : "0";
    if (holdWash.current) holdWash.current.style.opacity = String(normalized);
    if (holdSweep.current) {
      const sweepX = -100 + normalized * 200;
      holdSweep.current.style.transform = `translate3d(${sweepX}%, 0, 0) rotate(8deg)`;
    }
    if (holdCore.current) {
      holdCore.current.style.opacity = String(normalized);
      holdCore.current.style.transform = `translate3d(-50%, -50%, 0) scale(${0.65 + normalized * 0.85})`;
    }
  };

  const beginHold = () => {
    if (!revealed) return;
    if (holdCompleted.current) return;
    holdStart.current = 0;
    stopHoldRaf();
    const tick = (ts: number) => {
      if (!holdStart.current) holdStart.current = ts;
      const p = Math.min(1, (ts - holdStart.current) / HOLD_MS);
      setHoldVisualProgress(p);
      if (p >= 1) {
        holdCompleted.current = true;
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
    stopHoldRaf();
    // gentle decay back to 0
    const start = performance.now();
    const from = holdProgress.current;
    const decayMs = Math.max(300, from * 700);
    const decayTick = (ts: number) => {
      const t = Math.min(1, (ts - start) / decayMs);
      const v = from * (1 - t);
      setHoldVisualProgress(v);
      if (t < 1) holdRaf.current = requestAnimationFrame(decayTick);
    };
    holdRaf.current = requestAnimationFrame(decayTick);
  };

  /**
   * 报错后回到签面。用户已经抽到签了，不该把他丢回首页重来。
   * 状态清回 idle 让签诗重新露出来，同时后台重新发起解签请求 ——
   * 否则用户再按住 PRESS & HOLD 时没有请求在跑，会一直等不到结果。
   */
  const backToPoem = () => {
    setError(null);
    setAwaitingInterpret(false);
    setHoldVisualProgress(0);
    holdCompleted.current = false;
    setInterpretStatus("idle");
    const q = getUserQuestion();
    if (slip && q) void runInterpret(slip, q);
  };

  if (!slip) return null;

  // Workflow B starts in the background while the slip is being revealed.
  // Do not interrupt the slip or disable its hold interaction when that preload
  // fails; surface the error only after the user has completed the ritual.
  if (interpretStatus === "error" && awaitingInterpret) {
    return (
      <Shell intensity={0.5}>
        <RitualErrorScreen
          detail="解签暂时未完成，请稍后重试"
          restartLabel="重 新 解 签"
          onRestart={backToPoem}
          onSecondary={() => navigate({ to: "/" })}
        />
      </Shell>
    );
  }

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

  const poemFontSize =
    longestColumnLength > 26
      ? "2.0cqi"
      : longestColumnLength > 22
        ? "2.2cqi"
        : longestColumnLength > 18
          ? "2.4cqi"
          : longestColumnLength > 14
            ? "2.6cqi"
            : "2.6cqi";

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
          className="w-full"
          style={{
            maxWidth: 520,
            margin: "0 auto",
          }}
        >
          <div
            className={`relative mx-auto w-[88%] touch-none select-none ${revealed ? "cursor-pointer" : "cursor-default"}`}
            aria-disabled={!revealed}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              if (!revealed) return;
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
              overflow: "hidden",
              borderRadius: 4,
              background: "linear-gradient(150deg, rgb(235 229 217) 0%, rgb(224 215 199) 100%)",
              filter:
                "drop-shadow(0 30px 60px oklch(0 0 0 / 0.6)) drop-shadow(0 0 50px oklch(0.74 0.13 55 / 0.2))",
            }}
          >
            <SlipImage
              slip={slip}
              alt={slip.title ? `${slip.title}签面` : "签面"}
              fetchPriority="high"
              readyDelayMs={380}
              watchdogMs={3000}
              onReady={() => {
                setImageRetrying(false);
                setRevealed(true);
                trackClarityEvent("slip_image_ready");
              }}
              onRetry={() => {
                setImageRetrying(true);
                trackClarityEvent("slip_image_retry");
              }}
              onFailure={() => trackClarityEvent("slip_image_failed")}
              imgClassName="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
              imgStyle={{
                WebkitTouchCallout: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
                transition: "opacity 360ms ease",
              }}
              errorClassName="absolute bottom-[4%] left-1/2 z-20 -translate-x-1/2 rounded-full border border-[rgba(55,38,24,0.2)] bg-[rgba(245,239,227,0.85)] px-4 py-2 font-serif-sc text-[10px] tracking-[0.18em] text-[rgba(55,38,24,0.62)]"
            />

            {!revealed && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-serif-sc text-xs tracking-[0.35em] text-[rgba(55,38,24,0.38)]">
                {imageRetrying ? "网络稍缓 · 正在重试" : "签 面 显 现 中"}
              </div>
            )}

            {/* Top-left: Chinese number */}
            {revealed && (
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
            )}

            {/* Top-right: poem title */}
            {revealed && (
              <div
                className="pointer-events-none absolute flex flex-col items-center font-serif-sc text-[rgba(55,38,24,0.82)]"
                style={{ right: "8%", top: "3.8%", lineHeight: 1.15, letterSpacing: "0.08em" }}
              >
                <span style={{ fontSize: "3.8cqi", fontWeight: 500 }}>{slip.title}</span>
              </div>
            )}

            {/* Right vertical column: lines 1-2 (rightmost line first) */}
            <div
              className="pointer-events-none absolute flex flex-row-reverse"
              style={{ right: "7%", top: "20%", height: "78%", gap: "clamp(4px, 1.6cqi, 14px)" }}
            >
              {revealed && (
                <span
                  className="poem-line-reveal font-serif-sc text-[rgba(55,38,24,0.86)]"
                  style={{
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    letterSpacing: "0.12em",
                    fontSize: poemFontSize,
                    lineHeight: 1.25,
                    fontWeight: 600,
                    animationDelay: "600ms",
                  }}
                >
                  {rightColumn}
                </span>
              )}
            </div>

            {/* Left vertical column: lines 3-4 (rightmost line first) */}
            <div
              className="pointer-events-none absolute flex flex-row-reverse"
              style={{ left: "7%", top: "20%", height: "78%", gap: "clamp(4px, 1.6cqi, 14px)" }}
            >
              {revealed && (
                <span
                  className="poem-line-reveal font-serif-sc text-[rgba(55,38,24,0.86)]"
                  style={{
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    letterSpacing: "0.12em",
                    fontSize: poemFontSize,
                    lineHeight: 1.25,
                    fontWeight: 600,
                    animationDelay: "2.2s",
                  }}
                >
                  {leftColumn}
                </span>
              )}
            </div>

            {/* Golden hold feedback */}
            <div
              ref={holdVisual}
              className={`poem-hold-glow pointer-events-none absolute inset-0 overflow-hidden ${awaitingInterpret ? "poem-hold-glow--waiting" : ""}`}
            >
              <div ref={holdWash} className="poem-hold-glow__wash absolute inset-0" />
              <div
                ref={holdSweep}
                className="poem-hold-glow__sweep absolute inset-y-[-15%] left-0 w-full"
              />
              <div
                ref={holdCore}
                className="poem-hold-glow__core absolute left-1/2 top-1/2 h-24 w-24 rounded-full"
              />
            </div>

            {/* Hold hint — anchored inside the card, lower-middle, over the touch
                target itself. Only appears once the poem lines have nearly finished
                revealing (see holdHintVisible timer above), and only the glow behind
                the text breathes — the text itself never moves. Styles are scoped
                to this file (see <style> below) so they can't collide with anyone
                else's edits to shared stylesheets. */}
            {revealed && holdHintVisible && (
              <div className="hold-hint pointer-events-none absolute inset-x-0 bottom-[8%] flex justify-center holdHintAppear">
                {!awaitingInterpret && (
                  <>
                    <span className="hold-hint__outer absolute left-1/2 top-1/2" />
                    <span className="hold-hint__mid absolute left-1/2 top-1/2" />
                    <span className="hold-hint__core absolute left-1/2 top-1/2" />
                  </>
                )}
                <div
                  className="hold-hint__text relative flex flex-col items-center gap-0.5 font-serif-sc font-medium text-[14px] leading-[1.5] tracking-[0.15em] text-[rgba(55,38,24,0.72)]"
                  style={{
                    opacity: awaitingInterpret ? 0.7 : 1,
                    transition: "opacity 600ms ease",
                  }}
                >
                  <span>{awaitingInterpret ? "签 意 解析 中" : "长按签面"}</span>
                  <span>{awaitingInterpret ? "静 候 片 刻" : "查看解析"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/*
        Scoped styles for the hold-hint breathing glow (poem page only).
        Three layered radial blobs standing in for the homepage's
        InputAmoebaAura canvas aura (same warm gold palette as
        src/lib/particles.ts AURA_GOLD, same "breathe" cadence) — reimplemented
        here as lightweight CSS instead of importing the full-viewport canvas
        component, since that one is hard-wired to window size / screen center.
        Kept entirely inside this file so it can't collide with anyone else's
        edits to shared stylesheets or the InputAmoebaAura component itself.
      */}
      <style>{`
      .holdHintAppear {
  animation: holdHintAppear 500ms ease-out both;
}

@keyframes holdHintAppear {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
        .hold-hint__outer,
        .hold-hint__mid,
        .hold-hint__core {
          border-radius: 50%;
          pointer-events: none;
        }

        /* Outermost ring — the one allowed to swell up to ~80% of the card's
           own width (cqi is relative to the card's inline size). */
        .hold-hint__outer {
          width: 80cqi;
          height: 80cqi;
          max-width: 450px;
          max-height: 450px;
          background: radial-gradient(
            circle,
            rgba(185, 140, 65, 0.22) 0%,
            rgba(168, 128, 60, 0.16) 55%,
            rgba(140, 100, 45, 0.21) 82%,
            rgba(125, 90, 38, 0.15) 100%
          );
          filter: blur(18px);
          animation:
            holdHintOuterBreathe 3.4s cubic-bezier(0.33, 0, 0.2, 1) 0s infinite backwards,
            holdHintOuterWobble 5.6s ease-in-out 1.4s infinite backwards;
        }

        .hold-hint__mid {
          width: 50cqi;
          height: 50cqi;
          max-width: 320px;
          max-height: 320px;
          background: radial-gradient(
            circle,
            rgba(196, 148, 70, 0.3) 0%,
            rgba(178, 133, 60, 0.26) 60%,
            rgba(150, 107, 48, 0.17) 85%,
            rgba(125, 90, 38, 0) 100%
          );
          filter: blur(12px);
          animation: holdHintMidBreathe 2.9s cubic-bezier(0.33, 0, 0.2, 1) 0s infinite backwards;
        }

        .hold-hint__core {
          width: 28cqi;
          height: 28cqi;
          max-width: 200px;
          max-height: 200px;
          background: radial-gradient(
            circle,
            rgba(210, 164, 85, 0.45) 0%,
            rgba(196, 152, 75, 0.33) 55%,
            rgba(165, 119, 55, 0.19) 82%,
            rgba(125, 90, 38, 0.11) 100%
          );
          filter: blur(6px);
          animation: holdHintCoreBreathe 3.7s cubic-bezier(0.33, 0, 0.2, 1) 0s infinite backwards;
        }

        /* Asymmetric rise / brief hold / slower fall — like an actual breath,
           not a metronome. Shape (border-radius) is animated separately below
           on its own, unrelated period, so the wobble and the pulse drift
           in and out of phase with each other instead of always landing on
           the same beat. */
        @keyframes holdHintOuterBreathe {
          0% {
            opacity: 0;
            transform: translate3d(-50%, -50%, 0) scale(0.5);
          }
          40% {
            opacity: 0.26;
            transform: translate3d(-50%, -50%, 0) scale(0.94);
          }
          54% {
            opacity: 0.28;
            transform: translate3d(-50%, -50%, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate3d(-50%, -50%, 0) scale(0.5);
          }
        }

        @keyframes holdHintOuterWobble {
          0%,
          100% {
            border-radius: 46% 54% 61% 39% / 49% 42% 58% 51%;
          }
          50% {
            border-radius: 58% 42% 39% 61% / 41% 57% 43% 59%;
          }
        }

        @keyframes holdHintMidBreathe {
          0% {
            opacity: 0.05;
            transform: translate3d(-50%, -50%, 0) scale(0.6);
          }
          42% {
            opacity: 0.42;
            transform: translate3d(-50%, -50%, 0) scale(0.96);
          }
          58% {
            opacity: 0.45;
            transform: translate3d(-50%, -50%, 0) scale(1);
          }
          100% {
            opacity: 0.05;
            transform: translate3d(-50%, -50%, 0) scale(0.6);
          }
        }

        @keyframes holdHintCoreBreathe {
          0% {
            opacity: 0.15;
            transform: translate3d(-50%, -50%, 0) scale(0.78);
          }
          38% {
            opacity: 0.7;
            transform: translate3d(-50%, -50%, 0) scale(1.02);
          }
          52% {
            opacity: 0.75;
            transform: translate3d(-50%, -50%, 0) scale(1.05);
          }
          100% {
            opacity: 0.15;
            transform: translate3d(-50%, -50%, 0) scale(0.78);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hold-hint__outer,
          .hold-hint__mid,
          .hold-hint__core {
            animation: none;
            opacity: 0.25;
            transform: translate3d(-50%, -50%, 0) scale(1);
            border-radius: 50%;
          }
        }
      `}</style>
    </Shell>
  );
}
