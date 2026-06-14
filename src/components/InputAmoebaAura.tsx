import { useEffect, useRef, type RefObject } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

type Amoeba = {
  ox: number;
  oy: number;
  rotSpd: number;
  breathSpd: number;
  breathPhase: number;
  baseR: number;
  alpha: number;
  lobeAmp: number;
};

type Lobe = { freq: number; amp: number; phase: number };

// baseR ×1.8, alpha ×2.5, lobeAmp ×1.5
// breathSpd / breathPhase / rotSpd untouched (reference HTML values)
const AMOEBAS: Amoeba[] = [
  { ox: 0,   oy: 0,   rotSpd:  0.00012, breathSpd: 0.0038, breathPhase: 0,   baseR: 74, alpha: 0.11, lobeAmp: 0.62 },
  { ox: 18,  oy: -12, rotSpd: -0.00010, breathSpd: 0.0029, breathPhase: 1.8, baseR: 64, alpha: 0.08, lobeAmp: 0.55 },
  { ox: -16, oy: 10,  rotSpd:  0.00014, breathSpd: 0.0046, breathPhase: 3.2, baseR: 58, alpha: 0.075, lobeAmp: 0.68 },
  { ox: 8,   oy: 18,  rotSpd: -0.00008, breathSpd: 0.0033, breathPhase: 5.0, baseR: 68, alpha: 0.085, lobeAmp: 0.45 },
  { ox: -22, oy: -8,  rotSpd:  0.00011, breathSpd: 0.0041, breathPhase: 2.4, baseR: 60, alpha: 0.07, lobeAmp: 0.48 },
  { ox: 12,  oy: -22, rotSpd: -0.00014, breathSpd: 0.0031, breathPhase: 4.1, baseR: 54, alpha: 0.075, lobeAmp: 0.52 },
];

const LOBES: Lobe[] = [
  { freq: 2, amp: 1.0,  phase: 0   },
  { freq: 3, amp: 0.6,  phase: 1.1 },
  { freq: 5, amp: 0.3,  phase: 2.7 },
  { freq: 7, amp: 0.18, phase: 4.3 },
  { freq: 1, amp: 0.5,  phase: 0.8 },
];

// innermost alphaM changed 0.10 → 0.18
const GLOW_LAYERS = [
  { scale: 2.2, alphaM: 0.0014 },
  { scale: 1.75, alphaM: 0.0022 },
  { scale: 1.38, alphaM: 0.0032 },
  { scale: 1.08, alphaM: 0.0042 },
  { scale: 0.86,  alphaM: 0.0052 },
];

// ---- FBM noise (unchanged) ----
function hsh(n: number) {
  n = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function n2(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return (
    hsh(ix     + hsh(iy    )) * (1 - ux) * (1 - uy) +
    hsh(ix + 1 + hsh(iy    )) * ux       * (1 - uy) +
    hsh(ix     + hsh(iy + 1)) * (1 - ux) * uy       +
    hsh(ix + 1 + hsh(iy + 1)) * ux       * uy
  );
}

function fbm(x: number, y: number, o: number) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < o; i++) {
    v += n2(x * f, y * f) * a;
    a *= 0.5;
    f *= 2.1;
  }
  return v;
}

