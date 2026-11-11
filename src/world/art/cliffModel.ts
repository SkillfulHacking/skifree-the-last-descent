/**
 * The cliff kit's pure model (no three.js): the authored cliff profile per z and the height of the
 * hidden heightfield backing under the sea side. Shared by the Mountain (heights, physics-safe: it
 * only changes the sea side beyond the rim crest) and the mesh builder (./cliffKit.ts).
 * Deterministic: every value is a pure function of the coast frame and the seed.
 */
import { clamp, smoothstep } from './noise3';
import { gnoise, ridged } from '../../core/rng';

/** What the cliff needs to know about the coast (implemented over Coast + Mountain). */
export interface CoastFrame {
  readonly seed: number;
  /** absolute x of the rim crest at z (the sea is on −X) */
  rimX(z: number): number;
  /** gameplay terrain height on the land side (used for the rim height and the buried top) */
  landHeight(x: number, z: number): number;
  /** water level at z */
  waterLevel(z: number): number;
  /**
   * 0..1 strand-flat strength at z (Coast.strandMask): a fishing hamlet's terrace at the cliff foot,
   * ~4.5 m above the water. The face then ends on the flat (no notch, no relief at its foot) and the
   * backing carries the flat out to sea before the bed falls away (review P-M6).
   */
  strand?(z: number): number;
}

/** One column of the face: drop below the rim → seaward offset, sampled every DS metres of drop. */
export interface Column {
  z: number;
  xr: number;
  hRim: number;
  water: number;
  /** total drop from the rim to the face's base (6 m below the water; a hamlet's strand flat) */
  H: number;
  /** strand-flat strength (0 = open water at the foot) */
  hm: number;
  /** world y of the face's base */
  base: number;
  /** seaward offset (m) at drop i*DS */
  d: Float32Array;
  /** 0..1 concavity (bench backs, gully floors) for the baked AO */
  occ: Float32Array;
}

export const DS = 2;

export class CliffModel {
  private cache = new Map<number, Column>();
  constructor(readonly frame: CoastFrame) {}

  /** cliff character along the coast (pure) */
  private character(z: number) {
    const s = this.frame.seed;
    const n = (k: number, sc: number) => gnoise(z / sc, k * 1.37, s + 500 + k);
    return {
      tiers: 2 + Math.floor(clamp(0.5 + 0.7 * n(2, 1700), 0, 0.999) * 3),
      /** dx per metre of drop on the rock bands (0.12 ≈ 83°, 0.3 ≈ 73°) */
      bandSlope: 0.13 + 0.12 * (0.5 + 0.5 * n(4, 450)),
      /** fraction of each tier that is bench, and the bench's dx per metre of drop (2 ≈ 27° incline) */
      benchFrac: 0.1 + 0.07 * (0.5 + 0.5 * n(3, 600)),
      benchSlope: 1.9 + 1.3 * (0.5 + 0.5 * n(8, 380)),
      notch: 2 + 2.5 * (0.5 + 0.5 * n(7, 120)),
    };
  }

  /** spurs (buttresses) push whole sections of face seaward: ≥ 0, metres per metre of wall height */
  private spur(z: number): number {
    const s = this.frame.seed;
    const a = ridged(z / 300, 3.1, s + 510, 2);
    const b = ridged(z / 130 + 4.7, 1.3, s + 511, 1);
    return Math.max(0, 0.2 * (a - 0.3) + 0.07 * (b - 0.4) + 0.03 * gnoise(z / 900, 6.1, s + 512));
  }

  /** gully strength (0..1) cutting back into the face at z */
  private gully(z: number): number {
    const s = this.frame.seed;
    const zw = z + 55 * gnoise(z / 210, 4.4, s + 520);
    const g = ridged(zw / 150, 0.7, s + 521, 2);
    return smoothstep(0.3, 0.62, g) * (0.4 + 0.6 * smoothstep(-0.3, 0.4, gnoise(z / 700, 1.9, s + 522)));
  }

