import { useEffect, useRef, useState } from "react";
import { noise2, drawParticle } from "@/lib/particles";
import { GlyphYi, GlyphQian } from "./LogoGlyphs";

interface Particle {
  sx: number;
  sy: number;
  x: number;
  y: number;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  t: number;
  travelSpeed: number;
  driftAngle: number;
  driftSpeed: number;
  size: number;
  alpha: number;
  trail: { x: number; y: number }[];
  arrived: boolean;
  arriveAlpha: number;
  noiseOx: number;
  noiseOy: number;
}

// -- Timing (seconds) ---------------------------------------------------------
const T_CHARS_SHOW = 2.6; //粒子飞了多久后 logo 开始浮现
const T_HOLD_START = 3.0; //光球轻微脉动的区间
const T_HOLD_END = 5.4; //光球轻微脉动的区间
const T_DONE = 7.2; //整个开场结束、页面接管

// -- Layout constants ----------------------------------------------------------
const ORB_R = 36; //光球半径。注意它同时决定间距基准，改大字会跟着往外推
const TEXT_GAP = 30; //字与光球的间距
const LOGO_W = 48;   // ← 新增，logo 显示宽度，先用 72 试
/** 整组上移量（像素）。加了 OneSlip 后下半部分变长，往上提回视觉中心 */
const VERTICAL_SHIFT = 28;

// -- Palette -------------------------------------------------------------------
const ORB_WARM = "220, 195, 150"; // 光球中心
const ORB_EDGE = "160, 125,  70"; // 光球边缘

