import { useEffect, useMemo, useState } from "react";
import { IncenseSmoke } from "./IncenseSmoke";
import { prefersReducedMotion } from "@/lib/particles";

/* ── 香的燃烧 ────────────────────────────────────────────────
 * 香从上往下烧：香头（余烬）下移，香身变短，烟的发射点跟着走。
 * 烧到剩约 30% 就停住（「香未尽」），避免烧光的尴尬，也避免
 * 重置循环露出机械感。曲线是减速的，越烧越慢，停下时不突兀。
 * ──────────────────────────────────────────────────────────── */

/** 香头初始位置（容器坐标 y） */
const EMBER_TOP = 168;
/** 香身初始长度 */
const STICK_H = 76;
/** 最多烧掉多少像素。76 - 54 = 剩 22px */
const BURN_MAX = 54;
/** 烧完这些像素需要多少秒。调小 = 烧得快 */
const BURN_DURATION_S = 140;
/** 烟的画布比香容器往上多出多少，留给烟消散的空间。
 *  必须和 IncenseSmoke 的 CANVAS_H 配套：香头要落在画布底部附近，
 *  上方留出 RISE_HEIGHT 以上的空间，烟才不会被画布边缘切断。
 *  当前 CANVAS_H = 520，香头在画布 y ≈ 448，上方余量 448 > RISE_HEIGHT 360 ✓ */
const SMOKE_TOP_OFFSET = 280;

interface RitualErrorScreenProps {
  title?: string;
  subtitle?: string;
  detail?: string | null;
  /** 主行动入口，渲染成首页同款胶囊按钮。不传就不渲染 */
  onRestart?: () => void;
  restartLabel?: string;
  /** 次要入口，渲染成按钮下方一行很淡的文字。不传就不渲染 */
  onSecondary?: () => void;
  secondaryLabel?: string;
}

/**
 * Ritual error state: a single incense stick burning in its holder,
 * smoke drifting upward through floating golden motes.
 */
