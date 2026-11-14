/**
 * Coast: an optional terrain capability that turns one side of the valley into a sea coast —
 * the cliff rim beside the piste, enormous fjord walls dropping to cold water, the fjord bed,
 * islands and skerries, the mountains across the fjord, headland ridges between fjord arms and,
 * on finite courses, the open ocean beyond the finish harbour. Pure (no three.js): the same model
 * drives the heightfield (Mountain.heightAt), physics (the cornice guard), placement (obstacles,
 * vegetation, hazards), the water renderer and the tests.
 *
 * Sea level on a mountain that descends for 50 km
 * ------------------------------------------------
 * The course loses ~0.3 m of height per metre travelled, so a single sea level would leave the
 * top of a long course kilometres above the water. The coast is therefore a chain of *reaches*
 * (fjord arms), each with its own level water, separated by headland ridges ("crests") that cross
 * the fjord. A reach's water lies `margin` metres below the course at its downstream crest, so the
 * fjord walls stay 0.3–1.3 km high everywhere. At each crest the next, lower arm begins; the bed
 * and the levels blend only inside the ridge, so the edges of the level water surfaces are always
 * hidden under rock. The last reach of a finite course is the open sea: its level is the harbour
 * quay at the finish, and beyond the shoreline the land drops away to the horizon.
 *
 * Sprint (≤ 4 km) has a single reach: from the summit you look straight down at the harbour.
 *
 * Convention: the sea is on −X, the skier's RIGHT when facing downhill (the camera looks down +Z,
 * so +X is on the left of the screen). The rim is measured from
 * the piste edge; the far shore and islands are placed in absolute x.
 */
import { Rng, clamp, fbm, gnoise, ridged, smoothstep } from '../core/rng';
import type { CliffBand, CourseProfile, GapCut, Kicker } from './profile';

/** Coast tuning (data, part of a biome's terrain). Ranges are [min, max]. */
export interface CoastParams {
  /** average fjord-arm length between headland crests, m */
  readonly reach: number;
  /** course height above an arm's water at its downstream crest, m */
  readonly margin: readonly [number, number];
  /** distance from the piste edge to the cliff rim, m */
  readonly rim: readonly [number, number];
  /** cliff horizontal extent per metre of cliff height (0.35 ≈ 70° average face) */
  readonly steep: readonly [number, number];
  /** |x| of the far shore across the fjord, m */
  readonly far: readonly [number, number];
  /** height of the mountains across the fjord above the water, m */
  readonly farHeight: readonly [number, number];
  /** fjord bed depth below the water, m */
  readonly depth: number;
  /** height of the cornice berm along the rim, m */
  readonly berm: readonly [number, number];
  /** harbour quay height above the sea at the finish, m */
  readonly quay: number;
  /** distance from the finish line to the harbour quay front, m */
  readonly quayZ: number;
  /**
   * Optional (round 3, art request R1): on open stretches the cliff rim runs this far from the
   * racing line, [min, max] m, instead of beyond the far edge of the piste, so the sea and the drop
   * are in the gameplay view. Kept off near the start, the caves, the refuges and the finish (set
   * pieces keep their room). min must stay above RIM_LINE_CLEAR so the cornice never reaches a line.
   */
  readonly nearRim?: readonly [number, number];
  /**
   * Round 4 (art pipeline): the sea cliffs are authored meshes (src/world/art/cliffKit.ts) instead
   * of heightfield faces. The Mountain then draws only a hidden backing under the sea side
   * (Mountain.heightAt); every land-side height (gameplay) is unchanged.
   */
  readonly cliffKit?: boolean;
}

/**
 * No racing or alternate line (nor a kicker, cliff band or gap) comes closer than this to the rim
 * crest: the cornice guard starts 36 m inside the crest (Coast.guard), so lines stay on clean snow.
 */
export const RIM_LINE_CLEAR = 44;

/** distance from the piste edge to the rim when it follows the piste (pure; Coast.rimX) */
export function rimOffsetRaw(p: CoastParams, seed: number, z: number): number {
  const [a, b] = p.rim;
  const n = 0.5 + 0.5 * fbm(z / 620, 3.7, seed + 61, 2) + 0.18 * gnoise(z / 97, 1.3, seed + 62);
  return a + (b - a) * clamp(n, 0, 1);
}

/** racing line → rim distance where the rim comes in close (pure; see CoastParams.nearRim) */
export function nearRimDistance(p: CoastParams, seed: number, z: number): number {
  const nr = p.nearRim;
  if (!nr) return Infinity;
  const n = 0.5 + 0.62 * fbm(z / 540, 5.3, seed + 120, 2) + 0.12 * gnoise(z / 233, 2.4, seed + 121);
  return nr[0] + (nr[1] - nr[0]) * clamp(n, 0, 1);
}

/** where the rim may come in close (0 = keeps to the piste edge): open stretches, away from set pieces */
export function nearRimMask(P: CourseProfile, z: number): number {
  let k = smoothstep(380, 600, z);
  if (Number.isFinite(P.finishZ)) k *= 1 - smoothstep(P.finishZ - 560, P.finishZ - 360, z);
  for (const e of P.encounters(z - 900, z + 900)) {
    k *= smoothstep(260, 440, Math.abs(z - e.caveZ));
    if (e.checkpointZ !== null) k *= smoothstep(380, 560, Math.abs(z - e.checkpointZ));
  }
  return k;
}

export interface Reach {
  readonly index: number;
  /** upstream crest (−2600 for the first arm: the fjord head) */
  readonly z0: number;
  /** downstream crest (Infinity for the open sea) */
  readonly z1: number;
  /** water level of this arm */
  readonly level: number;
  /** true for the open sea beyond a finite course's finish */
  readonly ocean: boolean;
}

/** Where a small fishing hamlet sits on a strand flat at the foot of the fjord wall. */
export interface Hamlet {
  readonly id: number;
  readonly z: number;
  readonly reach: number;
  readonly seed: number;
}

