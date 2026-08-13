import { useEffect, useRef } from "react";
import { noise2, drawFlowParticle, goldAt, prefersReducedMotion } from "@/lib/particles";
import { useIsMobile } from "@/hooks/use-mobile";

/* ──────────────────────────────────────────────────────────────
 * 可调参数 —— 想调整烟的感觉，只动这一段就够了
 *
 * 配色和粒子形态对齐首页背景 InputAmoebaAura.tsx，但拖尾的实现方式不同：
 * 首页靠画布逐帧残留累积流线，那套做法在小画布上会留下永久残影
 * （透明度是 0–255 整数，乘性衰减到 1 以下四舍五入又变回 1，除不尽）。
 * 这里改成每帧清空 + 每个粒子自己记录路径点画成渐隐折线，
 * 拖尾时长因此是一个可以精确设定的值，也不可能有残留。
 * ────────────────────────────────────────────────────────────── */

/** 画布尺寸（CSS 像素）。香头在 x = CANVAS_W / 2。
 *  改这里必须同步改 RitualErrorScreen 里的 SMOKE_TOP_OFFSET，
 *  那个值决定画布顶边比香容器高出多少，香头才落在画布底部附近 */
const CANVAS_W = 480;
const CANVAS_H = 520;

/** **拖尾显示时长（秒）** —— 流线长度的总开关。
 *  0.4 ≈ 短促的点状，1.5 ≈ 很长的流线 */
const TRAIL_SECONDS = 0.9;
/** 拖尾分几段渐隐。调大更平滑但更费性能，5 段肉眼已看不出接缝 */
const TRAIL_SEGMENTS = 5;

/** 同时存在的粒子上限。手机上自动减半，见 useIsMobile */
const PARTICLE_MAX = 110;
/** 每秒生成几个粒子。调大 = 烟更浓 */
const EMIT_PER_SEC = 22;
/** 手机上的折减系数，兼顾性能 */
const MOBILE_SCALE = 0.62;

/** 粒子从香头往上飘多远后完全消失（像素）。
 *  必须明显小于香头到画布顶边的距离，否则粒子会在画布边缘被硬切断 */
const RISE_HEIGHT = 360;
/** 向上的浮力。和 DAMPING 一起决定终速：终速 ≈ BUOYANCY / (1 - DAMPING) */
const BUOYANCY = 0.05;
/** 速度阻尼。越接近 1 惯性越大、终速越高 */
const DAMPING = 0.965;

/** 底部的横向扰动。**调大会让香头附近就散开，一缕感消失** */
const WANDER_BOTTOM = 0.008;
/** 顶部的横向扰动。调大 = 上方飘得更野。
 *  画布变高后粒子飞行时间更长、扰动累积更多，所以这个值要比小画布时小 */
const WANDER_TOP = 0.055;
/** 噪声场的空间尺度。调小 = 涡流更大更舒缓 */
const NOISE_SCALE = 0.009;
/** 噪声场随时间流动的速度 */
const NOISE_DRIFT = 0.3;

/** 粒子基础尺寸范围。首页用的是 0.14–1.5，别调大，会变成模糊光斑 */
const SIZE_MIN = 0.22;
const SIZE_MAX = 0.95;

/* ────────────────────────────────────────────────────────────── */

/** 每帧记一个点，所以拖尾点数 = 时长 × 60fps */
const TRAIL_POINTS = Math.max(2, Math.round(TRAIL_SECONDS * 60));

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  bright: number;
  age: number;
  nox: number;
  noy: number;
  trail: { x: number; y: number }[];
}

interface IncenseSmokeProps {
  /** 香头（余烬）在画布坐标里的 y。香烧短时这个值变大，发射点跟着下移 */
  emberY: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 香烟流场粒子。
 *
 * 粒子从香头生成，方向由 Perlin 噪声流场决定：底部扰动极小所以聚拢成一缕，
 * 越往上扰动越强、浮力越弱，于是自然散开变淡。颜色随高度从暖金渐变到暗金，
 * 取自首页背景的同一组配色。
 */
export function IncenseSmoke({ emberY, className, style }: IncenseSmokeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  // 用 ref 传递，避免香每烧短一点就重启整个动画循环
  const emberYRef = useRef(emberY);
  emberYRef.current = emberY;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prefersReducedMotion()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const EMBER_X = CANVAS_W / 2;
    const maxParticles = Math.round(PARTICLE_MAX * (isMobile ? MOBILE_SCALE : 1));
    const emitPerSec = EMIT_PER_SEC * (isMobile ? MOBILE_SCALE : 1);
    const particles: SmokeParticle[] = [];
    let emitAcc = 0;
    let raf = 0;
    let last = performance.now();
    let noiseT = 0;

    const spawn = () => {
      if (particles.length >= maxParticles) return;
      particles.push({
        x: EMBER_X + (Math.random() - 0.5) * 1.6,
        y: emberYRef.current - 2,
        vx: (Math.random() - 0.5) * 0.1,
        vy: -0.3 - Math.random() * 0.2,
        size: SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN),
        bright: 0.45 + Math.random() * 0.45,
        age: 0,
        nox: Math.random() * 100,
        noy: Math.random() * 100,
        trail: [],
      });
    };

