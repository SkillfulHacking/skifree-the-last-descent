/**
 * Course profiles: everything about the mountain that varies along the descent (slope, width,
 * centreline swing, feature biases, valley shape, jumps, caves, checkpoints, the finish).
 *
 * Two implementations share one interface:
 *  - ClassicProfile: the original hand-authored 3 km mountain (kept for continuity and tests);
 *  - GeneratedProfile: a deterministic segment plan for any length, including Endless (segments
 *    are generated lazily, in order, from the seed — so memory is bounded by what you query).
 *
 * Every along-course quantity is a piecewise-linear KeyTrack; the base height is the analytic
 * integral of the slope track, so arbitrary distances stay exact and cheap.
 */
import { Rng, clamp, smoothstep } from '../core/rng';
import { CAVE_D, type CaveAnchor } from './caveTerrain';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------------------------
export class KeyTrack {
  readonly zs: number[] = [];
  readonly vs: number[] = [];
  private hint = 0;

  constructor(keys: ReadonlyArray<readonly [number, number]> = []) {
    for (const [z, v] of keys) this.push(z, v);
  }

  push(z: number, v: number) {
    const n = this.zs.length;
    if (n && z <= this.zs[n - 1]!) {
      // equal/backwards key: replace the last value (keeps the track monotone in z)
      if (z === this.zs[n - 1]) this.vs[n - 1] = v;
      return;
    }
    this.zs.push(z);
    this.vs.push(v);
  }

  get last(): number {
    return this.zs.length ? this.zs[this.zs.length - 1]! : -Infinity;
  }

  /** Index i such that zs[i] <= z < zs[i+1] (clamped). */
  index(z: number): number {
    const zs = this.zs;
    const n = zs.length;
    if (n < 2 || z <= zs[0]!) return 0;
    if (z >= zs[n - 1]!) return n - 2;
    let i = this.hint;
    if (i < n - 1 && zs[i]! <= z && z < zs[i + 1]!) return i;
    if (i + 1 < n - 1 && zs[i + 1]! <= z && z < zs[i + 2]!) return (this.hint = i + 1);
    let lo = 0;
    let hi = n - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (zs[mid]! <= z) lo = mid;
      else hi = mid - 1;
    }
    this.hint = lo;
    return lo;
  }

  at(z: number): number {
    const n = this.zs.length;
    if (n === 0) return 0;
    if (n === 1 || z <= this.zs[0]!) return this.vs[0]!;
    if (z >= this.zs[n - 1]!) return this.vs[n - 1]!;
    const i = this.index(z);
    const z0 = this.zs[i]!;
    const z1 = this.zs[i + 1]!;
    const t = (z - z0) / (z1 - z0);
    return this.vs[i]! + (this.vs[i + 1]! - this.vs[i]!) * t;
  }
}

/** ∫ tan(θ0 + (θ1-θ0)·t/L) dt over [0, x] (radians). */
function tanIntegral(t0: number, t1: number, L: number, x: number): number {
  const b = (t1 - t0) / L;
  if (Math.abs(b) < 1e-9) return x * Math.tan(t0);
  return (Math.log(Math.cos(t0)) - Math.log(Math.cos(t0 + b * x))) / b;
}

/** Slope track (degrees) with the analytic base height (descending toward +Z). */
export class SlopeTrack extends KeyTrack {
  // filled by push(), which may run inside super() (keys passed to the constructor), so it must
  // not be a class field with an initializer (that would reset it after super() returns)
  private declare _H: number[] | undefined;
  private get H(): number[] {
    return (this._H ??= []);
  }
  private zeroOffset = 0;

  override push(z: number, v: number) {
    const n = this.zs.length;
    super.push(z, v);
    if (this.zs.length === n) {
      // replaced last value: recompute its cumulative height
      if (n >= 2) this.H[n - 1] = this.H[n - 2]! - tanIntegral(this.vs[n - 2]! * DEG, this.vs[n - 1]! * DEG, this.zs[n - 1]! - this.zs[n - 2]!, this.zs[n - 1]! - this.zs[n - 2]!);
      return;
    }
    if (n === 0) this.H.push(0);
    else {
      const z0 = this.zs[n - 1]!;
      const L = z - z0;
      this.H.push(this.H[n - 1]! - tanIntegral(this.vs[n - 1]! * DEG, v * DEG, L, L));
    }
  }

  /** Shift heights so that base(z0) = 0. Call once after the keys spanning z0 exist. */
  anchorZero(z0: number) {
    this.zeroOffset = 0;
    this.zeroOffset = -this.base(z0);
  }

  base(z: number): number {
    const zs = this.zs;
    const n = zs.length;
    if (n === 0) return 0;
    if (z <= zs[0]!) return this.H[0]! + Math.tan(this.vs[0]! * DEG) * (zs[0]! - z) + this.zeroOffset;
    if (z >= zs[n - 1]!) return this.H[n - 1]! - Math.tan(this.vs[n - 1]! * DEG) * (z - zs[n - 1]!) + this.zeroOffset;
    const i = this.index(z);
    const z0 = zs[i]!;
    const L = zs[i + 1]! - z0;
    return this.H[i]! - tanIntegral(this.vs[i]! * DEG, this.vs[i + 1]! * DEG, L, z - z0) + this.zeroOffset;
  }
}

// ---------------------------------------------------------------------------------------------
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