/** A scenic viewpoint on the rim: optional, off the racing line, discovered by skiing into it. */
export interface Lookout {
  /** stable id, unique per course and location ("vp-<world seed>-<length>-<z>") */
  readonly id: string;
  readonly n: number;
  readonly x: number;
  readonly z: number;
  /** discovery radius (m) */
  readonly r: number;
  /** a chase-stretch viewpoint close beside the line (obstacles keep the swerve to it clear) */
  readonly chase?: boolean;
}

/** a sea-side cave: the rim crest runs this far behind the cave cliff's base line (m) … */
export const SEA_CAVE_BACK = 72;
/** … within this z distance of the cave, fading out by the next */
const SEA_CAVE_RIM_NEAR = 150;
const SEA_CAVE_RIM_FAR = 260;
/** rim cache grid (m) */
const RIM_CELL = 8;
/** round 6: islands are drawn as scanned rock meshes; the heightfield keeps a shoal (m relative to the water) */
export const MESH_ISLANDS = true;
const ISLAND_BASE = -8;
/** viewpoints: free stretches start this far down the run-in / past a refuge, end this far before a trigger */
const LOOKOUT_RUNIN = 90;
const LOOKOUT_AFTER_REFUGE = 170;
const LOOKOUT_BEFORE_TRIGGER = 45;
/** chase viewpoints: not in the first / last metres of a chase (the leap from the cave, the finish or refuge approach) */
const LOOKOUT_CHASE_AFTER_CAVE = 260;
const LOOKOUT_CHASE_BEFORE_END = 320;
/** one chase viewpoint per this many metres of chase */
const LOOKOUT_CHASE_SPACING = 600;
/** a chase viewpoint stands this far inside the rim crest (outside the cornice zone) … */
const LOOKOUT_CHASE_INSET = 37;
/** … and this far (min/max) to the sea side of the racing line */
export const LOOKOUT_CHASE_MIN = 15;
export const LOOKOUT_CHASE_MAX = 20;

/** discovery radius of a viewpoint */
export const LOOKOUT_RADIUS = 14;
/** how far inside the rim crest a viewpoint stands (outside the cornice zone) */
export const LOOKOUT_INSET = 44;

/** z of the first arm's head ridge (the fjord ends here, behind the summit). */
export const FJORD_HEAD_Z = -2600;
/** half-width (m, along z) of the headland ridges that separate fjord arms */
const RIDGE_SIGMA = 260;
/** bed / level blend half-window around a crest (inside the ridge) */
const BED_BLEND = 150;
/** far-shore level blend half-window around a crest */
const FAR_BLEND = 700;
/** height of the ridge above the higher arm's water at the rim (always below the rim) */
const RIDGE_CLEAR = 14;

export class Coast {
  private crests: number[] = [];
  private levels: number[] = [];
  private oceanLevel = NaN;
  private hamletList: Hamlet[] = [];
  private nextHamletReach = 0;
  private rng: Rng;
  private lookoutList: Lookout[] = [];
  /** terrain sampler (set by the Mountain) for placement checks */
  terrain: ((x: number, z: number) => number) | null = null;
  readonly finite: boolean;
  readonly finishZ: number;

  constructor(
    readonly profile: CourseProfile,
    readonly seed: number,
    readonly p: CoastParams,
  ) {
    this.finite = !profile.endless && Number.isFinite(profile.finishZ);
    this.finishZ = profile.finishZ;
    this.rng = new Rng((seed ^ 0x5eac0a57) >>> 0);
    if (this.finite) {
      const L = profile.finishZ;
      const n = L <= 4000 ? 0 : Math.ceil((L - 1800) / p.reach);
      const spacing = (L - 1500) / (n + 1);
      for (let i = 0; i < n; i++) this.pushCrest(spacing * (i + 1) + this.rng.range(-0.12, 0.12) * spacing);
      this.oceanLevel = profile.baseHeight(L + p.quayZ) - p.quay;
    } else this.extend(20000);
  }

  private pushCrest(z: number) {
    this.crests.push(z);
    this.levels.push(this.profile.baseHeight(z) - this.rng.range(this.p.margin[0], this.p.margin[1]));
  }

  /** Endless: generate crests ahead of z (deterministic: always generated in order). */
  private extend(z: number) {
    if (this.finite) return;
    while (!this.crests.length || this.crests[this.crests.length - 1]! < z + 8000) this.pushNext();
  }

  private pushNext() {
    const last = this.crests.length ? this.crests[this.crests.length - 1]! : -400;
    this.pushCrest(last + this.p.reach * this.rng.range(0.82, 1.18));
  }

  /** Endless: make sure crest i (and the one after it) exists. */
  private ensureIndex(i: number) {
    if (this.finite) return;
    while (this.crests.length <= i + 1) this.pushNext();
  }

