import { useEffect, useRef, useState } from "react";

// --- Perlin-like noise --------------------------------------------------------
function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function lerp(a: number, b: number, t: number) {
  return a + t * (b - a);
}
function grad(hash: number, x: number, y: number) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return (h & 1 ? -u : u) + (h & 2 ? -v : v);
}
const _P = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21,
  10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149,
  56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229,
  122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209,
  76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217,
  226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42,
  223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
  108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179,
  162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50,
  45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
];
const PERM = Array.from({ length: 512 }, (_, i) => _P[i & 255]);
function noise2(x: number, y: number) {
  const X = Math.floor(x) & 255,
    Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x),
    yf = y - Math.floor(y);
  const u = fade(xf),
    v = fade(yf);
  const a = PERM[X] + Y,
    b = PERM[X + 1] + Y;
  return lerp(
    lerp(grad(PERM[a], xf, yf), grad(PERM[b], xf - 1, yf), u),
    lerp(grad(PERM[a + 1], xf, yf - 1), grad(PERM[b + 1], xf - 1, yf - 1), u),
    v,
  );
}
// -----------------------------------------------------------------------------

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
const T_CHARS_SHOW = 2.6;
const T_HOLD_START = 3.0;
const T_HOLD_END = 5.4;
const T_DONE = 7.2;

// -- Layout constants ----------------------------------------------------------
const ORB_R = 36;
const TEXT_GAP = 36;
const CHAR_H = 36;

// -- Palette -------------------------------------------------------------------
const ORB_WARM = "220, 195, 150";
const ORB_EDGE = "160, 125,  70";
const PART_HEAD = "210, 165, 85";
const PART_TAIL = "160, 120, 55";

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
    const CY = () => H / 2;

    const COUNT = 120;
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
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translateX(-50%) translateY(calc(-${ORB_R + TEXT_GAP}px - 100%))`,
            fontFamily: "var(--font-serif-sc)",
            fontSize: `${CHAR_H}px`,
            fontWeight: 300,
            color: "rgba(235, 225, 205, 0.90)",
            letterSpacing: "0.18em",
            textShadow: "0 0 24px rgba(210, 190, 150, 0.4)",
            opacity: 0,
            filter: "blur(12px)",
            animation: "splashCharIn 2.0s ease-out forwards",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          一
        </span>
      )}

      {charsVisible && (
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translateX(-50%) translateY(${ORB_R + TEXT_GAP}px)`,
            fontFamily: "var(--font-serif-sc)",
            fontSize: `${CHAR_H}px`,
            fontWeight: 300,
            color: "rgba(235, 225, 205, 0.90)",
            letterSpacing: "0.18em",
            textShadow: "0 0 24px rgba(210, 190, 150, 0.4)",
            opacity: 0,
            filter: "blur(12px)",
            animation: "splashCharIn 2.2s ease-out 0.5s forwards",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          签
        </span>
      )}

      <style>{`
        @keyframes splashCharIn {
          to { opacity: 1; filter: blur(0); }
        }
      `}</style>
    </div>
  );
}

// -- Particle draw -------------------------------------------------------------
function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number; size: number; alpha: number; trail: { x: number; y: number }[] },
  alphaScale: number,
) {
  const tLen = p.trail.length;
  if (tLen < 2) return;
  for (let i = 1; i < tLen; i++) {
    const tp = p.trail[i];
    const ratio = i / tLen;
    const a = ratio * ratio * 0.2 * p.alpha * alphaScale;
    const sz = p.size * ratio * 0.55;
    ctx.fillStyle = `rgba(${PART_TAIL}, ${a})`;
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  const glowR = p.size * 3.0;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
  g.addColorStop(0, `rgba(${PART_HEAD}, ${0.9 * p.alpha * alphaScale})`);
  g.addColorStop(0.3, `rgba(${PART_HEAD}, ${0.5 * p.alpha * alphaScale})`);
  g.addColorStop(1, `rgba(${PART_TAIL}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
  ctx.fill();
}