export interface Encounter {
  index: number;
  /** cave mouth z */
  caveZ: number;
  /** the cinematic fires when the skier passes this z */
  triggerZ: number;
  /** foreshadowing (footprints, sign, growls) starts here */
  foreshadowZ: number;
  anchor: CaveAnchor;
  /** z at which the chase is won (finish line, or an Endless checkpoint) */
  chaseEndZ: number;
  /** Endless only: checkpoint where the run is banked */
  checkpointZ: number | null;
  /** pursuit tuning for this encounter (1 = classic) */
  speedMul: number;
}

export interface Sighting {
  /** fires when the skier passes this z */
  z: number;
  /** which side of the valley the Yeti appears on */
  side: 1 | -1;
}

export type SegmentType =
  | 'summit'
  | 'beginner'
  | 'alpine'
  | 'forest'
  | 'ridgeline'
  | 'basin'
  | 'chute'
  | 'moguls'
  | 'powder'
  | 'highspeed'
  | 'cliffside'
  | 'encounter'
  | 'checkpoint'
  | 'finish'
  | 'classic';

export const SEGMENT_NAMES: Record<SegmentType, string> = {
  summit: 'Summit',
  beginner: 'Beginner slope',
  alpine: 'Open alpine descent',
  forest: 'Forest corridor',
  ridgeline: 'Rocky ridgeline',
  basin: 'Frozen basin',
  chute: 'Technical chute',
  moguls: 'Mogul field',
  powder: 'Powder valley',
  highspeed: 'High-speed run',
  cliffside: 'Cliffside descent',
  encounter: 'Yeti territory',
  checkpoint: 'Checkpoint lodge',
  finish: 'Resort approach',
  classic: 'The Last Descent',
};

export interface CourseProfile {
  readonly kind: 'classic' | 'generated';
  /** metres from start to finish; Infinity for Endless */
  readonly length: number;
  readonly finishZ: number;
  readonly endless: boolean;
  readonly tutorialEndZ: number;
  /** generate segments up to at least z (no-op for finite/classic) */
  ensure(z: number): void;
  slopeDeg(z: number): number;
  baseHeight(z: number): number;
  halfWidth(z: number): number;
  centerX(z: number): number;
  routeX(z: number): number;
  mogulZone(z: number): number;
  rollerZone(z: number): number;
  iceZone(z: number): number;
  powderBias(z: number): number;
  /** tree density multiplier on/near the piste */
  forest(z: number): number;
  /** 0 = above the tree line (alpine), 1 = forested */
  treeLine(z: number): number;
  rockBias(z: number): number;
  /** wall setback (× half width) and steepness for the +X (side=1) and −X (side=−1) valley sides */
  sideSetback(z: number, side: 1 | -1): number;
  sideSteep(z: number, side: 1 | -1): number;
  /** 0..1 flattening of finish/checkpoint run-outs */
  flatten(z: number): number;
  kickersNear(z0: number, z1: number, out: Kicker[]): Kicker[];
  cliffsNear(z0: number, z1: number, out: CliffBand[]): CliffBand[];
  encounters(z0: number, z1: number): Encounter[];
  sightings(z0: number, z1: number): Sighting[];
  checkpoints(z0: number, z1: number): number[];
  segmentAt(z: number): SegmentType;
  /** alternate lines (shortcuts through bends / tree runs) overlapping [z0, z1] */
  altRoutes(z0: number, z1: number): AltRoute[];
  /** x of an alternate line at z, or null where there is none */
  altRouteX(z: number): number | null;
  /** x of a given alternate line at z (z within [a.z0, a.z1]) */
  altX(a: AltRoute, z: number): number;
}

/**
 * An alternate line through a segment: a straight chord between two points of the guaranteed
 * route that cuts the inside of its bends (shorter, but closer to the trees and banks), kept
 * inside the piste and cleared of solid obstacles like the main route.
 */
export interface AltRoute {
  z0: number;
  z1: number;
  /** segment type it belongs to */
  type: SegmentType;
}

function between<T extends { z: number }>(arr: readonly T[], z0: number, z1: number, out: T[]): T[] {
  out.length = 0;
  // arr is sorted by z
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid]!.z < z0) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < arr.length && arr[i]!.z <= z1; i++) out.push(arr[i]!);
  return out;
}

// =============================================================================================
// Classic: the original 3 km mountain
// =============================================================================================
const CLASSIC_SLOPE: ReadonlyArray<readonly [number, number]> = [
  [-400, 2], [-60, 3], [0, 6], [60, 10], [160, 12], [210, 8], [275, 9], [315, 18], [380, 19], [640, 17], [700, 22], [980, 21], [1060, 14],
  [1250, 13], [1300, 15], [1365, 17], [1405, 18], [1470, 19], [1900, 20], [1990, 26], [2280, 25], [2330, 17], [2680, 16], [2740, 14], [2930, 12], [2990, 6],
  [3060, 1.2], [3400, 0.6], [6000, 0.4],
];
const CLASSIC_WIDTH: ReadonlyArray<readonly [number, number]> = [
  [-400, 70], [0, 62], [300, 55], [700, 48], [1000, 44], [1250, 52], [1450, 46], [1950, 34], [2020, 22], [2260, 22], [2340, 40],
  [2700, 52], [2950, 70], [3100, 110], [6000, 140],
];

/**
 * Yeti cave placement rule: the (first) cave always sits inside the first 10 % of a finite course,
 * with its trigger line before the 10 % mark too (Sprint 3 km: by 300 m; Standard 10 km: by 1 km).
 */