  /** Index of the reach containing z. */
  private reachIndex(z: number): number {
    this.extend(z);
    const c = this.crests;
    let lo = 0;
    let hi = c.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (c[mid]! <= z) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private levelOf(i: number): number {
    this.ensureIndex(i);
    if (i < this.levels.length) return this.levels[i]!;
    return this.finite ? this.oceanLevel : this.levels[this.levels.length - 1]!;
  }

  reach(i: number): Reach {
    this.ensureIndex(i);
    const ocean = this.finite && i >= this.crests.length;
    return { index: i, z0: i === 0 ? FJORD_HEAD_Z : this.crests[i - 1]!, z1: i < this.crests.length ? this.crests[i]! : Infinity, level: this.levelOf(i), ocean };
  }

  /** The reach (fjord arm) at z. */
  reachAt(z: number): Reach {
    return this.reach(this.reachIndex(z));
  }

  /** Reaches overlapping [z0, z1]. */
  reaches(z0: number, z1: number): Reach[] {
    const out: Reach[] = [];
    const a = this.reachIndex(Math.max(z0, FJORD_HEAD_Z));
    const b = this.reachIndex(z1);
    for (let i = a; i <= b; i++) out.push(this.reach(i));
    return out;
  }

  /** Water level of the arm at z (a step function: level within each arm). */
  seaLevelAt(z: number): number {
    return this.levelOf(this.reachIndex(z));
  }

  /** Crests (headland ridges) within [z0, z1]. */
  crestsIn(z0: number, z1: number): number[] {
    this.extend(z1);
    return this.crests.filter((c) => c >= z0 && c <= z1);
  }

  /** level blended across a crest over ±win (continuous; used inside the ridge only) */
  private blendedLevel(z: number, win: number): number {
    const i = this.reachIndex(z);
    let lv = this.levelOf(i);
    // the crest just upstream (z > crest) or downstream (z < crest) within the window
    const up = i > 0 ? this.crests[i - 1]! : -Infinity;
    const down = i < this.crests.length ? this.crests[i]! : Infinity;
    if (z - up < win) lv = this.levelOf(i - 1) + (lv - this.levelOf(i - 1)) * smoothstep(up - win, up + win, z);
    else if (down - z < win) lv = lv + (this.levelOf(i + 1) - lv) * smoothstep(down - win, down + win, z);
    return lv;
  }

  /** ridge strength (0..1) of the nearest crest or the fjord head, and the higher arm's level */
  private ridgeAt(z: number): { bell: number; level: number } {
    const i = this.reachIndex(z);
    let best = 0;
    let level = 0;
    const consider = (c: number, lv: number) => {
      const u = (z - c) / RIDGE_SIGMA;
      const b = Math.exp(-u * u);
      if (b > best) {
        best = b;
        level = lv;
      }
    };
    consider(FJORD_HEAD_Z, this.levelOf(0));
    if (i > 0) consider(this.crests[i - 1]!, this.levelOf(i - 1));
    if (i < this.crests.length) consider(this.crests[i]!, this.levelOf(i));
    return { bell: best, level };
  }

  // --- the coastline beside the course ------------------------------------------------------
  /** distance from the sea-side piste edge to the cliff rim at z */
  rimOffset(z: number): number {
    return this.profile.centerX(z) - this.profile.halfWidth(z) - this.rimX(z);
  }

  /**
   * absolute x of the rim crest (cliff edge) at z: beyond the sea-side piste edge, or (nearRim, on
   * open stretches) 46–72 m from the racing line, whichever is closer to the line. Cached on an 8 m
   * grid (linear in between: the underlying curve is smooth at that scale).
   */
  rimX(z: number): number {
    if (!this.p.nearRim) return this.rimAt(z);
    const u = z / RIM_CELL;
    const i = Math.floor(u);
    const a = this.rimCell(i);
    const b = this.rimCell(i + 1);
    return a + (b - a) * (u - i);
  }

  private rimCache = new Map<number, number>();
  private rimCell(i: number): number {
    let v = this.rimCache.get(i);
    if (v === undefined) {
      if (this.rimCache.size > 60000) this.rimCache.clear();
      v = this.rimAt(i * RIM_CELL);
      this.rimCache.set(i, v);
    }
    return v;
  }

  private rimAt(z: number): number {
    const P = this.profile;
    let edge = P.centerX(z) - P.halfWidth(z) - rimOffsetRaw(this.p, this.seed, z);
    // a Yeti cave on the sea side (art request R4): the cliff runs behind its hillside, close enough
    // that the fjord shows over it in the encounter's shots, far enough to leave the hill whole
    for (const e of P.encounters(z - 300, z + 300)) {
      const a = e.anchor;
      if (a.side > 0) continue;
      const k = 1 - smoothstep(SEA_CAVE_RIM_NEAR, SEA_CAVE_RIM_FAR, Math.abs(z - a.z));
      if (k <= 0) continue;
      const behind = a.centerX - a.d - SEA_CAVE_BACK;
      if (behind < edge) edge += (behind - edge) * k;
    }
    if (!this.p.nearRim) return edge;
    const near = P.routeX(z) - nearRimDistance(this.p, this.seed, z);
    if (near <= edge) return edge;
    return edge + (near - edge) * nearRimMask(P, z);
  }

  /** signed distance beyond the rim (x side of the sea): < 0 inside the rim, > 0 over the cliff */
  beyondRim(x: number, z: number): number {
    return this.rimX(z) - x;
  }

  /** cornice berm height at z */
  private bermHeight(z: number): number {
    return this.p.berm[0] + (this.p.berm[1] - this.p.berm[0]) * (0.5 + 0.5 * gnoise(z / 140, 7.1, this.seed + 63));
  }

  /**
   * The cornice zone along the rim: 0 on the piste, rising to 1 over the last ~22 m before the
   * cliff edge (deep wind-loaded snow behind the cairns). Used by the surface model to stop a
   * skier who heads for the edge, and by placement code to keep the rim clear.
   */
  guard(x: number, z: number): number {
    return smoothstep(-36, -12, this.beyondRim(x, z));
  }

  /** |x| of the far shore across the fjord at z (bays and spurs every few hundred metres) */
  farShore(z: number): number {
    const [a, b] = this.p.far;
    return a + (b - a) * clamp(0.5 + 0.6 * fbm(z / 2300, 9.1, this.seed + 64, 2), 0, 1) + 230 * gnoise(z / 640, 4.4, this.seed + 77) + 70 * gnoise(z / 170, 1.9, this.seed + 78);
  }

  /** cliff extent per metre of height (steepness character changes along the coast) */
  private steep(z: number): number {
    const [a, b] = this.p.steep;
    return a + (b - a) * clamp(0.5 + 0.7 * fbm(z / 900, 2.2, this.seed + 65, 2), 0, 1);
  }

  // --- the finish harbour -------------------------------------------------------------------
  /** z of the shoreline at x (finite courses): the quay front by the finish, a headland on +X */
  shoreZ(x: number): number {
    const L = this.finishZ;
    const d = x - this.profile.centerX(L);
    const head = 1250 * smoothstep(170, 420, d) * (1 - smoothstep(1900, 2900, d));
    const wobble = d > 140 ? 70 * gnoise(d / 260, 3.3, this.seed + 66) : 0;
    return L + this.p.quayZ + head + wobble;
  }

  /** the open sea's level (finite courses), else NaN */
  get seaLevel(): number {
    return this.oceanLevel;
  }

  // --- hamlets on strand flats ---------------------------------------------------------------
  /** Fishing hamlets at the foot of the fjord wall overlapping [z0, z1] (deterministic). */
  hamlets(z0: number, z1: number): Hamlet[] {
    // generated per reach in order: one or two per arm, never at a crest
    const last = this.reachIndex(z1 + 2000);
    while (this.nextHamletReach <= last) {
      const r = this.reach(this.nextHamletReach);
      const k = this.nextHamletReach++;
      const a = Math.max(r.z0 + 500, -200);
      const b = Number.isFinite(r.z1) ? r.z1 - 500 : this.finite ? this.finishZ - 600 : a + 2500;
      if (b - a < 300) continue;
      const rr = new Rng((this.seed ^ Math.imul(k + 11, 0x2c1b3c6d)) >>> 0);
      const n = b - a > 1800 ? 2 : 1;
      for (let j = 0; j < n; j++) {
        const z = a + ((j + rr.range(0.3, 0.7)) / n) * (b - a);
        this.hamletList.push({ id: k * 4 + j, z, reach: k, seed: rr.int(1, 1e9) });
      }
    }
    return this.hamletList.filter((h) => h.z >= z0 && h.z <= z1);
  }

  /** 0..1 strand-flat strength at z (a hamlet's terrace at the cliff foot) */
  strandMask(z: number): number {
    return this.hamletMask(z);
  }

  /** the islands' surface height at (x, z) (far below the bed where there is none) */
  islandHeight(x: number, z: number): number {
    return this.island(x, z, this.blendedLevel(z, BED_BLEND));
  }

  /** 0..1 strand-flat strength at z (a hamlet's terrace at the cliff foot) */
  private hamletMask(z: number): number {
    const c = this.hamCache;
    if (z < c.z0 || z > c.z1) {
      const z0 = Math.floor(z / 1024) * 1024 - 512;
      this.hamCache = { z0, z1: z0 + 2048, list: this.hamlets(z0 - 300, z0 + 2048 + 300).map((h) => h.z) };
    }
    let m = 0;
    for (const hz of this.hamCache.list) {
      const d = Math.abs(z - hz);
      if (d < 260) m = Math.max(m, 1 - smoothstep(110, 260, d));
    }
    return m;
  }
  private hamCache: { z0: number; z1: number; list: number[] } = { z0: 1, z1: 0, list: [] };

  // --- scenic viewpoints --------------------------------------------------------------------
  /**
   * Viewpoints on the cliff rim overlapping [z0, z1]. Two kinds, both optional and never on the
   * racing line:
   *  - free stretches (nothing chasing you): the run-in before the first cave's trigger and the
   *    reprieve after each refuge. One every 350–550 m (at least one per stretch), inside the
   *    cornice zone's edge, a gentle climb from the racing line.
   *  - chase stretches (round 3, B N2 / E2): where the rim runs close to the line (CoastParams
   *    .nearRim), a platform 15–20 m off the line on the sea side, reached by a few metres' swerve
   *    (its discovery radius reaches to within 2–16 m of the line): a measured detour costs a
   *    tenth of a second or two, so looking at the view never costs the chase.
   * Deterministic and independent of how it is queried: generated stretch by stretch, in order down
   * the course, each stretch from its own seed; a finite course looks at all of its encounters.
   */
  lookouts(z0: number, z1: number): Lookout[] {
    const P = this.profile;
    // a finite course plans all of its encounters up front: look at all of them, so the answer
    // never depends on the size or order of the queries (round 2, E1: a small first query used to
    // end placement after the run-in); Endless generates them ahead of the query
    const horizon = P.endless ? Math.max(z1, 0) + 3000 : Math.max(P.finishZ, 0) + 1;
    while (this.lookoutStretch >= 0) {
      const k = this.lookoutStretch;
      const enc = P.encounters(-Infinity, horizon).filter((e) => e.index === k)[0];
      if (!enc) {
        // no more caves on a finite course (the last chase was placed with its cave); Endless
        // resumes on a later query
        if (!P.endless) this.lookoutStretch = -1;
        break;
      }
      const prev = k === 0 ? null : P.encounters(-Infinity, enc.caveZ).find((e) => e.index === k - 1);
      const a = k === 0 ? LOOKOUT_RUNIN : (prev?.checkpointZ ?? prev?.chaseEndZ ?? enc.caveZ) + LOOKOUT_AFTER_REFUGE;
      const b = enc.triggerZ - LOOKOUT_BEFORE_TRIGGER;
      if (P.endless && a > z1 + 400 && this.lookoutStretch > 0) break;
      this.placeLookouts(k, a, b);
      const end = Number.isFinite(enc.chaseEndZ) ? enc.chaseEndZ : P.finishZ;
      this.placeChaseLookouts(k, enc.triggerZ + LOOKOUT_CHASE_AFTER_CAVE, end - LOOKOUT_CHASE_BEFORE_END);
      this.lookoutStretch++;
      if (P.endless && end > z1 + 400) break;
    }
    return this.lookoutList.filter((l) => l.z >= z0 && l.z <= z1);
  }
  private lookoutStretch = 0;

  private lookoutId(z: number): string {
    const P = this.profile;
    const lenTag = Number.isFinite(P.length) ? `${Math.round(P.length / 1000)}k` : 'inf';
    // unique per course and location: the world seed mixes in the biome; the length and z name the spot
    return `vp-${(this.seed >>> 0).toString(36)}-${lenTag}-${Math.round(z)}`;
  }

  private placeLookouts(k: number, a: number, b: number) {
    const P = this.profile;
    if (b - a < 40) return;
    const rr = new Rng((this.seed ^ Math.imul(k + 3, 0x6b43a9b5)) >>> 0);
    const n = Math.max(1, Math.floor((b - a) / 450));
    for (let j = 0; j < n; j++) {
      let z = a + ((j + rr.range(0.3, 0.7)) / n) * (b - a);
      let ok = false;
      let xv = this.rimX(z) + LOOKOUT_INSET;
      for (let t = 0; t < 9 && !ok; t++) {
        if (t > 0) z = a + ((j + rr.range(0.05, 0.95)) / n) * (b - a);
        const H = this.terrain;
        xv = this.rimX(z) + LOOKOUT_INSET;
        if (!H) {
          ok = true;
          break;
        }
        // a short, gentle climb from the racing line: as close to the rim as that allows (where a
        // hillside rises toward the rim — e.g. around a sea-side cave — the platform moves in)
        const rx = P.routeX(z);
        for (let x = xv; x < rx - 20 && !ok; x += 6) {
          const rise = H(x, z) - H(rx, z);
          const dist = rx - x;
          if (dist < 110 && rise < 9 && rise / dist < 0.15) {
            ok = true;
            xv = x;
          }
        }
      }
      if (!ok) continue;
      this.lookoutList.push({ id: this.lookoutId(z), n: this.lookoutList.length, x: xv, z, r: LOOKOUT_RADIUS });
    }
  }

  /** the ground between the line and a chase viewpoint is smooth: small second differences on a 3 m grid */
  private smoothSwerve(H: (x: number, z: number) => number, rx: number, x: number, z: number): boolean {
    for (const dz of [-60, -30, 0, 30]) {
      const zz = z + dz;
      const x0 = rx + (x - rx) * (dz < 0 ? (60 + dz) / 60 : 1) - 2;
      let a = H(x0 + 6, zz);
      let b = H(x0 + 3, zz);
      for (let xx = x0; xx >= x - 6; xx -= 3) {
        const c = H(xx, zz);
        if (Math.abs(a - 2 * b + c) > 0.3) return false;
        a = b;
        b = c;
      }
    }
    return true;
  }

  /** chase-stretch viewpoints: only where the rim is close to the line (cheap swerve), ~1 per 900 m */
  private placeChaseLookouts(k: number, a: number, b: number) {
    const P = this.profile;
    const H = this.terrain;
    if (!this.p.nearRim || !H || b - a < 300) return;
    const rr = new Rng((this.seed ^ Math.imul(k + 17, 0x2f6b9c35)) >>> 0);
    const n = Math.max(1, Math.round((b - a) / LOOKOUT_CHASE_SPACING));
    const kick: Kicker[] = [];
    const cliffs: CliffBand[] = [];
    for (let j = 0; j < n; j++) {
      for (let t = 0; t < 32; t++) {
        const z = a + ((j + rr.range(0.1, 0.9)) / n) * (b - a);
        const rx = P.routeX(z);
        const x = Math.max(this.rimX(z) + LOOKOUT_CHASE_INSET, rx - LOOKOUT_CHASE_MAX);
        const off = rx - x;
        if (off < LOOKOUT_CHASE_MIN) continue;
        // not into deep snow off the groomed line (a powder segment's ungroomed sides cost seconds)
        if (Math.max(P.powderBias(z - 70), P.powderBias(z), P.powderBias(z + 70)) > 0.3) continue;
        // where the line itself bows inland here, the swerve out to the sea side is that much longer
        const bow = rx - (P.routeX(z - 80) + P.routeX(z + 80)) / 2;
        if (off + Math.max(0, bow) > LOOKOUT_CHASE_MAX + 1) continue;
        // the guard must be clean, the swerve flat, and no jump or alternate line in the way
        if (this.guard(x, z) > 0) continue;
        if (H(x, z) - H(rx, z) > 1.3 || H(rx, z) - H(x, z) > 2 || P.slopeDeg(z) < 12) continue;
        // smooth snow on the way (no edge moguls, drifts or rollers to bounce over at speed)
        if (!this.smoothSwerve(H, rx, x, z)) continue;
        if (P.kickersNear(z - 100, z + 95, kick).length || P.cliffsNear(z - 100, z + 95, cliffs).length) continue;
        if (P.altRoutes(z - 80, z + 80).length) continue;
        this.lookoutList.push({ id: this.lookoutId(z), n: this.lookoutList.length, x, z, r: LOOKOUT_RADIUS, chase: true });
        break;
      }
    }
  }

  // --- gap jumps ------------------------------------------------------------------------------
  private gapCache: { z0: number; z1: number; list: GapCut[] } = { z0: 1, z1: 0, list: [] };
  /** Gullies overlapping [z0, z1] (the profile's gap jumps; none on profiles without them). */
  gaps(z0: number, z1: number): GapCut[] {
    const c = this.gapCache;
    if (z0 >= c.z0 && z1 <= c.z1) return c.list.filter((g) => g.z + g.len >= z0 && g.z <= z1);
    if (!this.profile.gapsNear) return [];
    const w0 = Math.floor(z0 / 256) * 256 - 256;
    const w1 = Math.ceil(z1 / 256) * 256 + 256;
    this.gapCache = { z0: w0, z1: w1, list: this.profile.gapsNear(w0, w1, []).slice() };
    return this.gapCache.list.filter((g) => g.z + g.len >= z0 && g.z <= z1);
  }

  /** depth of a gap gully at (x, z): steep-sided, flat-floored, fading out across the slope */
  gapDepth(x: number, z: number): number {
    const c = this.gapCache;
    if (!(z >= c.z0 && z <= c.z1)) this.gaps(z, z);
    let d = 0;
    for (const g of this.gapCache.list) {
      if (z < g.z || z > g.z + g.len) continue;
      const ax = Math.abs(x - g.x);
      if (ax > g.hw) continue;
      // a steep lip side, then a long ramp back up: still downhill on the slope, so a short jump
      // lands hard on it instead of slamming into a wall
      const along = smoothstep(g.z, g.z + 1.5, z) * (1 - smoothstep(g.z + 2, g.z + g.len, z));
      const across = 1 - smoothstep(g.hw - 5, g.hw, ax);
      d = Math.max(d, g.depth * along * across);
    }
    return d;
  }

  // --- the heightfield ----------------------------------------------------------------------
  /**
   * Coast-shaped height at (x, z). `h` is the land height there (Mountain without the coast) and
   * `land` samples it elsewhere (used once, at the rim). Continuous everywhere.
   */
  shape(x: number, z: number, h: number, land: (x: number, z: number) => number): number {
    // gap jumps: meltwater gullies cut across the ridgeline spines, running toward the cliff
    const gd = this.gapDepth(x, z);
    if (gd > 0) h -= gd;
    const xr = this.rimX(z);
    const t = xr - x; // beyond the rim (sea side)
    const ocean = this.finite && z > this.finishZ + 60;
    if (t < -36 && !ocean) return h;
    let out = h;
    if (t > -36) {
      const bH = this.bermHeight(z);
      const berm = bH * smoothstep(-34, -9, t) * (1 - smoothstep(-5, 5, t));
      if (t <= 0) out = h + berm;
      else out = this.seaSide(x, z, t, xr, berm, land);
    }
    if (ocean) out = this.oceanCut(x, z, out);
    return out;
  }

  private seaSide(x: number, z: number, t: number, xr: number, berm: number, land: (x: number, z: number) => number): number {
    const p = this.p;
    const s = this.seed;
    const hRim = land(xr, z);
    const lv = this.blendedLevel(z, BED_BLEND);
    const ridge = this.ridgeAt(z);
    const hm = this.hamletMask(z);
    // the cliff: a convex rim, a near-vertical face with ledges, a talus apron at the foot
    const foot = lv - 5 + 9.5 * hm; // a hamlet's strand flat sits ~4.5 m above the water
    const Hc = Math.max(1, hRim - foot);
    let Lc = clamp(Hc * this.steep(z), 26, 1200);
    Lc = Math.max(Lc, 26 + 220 * ridge.bell);
    // buttresses and gullies: the face position wanders along the coast
    // round 2 (art review D3): big buttresses and coves break the wall in plan (a ridged field
    // along the coast pushes whole sections of face seaward), on top of the old wander
    const butt = (ridged(z / 380, 1.7, s + 101, 2) - 0.45) * 0.42 * Lc + 0.12 * Lc * gnoise(z / 900, 4.1, s + 102);
    const tj = t + (16 * gnoise(z / 47, 0.37, s + 66) + 10 * gnoise(z / 13, 2.1, s + 67)) * smoothstep(0, 40, t) + (0.22 * Lc * gnoise(z / 430, 3.3, s + 89) + 0.1 * Lc * gnoise(z / 140, 7.7, s + 90) - butt) * smoothstep(0, 0.35 * Lc, t);
    const u = tj / Lc;
    let out: number;
    if (u < 1) {
      // the face profile: steeper towards the sea (no long snow apron at the waterline)
      let f = 0.72 * smoothstep(0, 0.5, u) + 0.28 * smoothstep(0.3, 1, u) * (0.7 + 0.3 * u);
      f = f / (0.72 + 0.28);
      // ledges (fjord walls step down in benches that hold snow): count and strength vary along
      // the coast, so the banding is never a regular stack
      const nL = 5 + 4 * (0.5 + 0.5 * gnoise(z / 520, 6.2, s + 103));
      const q = f * nL + 0.4 * gnoise(z / 210, 5.5, s + 68);
      const stair = (Math.floor(q) + smoothstep(0.25, 1, q - Math.floor(q))) / nL;
      const stairK = 0.2 + 0.3 * (0.5 + 0.5 * gnoise(z / 330, 2.9, s + 104));
      f = clamp(f + (stair - f) * stairK * smoothstep(0.04, 0.2, u) * (1 - smoothstep(0.8, 1, u)), 0, 1);
      // here and there a broad bench (a hanging shelf with snow and stunted pines) breaks the wall
      const bench = smoothstep(0.15, 0.55, gnoise(z / 650, 8.8, s + 91));
      if (bench > 0) {
        const bc = 0.38 + 0.18 * gnoise(z / 900, 1.1, s + 92);
        f = f + (bc - f) * bench * 0.8 * (1 - smoothstep(0.03, 0.12, Math.abs(f - bc)));
      }
      out = hRim + berm - (hRim - foot) * f;
      // couloirs: grooves running down the face (snow-filled, between rock ribs); irregular spacing
      // (warped z), and gathered into gullied sections between smooth slabby faces
      const zw = z + 70 * gnoise(z / 230, 3.4, s + 105);
      const g = ridged(zw / 75, 0.5 + f * 0.6, s + 84, 2);
      const gul = 0.35 + 0.65 * smoothstep(-0.2, 0.45, gnoise(z / 600, 8.3, s + 106));
      out -= (10 + 0.05 * Hc) * g * 4 * f * (1 - f) * gul;
    } else {
      const tf = (u - 1) * Lc;
      const flat = 80 * hm;
      const bedDrop = smoothstep(flat, flat + 420, tf);
      out = foot - (p.depth - 5 + 9.5 * hm) * bedDrop;
      // rocks and skerries at the cliff foot
      // (round 6: off with the scanned islands — the flat-topped lumps read as white slabs beside them)
      if (!MESH_ISLANDS) out += Math.max(0, gnoise(x / 23, z / 23, s + 69) - 0.45) * 30 * smoothstep(0, 25, tf) * (1 - smoothstep(30, 240, tf)) * (1 - hm);
      // islands in the fjord (smooth rounded skerries and a few bigger wooded islets)
      const k = smoothstep(380, 720, tf);
      if (k > 0) {
        const isl = this.island(x, z, lv);
        if (isl > out) out += (isl - out) * k;
      }
    }
    // the mountains across the fjord: steep walls from the water, separate summits, couloirs
    const xf = this.farShore(z);
    const ef = -x - xf;
    if (ef > -700) {
      const lvS = this.blendedLevel(z, FAR_BLEND);
      const [a, b] = p.farHeight;
      const massif = clamp(0.2 + 1.0 * ridged(x / 1700, z / 1700, s + 73, 4), 0, 1.2);
      const peaks = a + (b - a) * massif;
      // a steep wall from the water (dark rock with snow on its benches), then the summits
      const rise = smoothstep(-120, 720 + 260 * (0.5 + 0.5 * gnoise(z / 900, 6.6, s + 88)), ef);
      // (round 9, A r8 M6 "needle crests on the far massif": the 4th ridged octave, ~95 m, is one or
      // two vertices of the far tiles — single-vertex spires. Three octaves, the crest compressed
      // above 0.55 into shoulders, as on the far ranges)
      let sr = ridged(x / 760, z / 760, s + 79, 3);
      if (sr > 0.55) sr = 0.55 + (sr - 0.55) * 0.45;
      const summit = (sr - 0.32 + 0.1 * (0.5 + 0.5 * fbm(x / 420, z / 420, s + 80, 2))) * 520 * smoothstep(250, 1300, ef);
      const couloir = (ridged(x / 160, z / 70, s + 74, 2) - 0.4) * 150 * smoothstep(60, 500, ef) * (1 - smoothstep(900, 1600, ef));
      out = Math.max(out, lvS - p.depth + (peaks + p.depth) * (1 - Math.pow(1 - rise, 1.6)) + summit + couloir);
    }
    // the headland ridge between two arms (and the fjord head): hides where the levels change
    if (ridge.bell > 0.002) {
      const top = ridge.level + RIDGE_CLEAR + (260 + 260 * (0.5 + 0.5 * gnoise(z / 400, x / 900, s + 75))) * smoothstep(0, 900, t) + (ridged(x / 260, z / 260, s + 76, 3) - 0.3) * 70 * smoothstep(60, 400, t);
      const base = ridge.level - p.depth;
      out = Math.max(out, base + (top - base) * ridge.bell * smoothstep(0, 22, t));
    }
    return out;
  }

  /**
   * Islands and skerries in the fjord / sea (round 2, art review D2): not an even fbm scatter but a
   * few deliberate clusters. Space is cut into ~1.35 km cells; about four in ten hold a cluster: one
   * main island (a glaciated whaleback, 0.3–1 km along its long axis, 30–150 m high, with a steep
   * rocky shore and a flatter, snow-holding top split by a cleft or two) plus 1–4 islets strung
   * along the same grain (wave-washed rock, 12–34 m). Shores are irregular (domain-warped outline),
   * so silhouettes read as land at distance. Returns the island surface height, or far below the bed.
   */
  private island(x: number, z: number, lv: number): number {
    const CELL = 1350;
    const ci = Math.floor(x / CELL);
    const cj = Math.floor(z / CELL);
    let best = -1e9;
    const sd = this.seed;
    // warp the sample point so outlines are ragged (coves, points, skerry tails), not ellipses
    const wx = x + 44 * gnoise(x / 170, z / 170, sd + 94) + 16 * gnoise(x / 47, z / 47, sd + 95);
    const wz = z + 44 * gnoise(x / 170 + 7.3, z / 170, sd + 96) + 16 * gnoise(x / 47, z / 47 + 3.1, sd + 97);
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const cl = this.cluster(ci + di, cj + dj, CELL);
        for (const b of cl) {
          const ex = wx - b.x;
          const ez = wz - b.z;
          if (Math.abs(ex) > b.a * 1.3 + 60 || Math.abs(ez) > b.a * 1.3 + 60) continue;
          // rotated, elongated distance: q = 1 at the shoreline; u runs along the ice-flow grain
          const u = (ex * b.c + ez * b.s) / b.a;
          const v = (-ex * b.s + ez * b.c) / b.b;
          const q = Math.sqrt(u * u + v * v);
          if (q > 1.25) continue;
          const shore = 1 - smoothstep(0.92, 1.25, q);
          // round 6: the islands themselves are scanned rock meshes (art/scanIslands.ts); the
          // heightfield keeps only a shoal just under the water (it marks where an island stands; a
          // base above the water showed as a white plate wherever a mesh was not drawn)
          const top = (MESH_ISLANDS ? Math.min(ISLAND_BASE, islandProfile(b, u, v, q, sd)) : islandProfile(b, u, v, q, sd)) * shore;
          const hgt = lv - this.p.depth + (this.p.depth + top) * smoothstep(1.25, 0.98, q);
          if (hgt > best) best = hgt;
        }
      }
    return best;
  }

