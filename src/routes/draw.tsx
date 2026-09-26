import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  getTodayHistory,
  getUserQuestion,
  pushHistory,
  setCurrentHistoryId,
  setSelectedSlip,
  type SelectedSlip,
} from "@/lib/fortune-store";
import { drawSlip } from "@/lib/dify.functions";
import { getAnonymousUserId } from "@/lib/anonymous-user";
import { checkSameDayQuestion, type SimilarityResult } from "@/lib/similarity.functions";
import { preloadSlipImage, preloadSlipImages } from "@/lib/slip-image";
import { randomId } from "@/lib/utils";

export const Route = createFileRoute("/draw")({
  head: () => ({ meta: [{ title: "求签 · 一签" }] }),
  component: DrawPage,
});

const HOLD_MS = 3200;
const SAME_DAY_CHECK_TIMEOUT_MS = 3000;

type DrawRequestResult = { ok: true; value: unknown } | { ok: false; error: unknown };

function isTransportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /load failed|failed to fetch|network|connection/i.test(message);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("same-day check timed out")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function fallbackSameDayResult(question: string, reason: string): SimilarityResult {
  return {
    matchedId: null,
    intent: question,
    category: "other",
    confidence: 0,
    reason,
  };
}

function DrawPage() {
  const navigate = useNavigate();
  const drawSlipFn = useServerFn(drawSlip);
  const checkSameDay = useServerFn(checkSameDayQuestion);
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [sameDayPending, setSameDayPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completed = useRef(false);
  const raf = useRef<number | null>(null);
  const startTs = useRef<number>(0);
  const baseProgress = useRef(0);
  const holdingRef = useRef(false);
  const redirected = useRef(false);
  const drawRequest = useRef<Promise<DrawRequestResult> | null>(null);
  const sameDayRequest = useRef<Promise<SimilarityResult> | null>(null);
  const sameDayResult = useRef<SimilarityResult | null>(null);

  const prepareDraw = () => {
    if (drawRequest.current) return drawRequest.current;

    const question = getUserQuestion().trim();
    if (!question) return null;

    const run = () =>
      drawSlipFn({
        data: {
          user_question: question,
          anonymous_user_id: getAnonymousUserId(),
        },
      });
    drawRequest.current = run()
      .catch(async (requestError) => {
        if (!isTransportError(requestError)) throw requestError;
        console.warn("[draw] transport failed; retrying once");
        await new Promise<void>((resolve) => window.setTimeout(resolve, 600));
        return run();
      })
      .then((value) => {
        const maybeSlip = ((value as { slip?: unknown } | null)?.slip ?? value) as SelectedSlip;
        if (maybeSlip && typeof maybeSlip === "object" && !Array.isArray(maybeSlip)) {
          preloadSlipImage(maybeSlip);
        }
        return { ok: true as const, value };
      })
      .catch((requestError) => ({ ok: false as const, error: requestError }));
    return drawRequest.current;
  };

  const redirectToTodayGuidance = (result: SimilarityResult) => {
    if (!result.matchedId || redirected.current) return false;
    redirected.current = true;
    navigate({
      to: "/today-guidance",
      search: { id: result.matchedId, q: getUserQuestion().trim() },
    });
    return true;
  };

  const prepareSameDayCheck = () => {
    if (sameDayRequest.current) return sameDayRequest.current;

    const question = getUserQuestion().trim();
    const fallback = fallbackSameDayResult(question, "fallback");
    const today = getTodayHistory();
    if (!question || today.length === 0) {
      sameDayResult.current = fallback;
      sameDayRequest.current = Promise.resolve(fallback);
      return sameDayRequest.current;
    }

    setSameDayPending(true);
    sameDayRequest.current = withTimeout(
      checkSameDay({
        data: {
          newQuestion: question,
          today: today.map((entry) => ({
            id: entry.id,
            question: entry.question,
            intent: entry.intent,
            category: entry.category,
          })),
        },
      }),
      SAME_DAY_CHECK_TIMEOUT_MS,
    )
      .catch((checkError) => {
        console.warn("[draw] same-day check skipped:", checkError);
        return fallbackSameDayResult(question, "timeout-or-error");
      })
      .then((result) => {
        sameDayResult.current = result;
        setSameDayPending(false);
        if (result.matchedId && !holdingRef.current && !completed.current) {
          redirectToTodayGuidance(result);
        }
        return result;
      });

    return sameDayRequest.current;
  };

  const endHold = () => {
    holdingRef.current = false;
    setHolding(false);
    const result = sameDayResult.current;
    if (!completed.current && result?.matchedId) {
      redirectToTodayGuidance(result);
    }
  };

  const complete = async () => {
    if (completed.current) return;
    completed.current = true;
    setResolving(true);
    try {
      const question = getUserQuestion();
      if (!question || !question.trim()) {
        navigate({ to: "/" });
        return;
      }
      const checkResult = await prepareSameDayCheck();
      if (redirectToTodayGuidance(checkResult)) return;

      const pendingDraw = prepareDraw();
      if (!pendingDraw) {
        navigate({ to: "/" });
        return;
      }
      const drawResult = await pendingDraw;
      if (!drawResult.ok) throw drawResult.error;
      const res = drawResult.value;
      const maybeSlip = ((res as any)?.slip ?? res) as SelectedSlip | undefined;
      const isValid =
        maybeSlip &&
        typeof maybeSlip === "object" &&
        !Array.isArray(maybeSlip) &&
        Object.keys(maybeSlip).length > 0 &&
        (maybeSlip.image_url || maybeSlip.poem || maybeSlip.title || maybeSlip.number);
      if (!isValid) {
        console.error("[draw] invalid slip response:", res);
        throw new Error("求签返回数据不完整，请稍后再试");
      }
      const slip = maybeSlip as SelectedSlip;
      preloadSlipImage(slip);
      setSelectedSlip(slip);
      const historyId = randomId();
      pushHistory({
        id: historyId,
        question: question.trim(),
        intent: checkResult.intent,
        category: checkResult.category,
        slip,
        createdAt: Date.now(),
        savedKits: {},
      });
      setCurrentHistoryId(historyId);
      navigate({ to: "/poem" });
    } catch (e: any) {
      console.error("[draw] request failed:", e);
      drawRequest.current = null;
      completed.current = false;
      setResolving(false);
      setHolding(false);
      setProgress(0);
      baseProgress.current = 0;
      startTs.current = 0;
      setError("求签暂时未完成，请再次长按");
    }
  };

  useEffect(() => {
    // Start both server requests immediately. Delay low-priority image warming
    // briefly so it does not compete with the two control-plane requests.
    void prepareSameDayCheck();
    void prepareDraw();
    const imageWarmup = window.setTimeout(preloadSlipImages, 250);
    return () => window.clearTimeout(imageWarmup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = (ts: number) => {
      if (!startTs.current) startTs.current = ts;
      const elapsed = ts - startTs.current;
      const p = Math.min(1, baseProgress.current + elapsed / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        holdingRef.current = false;
        setHolding(false);
        void complete();
        return;
      }
      if (holding) raf.current = requestAnimationFrame(tick);
    };
    if (holding) {
      holdingRef.current = true;
      startTs.current = 0;
      raf.current = requestAnimationFrame(tick);
      try {
        navigator.vibrate?.(8);
      } catch {}
    } else {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (completed.current) {
        baseProgress.current = 1;
        setProgress(1);
        return;
      }
      baseProgress.current = progress;
      const decay = window.setInterval(() => {
        setProgress((prev) => {
          const next = Math.max(0, prev - 0.01);
          baseProgress.current = next;
          if (next === 0) window.clearInterval(decay);
          return next;
        });
      }, 80);
      return () => window.clearInterval(decay);
    }
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding]);

  const pct = Math.round(progress * 100);
  const guidance = error
    ? error
    : resolving
      ? sameDayPending
        ? "正在确认今日心问…"
        : "正在取签…"
      : progress < 0.05
        ? "按住光线，静心片刻"
        : progress < 0.5
          ? "让呼吸慢下来"
          : progress < 0.95
            ? "签意正在显现"
            : "天意将至";

  return (
    <Shell intensity={0.9} showTemple={false}>
      <main className="relative flex flex-1 flex-col items-center justify-center px-7 pb-16">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-700"
          style={{
            width: `${220 + progress * 240}px`,
            height: `${220 + progress * 240}px`,
            background: `radial-gradient(circle, oklch(0.74 0.13 55 / ${0.08 + progress * 0.25}) 0%, transparent 65%)`,
            filter: "blur(20px)",
          }}
        />
        {(holding || resolving) &&
          Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-primary"
              style={{
                boxShadow: "0 0 8px var(--primary)",
                animation: `orbit-${i} ${6 + i * 0.4}s linear infinite`,
                transform: `rotate(${i * 45}deg) translateX(${80 + progress * 60}px)`,
                opacity: 0.4 + progress * 0.5,
              }}
            />
          ))}

        <button
          onPointerDown={() => {
            if (completed.current || resolving) return;
            setError(null);
            void prepareDraw();
            holdingRef.current = true;
            setHolding(true);
          }}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          aria-label="按住求签"
          aria-busy={resolving}
          disabled={resolving}
          className="relative grid h-[60vh] max-h-[520px] w-full place-items-center touch-none select-none"
        >
          <div
            className="relative"
            style={{
              width: "2px",
              height: `${180 + progress * 140}px`,
              background: `linear-gradient(to bottom,
                transparent,
                oklch(0.74 0.13 55 / ${0.4 + progress * 0.6}) 20%,
                oklch(0.86 0.14 60 / ${0.7 + progress * 0.3}) 50%,
                oklch(0.74 0.13 55 / ${0.4 + progress * 0.6}) 80%,
                transparent)`,
              boxShadow: `0 0 ${20 + progress * 40}px oklch(0.74 0.13 55 / ${0.5 + progress * 0.4}),
                          0 0 ${60 + progress * 100}px oklch(0.68 0.16 45 / ${0.2 + progress * 0.4})`,
              transition: holding ? "height 200ms ease-out" : "height 800ms ease-out",
              borderRadius: "2px",
            }}
          />
        </button>

        <div className="mt-2 text-center">
          <p className="font-serif-sc text-sm tracking-[0.4em] text-foreground/65">{guidance}</p>
          <div className="mx-auto mt-5 h-px w-32 overflow-hidden bg-border/40">
            <div
              className="h-full bg-gradient-to-r from-transparent via-primary to-transparent transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-3 text-[10px] tracking-[0.4em] uppercase text-foreground/30">
            {resolving ? "Please wait" : "Press & Hold"}
          </p>
        </div>
      </main>
    </Shell>
  );
}
