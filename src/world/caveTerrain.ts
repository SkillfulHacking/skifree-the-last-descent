/**
 * Cave ↔ heightfield contract.
 *
 * A cave is placed by a CaveAnchor (any number of caves can exist on a course). The heightfield
 * calls `caveTerrainHeight` for points near an anchor; the cave mesh (src/world/Cave.ts) is built
 * from the same anchor and the same layout functions below, so the terrain cut and the rock mass are
 * designed together and never drift apart.
 *
 * The cave is a single rock formation standing in the valley-side cliff: a vertical face with an
 * overhanging brow, a chamber that runs ~24 m into the hill and bends downhill (so its back is never in
 * line of sight from the piste), and a rock ledge in front of the mouth. Inside the formation's footprint
 * the heightfield is pulled down so it always stays *inside* the rock (the terrain still forms a cliff for
 * physics, just behind the visible face); along the chamber it drops to just under the cave's own floor
 * mesh. Outside the footprint the heightfield is the classic cliff.
 *
 * Every modification is an additive offset on top of the natural terrain `h` (caveTerrainHeight =
 * h + caveTerrainOffset), so the cave builder can recover `h` from `Mountain.heightAt` exactly.
 *
 * Frames (all in metres):
 *  - `u`  = distance INTO the hill from the mouth reference point, along -outward (Cartesian);
 *  - `v`  = z - anchor.z (lateral, +Z = downhill; NOT mirrored by `side`);
 *  - `uc` = distance into the hill measured from the cliff line (follows the centreline: d·side − (D+2)).
 * Heights are relative to the natural terrain `h`; `bankOffset` is the snow bank rising to the cliff.
 */
import { clamp, gnoise, ridged, smoothstep } from '../core/rng';

export interface CaveAnchor {
  /** Course progress (world Z) of the cave mouth centre. */
  z: number;
  /** World X of the route centreline at `z` (the cave cliff is offset from it). */
  centerX: number;
  /** +1: cliff on the +X side of the piste (mouth faces -X). -1: mirrored. */
  side: 1 | -1;
  /** Lateral distance of the cliff base from the centreline. */
  d: number;
}

/** Lateral offset (from centreline) of the cave cliff base — default placement. */
export const CAVE_D = 46;
/** The cave floor (and the ledge in front of the mouth) sits this far above the snow bank. */
export const CAVE_FLOOR_RAISE = 0.7;
/** Quick reject radius: points farther than this (in Z) from the anchor are unaffected. */
export const CAVE_INFLUENCE_Z = 120;

/** Outward unit direction of the mouth (toward the piste) in world XZ. */
export function caveOutward(a: CaveAnchor): { x: number; z: number } {
  return { x: -a.side, z: 0 };
}

/** World XZ of the cave frame origin (u = 0, v = 0) at the cliff line. The mouth itself is at u = MOUTH_U. */
export function caveMouthXZ(a: CaveAnchor): { x: number; z: number } {
  return { x: a.centerX + a.side * (a.d + 2), z: a.z };
}

// --- layout ---------------------------------------------------------------------------------------
/** u of the mouth line (the floor point `Cave.mouth`). */
export const MOUTH_U = -1.0;
/** Height of the snow bank that rises toward the cliff. */
export const BANK_H = 4.5;
/** Partial levelling of the natural slope under the cave floor (fraction of a typical 8–10° fall line). */
const LEVEL_U = 0.13;
const LEVEL_V = -0.17;
/** Formation footprint: full rock core for |v - V_C| < CORE0, receding into the cliff by CORE1. */
export const FORM = { vc: 1, core0: 19, core1: 46, uBack: 30 } as const;
/** The floor mesh is cut at this u (just outside the mouth line); the ledge beyond is heightfield. */
export const FLOOR_RIM_U = -1.7;

export function bankOffset(uc: number): number {
  return BANK_H * smoothstep(-22, -3, uc);
}

/** 0 in the formation core, 1 where the rock has merged into the classic terrain cliff. */
export function formBand(v: number): number {
  return smoothstep(FORM.core0 - 5, FORM.core1 - 3, Math.abs(v - FORM.vc));
}