export function ParticleSplashIntro() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"running" | "fading" | "done">("running");
  const [charsVisible, setCharsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem("oneslip.splash.v5") === "1") {
        setPhase("done");
        return;
      }
      sessionStorage.setItem("oneslip.splash.v5", "1");
    } catch {}

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = window.innerWidth;
    let H = window.innerHeight;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const CX = () => W / 2;
    const CY = () => H / 2 - VERTICAL_SHIFT;

    const COUNT = 120; // 粒子数量
    const particles: Particle[] = [];
    for (let i = 0; i < COUNT; i++) {
      const edge = i % 4;
      let sx = 0,
        sy = 0;
      if (edge === 0) {
        sx = Math.random() * W;
        sy = -15;
      } else if (edge === 1) {
        sx = W + 15;
        sy = Math.random() * H;
      } else if (edge === 2) {
        sx = Math.random() * W;
        sy = H + 15;
      } else {
        sx = -15;
        sy = Math.random() * H;
      }
      const cx_ = CX(),
        cy_ = CY();
      const mx = (sx + cx_) / 2,
        my = (sy + cy_) / 2;
      const dx = cx_ - sx,
        dy = cy_ - sy;
      const len = Math.hypot(dx, dy) || 1;
      const curve = (Math.random() - 0.5) * Math.min(W, H) * 0.45;
      const perp = { x: -dy / len, y: dx / len };
      particles.push({
        sx,
        sy,
        x: sx,
        y: sy,
        cx: mx + perp.x * curve,
        cy: my + perp.y * curve,
        tx: cx_ + (Math.random() - 0.5) * 8,
        ty: cy_ + (Math.random() - 0.5) * 8,
        t: -Math.random() * 0.6,
        travelSpeed: 0.0022 + Math.random() * 0.0016,
        driftAngle: Math.random() * Math.PI * 2,
        driftSpeed: 0.25 + Math.random() * 0.4,
        size: 0.5 + Math.random() * 1.0,
        alpha: 0.5 + Math.random() * 0.5,
        trail: [],
        arrived: false,
        arriveAlpha: 1,
        noiseOx: Math.random() * 100,
        noiseOy: Math.random() * 100,
      });
    }

    let orbT = 0;
    let noiseT = 0;
    let raf = 0;
    let charsSet = false;
    let phaseRef: "running" | "fading" | "done" = "running";
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      noiseT += 0.0025;
      const cx_ = CX(),
        cy_ = CY();

      // Slow fade for long gossamer trails
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(28,14,6,0.14)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      // -- Particles ---------------------------------------------------------
      let arrivedCount = 0;
      for (const p of particles) {
        if (p.arrived) {
          arrivedCount++;
          p.arriveAlpha = Math.max(0, p.arriveAlpha - 0.004);
          if (p.arriveAlpha <= 0) continue;

          const nAngle = noise2(p.x * 0.003 + p.noiseOx + noiseT, p.y * 0.003 + p.noiseOy) * Math.PI * 2;
          p.driftAngle += p.driftSpeed * 0.016;
          const drift = 0.3 + 0.1 * Math.sin(elapsed + p.noiseOx);
          p.x += Math.cos(nAngle) * drift * 0.3 + Math.cos(p.driftAngle) * drift * 0.5;
          p.y += Math.sin(nAngle) * drift * 0.3 + Math.sin(p.driftAngle) * drift * 0.5;
          p.trail.push({ x: p.x, y: p.y });
          if (p.trail.length > 10) p.trail.shift();
          drawParticle(ctx, p, p.arriveAlpha);
          continue;
        }

        p.t += p.travelSpeed;
        if (p.t >= 1) {
          p.arrived = true;
          p.x = p.tx;
          p.y = p.ty;
          arrivedCount++;
          continue;
        }
        const tt = Math.max(0, p.t);
        if (tt <= 0) continue;

        const ease = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
        const u = 1 - ease;
        p.x = u * u * p.sx + 2 * u * ease * p.cx + ease * ease * p.tx;
        p.y = u * u * p.sy + 2 * u * ease * p.cy + ease * ease * p.ty;

        const nAngle = noise2(p.x * 0.004 + p.noiseOx + noiseT * 0.4, p.y * 0.004 + p.noiseOy) * Math.PI * 1.4;
        p.x += Math.cos(nAngle) * 0.5;
        p.y += Math.sin(nAngle) * 0.5;

        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 16) p.trail.shift();
        drawParticle(ctx, p, 1);
      }

      // -- Orb ---------------------------------------------------------------
      ctx.globalCompositeOperation = "source-over";

      if (arrivedCount > COUNT * 0.2) {
        orbT = Math.min(1, orbT + 0.006);
      }

      if (orbT > 0) {
        const inHold = elapsed >= T_HOLD_START && elapsed < T_HOLD_END;
        const pulse = inHold ? 1 + 0.025 * Math.sin(elapsed * 2.0) : 1;
        const r = ORB_R * orbT * pulse;

        // Outer ambient glow
        const halo = ctx.createRadialGradient(cx_, cy_, r * 0.5, cx_, cy_, r * 3.0);
        halo.addColorStop(0, `rgba(${ORB_WARM}, ${0.08 * orbT})`);
        halo.addColorStop(0.6, `rgba(${ORB_EDGE}, ${0.04 * orbT})`);
        halo.addColorStop(1, `rgba(${ORB_EDGE}, 0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx_, cy_, r * 3.0, 0, Math.PI * 2);
        ctx.fill();

        // Soft body
        const body = ctx.createRadialGradient(cx_ - r * 0.2, cy_ - r * 0.2, 0, cx_, cy_, r);
        body.addColorStop(0, `rgba(${ORB_WARM}, ${0.22 * orbT})`);
        body.addColorStop(0.55, `rgba(${ORB_WARM}, ${0.14 * orbT})`);
        body.addColorStop(0.85, `rgba(${ORB_EDGE}, ${0.06 * orbT})`);
        body.addColorStop(1, `rgba(${ORB_EDGE}, 0)`);
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(cx_, cy_, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // -- Char reveal -------------------------------------------------------
      if (elapsed >= T_CHARS_SHOW && !charsSet) {
        charsSet = true;
        setCharsVisible(true);
      }

      // -- Phase transitions -------------------------------------------------
      if (elapsed >= T_HOLD_END && phaseRef === "running") {
        phaseRef = "fading";
        setPhase("fading");
      }
      if (elapsed >= T_DONE) {
        setPhase("done");
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "done") return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: phase === "fading" ? "none" : "auto",
        background: "radial-gradient(ellipse at 50% 50%, #1e1408 0%, #120d04 55%, #070402 100%)",
        opacity: phase === "fading" ? 0 : 1,
        transition: "opacity 1.8s ease-out",
      }}
    >
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0 }} />

     

{charsVisible && (
  <div
    style={{
      position: "absolute",
      left: "50%",
      top: `calc(50% - ${VERTICAL_SHIFT}px)`,
      transform: `translateX(-50%) translateY(calc(-${ORB_R + TEXT_GAP}px - 100%))`,
      color: "rgba(235, 225, 205, 0.80)", //logo“一”字体颜色
      opacity: 0,
      filter: "blur(12px)", //起始模糊度，调大会更有「从虚无中凝聚」的感觉
      animation: "splashCharIn 2.0s ease-out forwards",
      pointerEvents: "none",
    }}
  >
    <GlyphYi
      style={{
        display: "block",
        width: LOGO_W,
        height: "auto",
        filter: "drop-shadow(0 0 24px rgba(210, 190, 150, 0.45))", //字体发光效果， px控制光晕扩散半径，0.45是强度
      }}
    />
  </div>
)}

{charsVisible && (
  <div
    style={{
      position: "absolute",
      left: "50%",
      top: `calc(50% - ${VERTICAL_SHIFT}px)`,
      transform: `translateX(-50%) translateY(${ORB_R + TEXT_GAP}px)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      color: "rgba(235, 225, 205, 0.90)",
      pointerEvents: "none",
      whiteSpace: "nowrap",
    }}
  >
    {/* 签 */}
    <div style={{ opacity: 0, filter: "blur(12px)", animation: "splashCharIn 2.2s ease-out 0.5s forwards" }}>
      <GlyphQian
        style={{
          display: "block",
          width: LOGO_W,
          height: "auto",
          filter: "drop-shadow(0 0 18px rgba(210, 190, 150, 0.45))",
        }}
      />
    </div>

    {/* 圆点 + OneSlip */}
    <div
      style={{
        opacity: 0,
        filter: "blur(8px)",
        animation: "splashCharIn 1.8s ease-out 0.55s forwards",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textShadow: "0 0 16px rgba(210, 190, 150, 0.35)",
      }}
    >
      <span style={{ marginTop: 18, width: 3, height: 3, borderRadius: "50%", background: "currentColor", opacity: 0.55 }} />
      <span
        style={{
          marginTop: 12, //圆点与OneSlip的间距
          fontFamily: "var(--font-sans)",
          fontSize: 18,
          fontWeight: 300,
          letterSpacing: "0.02em",
        }}
      >
        OneSlip
      </span>
    </div>
  </div>
)}

      <style>{`
        @keyframes splashCharIn {
          to { opacity: 1; filter: blur(0); }
        }
      `}</style>
    </div>
  );
}
