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
      out += Math.max(0, gnoise(x / 23, z / 23, s + 69) - 0.45) * 30 * smoothstep(0, 25, tf) * (1 - smoothstep(30, 240, tf)) * (1 - hm);
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
      const summit = (ridged(x / 760, z / 760, s + 79, 4) - 0.32) * 520 * smoothstep(250, 1300, ef);
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
    // warp the sample point a little so outlines are ragged (coves, points), not ellipses
    const wx = x + 38 * gnoise(x / 170, z / 170, this.seed + 94) + 12 * gnoise(x / 41, z / 41, this.seed + 95);
    const wz = z + 38 * gnoise(x / 170 + 7.3, z / 170, this.seed + 96) + 12 * gnoise(x / 41, z / 41 + 3.1, this.seed + 97);
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const cl = this.cluster(ci + di, cj + dj, CELL);
        for (const b of cl) {
          const ex = wx - b.x;
          const ez = wz - b.z;
          if (Math.abs(ex) > b.a * 1.3 + 60 || Math.abs(ez) > b.a * 1.3 + 60) continue;
          // rotated, elongated distance: q = 1 at the shoreline
          const u = (ex * b.c + ez * b.s) / b.a;
          const v = (-ex * b.s + ez * b.c) / b.b;
          const q = Math.sqrt(u * u + v * v);
          if (q > 1.25) continue;
          const shore = 1 - smoothstep(0.92, 1.25, q);
          // steep shore (the first ~18 % inside the waterline rises fast: bare rock), then a
          // flatter rounded top where snow lies; clefts and ridges follow the grain (along u)
          const rise = smoothstep(1.0, 0.78, q);
          const dome = Math.pow(Math.max(0, 1 - q * q), 0.75);
          const grain = ridged(u * 2.4 + b.k, v * 0.9, this.seed + 98, 2) - 0.45;
          const cleft = 1 - 0.35 * smoothstep(0.82, 1.0, 1 - Math.abs(gnoise(u * 1.7 + b.k, 0.5, this.seed + 99)));
          // mostly a rounded dome (it must stay rounded when the 64 m far-field tiles sample it),
          // with a steeper rocky rim near the waterline
          const top = (2.5 + b.h * (0.28 * rise + 0.72 * Math.pow(dome, 1.25)) * cleft + b.h * 0.2 * grain * dome) * shore;
          const hgt = lv - this.p.depth + (this.p.depth + top) * smoothstep(1.25, 0.98, q);
          if (hgt > best) best = hgt;
        }
      }
    return best;
  }

  private clusterCache = new Map<number, Array<{ x: number; z: number; a: number; b: number; c: number; s: number; h: number; k: number }>>();
  /** the islands of one cluster cell (deterministic, cached) */
  private cluster(ci: number, cj: number, cell: number) {
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
      // drawn by them): nothing smaller than ~150 m across
      const big = r.float() < 0.6;
      const a = big ? r.range(260, 480) : r.range(140, 240);
      const main = { x: cx, z: cz, a, b: a * r.range(0.4, 0.62), c: Math.cos(ang), s: Math.sin(ang), h: big ? r.range(95, 185) : r.range(40, 80), k: r.range(0, 50) };
      out.push(main);
      // satellite islets and skerries along the grain, off the ends and one side
      const n = r.int(1, 4);
      for (let i = 0; i < n; i++) {
        const along = (r.float() < 0.5 ? -1 : 1) * r.range(1.0, 1.8) * a;
        const across = r.range(-0.9, 0.9) * main.b;
        const sa = r.range(75, 150);
        const aa = ang + r.range(-0.4, 0.4);
        out.push({ x: cx + main.c * along - main.s * across, z: cz + main.s * along + main.c * across, a: sa, b: sa * r.range(0.45, 0.75), c: Math.cos(aa), s: Math.sin(aa), h: r.range(12, 34), k: r.range(0, 50) });
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
