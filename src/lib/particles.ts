/**
 * 共用粒子引擎
 *
 * 首页开场（ParticleSplashIntro）与错误页香烟（IncenseSmoke）共用同一套
 * Perlin 噪声流场与拖尾绘制，保证两处的运动质感一致。
 * 改这里会同时影响两处，改之前先确认。
 */

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

/** 二维 Perlin 噪声，返回约 [-1, 1]。相邻输入得到相邻输出，所以运动是连续有机的。 */
export function noise2(x: number, y: number) {
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

// -- 调色板（rgb 三元组字符串，方便拼进 rgba()）---------------------------------
/** 首页开场：暖金 */
export const PART_HEAD = "210, 165, 85";
export const PART_TAIL = "160, 120, 55";
/**
 * 首页背景流线的金色分档（与 InputAmoebaAura.tsx 里的 pzone 配色一致）。
 * 错误页香烟直接取这组值，颜色才和首页是同一套。
 * 顺序：最亮（近热源）→ 最暗（远处）
 */
export const AURA_GOLD: [number, number, number][] = [
  [210, 165, 85],
  [185, 140, 65],
  [155, 115, 50],
  [125, 90, 38],
];

/** 在 0..1 上插值取金色。t=0 最亮最暖，t=1 最暗最冷 */
export function goldAt(t: number): [number, number, number] {
  const x = Math.min(Math.max(t, 0), 1) * (AURA_GOLD.length - 1);
  const i = Math.min(Math.floor(x), AURA_GOLD.length - 2);
  const f = x - i;
  const a = AURA_GOLD[i];
  const b = AURA_GOLD[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/**
 * 首页背景那种「极小实心点 + 柔和光晕」的粒子画法。
 * 和 InputAmoebaAura 的渲染保持一致 —— 关键是点要小、光晕要淡，
 * 长长的流线靠画布的逐帧残留累积出来，不是靠把粒子画大。
 *
 * 调用前请把 ctx.globalCompositeOperation 设为 "screen"（不是 "lighter"，
 * 那个是纯加法叠加，光晕一重合就冲成白色）。
 */
export function drawFlowParticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
  rgb: [number, number, number],
) {
  if (alpha < 0.007) return;
  const [r, g, b] = rgb;
  if (size > 0.65) {
    const gd = ctx.createRadialGradient(x, y, 0, x, y, size * 3.0);
    gd.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    gd.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.2})`);
    gd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gd;
    ctx.beginPath();
    ctx.arc(x, y, size * 3.0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(alpha * 1.2, 0.92)})`;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

export interface TrailPoint {
  x: number;
  y: number;
}

export interface Drawable {
  x: number;
  y: number;
  size: number;
  alpha: number;
  trail: TrailPoint[];
}

/**
 * 画一个带渐隐拖尾和径向光晕的粒子。
 * 调用前请把 ctx.globalCompositeOperation 设为 "lighter"，光晕才会相互叠加。
 */
export function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: Drawable,
  alphaScale: number,
  head: string = PART_HEAD,
  tail: string = PART_TAIL,
) {
  const tLen = p.trail.length;
  if (tLen < 2) return;
  for (let i = 1; i < tLen; i++) {
    const tp = p.trail[i];
    const ratio = i / tLen;
    const a = ratio * ratio * 0.2 * p.alpha * alphaScale;
    const sz = p.size * ratio * 0.55;
    ctx.fillStyle = `rgba(${tail}, ${a})`;
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  const glowR = p.size * 3.0;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
  g.addColorStop(0, `rgba(${head}, ${0.9 * p.alpha * alphaScale})`);
  g.addColorStop(0.3, `rgba(${head}, ${0.5 * p.alpha * alphaScale})`);
  g.addColorStop(1, `rgba(${tail}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
  ctx.fill();
}

/** 用户是否开启了「减弱动态效果」。常驻动画必须尊重这个设置。 */
export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