export function RitualErrorScreen({
  title = "今日闭关",
  subtitle = "晚些时候再来",
  detail,
  onRestart,
  restartLabel = "重启仪式",
  onSecondary,
  secondaryLabel = "重 启 仪 式",
}: RitualErrorScreenProps) {
  const motes = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const angle = (i / 40) * Math.PI * 2 + Math.random() * 0.4;
        const distance = 160 + Math.random() * 460;
        // brighter/bigger when they stay close to the smoke column at center
        const nearness = 1 - Math.min(distance, 620) / 620;
        return {
          id: i,
          tx: Math.cos(angle) * distance,
          ty: Math.sin(angle) * distance * 0.9,
          delay: Math.random() * 9,
          duration: 10 + Math.random() * 9,
          size: 1 + nearness * 2.6 + Math.random(),
          opacity: 0.2 + nearness * 0.65,
        };
      }),
    [],
  );

  // 已烧掉的长度（像素）
  const [burn, setBurn] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const start = performance.now();
    // 每 500ms 算一次就够了 —— 这个变化极慢，没必要每帧更新
    const id = window.setInterval(() => {
      const x = Math.min((performance.now() - start) / 1000 / BURN_DURATION_S, 1);
      const eased = 1 - Math.pow(1 - x, 2); // 减速：越烧越慢
      setBurn(BURN_MAX * eased);
      if (x >= 1) window.clearInterval(id);
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-16">
      {/* golden motes radiating outward from the center */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {motes.map((m) => (
          <span
            key={m.id}
            className="absolute rounded-full"
            style={
              {
                left: "50%",
                top: "50%",
                width: `${m.size}px`,
                height: `${m.size}px`,
                background: `oklch(0.8 0.13 60 / ${m.opacity})`,
                boxShadow: `0 0 ${m.size * 5}px oklch(0.76 0.13 55 / ${m.opacity * 0.7})`,
                "--mote-tx": `${m.tx}px`,
                "--mote-ty": `${m.ty}px`,
                "--mote-opacity": m.opacity,
                animation: `radiate-particle ${m.duration}s ease-out ${m.delay}s infinite`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>


      <div className="slow-fade-in relative flex flex-col items-center">
        {/* incense */}
        <div className="relative h-[280px] w-[160px]">
          {/* smoke haze glow —— 跟着香头下移 */}
          <div
            className="pointer-events-none absolute left-1/2 h-[200px] w-[150px] -translate-x-1/2 smoke-haze"
            style={{
              top: burn,
              background:
                "radial-gradient(ellipse at 50% 85%, oklch(0.8 0.1 60 / 0.16), transparent 65%)",
              filter: "blur(12px)",
            }}
          />

          {/* smoke —— 流场粒子，与首页开场共用同一套引擎 */}
          <IncenseSmoke
            emberY={EMBER_TOP + burn + SMOKE_TOP_OFFSET}
            className="pointer-events-none absolute left-1/2 -translate-x-1/2"
            style={{ top: -SMOKE_TOP_OFFSET }}
          />

          {/* ember tip */}
          <span
            className="absolute left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full incense-ember"
            style={{ top: EMBER_TOP + burn }}
          />

          {/* stick —— 从上往下烧，顶端下移、长度变短 */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: EMBER_TOP + 4 + burn,
              width: 2,
              height: STICK_H - burn,
              background: "linear-gradient(to bottom, oklch(0.62 0.06 55 / 0.9), oklch(0.42 0.04 50 / 0.75))",
            }}
          />

          {/* holder */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <div
              className="h-[10px] w-[64px] rounded-t-[6px]"
              style={{
                background: "linear-gradient(to bottom, oklch(0.44 0.03 55 / 0.9), oklch(0.3 0.02 50 / 0.9))",
              }}
            />
            <div
              className="mx-auto h-[5px] w-[86px] rounded-full"
              style={{ background: "oklch(0.26 0.02 50 / 0.95)" }}
            />
            <div
              className="mx-auto mt-[2px] h-[10px] w-[110px] rounded-full"
              style={{
                background: "radial-gradient(ellipse at center, oklch(0.7 0.12 55 / 0.14), transparent 70%)",
                filter: "blur(4px)",
              }}
            />
          </div>
        </div>

        {/* words */}
        <div className="mt-2 flex flex-col items-center gap-3 text-center">
          <p className="font-serif-sc text-[20px] tracking-[0.55em] text-foreground/70">{title}</p>
          <p className="font-serif-sc text-[13px] leading-[2] tracking-[0.42em] text-foreground/40">{subtitle}</p>
          {detail && (
            <p className="mt-2 max-w-[260px] font-serif-sc text-[10px] leading-[2] tracking-[0.2em] text-foreground/25">
              {detail}
            </p>
          )}
        </div>

        {(onRestart || onSecondary) && (
          <div className="mt-10 flex flex-col items-center">
            {/* 主入口：与首页「求一支签」同款按钮，保持全站行动入口的一致性 */}
            {onRestart && (
              <button
                onClick={onRestart}
                className="rounded-full border border-foreground/12 bg-transparent px-12 py-2.5 font-serif-sc text-[13px] text-ivory/90 transition-all duration-500 hover:border-foreground/28 hover:text-ivory"
                style={{
                  letterSpacing: "0.48em",
                  paddingRight: "calc(3rem - 0.48em)",
                  boxShadow: "0 0 24px oklch(0.75 0.04 80 / 0.04)",
                }}
              >
                {restartLabel}
              </button>
            )}
            {/* 次要入口：刻意做得很淡，不跟主按钮抢注意力 */}
            {onSecondary && (
              <button
                onClick={onSecondary}
                className="mt-6 font-serif-sc text-[11px] tracking-[0.3em] text-foreground/25 transition-colors hover:text-foreground/50"
              >
                {secondaryLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
