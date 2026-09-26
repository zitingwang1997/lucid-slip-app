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
  const [interpretStatus, setInterpretStatus] = useState<InterpretStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [awaitingInterpret, setAwaitingInterpret] = useState(false);
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
    if (interpretStatus === "error") return;
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

  if (interpretStatus === "error") {
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
              onReady={() => setRevealed(true)}
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
                签 面 显 现 中
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
          </div>
        </div>

        {revealed && (
          <div className="mt-8 flex w-full max-w-[340px] flex-col items-center gap-2 slow-fade-in">
            <div
              className="flex flex-col items-center font-serif-sc text-[12px] leading-[1.9] tracking-[0.5em] text-foreground/40"
              style={{
                opacity: awaitingInterpret ? 0.7 : 1,
                transition: "opacity 600ms ease",
              }}
            >
              <span>{awaitingInterpret ? "签 意 解析 中" : "长 按 签 文"}</span>
              <span>{awaitingInterpret ? "静 候 片 刻" : "静 观 其 意"}</span>
            </div>
          </div>
        )}
      </main>
    </Shell>
  );
}