  /** the islands of the cluster layout whose centres lie in z ∈ [z0, z1], at any x (deterministic) */
  islandBlobs(z0: number, z1: number): IslandBlob[] {
    const CELL = 1350;
    const out: IslandBlob[] = [];
    const xr = this.rimX((z0 + z1) / 2);
    for (let cj = Math.floor((z0 - 600) / CELL); cj <= Math.floor((z1 + 600) / CELL); cj++)
      for (let ci = Math.floor((xr - 9000) / CELL); ci <= Math.floor((xr + 300) / CELL); ci++)
        for (const b of this.cluster(ci, cj, CELL)) if (b.z >= z0 && b.z <= z1) out.push(b);
    return out;
  }

  private clusterCache = new Map<number, IslandBlob[]>();
  /**
   * The islands of one cluster cell (deterministic, cached). Round 4 (F-009, "repeated loaves"):
   * the main island is no longer one tall dome per cluster. Glacial archipelagos are mostly LOW:
   *  - whaleback (most): a long, low (65–125 m) scoured hump, gentle up-ice, plucked cliffs at the
   *    down-ice end, benches along the grain;
   *  - peak island (two clusters in five): a steep multi-summit island (130–250 m) — two or
   *    three tops along a ridge, not a dome;
   *  - satellites: low skerries (6–22 m) strung along the grain, some barely awash.
   */
  private cluster(ci: number, cj: number, cell: number): IslandBlob[] {
    const key = (ci + 4096) * 65536 + (cj + 32768);
    let out = this.clusterCache.get(key);
    if (out) return out;
    out = [];
    const r = new Rng((this.seed ^ Math.imul(ci + 977, 0x2c1b3c6d) ^ Math.imul(cj + 131, 0x297a2d39)) >>> 0);
    if (r.float() < 0.42) {
      const cx = (ci + r.range(0.2, 0.8)) * cell;
      const cz = (cj + r.range(0.2, 0.8)) * cell;
      const ang = r.range(0, Math.PI);
      // sizes are chosen to be resolved by the 64 m far-field terrain tiles (most of the sea is
      // drawn by them): nothing main smaller than ~150 m across
      const peak = r.float() < 0.4;
      const a = peak ? r.range(200, 340) : r.range(200, 460);
      const main: IslandBlob = { kind: peak ? 2 : 1, x: cx, z: cz, a, b: a * (peak ? r.range(0.55, 0.8) : r.range(0.32, 0.55)), c: Math.cos(ang), s: Math.sin(ang), h: peak ? r.range(130, 250) : r.range(65, 125), k: r.range(0, 50) };
      out.push(main);
      // satellite skerries along the grain, off the ends and one side
      const n = r.int(2, 5);
      for (let i = 0; i < n; i++) {
        const along = (r.float() < 0.5 ? -1 : 1) * r.range(1.0, 2.0) * a;
        const across = r.range(-0.9, 0.9) * main.b;
        const sa = r.range(75, 150);
        const aa = ang + r.range(-0.35, 0.35);
        out.push({ kind: 0, x: cx + main.c * along - main.s * across, z: cz + main.s * along + main.c * across, a: sa, b: sa * r.range(0.45, 0.7), c: Math.cos(aa), s: Math.sin(aa), h: r.range(6, 22), k: r.range(0, 50) });
      }
    }
    if (this.clusterCache.size > 4096) this.clusterCache.clear();
    this.clusterCache.set(key, out);
    return out;
  }

