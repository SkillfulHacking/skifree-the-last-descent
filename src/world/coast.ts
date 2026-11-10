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
 * Convention: the sea is on −X (the skier's left when facing downhill). The rim is measured from
 * the piste edge; the far shore and islands are placed in absolute x.
 */
import { Rng, clamp, fbm, gnoise, ridged, smoothstep } from '../core/rng';
import type { CourseProfile } from './profile';

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
  /** stable id within the course ("lookout-<n>", n counts down the course) */
  readonly id: string;
  readonly n: number;
  readonly x: number;
  readonly z: number;
  /** discovery radius (m) */
  readonly r: number;
}

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
  private lookoutZ = 380;
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
    const [a, b] = this.p.rim;
    const n = 0.5 + 0.5 * fbm(z / 620, 3.7, this.seed + 61, 2) + 0.18 * gnoise(z / 97, 1.3, this.seed + 62);
    return a + (b - a) * clamp(n, 0, 1);
  }

  /** absolute x of the rim crest (cliff edge) at z */
  rimX(z: number): number {
    return this.profile.centerX(z) - this.profile.halfWidth(z) - this.rimOffset(z);
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
   * Viewpoints on the cliff rim overlapping [z0, z1]: every 0.95–1.5 km, away from cave shelves,
   * refuges, the summit and the finish approach, inside the cornice zone's edge, never more than a
   * gentle climb above the piste. Deterministic (generated in order down the course).
   */
  lookouts(z0: number, z1: number): Lookout[] {
    const P = this.profile;
    const end = this.finite ? this.finishZ - 420 : Infinity;
    while (this.lookoutZ < Math.min(z1 + 400, end)) {
      const rr = new Rng((this.seed ^ Math.imul(this.lookoutList.length + 3, 0x6b43a9b5) ^ Math.imul(Math.floor(this.lookoutZ), 0x27d4eb2d)) >>> 0);
      let z = this.lookoutZ + rr.range(200, 500);
      this.lookoutZ += rr.range(950, 1500);
      if (z > end) break;
      const busy = (q: number) => P.encounters(q - 400, q + 400).some((e) => q > e.caveZ - 360 && q < e.caveZ + 220) || P.checkpoints(q - 400, q + 400).some((c) => Math.abs(q - c) < 330);
      let ok = false;
      for (let k = 0; k < 6 && !ok; k++) {
        if (k > 0) z += 70;
        if (busy(z)) continue;
        const x = this.rimX(z) + LOOKOUT_INSET;
        const H = this.terrain;
        if (!H) {
          ok = true;
          break;
        }
        // a short, gentle climb from the racing line
        const rx = P.routeX(z);
        const rise = H(x, z) - H(rx, z);
        const dist = rx - x;
        if (dist > 20 && dist < 110 && rise < 14 && rise / dist < 0.2) ok = true;
      }
      if (!ok) continue;
      const n = this.lookoutList.length;
      this.lookoutList.push({ id: `lookout-${n}`, n, x: this.rimX(z) + LOOKOUT_INSET, z, r: LOOKOUT_RADIUS });
    }
    return this.lookoutList.filter((l) => l.z >= z0 && l.z <= z1);
  }

  // --- the heightfield ----------------------------------------------------------------------
  /**
   * Coast-shaped height at (x, z). `h` is the land height there (Mountain without the coast) and
   * `land` samples it elsewhere (used once, at the rim). Continuous everywhere.
   */
  shape(x: number, z: number, h: number, land: (x: number, z: number) => number): number {
    const P = this.profile;
    const cx = P.centerX(z);
    const w = P.halfWidth(z);
    const rimE = this.rimOffset(z);
    const t = cx - w - rimE - x; // beyond the rim (sea side)
    const ocean = this.finite && z > this.finishZ + 60;
    if (t < -36 && !ocean) return h;
    let out = h;
    if (t > -36) {
      const bH = this.bermHeight(z);
      const berm = bH * smoothstep(-34, -9, t) * (1 - smoothstep(-5, 5, t));
      if (t <= 0) out = h + berm;
      else out = this.seaSide(x, z, t, cx - w - rimE, berm, land);
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
    const tj = t + (16 * gnoise(z / 47, 0.37, s + 66) + 10 * gnoise(z / 13, 2.1, s + 67)) * smoothstep(0, 40, t);
    const u = tj / Lc;
    let out: number;
    if (u < 1) {
      let f = 0.8 * smoothstep(0, 0.52, u) + 0.2 * smoothstep(0.35, 1, u);
      // ledges (fjord walls step down in benches that hold snow)
      const q = f * 7 + 0.4 * gnoise(z / 210, 5.5, s + 68);
      const stair = (Math.floor(q) + smoothstep(0.25, 1, q - Math.floor(q))) / 7;
      f = clamp(f + (stair - f) * 0.38 * smoothstep(0.04, 0.2, u) * (1 - smoothstep(0.8, 1, u)), 0, 1);
      out = hRim + berm - (hRim - foot) * f;
      // couloirs: grooves running down the face (snow-filled, between rock ribs)
      const g = ridged(z / 64, 0.5 + f * 0.6, s + 84, 2);
      out -= (10 + 0.05 * Hc) * g * 4 * f * (1 - f);
    } else {
      const tf = (u - 1) * Lc;
      const flat = 80 * hm;
      const bedDrop = smoothstep(flat, flat + 420, tf);
      out = foot - (p.depth - 5 + 9.5 * hm) * bedDrop;
      // rocks and skerries at the cliff foot
      out += Math.max(0, gnoise(x / 23, z / 23, s + 69) - 0.45) * 30 * smoothstep(0, 25, tf) * (1 - smoothstep(30, 240, tf)) * (1 - hm);
      // islands in the fjord (smooth rounded skerries and a few bigger wooded islets)
      const k = smoothstep(160, 420, tf);
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
      const rise = smoothstep(-160, 1100, ef);
      // summits: a ridged field at ~900 m wavelength sharpened near the top of the wall
      const summit = (ridged(x / 760, z / 760, s + 79, 4) - 0.32) * 520 * smoothstep(250, 1300, ef);
      const couloir = (ridged(x / 210, z / 95, s + 74, 2) - 0.4) * 90 * smoothstep(80, 600, ef);
      out = Math.max(out, lvS - p.depth + (peaks + p.depth) * Math.pow(rise, 0.7) + summit + couloir);
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
   * Islands and skerries in the fjord / sea: low rounded domes of rock (8–45 m) with steep shores,
   * a few broad enough to carry pines; returns the island's surface height (or far below the bed).
   */
  private island(x: number, z: number, lv: number): number {
    const s = this.seed;
    const n = fbm(x / 380, z / 380, s + 71, 3) + 0.25 * gnoise(x / 120, z / 120, s + 72);
    const isl = n - 0.36;
    if (isl <= -0.02) return -1e9;
    const shore = smoothstep(-0.02, 0.05, isl);
    const top = 6 + 42 * smoothstep(0.03, 0.3, isl) + 9 * gnoise(x / 60, z / 60, s + 83);
    return lv - this.p.depth + (this.p.depth + top) * shore;
  }

  /** finite courses: beyond the harbour shoreline the land slopes away into the open sea */
  private oceanCut(x: number, z: number, h: number): number {
    const W = this.oceanLevel;
    const sz = this.shoreZ(x);
    const k = smoothstep(sz - 6, sz + 36 + 0.85 * Math.max(0, h - W), z);
    if (k <= 0) return h;
    const s = this.seed;
    let bed = W - 4 - (this.p.depth - 4) * smoothstep(sz, sz + 700, z);
    // islands and skerries out to sea
    void s;
    const ki = smoothstep(sz + 150, sz + 500, z);
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