/** Horizontal run of the terrain cliff: the classic steep cliff far away, a steep snow slope beside the cave. */
export function cliffRun(v: number): number {
  return 8 + 30 * (1 - smoothstep(52, 66, Math.abs(v - FORM.vc)));
}

/** uc of a smoothstep cliff profile (from uc = -4, horizontal run `run`) at height y above the bank. */
export function cliffSurfaceUc(y: number, Hc: number, run = 8): number {
  const k = clamp(y / Math.max(1, Hc), 0, 1);
  const t = 0.5 - Math.sin(Math.asin(1 - 2 * k) / 3);
  return -4 + run * t;
}

/** Cliff height above the bank (lower around the cave, full classic height away from it). */
export function cliffHeight(x: number, z: number, v: number, seed: number): number {
  const av = Math.abs(v - FORM.vc);
  return 28 - 11 * (1 - smoothstep(22, 50, av)) + 6 * ridged(x / 14, z / 14, seed + 9, 3);
}

/** Base line (uc) of the formation's front face: protrudes in the core, recedes into the cliff at the sides. */
export function faceBase(v: number, seed: number): number {
  const av = Math.abs(v - FORM.vc);
  // buttresses and bays along the cliff, calmer right around the mouth
  const wav = 1.7 * gnoise(v * 0.075, 3.1, seed + 77) + 0.6 * gnoise(v * 0.21, 8.3, seed + 78);
  const calm = 1 - 0.65 * (1 - smoothstep(5, 13, Math.abs(v)));
  void av;
  return -1.8 + wav * calm;
}

// --- chamber path -----------------------------------------------------------------------------------
// Control points (u, v); s = 0 at the mouth line. The chamber runs in and bends toward +v (downhill).
const CTRL: ReadonlyArray<readonly [number, number]> = [
  [-6.5, 0.25],
  [-1, 0],
  [3, -0.2],
  [7, 0.4],
  [10.5, 2.2],
  [13.2, 5.0],
  [15.1, 8.6],
  [16.3, 12.1],
  [16.9, 14.6],
];
/** Dense polyline samples: u, v, s. */
const PATH = (() => {
  const pts: Array<[number, number]> = [];
  const n = CTRL.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = CTRL[Math.max(0, i - 1)]!, p1 = CTRL[i]!, p2 = CTRL[i + 1]!, p3 = CTRL[Math.min(n - 1, i + 2)]!;
    const steps = 8;
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pts.push([CTRL[n - 1]![0], CTRL[n - 1]![1]]);
  const u = new Float64Array(pts.length), v = new Float64Array(pts.length), s = new Float64Array(pts.length);
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    u[i] = pts[i]![0];
    v[i] = pts[i]![1];
    if (i > 0) acc += Math.hypot(u[i]! - u[i - 1]!, v[i]! - v[i - 1]!);
    s[i] = acc;
  }
  // re-zero s at the mouth line (u = MOUTH_U)
  let s0 = 0;
  for (let i = 1; i < pts.length; i++) {
    if (u[i - 1]! <= MOUTH_U && u[i]! >= MOUTH_U) {
      const t = (MOUTH_U - u[i - 1]!) / (u[i]! - u[i - 1]!);
      s0 = s[i - 1]! + t * (s[i]! - s[i - 1]!);
      break;
    }
  }
  for (let i = 0; i < pts.length; i++) s[i] = s[i]! - s0;
  return { u, v, s, n: pts.length };
})();
export const CHAMBER_S_MIN = PATH.s[0]!;
export const CHAMBER_S_MAX = PATH.s[PATH.n - 1]!;

export interface ChamberHit {
  /** arc length of the closest path point */
  s: number;
  /** signed lateral offset (+ toward the left normal of the path direction; ≈ +v at the mouth) */
  l: number;
  /** distance to the path (|l| along the path; Euclidean beyond the ends) */
  dist: number;
}

