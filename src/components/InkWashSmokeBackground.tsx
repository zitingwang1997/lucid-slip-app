import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

type InkWash = {
  id: number;
  left: string;
  top?: string;
  bottom?: string;
  width: number;
  height: number;
  blur: number;
  duration: number;
  delay: number;
  density: number;
  borderRadius: string;
  blendMode: "screen" | "soft-light";
  x: number[];
  y: number[];
  scale: number[];
  opacity: number[];
  rotate: number[];
};

type SmokeRibbon = {
  id: number;
  left: string;
  bottom: string;
  width: number;
  height: number;
  blur: number;
  duration: number;
  delay: number;
  rotate: number;
  x: number[];
  y: number[];
  scale: number[];
  opacity: number[];
};

/** Warm parchment-gray diffusion — high contrast on dark brown. */
function washGradient(density: number) {
  const a = density;
  return [
    `radial-gradient(ellipse 40% 36% at 50% 82%, oklch(0.88 0.028 85 / ${(0.72 * a).toFixed(3)}) 0%, transparent 52%)`,
    `radial-gradient(ellipse 65% 58% at 48% 58%, oklch(0.84 0.024 82 / ${(0.5 * a).toFixed(3)}) 0%, transparent 58%)`,
    `radial-gradient(ellipse 85% 72% at 52% 38%, oklch(0.8 0.02 80 / ${(0.28 * a).toFixed(3)}) 0%, transparent 64%)`,
    `radial-gradient(ellipse 100% 88% at 50% 18%, oklch(0.76 0.016 78 / ${(0.12 * a).toFixed(3)}) 0%, transparent 68%)`,
  ].join(", ");
}

function ribbonGradient() {
  return [
    "radial-gradient(ellipse 88% 22% at 50% 92%, oklch(0.9 0.03 86 / 0.85) 0%, transparent 68%)",
    "radial-gradient(ellipse 62% 48% at 50% 55%, oklch(0.85 0.025 83 / 0.55) 0%, transparent 62%)",
    "radial-gradient(ellipse 48% 38% at 50% 22%, oklch(0.8 0.018 80 / 0.28) 0%, transparent 66%)",
  ].join(", ");
}

const DESKTOP_WASHES: InkWash[] = [
  {
    id: 1,
    left: "-14%",
    bottom: "-4%",
    width: 560,
    height: 460,
    blur: 58,
    duration: 52,
    delay: 0,
    density: 1.1,
    borderRadius: "42% 58% 55% 45% / 48% 42% 58% 52%",
    blendMode: "screen",
    x: [0, 36, 14, -28, 18, 0],
    y: [0, -45, -95, -150, -90, 0],
    scale: [1, 1.08, 1.16, 1.22, 1.1, 1],
    opacity: [0.55, 0.92, 0.85, 0.65, 0.5, 0.55],
    rotate: [0, 4, -3, 5, -2, 0],
  },
  {
    id: 2,
    left: "64%",
    bottom: "-2%",
    width: 520,
    height: 420,
    blur: 54,
    duration: 58,
    delay: 8,
    density: 1,
    borderRadius: "55% 45% 48% 52% / 52% 48% 52% 48%",
    blendMode: "screen",
    x: [0, -32, -10, 26, -18, 0],
    y: [0, -50, -105, -165, -100, 0],
    scale: [1, 1.06, 1.14, 1.2, 1.08, 1],
    opacity: [0.5, 0.88, 0.8, 0.6, 0.45, 0.5],
    rotate: [0, -5, 3, -4, 2, 0],
  },
  {
    id: 3,
    left: "22%",
    bottom: "-8%",
    width: 480,
    height: 380,
    blur: 50,
    duration: 48,
    delay: 16,
    density: 0.95,
    borderRadius: "48% 52% 50% 50% / 55% 45% 55% 45%",
    blendMode: "screen",
    x: [0, 20, -24, 16, -12, 0],
    y: [0, -40, -88, -140, -80, 0],
    scale: [1, 1.1, 1.18, 1.24, 1.12, 1],
    opacity: [0.48, 0.85, 0.78, 0.58, 0.42, 0.48],
    rotate: [0, 3, -4, 2, -3, 0],
  },
  {
    id: 4,
    left: "-6%",
    bottom: "18%",
    width: 380,
    height: 340,
    blur: 48,
    duration: 54,
    delay: 24,
    density: 0.85,
    borderRadius: "50% 50% 45% 55% / 45% 55% 50% 50%",
    blendMode: "soft-light",
    x: [0, 28, -16, 22, 0],
    y: [0, -35, -75, -120, 0],
    scale: [1, 1.05, 1.12, 1.18, 1],
    opacity: [0.45, 0.78, 0.7, 0.5, 0.45],
    rotate: [0, 5, -3, 4, 0],
  },
  {
    id: 5,
    left: "76%",
    bottom: "14%",
    width: 360,
    height: 320,
    blur: 46,
    duration: 50,
    delay: 32,
    density: 0.85,
    borderRadius: "52% 48% 53% 47% / 50% 50% 48% 52%",
    blendMode: "soft-light",
    x: [0, -26, 18, -20, 0],
    y: [0, -38, -80, -125, 0],
    scale: [1, 1.06, 1.13, 1.19, 1],
    opacity: [0.42, 0.75, 0.68, 0.48, 0.42],
    rotate: [0, -4, 4, -2, 0],
  },
];

