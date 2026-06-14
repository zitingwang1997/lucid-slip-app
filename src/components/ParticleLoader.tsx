/**
 * ParticleLoader.tsx — 签 App
 *
 * 时序：
 *   stream  2.5s  粒子从四周流入聚核
 *   grow    2.0s  小球涨大 + 呼吸开始
 *   breathe ≥4s   呼吸球体，等待数据
 *   expand  2.2s  球体带呼吸感膨胀 → 光晕填满整屏 → onBurstComplete
 */

import { useEffect, useRef, useCallback, useState } from "react";

// ── 调节 ──────────────────────────────────────────────────────────────────────
const COUNT         = 400;
const R_SMALL       = 18;
const R_BIG         = 148;
const STREAM_DUR    = 2500;
const GROW_DUR      = 2000;
const MIN_BREATHE   = 4000;   // 至少呼吸这么久（~2次）再允许扩散
const EXPAND_DUR    = 2200;   // 扩散到全屏时长
const BREATHE_RATE  = 0.40;   // 呼吸速度，越小越慢
const BG            = "#1c1510";

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useParticleLoader() {
  const burstRef = useRef<(() => void) | null>(null);

  const triggerBurst = useCallback(() => {
    burstRef.current?.();
  }, []);

  const LoaderComponent = useCallback(
    ({ onBurstComplete }: { onBurstComplete?: () => void }) => (
      <ParticleLoader burstRef={burstRef} onBurstComplete={onBurstComplete} />
    ),
    []
  );

  return { LoaderComponent, triggerBurst };
}

// ── Types ────────────────────────────────────────────────────────────────────
interface Particle {
  i: number;
  sx: number; sy: number;
  nucX: number; nucY: number; nucZ: number;
  x: number; y: number; tz: number;
  bendAmt: number;
  delay: number; speed: number; size: number;
  r: number; g: number; b: number;
  opacity: number;
  breathFreq: number; breathAmp: number; breathPhase: number;
  glowFreq: number; glowPhase: number; glowAmp: number;
  trail: { x: number; y: number }[];
  trailMax: number;
}

// ── Math ─────────────────────────────────────────────────────────────────────
const eio      = (t: number) => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
const eout     = (t: number) => 1 - Math.pow(1-t, 3);
const eout2    = (t: number) => 1 - (1-t)*(1-t);
const eoutSoft = (t: number) => Math.sin(t * Math.PI * .5);

const WARM: [number,number,number][] = [
  [255,242,205],[250,230,182],[253,238,195],[246,222,168],
  [255,248,215],[241,217,160],[252,235,178],[244,224,158],
  [248,228,172],[255,240,190],
];

function fibTarget(i: number, total: number, R: number) {
  const phi   = Math.acos(1 - 2*(i+.5)/total);
  const theta = Math.PI*(3 - Math.sqrt(5)) * i;
  const x3 = R*Math.sin(phi)*Math.cos(theta);
  const y3 = R*Math.sin(phi)*Math.sin(theta);
  const z3 = R*Math.cos(phi);
  const fov = 440, s = fov / (fov + z3*.38);
  return { x: x3*s, y: y3*s*.93, z: z3/R };
}

function randomEdge(W: number, H: number) {
  const pad = 18, side = Math.floor(Math.random()*4);
  if (side === 0) return { x: Math.random()*W, y: -pad };
  if (side === 1) return { x: W+pad, y: Math.random()*H };
  if (side === 2) return { x: Math.random()*W, y: H+pad };
  return { x: -pad, y: Math.random()*H };
}

function flowPos(p: Particle, t: number) {
  const te  = eio(t);
  const px  = -(p.nucY - p.sy), py = p.nucX - p.sx;
  const len = Math.sqrt(px*px + py*py) || 1;
  const mx  = (p.sx+p.nucX)*.5, my = (p.sy+p.nucY)*.5;
  const b   = p.bendAmt*(1-te), u = 1-te;
  return {
    x: u*u*p.sx + 2*u*te*(mx+px/len*b) + te*te*p.nucX,
    y: u*u*p.sy + 2*u*te*(my+py/len*b) + te*te*p.nucY,
  };
}

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
  burstRef: React.MutableRefObject<(() => void) | null>;
  onBurstComplete?: () => void;
}