/** Closest point on the chamber path in (u, v). */
export function chamberQuery(u: number, v: number, out: ChamberHit): ChamberHit {
  const P = PATH;
  let best = Infinity, bs = 0, bl = 0;
  for (let i = 0; i < P.n - 1; i++) {
    const au = P.u[i]!, av = P.v[i]!;
    const du = P.u[i + 1]! - au, dv = P.v[i + 1]! - av;
    const L2 = du * du + dv * dv;
    let t = ((u - au) * du + (v - av) * dv) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const pu = au + du * t, pv = av + dv * t;
    const e2 = (u - pu) * (u - pu) + (v - pv) * (v - pv);
    if (e2 < best) {
      best = e2;
      bs = P.s[i]! + t * (P.s[i + 1]! - P.s[i]!);
      const L = Math.sqrt(L2);
      bl = ((u - pu) * -dv + (v - pv) * du) / L; // left normal of (du, dv) is (-dv, du)
    }
  }
  out.s = bs;
  out.dist = Math.sqrt(best);
  out.l = Math.abs(bl) > 1e-9 ? Math.sign(bl) * out.dist : 0;
  return out;
}

/** Point on the path at arc length s (u, v) and its unit direction. */
export function chamberPoint(s: number): { u: number; v: number; du: number; dv: number } {
  const P = PATH;
  s = clamp(s, P.s[0]!, P.s[P.n - 1]!);
  let i = 0;
  while (i < P.n - 2 && P.s[i + 1]! < s) i++;
  const t = (s - P.s[i]!) / (P.s[i + 1]! - P.s[i]!);
  const du = P.u[i + 1]! - P.u[i]!, dv = P.v[i + 1]! - P.v[i]!;
  const L = Math.hypot(du, dv);
  return { u: P.u[i]! + du * t, v: P.v[i]! + dv * t, du: du / L, dv: dv / L };
}