    /** 把粒子走过的路径画成一条从尾到头逐渐变亮变粗的折线 */
    const drawTrail = (p: SmokeParticle, alpha: number, rgb: [number, number, number]) => {
      const n = p.trail.length;
      if (n < 3) return;
      const [r, g, b] = rgb;
      for (let s = 0; s < TRAIL_SEGMENTS; s++) {
        const i0 = Math.floor((s / TRAIL_SEGMENTS) * (n - 1));
        const i1 = Math.floor(((s + 1) / TRAIL_SEGMENTS) * (n - 1));
        if (i1 <= i0) continue;
        // ratio: 0 = 最旧的尾端，1 = 最新的头部
        const ratio = (s + 1) / TRAIL_SEGMENTS;
        const a = alpha * ratio * ratio * 0.55;
        if (a < 0.006) continue;
        ctx.beginPath();
        ctx.moveTo(p.trail[i0].x, p.trail[i0].y);
        for (let j = i0 + 1; j <= i1; j++) ctx.lineTo(p.trail[j].x, p.trail[j].y);
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
        ctx.lineWidth = p.size * (0.3 + ratio * 0.8);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      }
    };

    const tick = (now: number) => {
      // dt 上限 50ms：标签页切回来时不要让粒子瞬移
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const k = dt * 60; // 把参数换算成「每帧」的量，跟帧率解耦
      noiseT += dt * NOISE_DRIFT;

      emitAcc += emitPerSec * dt;
      while (emitAcc >= 1) {
        emitAcc -= 1;
        spawn();
      }

      // 每帧彻底清空。拖尾由粒子自己的路径点画出，所以不会有残影堆积。
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalCompositeOperation = "screen";

      const ember = emberYRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;

        // h：0 = 刚离开香头，1 = 升到消散高度
        const h = Math.min(Math.max((ember - p.y) / RISE_HEIGHT, 0), 1);

        // 平方曲线让底部长时间维持「一缕」，接近顶部才明显散开
        const wander = WANDER_BOTTOM + (WANDER_TOP - WANDER_BOTTOM) * h * h;
        const angle = noise2(p.x * NOISE_SCALE + p.nox, p.y * NOISE_SCALE + p.noy + noiseT) * Math.PI * 2;

        p.vx += Math.cos(angle) * wander * k;
        p.vy += Math.sin(angle) * wander * 0.4 * k;
        // 浮力随高度衰减：烟升高后失去热量，开始瘫软
        p.vy -= BUOYANCY * (1 - 0.5 * h) * k;

        const damp = Math.pow(DAMPING, k);
        p.vx *= damp;
        p.vy *= damp;
        p.x += p.vx * k;
        p.y += p.vy * k;

        if (h >= 1 || p.y < -20 || p.x < -40 || p.x > CANVAS_W + 40) {
          particles.splice(i, 1);
          continue;
        }

        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > TRAIL_POINTS) p.trail.shift();

        // 刚出生时淡入，避免在香头凭空冒出亮点
        const fadeIn = Math.min(p.age / 0.25, 1);
        const alpha = p.bright * Math.pow(1 - h, 1.2) * fadeIn;
        // 越高越暗越冷，和首页背景由内向外的配色逻辑一致
        const rgb = goldAt(h * 0.85);
        drawTrail(p, alpha, rgb);
        drawFlowParticle(ctx, p.x, p.y, p.size, alpha, rgb);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    // 切到后台就停，别让用户的风扇白转
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isMobile]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        // 双保险：即便参数被调到粒子能飘到画布外，顶边也不会出现硬切线
        maskImage: "linear-gradient(to bottom, transparent 0%, black 12%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12%)",
        ...style,
      }}
    />
  );
}

export const SMOKE_CANVAS_W = CANVAS_W;
export const SMOKE_CANVAS_H = CANVAS_H;