export const CAVE_FRACTION = 0.1;
export function firstCaveZ(length: number): number {
  return Math.round(length * CAVE_FRACTION) - 40;
}
/** Early caves leave less run-in: the tutorial, and the foreshadowing, shrink to fit before them. */
export function tutorialEndFor(caveZ: number): number {
  return caveZ < 600 ? caveZ - 110 : 330;
}
export function foreshadowFor(caveZ: number): number {
  return caveZ < 600 ? caveZ - 80 : caveZ - 530;
}

export const CLASSIC = { finishZ: 3000, caveZ: firstCaveZ(3000), tutorialEndZ: tutorialEndFor(firstCaveZ(3000)) } as const;

export class ClassicProfile implements CourseProfile {
  readonly kind = 'classic' as const;
  readonly length = 3000;
  readonly finishZ = 3000;
  readonly endless = false;
  readonly tutorialEndZ = CLASSIC.tutorialEndZ;
  private slope = new SlopeTrack(CLASSIC_SLOPE);
  private width = new KeyTrack(CLASSIC_WIDTH);
  private kick: Kicker[] = [];
  private cliffs: CliffBand[] = [];
  private enc: Encounter[];

  constructor(readonly seed: number) {
    this.slope.anchorZero(0);
    const rng = new Rng(seed ^ 0x51f15e);
    const tk = this.tutorialEndZ - 45; // the tutorial kicker, just before the tutorial ends
    this.kick.push({ z: tk, d: this.routeX(tk) - this.centerX(tk), width: 9, height: 1.1, run: 12 });
    for (const [a, b, count] of [
      [420, 960, 4],
      [1080, 1240, 1],
      [1500, 1960, 4],
      [2350, 2800, 4],
    ] as const) {
      const span = (b - a) / count;
      for (let i = 0; i < count; i++) {
        const z = a + span * (i + rng.range(0.25, 0.75));
        const w = this.halfWidth(z);
        const onRoute = i % 2 === 0;
        const base = this.routeX(z) - this.centerX(z);
        const d = onRoute ? base : clamp(base + rng.pick([-1, 1]) * rng.range(14, 22), -w * 0.75, w * 0.75);
        this.kick.push({ z, d, width: rng.range(7, 11), height: rng.range(1.2, 2.1), run: rng.range(10, 15) });
      }
    }
    this.kick.sort((p, q) => p.z - q.z);
    for (const [z, drop] of [
      [760, 3.5],
      [1760, 5.5],
      [2560, 4.5],
    ] as const) {
      const w = this.halfWidth(z);
      const o = this.routeX(z) - this.centerX(z);
      const band = o > 0 ? { dMin: -(w - 6), dMax: o - 13 } : { dMin: o + 13, dMax: w - 6 };
      if (band.dMax - band.dMin > 8) this.cliffs.push({ z, drop, ...band });
    }
    const caveZ = CLASSIC.caveZ;
    this.enc = [
      {
        index: 0,
        caveZ,
        triggerZ: caveZ + 22,
        foreshadowZ: foreshadowFor(caveZ),
        anchor: { z: caveZ, centerX: this.centerX(caveZ), side: 1, d: CAVE_D },
        chaseEndZ: this.finishZ,
        checkpointZ: null,
        speedMul: 1,
      },
    ];
  }

  ensure(): void {}
  slopeDeg(z: number) {
    return this.slope.at(z);
  }
  baseHeight(z: number) {
    return this.slope.base(z);
  }
  halfWidth(z: number) {
    return this.width.at(z);
  }
  centerX(z: number) {
    const fadeIn = smoothstep(-40, 260, z);
    const fadeOut = 1 - smoothstep(2660, 2880, z);
    return fadeIn * fadeOut * (95 * Math.sin(z / 410 + 0.6) + 42 * Math.sin(z / 173 + 2.1) + 14 * Math.sin(z / 71));
  }
  routeX(z: number) {
    const w = this.halfWidth(z);
    const m = smoothstep(80, 300, z) * (1 - smoothstep(2720, 2870, z));
    return this.centerX(z) + m * w * 0.3 * Math.sin(z / 133 + 1.3);
  }
  mogulZone(z: number) {
    return smoothstep(720, 760, z) * (1 - smoothstep(940, 980, z)) + smoothstep(2380, 2420, z) * (1 - smoothstep(2520, 2560, z));
  }
  rollerZone(z: number) {
    return smoothstep(450, 520, z) * (1 - smoothstep(640, 700, z));
  }
  iceZone(z: number) {
    return smoothstep(1980, 2010, z) * (1 - smoothstep(2270, 2300, z)) + smoothstep(1500, 1540, z) * (1 - smoothstep(1600, 1640, z));
  }
  powderBias() {
    return 0;
  }
  forest() {
    return 1;
  }
  treeLine(z: number) {
    return smoothstep(120, 520, z);
  }
  rockBias() {
    return 1;
  }
  sideSetback(z: number, side: 1 | -1) {
    return (1 + 0.25 * Math.sin(z / 470 + (side > 0 ? 1.7 : 4.1))) * smoothstep(-200, 0, z) + (1 - smoothstep(-200, 0, z));
  }
  sideSteep(z: number, side: 1 | -1) {
    return 0.75 + 0.5 * (0.5 + 0.5 * Math.sin(z / 610 + side * 2.3));
  }
  flatten(z: number) {
    return z > this.finishZ ? smoothstep(this.finishZ, this.finishZ + 60, z) : 0;
  }
  kickersNear(z0: number, z1: number, out: Kicker[]) {
    return between(this.kick, z0, z1, out);
  }
  cliffsNear(z0: number, z1: number, out: CliffBand[]) {
    return between(this.cliffs, z0, z1, out);
  }
  encounters(z0: number, z1: number) {
    return this.enc.filter((e) => e.chaseEndZ + 50 >= z0 && e.foreshadowZ - 600 <= z1);
  }
  sightings() {
    return [];
  }
  checkpoints() {
    return [];
  }
  altRoutes(): AltRoute[] {
    return [];
  }
  altRouteX(): number | null {
    return null;
  }
  altX(): number {
    return 0;
  }
  segmentAt(): SegmentType {
    return 'classic';
  }
}

