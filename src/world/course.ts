/**
 * The mountain: a deterministic heightfield plus the course layout (route, jumps, cave, finish).
 * Pure functions only — shared by rendering, physics, AI and tests.
 *
 * Convention: +Y up, the course descends toward +Z. Course progress is measured by Z,
 * which is monotonic along the route, so it is a reliable phase metric.
 */
import { clamp, fbm, gnoise, ridged, smoothstep, Rng } from '../core/rng';
import type { SurfaceType } from '../core/types';
import { CAVE_D, caveTerrainHeight, CAVE_INFLUENCE_Z, type CaveAnchor } from './caveTerrain';

export const COURSE = {
  startZ: 0,
  finishZ: 3000,
  /** Yeti cave (cliff on the +X side of the route). */
  caveZ: 1350,
  /** Progress at which the cave cinematic fires (just past the cave so the Yeti emerges behind). */
  caveTriggerZ: 1372,
  /** Foreshadowing begins (footprints, broken branches, sign, growls). */
  foreshadowZ: 820,
  /** Tutorial region. */
  tutorialEndZ: 330,
  resortEndZ: 3260,
} as const;

/** Slope profile (degrees) keyed by z. Linear interpolation of slope → C1-continuous height. */
const SLOPE_KEYS: ReadonlyArray<readonly [number, number]> = [
  [-400, 2],
  [-60, 3],
  [0, 6],
  [60, 10],
  [240, 11],
  [300, 18],
  [640, 17],
  [700, 22],
  [980, 21],
  [1060, 14],
  [1250, 13],
  [1300, 8],
  [1365, 9],
  [1405, 18],
  [1470, 19],
  [1900, 20],
  [1990, 26],
  [2280, 25],
  [2330, 17],
  [2680, 16],
  [2740, 14],
  [2930, 12],
  [2990, 6],
  [3060, 1.2],
  [3400, 0.6],
  [6000, 0.4],
];

/** Piste half-width keyed by z. */
const WIDTH_KEYS: ReadonlyArray<readonly [number, number]> = [
  [-400, 70],
  [0, 62],
  [300, 55],
  [700, 48],
  [1000, 44],
  [1250, 52],
  [1450, 46],
  [1950, 34],
  [2020, 22],
  [2260, 22],
  [2340, 40],
  [2700, 52],
  [2950, 70],
  [3100, 110],
  [6000, 140],
];

function interpKeys(keys: ReadonlyArray<readonly [number, number]>, z: number): number {
  const first = keys[0]!;
  if (z <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i]!;
    if (z <= k1[0]) {
      const k0 = keys[i - 1]!;
      const t = (z - k0[0]) / (k1[0] - k0[0]);
      return k0[1] + (k1[1] - k0[1]) * t;
    }
  }
  return keys[keys.length - 1]![1];
}

// --- base height table along Z (integral of slope) -----------------------------
const TABLE_MIN = -4000;
const TABLE_MAX = 8000;
const TABLE_STEP = 1;
const baseTable = (() => {
  const n = Math.floor((TABLE_MAX - TABLE_MIN) / TABLE_STEP) + 1;
  const t = new Float64Array(n);
  // integrate from z=0 (height 0) in both directions
  const i0 = Math.round((0 - TABLE_MIN) / TABLE_STEP);
  t[i0] = 0;
  for (let i = i0 + 1; i < n; i++) {
    const z = TABLE_MIN + (i - 0.5) * TABLE_STEP;
    t[i] = t[i - 1]! - Math.tan((interpKeys(SLOPE_KEYS, z) * Math.PI) / 180) * TABLE_STEP;
  }
  for (let i = i0 - 1; i >= 0; i--) {
    const z = TABLE_MIN + (i + 0.5) * TABLE_STEP;
    t[i] = t[i + 1]! + Math.tan((interpKeys(SLOPE_KEYS, z) * Math.PI) / 180) * TABLE_STEP;
  }
  return t;
})();

export function baseHeight(z: number): number {
  const f = (clamp(z, TABLE_MIN, TABLE_MAX - 1) - TABLE_MIN) / TABLE_STEP;
  const i = Math.floor(f);
  const a = baseTable[i]!;
  const b = baseTable[Math.min(i + 1, baseTable.length - 1)]!;
  return a + (b - a) * (f - i);
}

export function slopeDegAt(z: number): number {
  return interpKeys(SLOPE_KEYS, z);
}

export function halfWidth(z: number): number {
  return interpKeys(WIDTH_KEYS, z);
}

/** Route centreline X. Straight at the start and through the resort. */
export function centerX(z: number): number {
  const fadeIn = smoothstep(-40, 260, z);
  // straight, centred run-in to the finish chute (which starts ~70 m above the line)
  const fadeOut = 1 - smoothstep(2660, 2880, z);
  const m = fadeIn * fadeOut;
  return m * (95 * Math.sin(z / 410 + 0.6) + 42 * Math.sin(z / 173 + 2.1) + 14 * Math.sin(z / 71));
}