function ParticleLoader({ burstRef, onBurstComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  const s = useRef({
    phase:        0 as 0|1|2|3,   // 0=stream 1=grow 2=breathe 3=expand
    phaseStart:   Date.now(),
    breatheStart: 0,
    burstPending: false,
    burstReady:   false,
    breatheT:     0,
    lastTime:     Date.now(),
    particles:    [] as Particle[],
    W: 0, H: 0, CX: 0, CY: 0,
    expandStart:  0,
    doneFired:    false,
  });

  useEffect(() => {
    burstRef.current = () => {
      const c = s.current;
      if (c.phase === 2 && c.burstReady) {
        c.phase = 3;
        c.expandStart = Date.now();
      } else {
        c.burstPending = true;
      }
    };
    return () => { burstRef.current = null; };
  }, [burstRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    const W = canvas.offsetWidth  || 390;
    const H = canvas.offsetHeight || 844;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    Object.assign(s.current, { W, H, CX: W/2, CY: H/2 });

    const off = document.createElement("canvas");
    off.width = canvas.width; off.height = canvas.height;
    const octx = off.getContext("2d")!;
    octx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const { CX, CY } = s.current;
    // max radius needed to fill screen corner-to-corner
    const MAX_R = Math.sqrt(W*W + H*H) * 0.62;

    s.current.particles = Array.from({ length: COUNT }, (_, i) => {
      const edge = randomEdge(W, H);
      const sign = Math.sin(i*1.618) > 0 ? 1 : -1;
      const [r, g, b] = WARM[i % WARM.length];
      const nuc = fibTarget(i, COUNT, R_SMALL);
      return {
        i, sx: edge.x, sy: edge.y,
        nucX: CX+nuc.x, nucY: CY+nuc.y, nucZ: nuc.z,
        x: edge.x, y: edge.y, tz: 0,
        bendAmt: sign*(30 + Math.random()*75),
        delay:   Math.random()*.48,
        speed:   .64 + Math.random()*.36,
        size:    1.4  + Math.random()*2.0,
        r, g, b, opacity: 0,
        breathFreq:  .36  + Math.random()*.9,
        breathAmp:   .04  + Math.random()*.13,
        breathPhase: Math.random()*Math.PI*2,
        glowFreq:    .26  + Math.random()*.74,
        glowPhase:   Math.random()*Math.PI*2,
        glowAmp:     .3   + Math.random()*.7,
        trail: [], trailMax: 8 + Math.floor(Math.random()*8),
      } as Particle;
    });

    function frame() {
      const c   = s.current;
      const now = Date.now();
      const dt  = Math.min((now - c.lastTime) / 1000, 0.05); // cap防止卡帧时breatheT跳跃
      c.lastTime  = now;
      c.breatheT += dt * BREATHE_RATE;

      const elapsed = now - c.phaseStart;

      // phase transitions
      if (c.phase === 0 && elapsed >= STREAM_DUR) {
        c.phase = 1; c.phaseStart = now;
      } else if (c.phase === 1 && elapsed >= GROW_DUR) {
        c.phase = 2; c.phaseStart = now;
        c.breatheStart = now;
      }
      if (c.phase === 2) {
        if (now - c.breatheStart >= MIN_BREATHE) {
          c.burstReady = true;
          if (c.burstPending) {
            c.burstPending = false;
            c.phase = 3;
            c.expandStart = now;
          }
        }
      }

      const phaseT =
        c.phase === 0 ? Math.min(elapsed / STREAM_DUR, 1) :
        c.phase === 1 ? Math.min(elapsed / GROW_DUR,   1) :
        c.phase === 3 ? Math.min((now - c.expandStart) / EXPAND_DUR, 1) :
        0;

      // expand: sphere radius grows from R_BIG → MAX_R with breathing modulation
      const expandT = c.phase === 3 ? eout(phaseT) : 0;
      const breatheSin = Math.sin(c.breatheT * Math.PI * 2 * 0.55); // slow master breath
      const expandBreath = c.phase === 3
        ? 1 + breatheSin * 0.04 * (1 - expandT)   // breath fades as it expands
        : 1;

      const curR =
        c.phase === 0 ? R_SMALL :
        c.phase === 1 ? (R_SMALL + (R_BIG - R_SMALL) * eout(phaseT)) :
        c.phase === 3 ? (R_BIG + (MAX_R - R_BIG) * expandT) * expandBreath :
        R_BIG;

      // fire callback when expand finishes
      if (c.phase === 3 && phaseT >= 1 && !c.doneFired) {
        c.doneFired = true;
        onBurstComplete?.();
      }

      // ── clear ──
      const fadeA = c.phase === 0 ? .08 : .78;
      octx.fillStyle = `rgba(28,21,16,${fadeA})`;
      octx.fillRect(0, 0, c.W, c.H);
      ctx.clearRect(0, 0, c.W, c.H);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, c.W, c.H);

      // ── ambient / expand glow ──
      const mb = breatheSin * .055;
      if (c.phase === 3) {
        // expanding warm fill — grows to cover screen
        const glowR = curR * 1.15;
        const ga = ctx.createRadialGradient(c.CX, c.CY, 0, c.CX, c.CY, glowR);
        const brightness = eoutSoft(expandT);
        ga.addColorStop(0,    `rgba(220,185,100,${Math.min(.55 + brightness*.7, 1)})`);
        ga.addColorStop(.25,  `rgba(175,130,50,${Math.min(.35 + brightness*.5, 1)})`);
        ga.addColorStop(.55,  `rgba(110,72,18,${Math.min(.18 + brightness*.3, 1)})`);
        ga.addColorStop(.82,  `rgba(50,28,6,${.08 + brightness*.15})`);
        ga.addColorStop(1,    "rgba(28,21,16,0)");
        ctx.fillStyle = ga;
        ctx.beginPath(); ctx.arc(c.CX, c.CY, glowR, 0, Math.PI*2); ctx.fill();
      } else {
        const ambA =
          c.phase === 0 ? eout(phaseT)*.15 :
          c.phase === 1 ? eout(phaseT)*.28+.08 :
          .38 + mb*.08;
        const ambR = curR*2.1 + mb*20;
        const ag = ctx.createRadialGradient(c.CX, c.CY, 0, c.CX, c.CY, ambR);
        ag.addColorStop(0,   `rgba(145,95,28,${ambA*.32})`);
        ag.addColorStop(.38, `rgba(88,54,12,${ambA*.14})`);
        ag.addColorStop(.74, `rgba(44,24,5,${ambA*.055})`);
        ag.addColorStop(1,   "rgba(0,0,0,0)");
        ctx.fillStyle = ag;
        ctx.beginPath(); ctx.arc(c.CX, c.CY, ambR, 0, Math.PI*2); ctx.fill();
      }

      // ── update particles ──
      c.particles.forEach(p => {
        let nx = p.x, ny = p.y, op = p.opacity;
        let doTrail = false;

        if (c.phase === 0) {
          doTrail = true;
          const raw = Math.max(0,(phaseT - p.delay*.5))/(1 - p.delay*.5 + .001);
          const ft  = eio(Math.min(raw*p.speed, 1));
          const pos = flowPos(p, ft);
          nx = pos.x; ny = pos.y;
          p.tz = p.nucZ * ft;
          op   = eout2(Math.min(ft*3, .94));

        } else if (c.phase === 1) {
          const growT     = eio(phaseT);
          const earlyBrth = Math.sin(c.breatheT*p.breathFreq*Math.PI*2+p.breathPhase)*p.breathAmp*eout2(phaseT);
          const liveR     = (R_SMALL + (R_BIG-R_SMALL)*growT)*(1+earlyBrth);
          const raw       = fibTarget(p.i, COUNT, liveR);
          nx = c.CX+raw.x; ny = c.CY+raw.y; p.tz = raw.z;
          // 平滑趋近目标opacity，避免切相位时跳变
          const targetOp1 = .38 + eout2(growT) * .34;
          op = p.opacity + (targetOp1 - p.opacity) * Math.min(dt * 4, 1);
          p.trail = [];

        } else if (c.phase === 2) {
          const pb  = Math.sin(c.breatheT*p.breathFreq*Math.PI*2+p.breathPhase);
          const raw = fibTarget(p.i, COUNT, R_BIG*(1+pb*p.breathAmp));
          nx = c.CX+raw.x; ny = c.CY+raw.y; p.tz = raw.z;
          // 平滑趋近breathe目标opacity，消除grow→breathe切换时的跳变
          const targetOp2 = .38 + Math.max(0, pb) * .34;
          op = p.opacity + (targetOp2 - p.opacity) * Math.min(dt * 3, 1);
          p.trail = [];

        } else {
          // expand: particles ride the sphere surface outward
          const pb  = Math.sin(c.breatheT*p.breathFreq*Math.PI*2+p.breathPhase);
          const rideR = curR * (1 + pb*p.breathAmp*(1-expandT)*.5);
          const raw = fibTarget(p.i, COUNT, rideR);
          nx = c.CX+raw.x; ny = c.CY+raw.y; p.tz = raw.z;
          // fade opacity as they spread out — disappear into the light
          op = Math.max(0, (.72 + pb*.18) * (1 - eout2(expandT)));
          p.trail = [];
        }

        if (doTrail) {
          p.trail.push({ x: nx, y: ny });
          if (p.trail.length > p.trailMax) p.trail.shift();
        }
        p.x = nx; p.y = ny; p.opacity = Math.min(op, 1);
      });

      // ── trails (stream only) ──
      if (c.phase === 0) {
        c.particles.forEach(p => {
          if (p.opacity < .01 || p.trail.length < 2) return;
          const depth = .44 + ((p.tz||0)+1)/2*.56;
          const { r, g, b } = p;
          const tl = p.trail.length;
          for (let i = 1; i < tl; i++) {
            const frac = i/(tl-1);
            const a = p.opacity * Math.pow(frac, 2.2) * .44 * depth;
            if (a < .006) continue;
            octx.beginPath();
            octx.moveTo(p.trail[i-1].x, p.trail[i-1].y);
            octx.lineTo(p.trail[i].x,   p.trail[i].y);
            octx.strokeStyle = `rgba(${r},${g},${b},${a})`;
            octx.lineWidth   = p.size * frac * .68 * depth;
            octx.lineCap     = "round";
            octx.stroke();
          }
        });
        ctx.drawImage(off, 0, 0, c.W, c.H);
      }

      // ── inner volume glow ──
      if (c.phase <= 2) {
        const sp = c.phase === 0 ? eout(phaseT)*.8
                 : c.phase === 1 ? .8+eout(phaseT)*.2
                 : .99;
        const vp = Math.sin(c.breatheT * 1.9) * .05;
        const br = curR*(1+vp*.3);
        const ig = ctx.createRadialGradient(c.CX-br*.14, c.CY-br*.09, 0, c.CX, c.CY, br*.82);
        ig.addColorStop(0,   `rgba(215,178,90,${Math.min(sp*(.13+vp),1)})`);
        ig.addColorStop(.3,  `rgba(155,112,34,${sp*(.05+vp*.3)})`);
        ig.addColorStop(.72, `rgba(75,46,8,${sp*.018})`);
        ig.addColorStop(1,   "rgba(0,0,0,0)");
        ctx.fillStyle = ig;
        ctx.beginPath(); ctx.arc(c.CX, c.CY, br*.82, 0, Math.PI*2); ctx.fill();
      }

      // ── particle cores (z-sorted) ──
      [...c.particles]
        .sort((a, b) => (a.tz||0) - (b.tz||0))
        .forEach(p => {
          if (p.opacity < .015) return;
          const depth = .44 + ((p.tz||0)+1)/2*.64;
          const { r, g, b } = p;
          const pb = c.phase >= 1
            ? Math.sin(c.breatheT*p.breathFreq*Math.PI*2+p.breathPhase) : 0;
          const gp = c.phase >= 1
            ? 1 + Math.sin(c.breatheT*p.glowFreq*Math.PI*2+p.glowPhase)*p.glowAmp : 1;
          const sz  = p.size*depth*(1+pb*.07);
          const gMu = c.phase === 0 ? 6.5 : c.phase === 1 ? 6.5+eout(phaseT)*4 : 11;
          const gR  = sz*gMu*gp*Math.min(depth,1.5);

          const bG = c.phase === 0 ? .3 : c.phase === 1 ? .28+eout(phaseT)*.1 : .26+pb*.09;
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gR);
          grd.addColorStop(0,   `rgba(${r},${g},${b},${Math.min(p.opacity*bG*gp*.88,1)})`);
          grd.addColorStop(.28, `rgba(${r},${Math.round(g*.8)},${Math.round(b*.3)},${p.opacity*.06})`);
          grd.addColorStop(.65, `rgba(${Math.round(r*.48)},${Math.round(g*.34)},0,${p.opacity*.018})`);
          grd.addColorStop(1,   "rgba(0,0,0,0)");
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(p.x, p.y, gR, 0, Math.PI*2); ctx.fill();

          const cSz = sz*.72;
          ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(p.opacity*(.56+gp*.1),1)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, cSz, 0, Math.PI*2); ctx.fill();

          if (depth > 1.06 && p.opacity > .42) {
            ctx.fillStyle = `rgba(255,252,230,${p.opacity*(depth-1)*(.72+gp*.1)*.5})`;
            ctx.beginPath(); ctx.arc(p.x-cSz*.18, p.y-cSz*.18, cSz*.33, 0, Math.PI*2); ctx.fill();
          }
        });

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onBurstComplete]);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: BG,
      zIndex: 999,
    }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}

export default ParticleLoader;