  column(zIn: number): Column {
    // quantised to whole metres: the result never depends on who asked first (determinism)
    const key = Math.round(zIn);
    let c = this.cache.get(key);
    if (c) return c;
    const z = key;
    const F = this.frame;
    const xr = F.rimX(z);
    const hRim = F.landHeight(xr + 0.5, z);
    const water = F.waterLevel(z);
    const hm = F.strand ? F.strand(z) : 0;
    const base = water - 6 + 10.5 * hm;
    const H = Math.max(12, hRim - base);
    const ch = this.character(z);
    const n = Math.ceil(H / DS) + 1;
    const d = new Float32Array(n);
    const occ = new Float32Array(n);
    const s = F.seed;
    // tier edges (drop below the rim): dipping along the coast (strata) and wandering a little
    const nt = ch.tiers;
    const edges: number[] = [0];
    for (let k = 1; k < nt; k++) edges.push((k / nt + 0.07 * gnoise(z / 480, k * 2.1, s + 530 + k) + 0.00004 * z) * H);
    edges.push(H);
    const gk = this.gully(z);
    let x = 0;
    for (let i = 0; i < n; i++) {
      const dz = i * DS;
      let k = 0;
      while (k < nt - 1 && dz >= edges[k + 1]!) k++;
      const t0 = edges[k]!, t1 = edges[k + 1]!;
      const th = Math.max(1, t1 - t0);
      const local = (dz - t0) / th;
      const last = k === nt - 1;
      // a band, then (except for the sea cliff) a bench; per-tier variation of both
      const bs = ch.bandSlope * (0.8 + 0.4 * (0.5 + 0.5 * gnoise(z / 260, k * 3.3, s + 540)));
      const bf = last ? 0 : ch.benchFrac * (0.7 + 0.6 * (0.5 + 0.5 * gnoise(z / 310, k * 1.7, s + 541)));
      const benchK = bf > 0 ? smoothstep(1 - bf - 2.5 / th, 1 - bf + 2.5 / th, local) : 0;
      let slope = bs + (ch.benchSlope - bs) * benchK;
      // the lip: a convex 45° shoulder easing in over the first ~9 m
      slope = slope + (1.1 - slope) * (1 - smoothstep(0, 9, dz));
      // scree fan at the foot below the gullies
      slope += gk * 2.2 * smoothstep(0.9, 1, dz / H);
      x += slope * DS;
      d[i] = x;
      occ[i] = bf > 0 ? smoothstep(1 - bf - 0.05, 1 - bf, local) * (1 - smoothstep(1 - bf, 1 - bf + 0.05, local)) : 0;
    }
    // wave-cut notch at the waterline, spurs in plan, gullies cut back (no overhang in the base profile)
    const spur = this.spur(z) * H;
    const gd = gk * H * 0.08;
    for (let i = 0; i < n; i++) {
      const dz = i * DS;
      const f = dz / H;
      const above = H - 6 - dz;
      const notch = ch.notch * (1 - hm) * Math.exp(-((above - 1.2) * (above - 1.2)) / 6);
      const g = gd * smoothstep(0.02, 0.12, f) * (1 - smoothstep(0.85, 1, f));
      d[i] = d[i]! + spur * smoothstep(0.0, 0.12, f) - notch - g;
      occ[i] = Math.max(occ[i]!, gk * smoothstep(0.02, 0.12, f) * 0.5, notch / 5);
      if (i > 0) d[i] = Math.max(d[i]!, d[i - 1]! + 0.03 * DS);
    }
    c = { z, xr, hRim, water, H, hm, base, d, occ };
    if (this.cache.size > 1500) this.cache.clear();
    this.cache.set(key, c);
    return c;
  }

  /** seaward offset of the (undisplaced) face at drop `dz` below the rim */
  offsetAt(c: Column, dz: number): number {
    const i = clamp(dz / DS, 0, c.d.length - 1);
    const a = Math.floor(i);
    const b = Math.min(c.d.length - 1, a + 1);
    return c.d[a]! + (c.d[b]! - c.d[a]!) * (i - a);
  }

  /** drop below the rim at which the face reaches seaward offset t (inverse of offsetAt; face monotone enough) */
  dropAt(c: Column, t: number): number {
    const d = c.d;
    if (t <= d[0]!) return 0;
    // binary search on a running maximum (the notch and gullies make it slightly non-monotone)
    let lo = 0;
    let hi = d.length - 1;
    if (t >= d[hi]!) return hi * DS;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (d[mid]! < t) lo = mid;
      else hi = mid;
    }
    const f = (t - d[lo]!) / Math.max(1e-6, d[hi]! - d[lo]!);
    return (lo + clamp(f, 0, 1)) * DS;
  }

  /** the face's foot (seaward offset where it meets the water) */
  footOffset(c: Column): number {
    return this.offsetAt(c, c.H - 6 * (1 - c.hm));
  }

  /** a hamlet's strand flat: world y, and how far it runs seaward of the face's foot (m) */
  strandY(c: Column): number {
    return c.base;
  }
  strandWidth(c: Column): number {
    return 95 * c.hm;
  }

  /**
   * Height of the hidden heightfield under the sea side, at t metres seaward of the rim (t > 0):
   * the face pushed `inset` m inland and `sink` m down (so the heightfield never shows through the
   * mesh), talus cones at the foot under the gullies, then the fjord bed.
   */
  backingHeight(z: number, t: number, bedDepth: number): number {
    // conservative over the heightfield's sampling footprint (far tiles are 32 m): the most inland
    // face of the neighbouring columns, so linear interpolation between samples never pokes out
    // in front of a gully wall
    return Math.min(this.backingAt(z - 18, t, bedDepth), this.backingAt(z, t, bedDepth), this.backingAt(z + 18, t, bedDepth));
  }

  private backingAt(z: number, t: number, bedDepth: number): number {
    const c = this.column(z);
    const inset = 9;
    const sink = 4;
    const foot = this.footOffset(c);
    let h: number;
    if (t < foot - inset) h = c.hRim - this.dropAt(c, t + inset) - sink;
    else h = -Infinity; // beyond the foot: the bed
    // the bed falls away from the foot (from a hamlet's strand flat, after the flat)
    const w = this.strandWidth(c);
    const bed = c.base - (c.base - (c.water - bedDepth)) * smoothstep(foot + 20 + w, foot + 420 + w, t);
    return Math.max(Math.min(h, c.hRim), bed);
  }
}