/** The intended, guaranteed-clear primary line through the obstacles. */
export function routeX(z: number): number {
  const w = halfWidth(z);
  const m = smoothstep(80, 300, z) * (1 - smoothstep(2720, 2870, z));
  return centerX(z) + m * w * 0.3 * Math.sin(z / 133 + 1.3);
}

// --- jumps / features -----------------------------------------------------------
export interface Kicker {
  z: number; // lip position
  d: number; // lateral offset from centreline
  width: number;
  height: number;
  run: number; // approach length
}

export interface CliffBand {
  z: number; // drop edge
  dMin: number;
  dMax: number;
  drop: number;
}

export const SEED_DEFAULT = 20261106;

export interface CourseFeatures {
  kickers: Kicker[];
  cliffs: CliffBand[];
}

export function generateFeatures(seed: number): CourseFeatures {
  const rng = new Rng(seed ^ 0x51f15e);
  const kickers: Kicker[] = [];
  // a gentle tutorial kicker on the route
  kickers.push({ z: 285, d: routeX(285) - centerX(285), width: 9, height: 1.1, run: 12 });
  const zones: Array<[number, number, number]> = [
    // [zStart, zEnd, count]
    [420, 960, 4],
    [1080, 1240, 1],
    [1500, 1960, 4],
    [2350, 2800, 4],
  ];
  for (const [a, b, count] of zones) {
    const span = (b - a) / count;
    for (let i = 0; i < count; i++) {
      const z = a + span * (i + rng.range(0.25, 0.75));
      const w = halfWidth(z);
      // alternate: on the route, or an optional side kicker
      const onRoute = i % 2 === 0;
      const d = onRoute ? routeX(z) - centerX(z) : clamp(routeX(z) - centerX(z) + rng.pick([-1, 1]) * rng.range(14, 22), -w * 0.75, w * 0.75);
      kickers.push({ z, d, width: rng.range(7, 11), height: rng.range(1.2, 2.1), run: rng.range(10, 15) });
    }
  }
  // Risky/rewarding drops on the edge of the piste, always on the side away from the primary line.
  const cliffs: CliffBand[] = [];
  for (const [z, drop] of [[760, 3.5], [1760, 5.5], [2560, 4.5]] as const) {
    const w = halfWidth(z);
    const o = routeX(z) - centerX(z);
    const band = o > 0 ? { dMin: -(w - 6), dMax: o - 13 } : { dMin: o + 13, dMax: w - 6 };
    if (band.dMax - band.dMin > 8) cliffs.push({ z, drop, ...band });
  }
  return { kickers, cliffs };
}

// --- cave cliff -----------------------------------------------------------------
export { CAVE_D, CAVE_FLOOR_RAISE } from './caveTerrain';
/** The default (classic course) cave anchor. */
export function defaultCaveAnchor(): CaveAnchor {
  return { z: COURSE.caveZ, centerX: centerX(COURSE.caveZ), side: 1, d: CAVE_D };
}

// --- the heightfield ------------------------------------------------------------
export class Mountain {
  readonly seed: number;
  readonly features: CourseFeatures;
  readonly caves: CaveAnchor[];
  constructor(seed = SEED_DEFAULT) {
    this.seed = seed;
    this.features = generateFeatures(seed);
    this.caves = [defaultCaveAnchor()];
  }