// =============================================================================================
// Generated: deterministic segment plan for any length
// =============================================================================================
interface TypeSpec {
  slope: [number, number];
  width: [number, number];
  amp: [number, number];
  len: [number, number];
  mogul: number;
  roller: number;
  ice: number;
  powder: number;
  forest: number;
  treeLine: number;
  rock: number;
  kickers: [number, number];
  cliffs: number;
  steep: [number, number];
}

const TYPES: Record<Exclude<SegmentType, 'summit' | 'encounter' | 'checkpoint' | 'finish' | 'classic'>, TypeSpec> = {
  beginner: { slope: [9, 12], width: [58, 70], amp: [25, 45], len: [320, 520], mogul: 0, roller: 0.4, ice: 0, powder: 0, forest: 0.5, treeLine: 0.8, rock: 0.6, kickers: [1, 1], cliffs: 0, steep: [0.7, 0.9] },
  alpine: { slope: [15, 19], width: [60, 78], amp: [50, 90], len: [450, 900], mogul: 0, roller: 0.2, ice: 0.1, powder: 0.3, forest: 0.25, treeLine: 0.12, rock: 1.6, kickers: [1, 3], cliffs: 0, steep: [0.9, 1.3] },
  forest: { slope: [15, 19], width: [26, 36], amp: [55, 95], len: [400, 800], mogul: 0, roller: 0, ice: 0, powder: 0.2, forest: 1.9, treeLine: 1, rock: 0.6, kickers: [0, 1], cliffs: 0, steep: [0.8, 1.1] },
  ridgeline: { slope: [17, 22], width: [36, 46], amp: [40, 70], len: [400, 700], mogul: 0, roller: 0, ice: 0.3, powder: 0, forest: 0.4, treeLine: 0.35, rock: 2.6, kickers: [0, 2], cliffs: 1, steep: [1.2, 1.5] },
  basin: { slope: [8, 12], width: [80, 100], amp: [30, 55], len: [400, 700], mogul: 0, roller: 0.5, ice: 1, powder: 0.1, forest: 0.6, treeLine: 0.6, rock: 0.8, kickers: [1, 2], cliffs: 0, steep: [0.65, 0.85] },
  chute: { slope: [23, 27], width: [18, 24], amp: [20, 35], len: [260, 420], mogul: 0, roller: 0, ice: 0.6, powder: 0, forest: 1.3, treeLine: 1, rock: 1.4, kickers: [0, 0], cliffs: 0, steep: [1.2, 1.5] },
  moguls: { slope: [18, 21], width: [40, 50], amp: [35, 55], len: [250, 420], mogul: 1, roller: 0, ice: 0, powder: 0.2, forest: 0.8, treeLine: 0.8, rock: 0.8, kickers: [0, 1], cliffs: 0, steep: [0.9, 1.1] },
  powder: { slope: [13, 17], width: [65, 82], amp: [50, 90], len: [400, 800], mogul: 0, roller: 0.3, ice: 0, powder: 1, forest: 0.9, treeLine: 0.9, rock: 0.7, kickers: [1, 2], cliffs: 0, steep: [0.75, 1.0] },
  highspeed: { slope: [19, 23], width: [50, 62], amp: [30, 50], len: [450, 900], mogul: 0, roller: 0.6, ice: 0.15, powder: 0, forest: 0.6, treeLine: 0.7, rock: 0.7, kickers: [2, 3], cliffs: 0, steep: [0.85, 1.05] },
  cliffside: { slope: [18, 21], width: [40, 48], amp: [45, 75], len: [400, 700], mogul: 0, roller: 0, ice: 0.2, powder: 0, forest: 0.7, treeLine: 0.6, rock: 2.0, kickers: [0, 1], cliffs: 2, steep: [1.3, 1.6] },
};
const TYPE_LIST = Object.keys(TYPES) as Array<keyof typeof TYPES>;

interface Segment {
  i: number;
  type: SegmentType;
  z0: number;
  z1: number;
}

/** Chase length (metres from the cave to the finish) by course length. */
export function chaseLength(length: number): number {
  if (length <= 3000) return 1650;
  if (length <= 10000) return 3000;
  if (length <= 20000) return 3400;
  return 3800;
}

/** chase length of a mid-course skirmish on long finite courses (cave → refuge) */
export const SKIRMISH_CHASE = 2200;

/** Endless: each leg is a 5.4 km chase to a refuge, then 600 m of reprieve before the next cave (~10 % free). */
export const ENDLESS = { firstCave: 960, cycle: 6000, chase: 5400 } as const;

/** Share of a course skied without the Yeti on your tail (run-in + reprieves after refuges). */
export const FREE_FRACTION = 0.1;
/** Long finite courses: where the first cave sits (a shorter run-in leaves room for reprieves). */
export const LONG_FIRST_CAVE = 560;
/** Minimum refuge → next cave distance: the refuge zone and the next cave's shelf must not overlap. */
export const MIN_REPRIEVE = 560;