function keys(k: ReadonlyArray<readonly [number, number]>, x: number): number {
  if (x <= k[0]![0]) return k[0]![1];
  for (let i = 1; i < k.length; i++) {
    const b = k[i]!;
    if (x <= b[0]) {
      const a = k[i - 1]!;
      const t = (x - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t * t * (3 - 2 * t);
    }
  }
  return k[k.length - 1]![1];
}
const HW_KEYS = [[-7, 4.5], [0, 4.3], [4, 5.2], [11, 5.3], [16, 4.5], [20, 3.1], [22.5, 1.8], [24.5, 0.6]] as const;
const CEIL_KEYS = [[-7, 5.6], [0, 5.8], [4, 6.4], [11, 6.5], [16, 5.6], [20, 4.0], [22.5, 2.6], [24.5, 1.0]] as const;
/** Nominal chamber half-width at arc length s (walls are noisy but stay within +0.4 of this). */
export function chamberHalfWidth(s: number): number {
  return keys(HW_KEYS, s);
}
/** Nominal ceiling height above the floor at arc length s. */
export function chamberCeiling(s: number): number {
  return keys(CEIL_KEYS, s);
}

/** Floor lift above (h + bank), unmasked: raise + partial levelling + a gentle rise into the cave. */
export function floorLiftRaw(u: number, v: number, uc: number, s: number): number {
  return CAVE_FLOOR_RAISE + (BANK_H - bankOffset(uc)) - LEVEL_U * (u - MOUTH_U) - LEVEL_V * v + 0.03 * clamp(s, 0, 25);
}

/** Region where the floor lift applies (chamber + ledge in front of the mouth). */
export function liftMask(u: number, v: number, cd: number): number {
  // the ledge: a rounded, irregular apron in front of the mouth
  const eu = (u + 1.2) / (u < -1.2 ? 3.6 : 6), ev = (v - 0.4) / 6.0;
  const ed = Math.sqrt(eu * eu + ev * ev) + 0.12 * gnoise(v * 0.45, u * 0.45, 909);
  const ledge = 1 - smoothstep(0.8, 1.7, ed);
  const chamber = (1 - smoothstep(0.8, 2.8, cd)) * smoothstep(-3.4, -1.4, u);
  return Math.max(ledge, chamber);
}

/** Signed coverage of the cave floor mesh (< 0 inside). cd = distance to path − half-width. */
export function floorCover(u: number, cd: number): number {
  return Math.max(cd - 1.1, FLOOR_RIM_U - u);
}
/** Terrain sink under the floor mesh (terrain hides just below it). */
export function floorSink(e: number): number {
  return 0.3 * (1 - smoothstep(-0.8, 0, e));
}
/** Floor mesh dip at its rim (it tucks under the heightfield). */
export function floorDip(e: number): number {
  return 0.14 * smoothstep(-0.45, 0.45, e);
}

export interface CaveLocal {
  u: number;
  v: number;
  uc: number;
}
export function caveLocal(a: CaveAnchor, x: number, z: number, d: number, out: CaveLocal): CaveLocal {
  out.u = (x - (a.centerX + a.side * (a.d + 2))) * a.side;
  out.v = z - a.z;
  out.uc = d * a.side - (a.d + 2);
  return out;
}

const tmpL: CaveLocal = { u: 0, v: 0, uc: 0 };
const tmpH: ChamberHit = { s: 0, l: 0, dist: 0 };

/**
 * Additive terrain offset of the cave formation at (x, z).
 * @param d signed lateral offset from the centreline at z (x - centerX(z))
 */
export function caveTerrainOffset(a: CaveAnchor, x: number, z: number, d: number, seed: number): number {
  const cz = Math.abs(z - a.z);
  if (cz >= CAVE_INFLUENCE_Z) return 0;
  const L = caveLocal(a, x, z, d, tmpL);
  const uc = L.uc, u = L.u, v = L.v;
  if (uc <= -24) return 0;
  const zm = 1 - smoothstep(55, 120, cz);
  const bank = bankOffset(uc) * zm;
  const Hc = cliffHeight(x, z, v, seed) * zm;
  const cliff = Hc * smoothstep(-4, -4 + cliffRun(L.v), uc);
  const w = formBand(v);
  const core = (1 - smoothstep(0.5, 0.95, w)) * (1 - smoothstep(FORM.uBack - 7, FORM.uBack, uc));
  if (core <= 0 || u < -12) return bank + cliff;
  // inside the formation: a terrain cliff that stays behind the visible rock face …
  // the rock face is the classic cliff profile with a near-vertical lower wall (see rockField);
  // the terrain stays 2.6 m behind both
  const fIn = faceBase(v, seed) + 2.6;
  const inner = Hc * Math.min(smoothstep(fIn, fIn + 4, uc), smoothstep(-4 + 2.6, 4 + 2.6, uc));
  // … dropping to the chamber floor along the cave, and lifted to the ledge in front of the mouth
  // quick reject far from the chamber (most of the formation footprint)
  let cd = 99;
  let chS = 0;
  if (u > -16 && u < 27 && v > -11 && v < 26) {
    const ch = chamberQuery(u, v, tmpH);
    cd = ch.dist - chamberHalfWidth(ch.s);
    chS = ch.s;
  }
  const lift = floorLiftRaw(u, v, uc, chS);
  const sink = floorSink(floorCover(u, cd));
  const liftGround = lift * liftMask(u, v, cd) - sink;
  const chamberRamp = lift - sink + 3.0 * Math.max(0, cd - 1.1);
  let ground = Math.max(liftGround, Math.min(inner, chamberRamp));
  // on the flanks the rock lies on the (gentle) terrain slope: keep the terrain under both
  ground += (Math.min(cliff, ground) - ground) * smoothstep(0, 0.15, w);
  return bank + cliff + (ground - cliff) * core;
}

/**
 * Height modification for the cliff and the cave formation.
 * @param x,z  world position
 * @param d    signed lateral offset from the centreline at z (x - centerX(z))
 * @param h    terrain height before the cave is applied
 * @param seed world seed
 */
export function caveTerrainHeight(a: CaveAnchor, x: number, z: number, d: number, h: number, seed: number): number {
  return h + caveTerrainOffset(a, x, z, d, seed);
}
