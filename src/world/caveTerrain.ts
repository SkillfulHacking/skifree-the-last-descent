/**
 * Cave ↔ heightfield contract.
 *
 * A cave is placed by a CaveAnchor (any number of caves can exist on a course). The heightfield
 * calls `caveTerrainHeight` for points near an anchor; the cave mesh (src/world/Cave.ts) is built
 * from the same anchor and the same layout functions below, so the terrain cut and the rock mass are
 * designed together and never drift apart.
 *
 * The cave sits in a band of rock cropping out at the foot of the valley-side hillside: a stratified
 * face (full height around the mouth, tapering out under the snow 45–55 m to either side), with the snow
 * slope continuing up and back from its top, stepped by rock benches. The heightfield *is* that hillside;
 * its own cliff step stays hidden a few metres behind the rock face, so the rock never stands on the
 * slope as an object and there is no edge where rock and heightfield meet except the snow line. The
 * chamber runs ~24 m into the hill and bends downhill (so its back is never in line of sight from the
 * piste); along it the heightfield drops to just under the cave's own floor mesh, and a ledge is lifted
 * in front of the mouth.
 *
 * Every modification is an additive offset on top of the natural terrain `h` (caveTerrainHeight =
 * h + caveTerrainOffset), so the cave builder can recover `h` from `Mountain.heightAt` exactly.
 *
 * Frames (all in metres):
 *  - `u`  = distance INTO the hill from the mouth reference point, along -outward (Cartesian);
 *  - `v`  = z - anchor.z (lateral, +Z = downhill; NOT mirrored by `side`);
 *  - `uc` = distance into the hill measured from the cliff line (follows the centreline: d·side − (D+2)).
 * Heights are relative to the natural terrain `h`; `bankOffset` is the snow bank rising to the cliff;
 *  - `t`  = uc − faceBase(v): distance behind the face line.
 */
import { clamp, gnoise, smoothstep } from '../core/rng';

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
/**
 * The exposed rock band (an outcrop of the hillside, not an object on it): full height for
 * |v - vc| < core, tapering (noise-modulated) until the rock has disappeared under the snow slope at
 * `up` metres uphill / `down` metres downhill.
 */
export const FORM = { vc: 1, core: 9, up: 44, down: 56 } as const;
/** Lateral extent (v) of everything the formation can touch, with margin for the noise. */
export const FORM_V0 = -58;
export const FORM_V1 = 70;
/** Exposed height of the face above the bank in the core. */
export const BAND_H = 16.5;
/** The hillside above and behind the band rises HILL_R over the scale length HILL_L (initial slope ≈ R/L). */
const HILL_R = 18;
const HILL_L = 36;
/** The heightfield's (hidden) cliff step sits this far behind the rock face line. */
export const STEP_IN = 3.2;
/** Thickness of the bedding planes (rock and the stepped benches above the face). */
export const BED = 2.3;
/** The floor mesh is cut at this u (just outside the mouth line); the ledge beyond is heightfield. */
export const FLOOR_RIM_U = -1.7;

export function bankOffset(uc: number): number {
  return BANK_H * smoothstep(-22, -3, uc);
}

/** Noise-displaced lateral distance from the band centre (so its ends are not symmetric or smooth). */
function bandDist(v: number, seed: number): number {
  const av = Math.abs(v - FORM.vc);
  return av + (6 * gnoise(v * 0.04 + 0.5, 4.4, seed + 101) + 2.5 * gnoise(v * 0.12, 2.2, seed + 102)) * smoothstep(FORM.core - 2, FORM.core + 8, av);
}

/** Lateral profile of the band, 1 in the core … 0 where it has gone under the snow: a plateau, a drop to a
 *  long lower band, a second drop to a low ledge of rock, then nothing. */
export function bandTaper(v: number, seed: number): number {
  const ad = bandDist(v, seed);
  const reach = v < FORM.vc ? FORM.up : FORM.down;
  return Math.max(0, 1 - 0.42 * smoothstep(FORM.core, FORM.core + 9, ad) - 0.3 * smoothstep(FORM.core + 15, FORM.core + 21, ad) - 0.28 * smoothstep(reach - 13, reach, ad));
}

/** 0 in the core of the band, 1 where it has gone under the snow. */
export function formBand(v: number, seed: number): number {
  return 1 - bandTaper(v, seed);
}