export interface LegPlan {
  caveZ: number;
  /** where this leg's chase ends: a refuge, or the finish (last leg) */
  endZ: number;
  refuge: boolean;
}

/**
 * Long courses (≥ 18 km): a chain of chases. The Yeti is on your tail for ~90 % of the distance;
 * the other ~10 % is the run-in to the first cave plus a short reprieve after each refuge, where
 * the Yeti has lost your trail until the next cave. As many refuges as that budget allows.
 */
export function longCoursePlan(L: number): LegPlan[] {
  const budget = FREE_FRACTION * L;
  const firstTrig = LONG_FIRST_CAVE + 22;
  const refuges = Math.max(1, Math.floor((budget - firstTrig) / (MIN_REPRIEVE + 60)));
  const gap = Math.max(MIN_REPRIEVE, Math.floor((budget - firstTrig) / refuges) - 22);
  const chaseTotal = L - LONG_FIRST_CAVE - 22 - refuges * (gap + 22);
  const leg = chaseTotal / (refuges + 1);
  const plan: LegPlan[] = [];
  let cave = LONG_FIRST_CAVE;
  for (let i = 0; i <= refuges; i++) {
    const last = i === refuges;
    const end = last ? L : Math.round((cave + 22 + leg) / 10) * 10;
    plan.push({ caveZ: cave, endZ: end, refuge: !last });
    cave = end + gap;
  }
  return plan;
}

export class GeneratedProfile implements CourseProfile {
  readonly kind = 'generated' as const;
  readonly finishZ: number;
  readonly endless: boolean;
  readonly tutorialEndZ: number;
  private slope = new SlopeTrack();
  private width = new KeyTrack();
  private amp = new KeyTrack(); // centreline amplitude
  private routeAmp = new KeyTrack();
  private tMogul = new KeyTrack();
  private tRoller = new KeyTrack();
  private tIce = new KeyTrack();
  private tPowder = new KeyTrack();
  private tForest = new KeyTrack();
  private tTree = new KeyTrack();
  private tRock = new KeyTrack();
  private setP = new KeyTrack();
  private setN = new KeyTrack();
  private steepP = new KeyTrack();
  private steepN = new KeyTrack();
  private kick: Kicker[] = [];
  private cliffs: CliffBand[] = [];
  private segs: Segment[] = [];
  private enc: Encounter[] = [];
  private sight: Sighting[] = [];
  private cps: number[] = [];
  private alts: AltRoute[] = [];
  private zDone = -400;
  private phase: [number, number, number, number];
  private rngPlan: Rng;
  private lastType: SegmentType = 'summit';

  constructor(
    readonly seed: number,
    readonly length: number,
  ) {
    this.endless = !Number.isFinite(length);
    this.finishZ = this.endless ? Infinity : length;
    const r = new Rng(seed ^ 0x7c0ffee);
    this.rngPlan = new Rng(seed ^ 0x51ed);
    this.phase = [r.range(0, 6.28), r.range(0, 6.28), r.range(0, 6.28), r.range(0, 6.28)];
    const first = this.endless ? ENDLESS.firstCave : length >= 18000 ? LONG_FIRST_CAVE : firstCaveZ(length);
    this.tutorialEndZ = tutorialEndFor(first);
    // the summit: identical start for every course (start gate, tutorial run-in). With an early
    // cave (Sprint) the summit hands straight over to the cave shelf.
    const summitEnd = Math.min(330, first - 320);
    this.keys(-400, { slope: 2, width: 70, amp: 0, route: 0, tree: 0, forest: 0.3, rock: 1, setback: 1, steep: 0.8 });
    this.keys(-60, { slope: 3, width: 66, amp: 0, route: 0 });
    this.keys(0, { slope: 6, width: 62, amp: 0, route: 0 });
    if (summitEnd >= 240) {
      this.keys(60, { slope: 10, width: 60, amp: 10, route: 0 });
      this.keys(240, { slope: 11, width: 56, amp: 30, route: 0.5, tree: 0.4 });
    }
    this.zDone = Math.max(0, summitEnd);
    this.segs.push({ i: 0, type: 'summit', z0: -400, z1: this.zDone });
    this.kick.push({ z: this.tutorialEndZ - 45, d: 0, width: 9, height: 1.1, run: 12 });
    if (!this.endless) {
      const L = length;
      // the Yeti's cave is always in the first 10 % of the course, and on every length you ski
      // free for only ~10 % of it. Sprint and Standard: one encounter, chased to the finish. Long
      // courses: a chain of chases, each ending at a refuge with a short reprieve before the next
      // cave; the last one runs to the finish.
      if (L < 18000) {
        this.addEncounter(0, first, L, null, 1);
      } else {
        const plan = longCoursePlan(L);
        plan.forEach((leg, i) => {
          this.addEncounter(i, leg.caveZ, leg.endZ, leg.refuge ? leg.endZ : null, leg.refuge ? Math.min(1, 0.94 + 0.02 * i) : 1);
          if (leg.refuge) this.cps.push(leg.endZ);
        });
      }
      const caveZ = this.enc.at(-1)!.caveZ;
      // sightings: the Yeti shows itself on a ridge between the encounters
      const busy = (z: number) => this.enc.some((e) => z > e.foreshadowZ - 900 && z < e.chaseEndZ + 600);
      for (let z = 2600; z < caveZ - 1500; z += this.rngPlan.range(3600, 5200)) if (!busy(z)) this.sight.push({ z, side: this.rngPlan.chance(0.5) ? 1 : -1 });
    }
    this.ensure(this.endless ? 12000 : length + 3000);
    // fix the tutorial kicker to the actual route
    this.kick[0]!.d = this.routeX(285) - this.centerX(285);
    this.slope.anchorZero(0);
  }

