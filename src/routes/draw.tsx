import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  getUserQuestion,
  pushHistory,
  setSelectedSlip,
  type SelectedSlip,
} from "@/lib/fortune-store";
import { drawSlip } from "@/lib/dify.functions";

export const Route = createFileRoute("/draw")({
  head: () => ({ meta: [{ title: "求签 · 一签" }] }),
  component: DrawPage,
});

const HOLD_MS = 3200;

function DrawPage() {
  const navigate = useNavigate();
  const drawSlipFn = useServerFn(drawSlip);
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completed = useRef(false);
  const raf = useRef<number | null>(null);
  const startTs = useRef<number>(0);
  const baseProgress = useRef(0);

  const complete = async () => {
    if (completed.current) return;
    completed.current = true;
    try {
      const question = getUserQuestion();
      if (!question || !question.trim()) {
        navigate({ to: "/" });
        return;
      }
      const res = await drawSlipFn({ data: { user_question: question.trim() } });
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
      setSelectedSlip(slip);
      pushHistory({
        id: crypto.randomUUID(),
        question: question.trim(),
        slip,
        createdAt: Date.now(),
      });
      navigate({ to: "/poem" });
    } catch (e: any) {
      completed.current = false;
      setError(e?.message ?? "求签失败，请稍后再试");
    }
  };


  useEffect(() => {
    const tick = (ts: number) => {
      if (!startTs.current) startTs.current = ts;
      const elapsed = ts - startTs.current;
      const p = Math.min(1, baseProgress.current + elapsed / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        window.setTimeout(() => void complete(), 400);
        return;
      }
      if (holding) raf.current = requestAnimationFrame(tick);
    };
    if (holding) {
      startTs.current = 0;
      raf.current = requestAnimationFrame(tick);
      try {
        navigator.vibrate?.(8);
      } catch {}
    } else {
      if (raf.current) cancelAnimationFrame(raf.current);
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
    : completed.current
    ? "签意已现"
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
        {holding &&
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
          onPointerDown={() => setHolding(true)}
          onPointerUp={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
          onPointerCancel={() => setHolding(false)}
          aria-label="按住求签"
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
            Press & Hold
          </p>
        </div>
      </main>
    </Shell>
  );
}
