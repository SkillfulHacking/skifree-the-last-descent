/**
 * 3D gradient noise for sculpting meshes (cliff faces, islands, basalt). Deterministic (integer
 * hash, no Math.random), allocation-free. Values roughly in [-1, 1].
 */
function h3(x: number, y: number, z: number, s: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x1b873593) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
// 12 cube-edge gradients
const GX = [1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0];
const GY = [1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1];
const GZ = [0, 0, 0, 0, 1, 1, -1, -1, 1, 1, -1, -1];
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
function grad(ix: number, iy: number, iz: number, s: number, dx: number, dy: number, dz: number): number {
  const g = h3(ix, iy, iz, s) % 12;
  return GX[g]! * dx + GY[g]! * dy + GZ[g]! * dz;
}

export function noise3(x: number, y: number, z: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const a = grad(xi, yi, zi, s, xf, yf, zf);
  const b = grad(xi + 1, yi, zi, s, xf - 1, yf, zf);
  const c = grad(xi, yi + 1, zi, s, xf, yf - 1, zf);
  const d = grad(xi + 1, yi + 1, zi, s, xf - 1, yf - 1, zf);
  const e = grad(xi, yi, zi + 1, s, xf, yf, zf - 1);
  const f = grad(xi + 1, yi, zi + 1, s, xf - 1, yf, zf - 1);
  const g = grad(xi, yi + 1, zi + 1, s, xf, yf - 1, zf - 1);
  const k = grad(xi + 1, yi + 1, zi + 1, s, xf - 1, yf - 1, zf - 1);
  const x1 = a + u * (b - a), x2 = c + u * (d - c), x3 = e + u * (f - e), x4 = g + u * (k - g);
  const y1 = x1 + v * (x2 - x1), y2 = x3 + v * (x4 - x3);
  return y1 + w * (y2 - y1);
}

export function fbm3(x: number, y: number, z: number, s: number, oct: number, gain = 0.5): number {
  let a = 1, f = 1, sum = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * noise3(x * f, y * f, z * f, s + i * 131);
    n += a;
    a *= gain;
    f *= 2.03;
  }
  return sum / n;
}

/** ridged 3D: sharp crests (rock ribs) in ~[0, 1] */
export function ridged3(x: number, y: number, z: number, s: number, oct: number): number {
  let a = 0.5, f = 1, sum = 0, prev = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(noise3(x * f, y * f, z * f, s + i * 977));
    n *= n;
    sum += n * a * prev;
    prev = n;
    a *= 0.5;
    f *= 2.03;
  }
  return sum;
}

/**
 * "Blocky" rock noise: noise quantised into terraces with soft risers, so faces break into ledges
 * and steps (jointed rock) instead of the smooth blobs plain noise gives.
 */
export function terraced(v: number, steps: number, soft: number): number {
  const q = v * steps;
  const i = Math.floor(q);
  const f = q - i;
  const t = Math.min(1, Math.max(0, (f - (1 - soft)) / soft));
  return (i + t * t * (3 - 2 * t)) / steps;
}

export const smoothstep = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