  private addEncounter(index: number, caveZ: number, chaseEnd: number, checkpointZ: number | null, speedMul: number) {
    this.enc.push({
      index,
      caveZ,
      triggerZ: caveZ + 22,
      foreshadowZ: foreshadowFor(caveZ),
      anchor: { z: caveZ, centerX: 0, side: 1, d: CAVE_D }, // centerX resolved once the keys exist
      chaseEndZ: chaseEnd,
      checkpointZ,
      speedMul,
    });
  }

  private keys(z: number, v: { slope?: number; width?: number; amp?: number; route?: number; mogul?: number; roller?: number; ice?: number; powder?: number; forest?: number; tree?: number; rock?: number; setback?: number; setbackN?: number; steep?: number; steepN?: number }) {
    if (v.slope !== undefined) this.slope.push(z, v.slope);
    if (v.width !== undefined) this.width.push(z, v.width);
    if (v.amp !== undefined) this.amp.push(z, v.amp);
    if (v.route !== undefined) this.routeAmp.push(z, v.route);
    this.tMogul.push(z, v.mogul ?? 0);
    this.tRoller.push(z, v.roller ?? 0);
    this.tIce.push(z, v.ice ?? 0);
    this.tPowder.push(z, v.powder ?? 0);
    if (v.forest !== undefined || this.tForest.zs.length === 0) this.tForest.push(z, v.forest ?? 1);
    if (v.tree !== undefined || this.tTree.zs.length === 0) this.tTree.push(z, v.tree ?? 1);
    if (v.rock !== undefined || this.tRock.zs.length === 0) this.tRock.push(z, v.rock ?? 1);
    if (v.setback !== undefined || this.setP.zs.length === 0) {
      this.setP.push(z, v.setback ?? 1);
      this.setN.push(z, v.setbackN ?? v.setback ?? 1);
    }
    if (v.steep !== undefined || this.steepP.zs.length === 0) {
      this.steepP.push(z, v.steep ?? 1);
      this.steepN.push(z, v.steepN ?? v.steep ?? 1);
    }
  }

  /** Next special zone start after z (encounter shelf, checkpoint, finish approach). */
  private nextSpecial(z: number): { z0: number; z1: number; kind: 'encounter' | 'checkpoint' | 'finish'; ref: number } | null {
    let best: { z0: number; z1: number; kind: 'encounter' | 'checkpoint' | 'finish'; ref: number } | null = null;
    const consider = (z0: number, z1: number, kind: 'encounter' | 'checkpoint' | 'finish', ref: number) => {
      if (z1 <= z) return;
      if (!best || z0 < best.z0) best = { z0, z1, kind, ref };
    };
    for (const e of this.enc) consider(e.caveZ - 320, e.caveZ + 140, 'encounter', e.caveZ);
    for (const c of this.cps) consider(c - 280, c + 240, 'checkpoint', c);
    if (!this.endless) consider(this.length - 420, Infinity, 'finish', this.length);
    return best;
  }

  ensure(zTarget: number): void {
    // Endless: schedule encounters/checkpoints ahead of generation
    while (this.endless) {
      const k = this.enc.length;
      const caveZ = ENDLESS.firstCave + k * ENDLESS.cycle;
      if (caveZ - 320 > zTarget + ENDLESS.cycle) break;
      const cp = caveZ + ENDLESS.chase;
      // escalation: each encounter's Yeti is faster, up to +30 % from the 7th on (B7)
      this.addEncounter(k, caveZ, cp, cp, Math.min(1.3, 1 + 0.05 * k));
      this.cps.push(cp);
      const prevEnd = k === 0 ? 1200 : ENDLESS.firstCave + (k - 1) * ENDLESS.cycle + ENDLESS.chase + 800;
      for (let z = prevEnd + 1400; z < caveZ - 1400; z += this.rngPlan.range(2600, 3600)) this.sight.push({ z, side: this.rngPlan.chance(0.5) ? 1 : -1 });
    }
    if (this.generating) return;
    this.generating = true;
    try {
      while (this.zDone < zTarget) this.generateNext();
    } finally {
      this.generating = false;
    }
  }