/** Exposed height of the rock face above the bank (0 beyond the ends of the band). */
export function bandHeight(v: number, seed: number): number {
  const tp = bandTaper(v, seed);
  if (tp <= 0) return 0;
  const vary = 2.0 * gnoise(v * 0.07, 7.7, seed + 103) + 1.0 * gnoise(v * 0.19, 1.3, seed + 104);
  return Math.max(0, BAND_H * tp + vary * (0.4 + 0.6 * smoothstep(4, 12, Math.abs(v - FORM.vc))) * smoothstep(0, 0.25, tp));
}

/** Base line (uc) of the face: buttresses and bays, curving back into the hillside toward the ends. */
export function faceBase(v: number, seed: number): number {
  const av = Math.abs(v - FORM.vc);
  const wav = 1.7 * gnoise(v * 0.075, 3.1, seed + 77) + 0.6 * gnoise(v * 0.21, 8.3, seed + 78);
  const calm = 1 - 0.65 * (1 - smoothstep(5, 13, Math.abs(v)));
  const bay = 5 * Math.pow(smoothstep(8, 60, av), 1.5);
  return -1.8 + wav * calm + bay;
}

/** max(t, 0), C¹-rounded over [-3, 3] (no crease where the hillside leaves the bank). */
function softPos(t: number): number {
  return t >= 3 ? t : t <= -3 ? 0 : ((t + 3) * (t + 3)) / 12;
}
/** Rise of the snow hillside above the top of the band, `t` metres behind the face line. */
export function hillRise(t: number, v: number, seed: number): number {
  const sp = softPos(t);
  // wind-shaped undulation and shallow gullies on the slope (none at the very edge of the band)
  const und = (1.6 * gnoise(v * 0.045, t * 0.05, seed + 111) + 0.6 * gnoise(v * 0.12, t * 0.1, seed + 112)) * smoothstep(2, 14, t);
  return HILL_R * (1 - Math.exp(-sp / HILL_L)) + und;
}
/** Smooth lateral envelope of the band height (what the hillside high above it "remembers"). */
export function bandEnvelope(v: number): number {
  const dv = v - FORM.vc;
  const reach = dv < 0 ? FORM.up : FORM.down;
  return BAND_H * (1 - smoothstep(FORM.core - 4, reach + 8, Math.abs(dv)));
}
/** Height of the band's top surface under the hillside: the band's own (stepped, noisy) height at the
 *  face, relaxing to the smooth envelope higher up the slope (no ridges running up the hill). */
export function hillBase(t: number, v: number, H: number): number {
  return H + (bandEnvelope(v) - H) * smoothstep(5, 24, t);
}
/** Heightfield surface (above the bank) of the hillside with the band: the cliff step hides inside the rock. */
export function hillSurface(t: number, v: number, H: number, seed: number): number {
  return hillBase(t, v, H) * smoothstep(STEP_IN, STEP_IN + 3, t) + hillRise(t, v, seed);
}
/** Steepness of the heightfield's drop into the chamber pit (hidden inside the chamber walls and roof). */
export const PIT_K = 14;
/** The pit's rim: beyond this (cd = distance to the chamber path − half-width) the heightfield is the hillside again. */
export function pitRim(hill: number): number {
  return 1.1 + hill / PIT_K;
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
export function floorCover(u: number, v: number, cd: number): number {
  return Math.max(cd - 1.1, floorRimDist(u, v));
}
/** Signed distance (u) past the floor mesh's outer rim at the mouth: an irregular line, not a smooth arc
 *  (the ledge snow reaches into the mouth further in places). */
export function floorRimDist(u: number, v: number): number {
  return FLOOR_RIM_U - u + 0.45 * gnoise(v * 0.55 + 0.2, u * 0.55, 919);
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
  const zm = 1 - smoothstep(60, 120, cz);
  const bank = bankOffset(uc) * zm;
  // the hillside with the rock band at its foot (the band's cliff step stays hidden inside the rock)
  const hill = hillSurface(uc - faceBase(v, seed), v, v > FORM_V0 && v < FORM_V1 ? bandHeight(v, seed) : 0, seed) * zm;
  if (u < -12 || !(u > -16 && u < 27 && v > -11 && v < 26)) return bank + hill;
  // the chamber: the terrain drops to just under the cave's own floor mesh; the ledge in front of the
  // mouth is lifted to the floor level
  const ch = chamberQuery(u, v, tmpH);
  const cd = ch.dist - chamberHalfWidth(ch.s);
  const lift = floorLiftRaw(u, v, uc, ch.s);
  const sink = floorSink(floorCover(u, v, cd));
  const liftGround = lift * liftMask(u, v, cd) - sink;
  const chamberRamp = lift - sink + PIT_K * Math.max(0, cd - 1.1);
  return bank + Math.max(liftGround, Math.min(hill, chamberRamp));
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