  /** finite courses: beyond the harbour shoreline the land slopes away into the open sea */
  private oceanCut(x: number, z: number, h: number): number {
    const W = this.oceanLevel;
    const s = this.seed;
    const sz = this.shoreZ(x);
    const tall = Math.max(0, h - W);
    // the headlands meet the sea in rugged buttresses, not a planar cut
    const n1 = gnoise(x / 170, 2.7, s + 85);
    const k0 = smoothstep(sz - 6, sz + 36 + 0.85 * tall * (0.75 + 0.45 * (0.5 + 0.5 * n1)), z + Math.min(160, tall * 0.25) * gnoise(x / 95, 5.1, s + 86));
    if (k0 <= 0) return h;
    const k = k0 * k0 * (3 - 2 * k0);
    const relief = (ridged(x / 120, z / 120, s + 87, 3) - 0.35) * Math.min(220, tall * 0.35) * k * (1 - k) * 4;
    h -= relief;
    let bed = W - 4 - (this.p.depth - 4) * smoothstep(sz, sz + 700, z);
    // islands and skerries out to sea
    void s;
    // keep the harbour mouth and the victory reveal's sightline (out to sea, then back up the
    // mountain) clear of islands
    const dxH = x - this.profile.centerX(this.finishZ) - 120;
    const lane = (1 - smoothstep(380, 650, Math.abs(dxH))) * (1 - smoothstep(sz + 2200, sz + 2800, z));
    const ki = smoothstep(sz + 150, sz + 500, z) * (1 - lane);
    if (ki > 0) {
      const isl = this.island(x, z, W);
      if (isl > bed) bed += (isl - bed) * ki;
    }
    return h + (bed - h) * k;
  }