  private generateNext() {
    const z0 = this.zDone;
    const special = this.nextSpecial(z0);
    const idx = this.segs.length;
    const rng = new Rng((this.seed ^ Math.imul(idx + 1, 0x9e3779b1)) >>> 0);
    if (special && special.z0 <= z0 + 1) {
      this.buildSpecial(special.kind, special.ref, Math.max(z0, special.z0), special.z1, rng, idx);
      return;
    }
    // a regular segment, possibly shortened to meet the next special zone
    let type: keyof typeof TYPES;
    do {
      type = rng.pick(TYPE_LIST);
    } while (type === this.lastType || (type === 'chute' && this.lastType === 'moguls') || (z0 < 1200 && (type === 'chute' || type === 'cliffside')));
    const spec = TYPES[type];
    let len = rng.range(spec.len[0], spec.len[1]);
    if (special) {
      const room = special.z0 - z0;
      if (room < len + 250) len = room; // fill exactly up to the special zone
    }
    const z1 = z0 + len;
    const sA = rng.range(spec.slope[0], spec.slope[1]);
    const sB = rng.range(spec.slope[0], spec.slope[1]);
    const w = rng.range(spec.width[0], spec.width[1]);
    const a = rng.range(spec.amp[0], spec.amp[1]);
    const steepSide = rng.chance(0.5) ? 1 : -1;
    const st = rng.range(spec.steep[0], spec.steep[1]);
    const common = {
      width: w,
      amp: a,
      route: type === 'chute' ? 0.5 : 1,
      mogul: spec.mogul,
      roller: spec.roller,
      ice: spec.ice,
      powder: spec.powder,
      forest: spec.forest,
      tree: spec.treeLine,
      rock: spec.rock,
      setback: steepSide > 0 ? rng.range(0.85, 1.05) : rng.range(1.05, 1.45),
      setbackN: steepSide > 0 ? rng.range(1.05, 1.45) : rng.range(0.85, 1.05),
      steep: steepSide > 0 ? st : st * 0.8,
      steepN: steepSide > 0 ? st * 0.8 : st,
    };
    const edge = Math.min(70, len / 4);
    this.keys(z0 + edge, { slope: sA, ...common });
    this.keys(z1 - edge, { slope: sB, ...common });
    this.segs.push({ i: idx, type, z0, z1 });
    this.lastType = type;
    this.zDone = z1;
    // features
    const nk = rng.int(spec.kickers[0], spec.kickers[1]);
    for (let k = 0; k < nk; k++) {
      const z = z0 + 90 + (len - 180) * ((k + rng.range(0.25, 0.75)) / Math.max(1, nk));
      if (z > z1 - 80) continue;
      const hw = this.halfWidth(z);
      const base = this.routeX(z) - this.centerX(z);
      const onRoute = k % 2 === 0;
      const d = onRoute ? base : clamp(base + rng.pick([-1, 1]) * rng.range(14, 22), -hw * 0.75, hw * 0.75);
      this.kick.push({ z, d, width: rng.range(7, 11), height: rng.range(1.2, type === 'highspeed' ? 2.4 : 2.0), run: rng.range(10, 15) });
    }
    for (let c = 0; c < spec.cliffs; c++) {
      const z = z0 + len * (0.35 + 0.35 * c) + rng.range(-30, 30);
      const hw = this.halfWidth(z);
      const o = this.routeX(z) - this.centerX(z);
      const band = o > 0 ? { dMin: -(hw - 6), dMax: o - 13 } : { dMin: o + 13, dMax: hw - 6 };
      if (band.dMax - band.dMin > 8) this.cliffs.push({ z, drop: rng.range(3.5, 6), ...band });
    }
    // an alternate line on wide, flowing segments (decided from this segment's own rng, so the
    // plan does not depend on generation order)
    if ((type === 'forest' || type === 'powder' || type === 'basin' || type === 'alpine' || type === 'highspeed') && len > 380 && rng.chance(0.65)) {
      this.alts.push({ z0: z0 + edge + 10, z1: z1 - edge - 10, type });
    }
    this.kick.sort((p, q) => p.z - q.z);
    this.cliffs.sort((p, q) => p.z - q.z);
  }

  private buildSpecial(kind: 'encounter' | 'checkpoint' | 'finish', ref: number, z0: number, z1: number, rng: Rng, idx: number) {
    if (kind === 'encounter') {
      const c = ref;
      // an early cave (Sprint) starts inside the summit run-in: keep the start straighter and
      // skip shelf keys that would land before the segment start
      const common = { width: 50, amp: Math.min(55, Math.max(20, (c - 50) * 0.15)), route: 0.8, forest: 0.9, tree: 1, rock: 1.2, setback: 1, steep: 1 };
      if (c - 300 > z0 + 5) this.keys(c - 300, { slope: 13, ...common });
      else this.keys(c - 120, { slope: 11, ...common });
      this.keys(c - 50, { slope: 8, ...common });
      this.keys(c + 15, { slope: 9, ...common });
      this.keys(c + 55, { slope: 18, ...common });
      this.keys(c + 130, { slope: 19, ...common, width: 46 });
      this.segs.push({ i: idx, type: 'encounter', z0, z1 });
      const e = this.enc.find((q) => q.caveZ === c);
      if (e) e.anchor.centerX = this.centerX(c);
      this.lastType = 'encounter';
      this.zDone = z1;
    } else if (kind === 'checkpoint') {
      const c = ref;
      const common = { width: 90, amp: 12, route: 0, forest: 0.3, tree: 0.8, rock: 0.6, setback: 1.2, steep: 0.8 };
      this.keys(c - 260, { slope: 12, ...common, width: 60, amp: 40 });
      this.keys(c - 70, { slope: 6, ...common });
      this.keys(c, { slope: 3, ...common });
      this.keys(c + 80, { slope: 6, ...common });
      this.keys(c + 230, { slope: 13, ...common, width: 60, amp: 40, route: 1 });
      this.segs.push({ i: idx, type: 'checkpoint', z0, z1 });
      this.lastType = 'checkpoint';
      this.zDone = z1;
    } else {
      const L = ref;
      const common = { forest: 0.5, tree: 0.8, rock: 0.6, setback: 1, steep: 0.9 };
      this.keys(L - 340, { slope: 15, width: 52, amp: this.amp.at(L - 340), route: 1, ...common });
      this.keys(L - 280, { slope: 14, width: 52, amp: 40, route: 0.6, ...common });
      this.keys(L - 120, { slope: 12, width: 60, amp: 0, route: 0, ...common });
      this.keys(L - 10, { slope: 6, width: 70, amp: 0, route: 0, ...common });
      this.keys(L + 60, { slope: 1.2, width: 110, amp: 0, route: 0, ...common });
      this.keys(L + 400, { slope: 0.6, width: 125, amp: 0, route: 0, ...common });
      this.keys(L + 6000, { slope: 0.4, width: 140, amp: 0, route: 0, ...common });
      this.segs.push({ i: idx, type: 'finish', z0, z1: Infinity });
      this.lastType = 'finish';
      this.zDone = Infinity;
    }
    void rng;
  }

