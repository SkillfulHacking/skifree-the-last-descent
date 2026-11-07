/** Fast deterministic 3D value noise for the cave SDF (CPU side). Output in [-1, 1]. */

function h3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x1b873593) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 2147483648 - 1;
}

export function noise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const a = h3(xi, yi, zi, seed), b = h3(xi + 1, yi, zi, seed);
  const c = h3(xi, yi + 1, zi, seed), d = h3(xi + 1, yi + 1, zi, seed);
  const e = h3(xi, yi, zi + 1, seed), f = h3(xi + 1, yi, zi + 1, seed);
  const g = h3(xi, yi + 1, zi + 1, seed), k = h3(xi + 1, yi + 1, zi + 1, seed);
  const x0 = a + (b - a) * u, x1 = c + (d - c) * u, x2 = e + (f - e) * u, x3 = g + (k - g) * u;
  const y0 = x0 + (x1 - x0) * v, y1 = x2 + (x3 - x2) * v;
  return y0 + (y1 - y0) * w;
}

/** 1D-ish value noise from an integer lattice index (strata band offsets). */
export function hash1(i: number, seed: number): number {
  return h3(i, 7, 13, seed);
}

export const smin = (a: number, b: number, k: number): number => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const smax = (a: number, b: number, k: number): number => -smin(-a, -b, k);