  /** true where the terrain height h at (x, z) is under water */
  isWater(z: number, h: number): boolean {
    return h < this.seaLevelAt(z) - 0.2;
  }
}

/** one island of a cluster: kind 0 skerry, 1 whaleback, 2 peak island */
export interface IslandBlob {
  kind: 0 | 1 | 2;
  x: number;
  z: number;
  a: number;
  b: number;
  c: number;
  s: number;
  h: number;
  k: number;
}

/**
 * Height of an island above the water (m) at local (u along the grain, v across, q radial; q = 1 at
 * the shoreline). Steep rocky shores everywhere (the first ~15 % inside the waterline), then:
 *  - skerry: a low, flat-backed rock with a ragged ridged top (wave-washed, little snow);
 *  - whaleback: a stoss–lee hump — a long gentle ramp from the up-ice end (u < 0), a plateau, a
 *    plucked cliff near the down-ice end (u > 0) — cut by benches and grooves along the grain;
 *  - peak: two or three summits along the long axis on a steep-sided base (a ridge, not a dome).
 */
function islandProfile(b: IslandBlob, u: number, v: number, q: number, sd: number): number {
  const rim = smoothstep(1.0, 0.8, q); // the steep rocky shore band
  const grain = ridged(u * 2.6 + b.k, v * 0.8, sd + 98, 3); // grooves along the ice-flow grain
  const rough = gnoise(u * 5.1 + b.k, v * 4.3, sd + 99);
  if (b.kind === 0) {
    const back = Math.pow(Math.max(0, 1 - q * q), 0.45);
    return 1.2 + b.h * (0.35 * rim + 0.65 * back) * (0.55 + 0.75 * grain) + 1.6 * rough;
  }
  if (b.kind === 1) {
    // stoss (u < 0): long convex ramp; lee (u > 0): the plateau breaks off in a plucked cliff
    const leeEdge = 0.62 + 0.1 * gnoise(v * 2.2 + b.k, 1.7, sd + 100);
    const stoss = Math.pow(Math.max(0, 1 - q * q), 0.6);
    const plateau = Math.pow(Math.max(0, 1 - (v * v) / 0.9), 0.5) * (1 - smoothstep(leeEdge, leeEdge + 0.14, u));
    const leeT = smoothstep(-0.2, 0.4, u);
    let f = stoss * (1 - leeT) + Math.max(plateau * (0.9 + 0.1 * (1 - u)), 0.18 * rim) * leeT;
    // (round 4b, A r4 M4 "two-tier slab": stepped benches read as a layer cake — instead crags: a
    // mid-scale ridged relief that breaks the top into knolls and hollows)
    const crag = ridged(u * 3.4 + b.k * 0.7, v * 3.1, sd + 103, 2);
    f = f * (0.7 + 0.5 * crag);
    return 1.5 + b.h * Math.max(0.3 * rim, f) * (0.62 + 0.6 * grain) + 3 * rough;
  }
  // peak island: summits along the axis, steep flanks, a talus / rock shelf at the shore
  let f = 0;
  const tops = 2 + (Math.floor(b.k) % 2);
  for (let i = 0; i < tops; i++) {
    const ut = -0.45 + (0.9 * i) / Math.max(1, tops - 1) + 0.12 * gnoise(i * 3.1 + b.k, 0.3, sd + 101);
    const ht = 0.62 + 0.38 * (0.5 + 0.5 * gnoise(i * 1.7 + b.k, 4.2, sd + 102));
    const d = Math.hypot((u - ut) * 1.5, v * 1.1);
    f = Math.max(f, ht * Math.pow(Math.max(0, 1 - d), 1.35));
  }
  const shelf = 0.08 * rim;
  return 2 + b.h * Math.max(shelf, f * (0.82 + 0.25 * grain)) + 3 * rough;
}
