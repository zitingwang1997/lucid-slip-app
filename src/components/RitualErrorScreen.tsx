import { useMemo } from "react";

interface RitualErrorScreenProps {
  title?: string;
  subtitle?: string;
  detail?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  onRestart?: () => void;
  restartLabel?: string;
}

/**
 * Ritual error state: a single incense stick burning in its holder,
 * smoke drifting upward through floating golden motes.
 */
export function RitualErrorScreen({
  title = "今日闭关",
  subtitle = "晚些时候再来",
  detail,
  onRetry,
  retryLabel = "再 试 一 次",
  onRestart,
  restartLabel = "重 启 仪 式",
}: RitualErrorScreenProps) {
  const motes = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.5;
        const distance = 220 + Math.random() * 420;
        return {
          id: i,
          tx: Math.cos(angle) * distance,
          ty: Math.sin(angle) * distance * 0.9,
          delay: Math.random() * 10,
          duration: 12 + Math.random() * 10,
          size: 1 + Math.random() * 2,
          opacity: 0.18 + Math.random() * 0.35,
        };
      }),
    [],
  );

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
          {/* smoke */}
          <svg
            className="pointer-events-none absolute left-1/2 top-0 h-[170px] w-[120px] -translate-x-1/2"
            viewBox="0 0 120 170"
            fill="none"
            aria-hidden="true"
          >
            <g style={{ filter: "blur(3px)" }}>
              <path
                className="incense-smoke"
                d="M60 168 C 54 140, 68 126, 60 104 C 52 82, 66 66, 58 42 C 54 28, 60 16, 62 4"
                stroke="oklch(0.86 0.03 70 / 0.30)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                className="incense-smoke incense-smoke-alt"
                d="M60 168 C 66 144, 52 128, 62 106 C 70 84, 56 68, 64 44 C 68 30, 60 18, 58 6"
                stroke="oklch(0.86 0.03 70 / 0.18)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </g>
          </svg>

          {/* ember tip */}
          <span
            className="absolute left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full incense-ember"
            style={{ top: 168 }}
          />

          {/* stick */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: 172,
              width: 2,
              height: 76,
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

        {(onRetry || onRestart) && (
          <div className="mt-10 flex flex-col items-center gap-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="font-serif-sc text-[12px] tracking-[0.35em] text-foreground/45 transition-colors hover:text-foreground/75"
              >
                {retryLabel}
              </button>
            )}
            {onRestart && (
              <button
                onClick={onRestart}
                className="font-serif-sc text-[11px] tracking-[0.3em] text-foreground/25 transition-colors hover:text-foreground/50"
              >
                {restartLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
