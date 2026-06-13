import { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  tx: number;
  ty: number;
  cx: number;
  cy: number;
  t: number;
  speed: number;
  size: number;
  trail: { x: number; y: number }[];
  arrived: boolean;
}

export function ParticleSplashIntro() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"running" | "fading" | "done">("running");
  const [charsVisible, setCharsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem("oneslip.splash.v1") === "1") {
        setPhase("done");
        return;
      }
      sessionStorage.setItem("oneslip.splash.v1", "1");
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

    const cx = W / 2;
    const cy = H / 2;

    const particles: Particle[] = [];
    const count = 110;
    for (let i = 0; i < count; i++) {
      const edge = i % 4;
      let x = 0;
      let y = 0;
      if (edge === 0) {
        x = Math.random() * W;
        y = -10;
      } else if (edge === 1) {
        x = W + 10;
        y = Math.random() * H;
      } else if (edge === 2) {
        x = Math.random() * W;
        y = H + 10;
      } else {
        x = -10;
        y = Math.random() * H;
      }
      // control point: perpendicular offset to create curved path
      const mx = (x + cx) / 2;
      const my = (y + cy) / 2;
      const dx = cx - x;
      const dy = cy - y;
      const len = Math.hypot(dx, dy) || 1;
      const perpX = -dy / len;
      const perpY = dx / len;
      const curve = (Math.random() - 0.5) * Math.min(W, H) * 0.6;
      particles.push({
        x,
        y,
        tx: cx + (Math.random() - 0.5) * 8,
        ty: cy + (Math.random() - 0.5) * 8,
        cx: mx + perpX * curve,
        cy: my + perpY * curve,
        t: -Math.random() * 0.4,
        speed: 0.0055 + Math.random() * 0.004,
        size: 0.8 + Math.random() * 1.6,
        trail: [],
        arrived: false,
      });
    }

    let orbT = 0;
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;

      // fade trails
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      let arrivedCount = 0;
      for (const p of particles) {
        if (p.arrived) {
          arrivedCount++;
          continue;
        }
        p.t += p.speed;
        if (p.t >= 1) {
          p.arrived = true;
          arrivedCount++;
          continue;
        }
        const tt = Math.max(0, p.t);
        const u = 1 - tt;
        const nx = u * u * p.x + 2 * u * tt * p.cx + tt * tt * p.tx;
        const ny = u * u * p.y + 2 * u * tt * p.cy + tt * tt * p.ty;

        p.trail.push({ x: nx, y: ny });
        if (p.trail.length > 14) p.trail.shift();

        // trail
        for (let i = 0; i < p.trail.length; i++) {
          const tp = p.trail[i];
          const a = (i / p.trail.length) * 0.45;
          ctx.fillStyle = `rgba(230, 188, 120, ${a})`;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, p.size * (i / p.trail.length) * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        // head glow
        const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, p.size * 6);
        grad.addColorStop(0, "rgba(255, 220, 160, 0.9)");
        grad.addColorStop(1, "rgba(214, 160, 80, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(nx, ny, p.size * 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // orb formation
      if (arrivedCount > count * 0.3) {
        orbT = Math.min(1, orbT + 0.012);
      }
      if (orbT > 0) {
        const r = 60 * orbT;
        const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
        og.addColorStop(0, `rgba(255, 226, 170, ${0.85 * orbT})`);
        og.addColorStop(0.3, `rgba(230, 175, 95, ${0.5 * orbT})`);
        og.addColorStop(1, "rgba(180, 110, 40, 0)");
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (orbT >= 0.6 && !charsVisible) {
        setCharsVisible(true);
      }

      if (elapsed > 3.2 && phase === "running") {
        setPhase("fading");
      }
      if (elapsed > 4.4) {
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
        background:
          "radial-gradient(ellipse at 50% 50%, #2a1c10 0%, #1a1108 55%, #0b0704 100%)",
        opacity: phase === "fading" ? 0 : 1,
        transition: "opacity 1.2s ease-out",
      }}
    >
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0 }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "9rem",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontFamily: "'Noto Serif SC', 'Noto Sans SC', serif",
            fontSize: "clamp(40px, 9vw, 72px)",
            fontWeight: 300,
            color: "rgba(245, 220, 175, 0.95)",
            letterSpacing: "0.1em",
            textShadow: "0 0 24px rgba(230, 180, 100, 0.55)",
            opacity: charsVisible ? 1 : 0,
            filter: charsVisible ? "blur(0)" : "blur(10px)",
            transform: charsVisible ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 1.4s ease-out, filter 1.4s ease-out, transform 1.4s ease-out",
          }}
        >
          一
        </span>
        <span
          style={{
            fontFamily: "'Noto Serif SC', 'Noto Sans SC', serif",
            fontSize: "clamp(40px, 9vw, 72px)",
            fontWeight: 300,
            color: "rgba(245, 220, 175, 0.95)",
            letterSpacing: "0.1em",
            textShadow: "0 0 24px rgba(230, 180, 100, 0.55)",
            opacity: charsVisible ? 1 : 0,
            filter: charsVisible ? "blur(0)" : "blur(10px)",
            transform: charsVisible ? "translateY(0)" : "translateY(-8px)",
            transition: "opacity 1.6s ease-out 0.3s, filter 1.6s ease-out 0.3s, transform 1.6s ease-out 0.3s",
          }}
        >
          签
        </span>
      </div>
    </div>
  );
}