const DESKTOP_RIBBONS: SmokeRibbon[] = [
  {
    id: 101,
    left: "10%",
    bottom: "2%",
    width: 72,
    height: 420,
    blur: 26,
    duration: 44,
    delay: 0,
    rotate: -8,
    x: [0, 22, -16, 28, 12, 0],
    y: [0, -80, -175, -290, -400, -480],
    scale: [0.75, 0.9, 1.05, 1.18, 1.28, 1.35],
    opacity: [0, 0.55, 0.78, 0.65, 0.35, 0],
  },
  {
    id: 102,
    left: "78%",
    bottom: "4%",
    width: 64,
    height: 400,
    blur: 24,
    duration: 48,
    delay: 12,
    rotate: 7,
    x: [0, -24, 18, -30, -14, 0],
    y: [0, -75, -165, -275, -385, -460],
    scale: [0.72, 0.88, 1.02, 1.15, 1.26, 1.32],
    opacity: [0, 0.5, 0.72, 0.6, 0.3, 0],
  },
  {
    id: 103,
    left: "38%",
    bottom: "0%",
    width: 80,
    height: 460,
    blur: 28,
    duration: 52,
    delay: 22,
    rotate: -3,
    x: [0, 14, -20, 18, -10, 0],
    y: [0, -90, -195, -310, -420, -500],
    scale: [0.78, 0.92, 1.08, 1.2, 1.3, 1.38],
    opacity: [0, 0.48, 0.7, 0.58, 0.28, 0],
  },
  {
    id: 104,
    left: "52%",
    bottom: "6%",
    width: 56,
    height: 360,
    blur: 22,
    duration: 40,
    delay: 34,
    rotate: 5,
    x: [0, -18, 24, -14, 20, 0],
    y: [0, -70, -155, -250, -340, -410],
    scale: [0.7, 0.86, 1, 1.12, 1.22, 1.28],
    opacity: [0, 0.45, 0.65, 0.52, 0.25, 0],
  },
  {
    id: 105,
    left: "92%",
    bottom: "20%",
    width: 52,
    height: 300,
    blur: 20,
    duration: 46,
    delay: 18,
    rotate: 10,
    x: [0, -16, 12, -20, 0],
    y: [0, -60, -130, -210, -280],
    scale: [0.74, 0.88, 1.02, 1.14, 1.2],
    opacity: [0, 0.42, 0.6, 0.45, 0],
  },
];

const MOBILE_WASHES: InkWash[] = [
  {
    id: 1,
    left: "-16%",
    bottom: "-2%",
    width: 380,
    height: 340,
    blur: 50,
    duration: 50,
    delay: 0,
    density: 1,
    borderRadius: "42% 58% 55% 45% / 48% 42% 58% 52%",
    blendMode: "screen",
    x: [0, 24, -14, 0],
    y: [0, -40, -85, 0],
    scale: [1, 1.1, 1.05, 1],
    opacity: [0.5, 0.88, 0.55, 0.5],
    rotate: [0, 3, -2, 0],
  },
  {
    id: 2,
    left: "58%",
    bottom: "0%",
    width: 340,
    height: 300,
    blur: 46,
    duration: 54,
    delay: 10,
    density: 0.95,
    borderRadius: "55% 45% 48% 52% / 52% 48% 52% 48%",
    blendMode: "screen",
    x: [0, -20, 14, 0],
    y: [0, -45, -95, 0],
    scale: [1, 1.08, 1.04, 1],
    opacity: [0.48, 0.85, 0.52, 0.48],
    rotate: [0, -4, 2, 0],
  },
  {
    id: 3,
    left: "18%",
    bottom: "-4%",
    width: 300,
    height: 280,
    blur: 44,
    duration: 46,
    delay: 20,
    density: 0.9,
    borderRadius: "48% 52% 50% 50% / 55% 45% 55% 45%",
    blendMode: "screen",
    x: [0, 16, -12, 0],
    y: [0, -38, -80, 0],
    scale: [1, 1.12, 1.06, 1],
    opacity: [0.45, 0.8, 0.48, 0.45],
    rotate: [0, 2, -3, 0],
  },
  {
    id: 4,
    left: "72%",
    bottom: "12%",
    width: 260,
    height: 240,
    blur: 42,
    duration: 52,
    delay: 28,
    density: 0.8,
    borderRadius: "52% 48% 53% 47% / 50% 50% 48% 52%",
    blendMode: "soft-light",
    x: [0, -18, 12, 0],
    y: [0, -32, -68, 0],
    scale: [1, 1.06, 1.02, 1],
    opacity: [0.4, 0.72, 0.45, 0.4],
    rotate: [0, -3, 3, 0],
  },
];