  // --- queries ------------------------------------------------------------------------------
  private generating = false;
  /** queries near/past the generated frontier extend the plan first (B5: never sample stale keys) */
  private reach(z: number) {
    if (z > this.zDone - 300 && !this.generating) this.ensure(z + 600);
  }
  slopeDeg(z: number) {
    this.reach(z);
    return this.slope.at(z);
  }
  baseHeight(z: number) {
    this.reach(z);
    return this.slope.base(z);
  }
  halfWidth(z: number) {
    this.reach(z);
    return this.width.at(z);
  }
  centerX(z: number) {
    this.reach(z);
    const a = this.amp.at(z);
    if (a < 1e-3) return 0;
    const p = this.phase;
    return a * (Math.sin(z / 410 + p[0]) * 0.63 + Math.sin(z / 173 + p[1]) * 0.28 + Math.sin(z / 71 + p[2]) * 0.09);
  }
  routeX(z: number) {
    const ra = this.routeAmp.at(z);
    return this.centerX(z) + ra * this.halfWidth(z) * 0.3 * Math.sin(z / 133 + this.phase[3]);
  }
  mogulZone(z: number) {
    return this.tMogul.at(z);
  }
  rollerZone(z: number) {
    return this.tRoller.at(z);
  }
  iceZone(z: number) {
    return this.tIce.at(z);
  }
  powderBias(z: number) {
    return this.tPowder.at(z);
  }
  forest(z: number) {
    return this.tForest.at(z);
  }
  treeLine(z: number) {
    return this.tTree.at(z);
  }
  rockBias(z: number) {
    return this.tRock.at(z);
  }
  sideSetback(z: number, side: 1 | -1) {
    return (side > 0 ? this.setP : this.setN).at(z) * (1 + 0.12 * Math.sin(z / 470 + (side > 0 ? 1.7 : 4.1)));
  }
  sideSteep(z: number, side: 1 | -1) {
    return (side > 0 ? this.steepP : this.steepN).at(z);
  }
  flatten(z: number) {
    let f = !this.endless && z > this.finishZ ? smoothstep(this.finishZ, this.finishZ + 60, z) : 0;
    for (const c of this.cps) {
      if (Math.abs(z - c) < 120) f = Math.max(f, 0.6 * (1 - smoothstep(40, 110, Math.abs(z - c - 10))));
    }
    return f;
  }
  kickersNear(z0: number, z1: number, out: Kicker[]) {
    this.ensure(z1);
    return between(this.kick, z0, z1, out);
  }
  cliffsNear(z0: number, z1: number, out: CliffBand[]) {
    this.ensure(z1);
    return between(this.cliffs, z0, z1, out);
  }
  encounters(z0: number, z1: number) {
    this.ensure(z1);
    return this.enc.filter((e) => e.chaseEndZ + 50 >= z0 && e.foreshadowZ - 600 <= z1);
  }
  sightings(z0: number, z1: number) {
    this.ensure(z1);
    return this.sight.filter((s) => s.z >= z0 && s.z <= z1);
  }
  checkpoints(z0: number, z1: number) {
    this.ensure(z1);
    return this.cps.filter((c) => c >= z0 && c <= z1);
  }
  altRoutes(z0: number, z1: number): AltRoute[] {
    this.ensure(z1 + 200);
    return this.alts.filter((a) => a.z1 >= z0 && a.z0 <= z1 && this.altUseful(a));
  }

  private altOk = new Map<AltRoute, boolean>();
  /** an alternate line only counts where it really is a different line from the route */
  private altUseful(a: AltRoute): boolean {
    let v = this.altOk.get(a);
    if (v === undefined) {
      let apart = 0;
      let n = 0;
      for (let z = a.z0; z <= a.z1; z += 10, n++) if (Math.abs(this.altX(a, z) - this.routeX(z)) > 10) apart++;
      v = apart / Math.max(1, n) > 0.35;
      this.altOk.set(a, v);
    }
    return v;
  }

  altX(a: AltRoute, z: number): number {
    const x0 = this.routeX(a.z0);
    const x1 = this.routeX(a.z1);
    const t = (z - a.z0) / (a.z1 - a.z0);
    const chord = x0 + (x1 - x0) * t;
    const c = this.centerX(z);
    const hw = this.halfWidth(z) - 9;
    return Math.min(c + hw, Math.max(c - hw, chord));
  }

  altRouteX(z: number): number | null {
    for (const a of this.altRoutes(z, z)) if (z >= a.z0 && z <= a.z1) return this.altX(a, z);
    return null;
  }

  segmentAt(z: number): SegmentType {
    this.ensure(z);
    for (let i = this.segs.length - 1; i >= 0; i--) if (this.segs[i]!.z0 <= z) return this.segs[i]!.type;
    return 'summit';
  }
  /** Number of generated segments (tests/diagnostics). */
  get segmentCount() {
    return this.segs.length;
  }
  get segmentList(): ReadonlyArray<{ type: SegmentType; z0: number; z1: number }> {
    return this.segs;
  }
}