export function InputAmoebaAura({
  anchorRef: _anchorRef,
}: {
  containerRef: RefObject<HTMLElement | null>;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  // bgCanvas-base: transparent base layer — no JS, lets page background through
  const baseRef = useRef<HTMLCanvasElement>(null);
  // bgCanvas-fx: all drawing happens here
  const fxRef   = useRef<HTMLCanvasElement>(null);
  const rafRef   = useRef(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    const fx = fxRef.current!;
    if (!fx) return;

    const ct = fx.getContext("2d")!;
    if (!ct) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let W = 0;
    let H = 0;
    let HX = 0;
    let HY = 0;
    let scale = 1;
    let t = 0;

    function resize() {
      W = fx.width  = window.innerWidth;
      H = fx.height = window.innerHeight;
      HX = W / 2;
      HY = H / 2;
      scale = Math.min(W, H) / 520;
    }

    // ---- particles (all params unchanged from reference HTML) ----
    const NP = isMobile ? 220 : 520;
    const ppx   = new Float32Array(NP);
    const ppy   = new Float32Array(NP);
    const pvx   = new Float32Array(NP);
    const pvy   = new Float32Array(NP);
    const plife = new Float32Array(NP);
    const pmaxl = new Float32Array(NP);
    const psz   = new Float32Array(NP);
    const pbr   = new Float32Array(NP);
    const pzone = new Uint8Array(NP);

    function spawn(i: number) {
      const z = Math.random();
      let r: number;
      let spd: number;

      if (z < 0.18) {
        pzone[i] = 0;
        r = Math.random() * 38 * scale;
        spd = 0.05;
        pmaxl[i] = 260 + Math.random() * 180;
        psz[i]   = 0.5  + Math.random() * 1.0;
        pbr[i]   = 0.55 + Math.random() * 0.38;
      } else if (z < 0.55) {
        pzone[i] = 1;
        r = (40 + Math.random() * 120) * scale;
        spd = 0.09;
        pmaxl[i] = 340 + Math.random() * 220;
        psz[i]   = 0.28 + Math.random() * 0.7;
        pbr[i]   = 0.18 + Math.random() * 0.42;
      } else if (z < 0.82) {
        pzone[i] = 2;
        r = (90 + Math.random() * 130) * scale;
        spd = 0.065;
        pmaxl[i] = 260 + Math.random() * 180;
        psz[i]   = 0.18 + Math.random() * 0.48;
        pbr[i]   = 0.07 + Math.random() * 0.25;
      } else {
        pzone[i] = 3;
        r = (160 + Math.random() * 170) * scale;
        spd = 0.03;
        pmaxl[i] = 360 + Math.random() * 280;
        psz[i]   = 0.14 + Math.random() * 0.35;
        pbr[i]   = 0.04 + Math.random() * 0.14;
      }

      const ang = Math.random() * Math.PI * 2;
      ppx[i]   = HX + Math.cos(ang) * r;
      ppy[i]   = HY + Math.sin(ang) * r;
      pvx[i]   = Math.cos(ang) * spd * 0.4 + (Math.random() - 0.5) * spd * 0.6;
      pvy[i]   = Math.sin(ang) * spd * 0.4 + (Math.random() - 0.5) * spd * 0.6;
      plife[i] = Math.random() * pmaxl[i];
    }

    for (let i = 0; i < NP; i++) spawn(i);

    // breath amplitude 0.24 → 0.38, base multiplier 0.82 → 0.75
    function amoebaR(ang: number, am: Amoeba, breath: number, rot: number) {
      const r = am.baseR * scale * (0.55 + breath * 0.38);
      let d = 0;
      for (const l of LOBES) {
        d +=
          am.lobeAmp *
          am.baseR *
          scale *
          l.amp *
          0.12 *
          Math.sin(l.freq * (ang + rot) + l.phase + t * am.rotSpd * 40);
      }
      return r + d;
    }

    function drawAmoeba(am: Amoeba) {
      const breath = (Math.sin(t * am.breathSpd + am.breathPhase) + 1) * 0.5;
      const rot = t * am.rotSpd;
      const cx0 = HX + am.ox * scale;
      const cy0 = HY + am.oy * scale;
      const STEPS = 120;

      for (const lay of GLOW_LAYERS) {
        ct.beginPath();
        for (let i = 0; i <= STEPS; i++) {
          const ang = (i / STEPS) * Math.PI * 2;
          const r = amoebaR(ang, am, breath, rot) * lay.scale;
          const x = cx0 + Math.cos(ang) * r;
          const y = cy0 + Math.sin(ang) * r;
          if (i === 0) ct.moveTo(x, y);
          else ct.lineTo(x, y);
        }
        ct.closePath();

        const maxR = am.baseR * scale * (0.75 + breath * 0.38) * lay.scale * 1.1;
        const g = ct.createRadialGradient(cx0, cy0, 0, cx0, cy0, maxR);
        const a = (am.alpha * lay.alphaM) / 0.16 * (0.45 + breath * 0.25);
        g.addColorStop(0,    `rgba(95,48,22,${a * 0.42})`);
        g.addColorStop(0.42, `rgba(70,32,14,${a * 0.28})`);
        g.addColorStop(0.78, `rgba(42,18,8,${a * 0.12})`);
        g.addColorStop(1,    "rgba(0,0,0,0)");
        ct.fillStyle = g;
        ct.fill();
        // subtle warm golden core, keeps the center alive without creating a large white halo
if (lay.scale < 1.1) {
  const coreR = am.baseR * scale * 1.1;
  const core = ct.createRadialGradient(cx0, cy0, 0, cx0, cy0, coreR);

  const coreAlpha = am.alpha * 0.035 * (0.55 + breath * 0.35);

  core.addColorStop(0, `rgba(205,145,72,${coreAlpha})`);
  core.addColorStop(0.35, `rgba(165,92,38,${coreAlpha * 0.45})`);
  core.addColorStop(1, "rgba(0,0,0,0)");

  ct.fillStyle = core;
  ct.beginPath();
  ct.arc(cx0, cy0, coreR, 0, Math.PI * 2);
  ct.fill();
}
      }
    }

    // getFlow unchanged from reference HTML
    function getFlow(x: number, y: number, nt: number) {
      const dx = x - HX;
      const dy = y - HY;
      const r = Math.sqrt(dx * dx + dy * dy) + 1;
      const ang = Math.atan2(dy, dx);
      const curlX = -Math.sin(ang) * 0.0004 * r * 0.012;
      const curlY =  Math.cos(ang) * 0.0004 * r * 0.012;
      const sc = 0.005;
      const nx = (fbm(x * sc + nt * 0.4, y * sc,                  3) - 0.5) * 0.9;
      const ny = (fbm(x * sc,             y * sc + nt * 0.35 + 20, 3) - 0.5) * 0.9;
      const os = Math.max(0, 1 - r / (220 * scale)) * 0.02;
      return {
        vx: curlX + nx * 0.28 + (dx / r) * os,
        vy: curlY + ny * 0.28 + (dy / r) * os,
      };
    }

    function drawFrame() {
      // Trail fade — rgb matches page background oklch(0.16 0.012 50) ≈rgb(42, 26, 18)
      // fx canvas is transparent underneath, so trails fade toward the page color
      ct.fillStyle = "rgba(28,14,6,0.14)";
ct.fillRect(0, 0, W, H);

      // breath signals (unchanged from reference HTML)
      const breath  = (Math.sin(t * 0.0068)       + 1) * 0.5;
      const breath2 = (Math.sin(t * 0.0038 + 1.4) + 1) * 0.5;
      const bc = breath * 0.72 + breath2 * 0.28;
      const nt = t * 0.0008;

      // ---- particles (unchanged) ----
      ct.save();
      ct.globalCompositeOperation = "screen";
      for (let i = 0; i < NP; i++) {
        plife[i]++;
        if (plife[i] > pmaxl[i]) { spawn(i); continue; }

        const lp  = plife[i] / pmaxl[i];
        const env = (lp < 0.08 ? lp / 0.08 : 1) * (lp > 0.75 ? (1 - lp) / 0.25 : 1);
        const fl  = getFlow(ppx[i], ppy[i], nt);
        const bp  = 0.85 + bc * 0.15;
        pvx[i] = pvx[i] * 0.96 + fl.vx * bp;
        pvy[i] = pvy[i] * 0.96 + fl.vy * bp;
        ppx[i] += pvx[i];
        ppy[i] += pvy[i];

        if (ppx[i] < -60 || ppx[i] > W + 60 || ppy[i] < -60 || ppy[i] > H + 60) {
          spawn(i);
          continue;
        }

        const al = env * pbr[i] * (0.5 + bc * 0.4);
        if (al < 0.007) continue;

        const sz = psz[i] * (0.6 + lp * 0.5);
        let r: number;
        let g: number;
        let b: number;
        if      (pzone[i] === 0) { r = 210; g = 165; b = 85; }
else if (pzone[i] === 1) { r = 185; g = 140; b = 65; }
else if (pzone[i] === 2) { r = 155; g = 115; b = 50; }
else                     { r = 125; g = 90;  b = 38; }

        if (sz > 0.65) {
          const gd = ct.createRadialGradient(ppx[i], ppy[i], 0, ppx[i], ppy[i], sz * 3.0);
          gd.addColorStop(0,   `rgba(${r},${g},${b},${al})`);
          gd.addColorStop(0.5, `rgba(${r},${g},${b},${al * 0.2})`);
          gd.addColorStop(1,   "rgba(0,0,0,0)");
          ct.fillStyle = gd;
          ct.beginPath();
          ct.arc(ppx[i], ppy[i], sz * 3.0, 0, Math.PI * 2);
          ct.fill();
        }

        ct.fillStyle = `rgba(${r},${g},${b},${Math.min(al * 1.2, 0.92)})`;
        ct.beginPath();
        ct.arc(ppx[i], ppy[i], sz * 0.5, 0, Math.PI * 2);
        ct.fill();
      }
      ct.restore();

      // ---- 6 amoebas ----
      ct.save();
ct.globalCompositeOperation = "screen";
ct.globalAlpha = 0.32;
for (const am of AMOEBAS) drawAmoeba(am);
ct.restore();

      // soft breathing glow — no obvious circular ring
ct.save();
ct.globalCompositeOperation = "screen";

const veilR = (170 + bc * 42) * scale;
const veil = ct.createRadialGradient(HX, HY, 0, HX, HY, veilR);

veil.addColorStop(0,    `rgba(210,170,105,${0.012 + bc * 0.012})`);
veil.addColorStop(0.38, `rgba(150,105,62,${0.01 + bc * 0.01})`);
veil.addColorStop(0.72, `rgba(90,62,38,${0.006 + bc * 0.006})`);
veil.addColorStop(1,    "rgba(0,0,0,0)");

ct.fillStyle = veil;
ct.fillRect(0, 0, W, H);
ct.restore();

      // 压四边融入背景
      const edge = ct.createRadialGradient(HX, HY, 0, HX, HY, Math.max(W, H) * 0.68);
edge.addColorStop(0,   "rgba(0,0,0,0)");
edge.addColorStop(0.5, "rgba(0,0,0,0)");
edge.addColorStop(1,   "rgba(22,10,4,0.96)");
ct.fillStyle = edge;
ct.fillRect(0, 0, W, H);
    }

    resize();
    window.addEventListener("resize", resize);

    if (reducedMotion) {
      drawFrame();
      return () => {
        window.removeEventListener("resize", resize);
      };
    }

    const tick = () => {
      drawFrame();
      t++;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isMobile]);

  return (
    <>
      {/* bgCanvas-base: transparent, z-0 — only lets page background show through */}
      <canvas
        ref={baseRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-0 h-screen w-screen"
        style={{ background: "transparent" }}
      />
      {/* bgCanvas-fx: all drawing, z-1 — trail fillRect + particles + amoebas */}
      <canvas
        ref={fxRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[1] h-screen w-screen"
      />
    </>
  );
}