const MOBILE_RIBBONS: SmokeRibbon[] = [
  {
    id: 101,
    left: "8%",
    bottom: "0%",
    width: 58,
    height: 360,
    blur: 22,
    duration: 42,
    delay: 0,
    rotate: -7,
    x: [0, 18, -12, 0],
    y: [0, -75, -180, -320],
    scale: [0.76, 0.95, 1.15, 1.3],
    opacity: [0, 0.55, 0.7, 0],
  },
  {
    id: 102,
    left: "72%",
    bottom: "2%",
    width: 52,
    height: 340,
    blur: 20,
    duration: 46,
    delay: 14,
    rotate: 6,
    x: [0, -16, 14, 0],
    y: [0, -70, -170, -300],
    scale: [0.74, 0.92, 1.12, 1.28],
    opacity: [0, 0.5, 0.65, 0],
  },
  {
    id: 103,
    left: "40%",
    bottom: "-2%",
    width: 64,
    height: 380,
    blur: 24,
    duration: 50,
    delay: 26,
    rotate: -2,
    x: [0, 12, -16, 0],
    y: [0, -85, -200, -350],
    scale: [0.78, 0.96, 1.18, 1.32],
    opacity: [0, 0.48, 0.62, 0],
  },
];

function InkWashLayer({
  wash,
  reduced,
}: {
  wash: InkWash;
  reduced: boolean;
}) {
  const position = {
    left: wash.left,
    ...(wash.top !== undefined ? { top: wash.top } : {}),
    ...(wash.bottom !== undefined ? { bottom: wash.bottom } : {}),
  };

  const style = {
    ...position,
    width: wash.width,
    height: wash.height,
    borderRadius: wash.borderRadius,
    background: washGradient(wash.density),
    filter: `blur(${wash.blur}px)`,
    mixBlendMode: wash.blendMode,
  };

  if (reduced) {
    return <div className="absolute" style={{ ...style, opacity: 0.55 }} />;
  }

  return (
    <motion.div
      className="absolute"
      style={style}
      animate={{
        x: wash.x,
        y: wash.y,
        opacity: wash.opacity,
        scale: wash.scale,
        rotate: wash.rotate,
      }}
      transition={{
        duration: wash.duration,
        delay: wash.delay,
        repeat: Infinity,
        ease: "easeInOut",
        times: wash.x.map((_, i) => i / (wash.x.length - 1)),
      }}
    />
  );
}

function SmokeRibbonLayer({
  ribbon,
  reduced,
}: {
  ribbon: SmokeRibbon;
  reduced: boolean;
}) {
  const style = {
    left: ribbon.left,
    bottom: ribbon.bottom,
    width: ribbon.width,
    height: ribbon.height,
    background: ribbonGradient(),
    filter: `blur(${ribbon.blur}px)`,
    mixBlendMode: "screen" as const,
    transformOrigin: "50% 90%",
  };

  if (reduced) {
    return (
      <div
        className="absolute"
        style={{ ...style, opacity: 0.45, transform: `rotate(${ribbon.rotate}deg)` }}
      />
    );
  }

  return (
    <motion.div
      className="absolute"
      style={style}
      initial={{
        opacity: 0,
        scale: ribbon.scale[0],
        rotate: ribbon.rotate,
      }}
      animate={{
        x: ribbon.x,
        y: ribbon.y,
        opacity: ribbon.opacity,
        scale: ribbon.scale,
        rotate: [
          ribbon.rotate,
          ribbon.rotate + 4,
          ribbon.rotate - 3,
          ribbon.rotate + 5,
          ribbon.rotate - 2,
          ribbon.rotate,
        ],
      }}
      transition={{
        duration: ribbon.duration,
        delay: ribbon.delay,
        repeat: Infinity,
        ease: "easeInOut",
        times: ribbon.x.map((_, i) => i / (ribbon.x.length - 1)),
      }}
    />
  );
}

export function InkWashSmokeBackground() {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  const washes = useMemo(
    () => (isMobile ? MOBILE_WASHES : DESKTOP_WASHES),
    [isMobile],
  );
  const ribbons = useMemo(
    () => (isMobile ? MOBILE_RIBBONS : DESKTOP_RIBBONS),
    [isMobile],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      style={{
        /* Clear zone for title — smoke wraps lower half & sides */
        maskImage:
          "radial-gradient(ellipse 34% 28% at 50% 34%, transparent 58%, black 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 34% 28% at 50% 34%, transparent 58%, black 100%)",
      }}
    >
      {/* Warm edge depth */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 90% 70% at 50% 100%, oklch(0.2 0.02 55 / 0.35) 0%, transparent 55%)",
            "radial-gradient(ellipse 120% 90% at 50% 50%, transparent 25%, oklch(0.09 0.01 50 / 0.5) 100%)",
          ].join(", "),
        }}
      />

      {washes.map((wash) => (
        <InkWashLayer
          key={wash.id}
          wash={wash}
          reduced={!!reducedMotion}
        />
      ))}

      {ribbons.map((ribbon) => (
        <SmokeRibbonLayer
          key={ribbon.id}
          ribbon={ribbon}
          reduced={!!reducedMotion}
        />
      ))}
    </div>
  );
}