  /** Terrain height at world (x, z). */
  heightAt(x: number, z: number): number {
    const s = this.seed;
    const cx = centerX(z);
    const d = x - cx;
    const w = halfWidth(z);
    const ad = Math.abs(d);
    let h = baseHeight(z);

    // summit massif behind the start
    if (z < 0) {
      const b = -z;
      h += 0.00022 * b * b + 0.18 * b;
    }

    // valley cross-section
    h += 0.0016 * d * d * (ad < w ? 1 : w / ad);
    // each side of the valley has its own character: banks set back further or closer, steeper or gentler
    const side = d >= 0 ? 1 : -1;
    const sideW = w * (1 + 0.25 * Math.sin(z / 470 + (side > 0 ? 1.7 : 4.1))) * smoothstep(-200, 0, z) + w * (1 - smoothstep(-200, 0, z));
    const e = Math.max(0, ad - Math.max(w, sideW));
    if (e > 0) {
      const steep = 0.75 + 0.5 * (0.5 + 0.5 * Math.sin(z / 610 + side * 2.3));
      const es = e * steep;
      // walls ease in from the piste (gentle banks, then steepening valley sides)
      const wall = 330 * (1 - Math.exp(-(es * es) / (2 * 230 * 230))) + 0.0025 * es * es * Math.exp(-es / 120) + 0.04 * es;
      const rough = ridged(x / 160, z / 160, s + 7, 4) * 70 * smoothstep(30, 220, e);
      h += wall + rough;
      // distant ranges
      h += 900 * smoothstep(350, 2600, e) * (0.35 + ridged(x / 900, z / 900, s + 11, 5));
    }

    // rolling large-scale undulation
    h += fbm(x / 210, z / 210, s + 1, 3) * 7;
    // mid-scale terrain variation
    h += fbm(x / 46, z / 46, s + 2, 3) * 1.4;

    // moguls: in specific zones and along piste edges
    const mogulZone = smoothstep(720, 760, z) * (1 - smoothstep(940, 980, z)) + smoothstep(2380, 2420, z) * (1 - smoothstep(2520, 2560, z));
    const edge = smoothstep(w * 0.55, w * 0.9, ad) * (1 - smoothstep(w * 1.1, w * 1.6, ad));
    const mogulAmp = 0.42 * clamp(mogulZone * (1 - smoothstep(w * 0.25, w * 0.35, Math.abs(x - routeX(z)))) + edge * 0.6, 0, 1);
    if (mogulAmp > 0.001) h += mogulAmp * gnoise(x / 4.2, z / 5.1, s + 3);

    // wind-shaped drifts (anisotropic), mostly off the groomed line
    const driftMask = smoothstep(w * 0.4, w * 1.2, ad);
    if (driftMask > 0.001) h += driftMask * 0.9 * gnoise(x / 26, z / 7.5, s + 4);

    // rollers across the piste
    h += 0.6 * Math.sin(z / 37) * smoothstep(450, 520, z) * (1 - smoothstep(640, 700, z));

    // kickers
    for (const k of this.features.kickers) {
      const u = z - k.z;
      if (u < -k.run || u > 4) continue;
      const lat = Math.abs(d - k.d);
      if (lat > k.width * 0.5 + 3) continue;
      const lm = 1 - smoothstep(k.width * 0.5, k.width * 0.5 + 3, lat);
      let p: number;
      if (u <= 0) {
        const t = (u + k.run) / k.run;
        p = t * t * (1.6 - 0.6 * t); // concave-then-steep transition, lip at u=0
      } else {
        p = 1 - smoothstep(0, 4, u);
      }
      h += k.height * p * lm;
    }

    // cliff bands: raised plateau ending in a drop
    for (const c of this.features.cliffs) {
      if (z < c.z - 90 || z > c.z + 6) continue;
      const lm = smoothstep(c.dMin - 6, c.dMin, d) * (1 - smoothstep(c.dMax, c.dMax + 6, d));
      if (lm <= 0) continue;
      const plateau = smoothstep(c.z - 80, c.z - 20, z) * (1 - smoothstep(c.z, c.z + 2.2, z));
      h += c.drop * plateau * lm;
    }

    // caves cut into cliffs (terrain cut and cave mesh share src/world/caveTerrain.ts)
    for (const c of this.caves) if (Math.abs(z - c.z) < CAVE_INFLUENCE_Z) h = caveTerrainHeight(c, x, z, d, h, s);

    // resort: flatten the run-out
    if (z > 3000) {
      const flat = smoothstep(3000, 3060, z) * (1 - smoothstep(130, 260, ad));
      const target = baseHeight(z) + 0.0016 * d * d * 0.2;
      h += (target - h) * flat * 0.85;
    }

    return h;
  }

  /** Surface normal by central differences. Writes into out [nx, ny, nz]. */
  normalAt(x: number, z: number, out: { x: number; y: number; z: number }, eps = 0.35): void {
    const hl = this.heightAt(x - eps, z);
    const hr = this.heightAt(x + eps, z);
    const hd = this.heightAt(x, z - eps);
    const hu = this.heightAt(x, z + eps);
    const nx = hl - hr;
    const nz = hd - hu;
    const ny = 2 * eps;
    const l = Math.hypot(nx, ny, nz);
    out.x = nx / l;
    out.y = ny / l;
    out.z = nz / l;
  }

  /** Surface type at a position (drives grip/drag). Must match the terrain shader's look. */
  surfaceAt(x: number, z: number): SurfaceType {
    const v = this.surfaceWeights(x, z);
    if (v.ice > 0.5) return 'ice';
    if (v.powder > 0.5) return 'powder';
    if (v.groomed > 0.5) return 'packed';
    return 'snow';
  }

  /** Continuous surface weights in 0..1 (also baked into terrain vertex attributes). */
  surfaceWeights(x: number, z: number): { ice: number; powder: number; groomed: number } {
    const s = this.seed;
    const d = x - centerX(z);
    const w = halfWidth(z);
    const ad = Math.abs(d);
    const iceNoise = fbm(x / 22, z / 30, s + 21, 2);
    const iceZone = 0.25 + 0.75 * (smoothstep(1980, 2010, z) * (1 - smoothstep(2270, 2300, z)) + smoothstep(1500, 1540, z) * (1 - smoothstep(1600, 1640, z)));
    const ice = smoothstep(0.28, 0.4, iceNoise * iceZone) * (1 - smoothstep(w * 0.8, w, ad)) * smoothstep(120, 160, z);
    const powderNoise = fbm(x / 35, z / 35, s + 22, 2);
    const powder = clamp(smoothstep(w * 0.78, w * 1.05, ad) + smoothstep(0.35, 0.5, powderNoise) * smoothstep(w * 0.45, w * 0.7, ad), 0, 1) * (1 - ice);
    const groomed = (1 - smoothstep(w * 0.3, w * 0.5, Math.abs(x - routeX(z)))) * (1 - ice) * (1 - powder);
    return { ice, powder, groomed };
  }
}
