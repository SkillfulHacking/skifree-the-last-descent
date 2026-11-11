/**
 * Coastal cliffs as authored meshes, independent of the heightfield.
 *
 * Why: a heightfield can only store one height per (x, z). A 300–1300 m fjord wall that drops in
 * 100–500 m of plan is sampled by a handful of 16–32 m grid cells, so every texel and shading
 * gradient on it is stretched vertically ("vertical smearing"), crests become isolated vertex
 * spikes ("needles") and nothing can overhang. Here the face is its own grid laid out ALONG the
 * wall (columns along the coast, rows down the face by arc length), so a vertical metre of rock
 * gets as many vertices as a horizontal one, and the profile can be authored like a sculpt:
 *
 *  - tiers: 2–4 near-vertical rock bands separated by snow-holding benches; the band edges dip
 *    gently along the coast (strata), so the layering reads horizontally at a kilometre;
 *  - a wave-cut sea cliff at the bottom with a notch at the waterline;
 *  - a convex rounded lip under the cornice (no knife edge, no spikes);
 *  - buttresses and coves in plan, and gullies (couloirs) that cut back into the face;
 *  - sculpted relief: terraced (blocky) noise and horizontally stretched ledges, displaced along
 *    the face normal — not fall-line striation.
 *
 * The heightfield keeps everything that is gameplay (the land up to the rim, the cornice) and
 * draws only a hidden "backing" under the sea side: the face pushed inland and down so it never
 * pokes through the mesh, plus talus cones under the gullies and the fjord bed.
 *
 * Deterministic (everything is a pure function of the coast frame and the seed). Bounded memory:
 * CliffKit keeps the segments within a z-window around the focus (8 at most) and disposes the rest.
 */
import * as THREE from 'three';
import { fbm3, noise3, ridged3, terraced, smoothstep, clamp } from './noise3';
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
}

/** One column of the face: drop below the rim → seaward offset, sampled every DS metres of drop. */
interface Column {
  z: number;
  xr: number;
  hRim: number;
  water: number;
  /** total drop from the rim to 6 m below the water */
  H: number;
  /** seaward offset (m) at drop i*DS */
  d: Float32Array;
  /** 0..1 concavity (bench backs, gully floors) for the baked AO */
  occ: Float32Array;
}

const DS = 2;

export class CliffModel {
  private cache = new Map<number, Column>();
  constructor(readonly frame: CoastFrame) {}

  /** cliff character along the coast (pure) */
  private character(z: number) {
    const s = this.frame.seed;
    const n = (k: number, sc: number) => gnoise(z / sc, k * 1.37, s + 500 + k);
    return {
      steep: 0.34 + 0.12 * (0.5 + 0.5 * n(1, 1300)),
      tiers: 2 + Math.floor(clamp(0.5 + 0.7 * n(2, 1700), 0, 0.999) * 3),
      band: 0.62 + 0.18 * n(3, 600),
      bandSlope: 0.09 + 0.05 * (0.5 + 0.5 * n(4, 450)),
      // buttress / cove offset in plan (fraction of the width)
      plan: Math.max(0, 0.22 * (ridged(z / 520, 3.1, s + 510, 2) - 0.3) + 0.08 * n(6, 260)),
      notch: 2 + 2.5 * (0.5 + 0.5 * n(7, 120)),
    };
  }

  /** gully strength (0..1) cutting back into the face at z */
  private gully(z: number): number {
    const s = this.frame.seed;
    const zw = z + 55 * gnoise(z / 210, 4.4, s + 520);
    const g = ridged(zw / 95, 0.7, s + 521, 2);
    return smoothstep(0.42, 0.62, g) * (0.4 + 0.6 * smoothstep(-0.3, 0.4, gnoise(z / 700, 1.9, s + 522)));
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
    const H = Math.max(12, hRim - water + 6);
    const ch = this.character(z);
    const W = H * ch.steep;
    const n = Math.ceil(H / DS) + 1;
    const d = new Float32Array(n);
    const occ = new Float32Array(n);
    const s = F.seed;
    // tier edges: fraction of the drop, dipping along the coast (strata) and wandering a little
    const nt = ch.tiers;
    const edges: number[] = [];
    for (let k = 1; k < nt; k++) edges.push((k / nt + 0.06 * gnoise(z / 480, k * 2.1, s + 530 + k) + 0.00004 * z) * (H - 30));
    // tier layout: [band | bench] × nt, the last band is the sea cliff (no bench below it)
    const tierH = H / nt;
    let x = 0;
    for (let i = 0; i < n; i++) {
      const dz = i * DS;
      // which tier and where inside it (0 = top of its band)
      let t0 = 0;
      let t1 = H;
      for (const e of edges) {
        if (dz >= e) t0 = e;
        else {
          t1 = e;
          break;
        }
      }
      const th = t1 - t0;
      const local = (dz - t0) / th;
      const last = t1 >= H;
      const bandFrac = last ? 1 : ch.band;
      // slope dx/d(drop): steep band, then a bench (shallow), smooth transition over ~3 m
      const benchW = (W / nt - ch.bandSlope * tierH * bandFrac) / Math.max(1, (1 - bandFrac) * tierH);
      const tb = smoothstep(bandFrac - 3 / th, bandFrac + 3 / th, local);
      let slope = ch.bandSlope + (Math.max(ch.bandSlope, benchW) - ch.bandSlope) * tb * (last ? 0 : 1);
      // the lip: convex rounding over the first ~8 m below the rim (a 45° shoulder easing in)
      slope = slope + (1.1 - slope) * (1 - smoothstep(0, 9, dz));
      x += slope * DS;
      d[i] = x;
      // bench backs (concave corner) and the band foot are darker
      occ[i] = smoothstep(bandFrac - 0.08, bandFrac, local) * (1 - smoothstep(bandFrac, bandFrac + 0.1, local)) * (last ? 0 : 1);
    }
    // wave-cut notch at the waterline (the sea cliff undercut by 2–4.5 m), plan offsets, gullies
    const planOff = ch.plan * W;
    const gk = this.gully(z) * W * 0.16;
    for (let i = 0; i < n; i++) {
      const dz = i * DS;
      const f = dz / H;
      const above = H - 6 - dz; // height above the water
      const notch = ch.notch * Math.exp(-((above - 1.2) * (above - 1.2)) / 6);
      const g = gk * smoothstep(0.03, 0.25, f) * (1 - 0.6 * smoothstep(0.75, 1, f));
      d[i] = d[i]! + planOff * smoothstep(0, 0.2, f) - notch - g;
      occ[i] = Math.max(occ[i]!, clamp(g / (W * 0.12), 0, 1) * 0.6, notch / 5);
      // never overhang in the base profile (the heightfield backing is single-valued): where a
      // gully or the notch would cut back under the face above, the face drops vertically instead
      // (the sculpted relief still adds small overhangs, which the backing's inset absorbs)
      if (i > 0) d[i] = Math.max(d[i]!, d[i - 1]! + 0.03 * DS);
    }
    c = { z, xr, hRim, water, H, d, occ };
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
    return this.offsetAt(c, c.H - 6);
  }

  /**
   * Height of the hidden heightfield under the sea side, at t metres seaward of the rim (t > 0):
   * the face pushed `inset` m inland and `sink` m down (so the heightfield never shows through the
   * mesh), talus cones at the foot under the gullies, then the fjord bed.
   */
  backingHeight(z: number, t: number, bedDepth: number): number {
    const c = this.column(z);
    const inset = 9;
    const sink = 4;
    const foot = this.footOffset(c);
    let h: number;
    if (t < foot - inset) h = c.hRim - this.dropAt(c, t + inset) - sink;
    else h = c.water - 6;
    // talus: cones of scree against the foot below the gullies (snow-covered: the terrain shades them)
    const s = this.frame.seed;
    const zw = z + 55 * gnoise(z / 210, 4.4, s + 520);
    const g = smoothstep(0.4, 0.62, ridged(zw / 95, 0.7, s + 521, 2));
    const tal = (0.03 + 0.05 * g) * c.H * (0.6 + 0.4 * (0.5 + 0.5 * gnoise(z / 60, 3.3, s + 540)));
    const tf = t - foot;
    const cone = tal * clamp(1 - (tf + inset) / (tal * 1.4 + 4), 0, 1);
    h = Math.max(h, c.water - 6 + cone + 6 * Math.min(1, cone / 4));
    // the bed falls away from the foot
    const bed = c.water - 6 - (bedDepth - 6) * smoothstep(foot + 20, foot + 420, t);
    return Math.max(Math.min(h, c.hRim), bed);
  }
}

/** relief displacement (m) of the face at a world point, along the face normal (+ = seaward) */
function relief(x: number, y: number, z: number, s: number, faceK: number): number {
  // big blocks: terraced noise → steps and ledges, a few metres
  const blocks = terraced(0.5 + 0.5 * fbm3(x / 70, y / 45, z / 70, s + 601, 3), 5, 0.3) - 0.5;
  // horizontal ledges: noise stretched along the strata
  const ledges = ridged3(x / 90, y / 7, z / 90, s + 611, 2) - 0.35;
  // ribs between chutes (vertical, short): kept weak — the old wall was all fall-line striation
  const ribs = noise3(x / 14, y / 40, z / 14, s + 621);
  const fine = fbm3(x / 6, y / 6, z / 6, s + 631, 2);
  return faceK * (7 * blocks + 3.2 * ledges + 1.2 * ribs + 0.8 * fine);
}

export interface CliffSegmentOptions {
  z0: number;
  z1: number;
  /** column spacing along the coast (m) */
  ds: number;
  /** row spacing down the face (m of arc length) */
  dr: number;
  /** buried run inland under the land surface (m), hides the seam with the heightfield */
  bury?: number;
}

/** Build one cliff segment between z0 and z1 (world coordinates; mesh at origin). */
export function buildCliffSegment(model: CliffModel, o: CliffSegmentOptions): THREE.BufferGeometry {
  const F = model.frame;
  const s = F.seed;
  const bury = o.bury ?? 12;
  const nc = Math.max(2, Math.round((o.z1 - o.z0) / o.ds) + 1);
  // profiles per column as polylines (t seaward, y), then resampled to a common row count
  const cols: Array<{ c: Column; pts: Float32Array; len: number }> = [];
  let maxLen = 0;
  for (let j = 0; j < nc; j++) {
    const z = o.z0 + ((o.z1 - o.z0) * j) / (nc - 1);
    const c = model.column(z);
    const pts: number[] = [];
    // buried top: under the snow surface from `bury` m inland to the rim
    for (let t = -bury; t < 0; t += 3) pts.push(t, F.landHeight(c.xr - t, z) - 0.45);
    const step = Math.max(1, o.dr * 0.5);
    for (let dz = 0; dz <= c.H; dz += step) pts.push(model.offsetAt(c, dz), c.hRim - dz);
    const P = new Float32Array(pts);
    let len = 0;
    for (let k = 2; k < P.length; k += 2) len += Math.hypot(P[k]! - P[k - 2]!, P[k + 1]! - P[k - 1]!);
    maxLen = Math.max(maxLen, len);
    cols.push({ c, pts: P, len });
  }
  const nr = Math.max(4, Math.round(maxLen / o.dr) + 1);
  const pos = new Float32Array(nc * nr * 3);
  const col = new Float32Array(nc * nr * 3);
  const faceKs = new Float32Array(nc * nr);
  for (let j = 0; j < nc; j++) {
    const { c, pts, len } = cols[j]!;
    const z = c.z;
    let k = 0;
    let acc = 0;
    for (let i = 0; i < nr; i++) {
      const target = (len * i) / (nr - 1);
      while (k < pts.length - 4 && acc + Math.hypot(pts[k + 2]! - pts[k]!, pts[k + 3]! - pts[k + 1]!) < target) {
        acc += Math.hypot(pts[k + 2]! - pts[k]!, pts[k + 3]! - pts[k + 1]!);
        k += 2;
      }
      const sl = Math.hypot(pts[k + 2]! - pts[k]!, pts[k + 3]! - pts[k + 1]!) || 1;
      const f = clamp((target - acc) / sl, 0, 1);
      const t = pts[k]! + (pts[k + 2]! - pts[k]!) * f;
      const y = pts[k + 1]! + (pts[k + 3]! - pts[k + 1]!) * f;
      const dz = c.hRim - y;
      // displacement along the (horizontal) face normal; none on the buried part, eased in under the lip
      const faceK = t <= 0 ? 0 : smoothstep(2, 14, dz) * (1 - smoothstep(c.H - 8, c.H - 2, dz) * 0.5);
      faceKs[j * nr + i] = faceK;
      const x0 = c.xr - t;
      const r = faceK > 0 ? relief(x0, y, z, s, faceK) : 0;
      const idx = (j * nr + i) * 3;
      pos[idx] = x0 - Math.max(-6, r); // seaward = −X; inward displacement capped (stays ahead of the backing)
      pos[idx + 1] = y + 0.15 * r;
      pos[idx + 2] = z;
      // baked colour: concavity AO × a slow warm/cool drift
      const occ = c.occ[Math.min(c.occ.length - 1, Math.max(0, Math.round(dz / DS)))] ?? 0;
      const ao = clamp(1 - 0.45 * occ - 0.06 * Math.max(0, -r), 0.45, 1);
      const warm = 0.5 + 0.5 * gnoise(z / 800, y / 400, s + 650);
      col[idx] = ao * (0.95 + 0.1 * warm);
      col[idx + 1] = ao * (0.97 + 0.03 * warm);
      col[idx + 2] = ao * (1.04 - 0.08 * warm);
    }
  }
  const idx = new Uint32Array((nc - 1) * (nr - 1) * 6);
  let q = 0;
  for (let j = 0; j < nc - 1; j++)
    for (let i = 0; i < nr - 1; i++) {
      const a = j * nr + i, b = a + 1, c2 = a + nr, d = c2 + 1;
      // winding: the face looks seaward (−X)
      idx[q++] = a; idx[q++] = b; idx[q++] = c2;
      idx[q++] = b; idx[q++] = d; idx[q++] = c2;
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  // make sure the winding faces the sea (flip if the average normal points inland)
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  let sx = 0;
  for (let i = 0; i < nrm.count; i++) sx += nrm.getX(i);
  if (sx > 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1]!;
      idx[i + 1] = idx[i + 2]!;
      idx[i + 2] = t;
    }
    g.index!.needsUpdate = true;
    g.computeVertexNormals();
  }
  g.computeBoundingSphere();
  g.computeBoundingBox();
  g.userData['faceK'] = faceKs;
  return g;
}

/** Streams cliff segments in a z-window around a focus (bounded: at most `maxSegments`). */
export class CliffKit {
  readonly group = new THREE.Group();
  private segs = new Map<number, { mesh: THREE.Mesh; lod: number }>();
  constructor(
    readonly model: CliffModel,
    readonly material: THREE.Material,
    readonly segLen = 256,
    readonly maxSegments = 16,
  ) {
    this.group.name = 'cliff-kit';
  }

  /** build/refresh the segments covering [z0, z1]; LOD by distance from (fx, fz) */
  sync(z0: number, z1: number, fx: number, fz: number, budget = Infinity): number {
    let built = 0;
    const i0 = Math.floor(z0 / this.segLen);
    const i1 = Math.floor(z1 / this.segLen);
    for (const [i, s] of this.segs) {
      if (i < i0 || i > i1) {
        s.mesh.geometry.dispose();
        this.group.remove(s.mesh);
        this.segs.delete(i);
      }
    }
    for (let i = i0; i <= i1 && built < budget; i++) {
      const za = i * this.segLen;
      const zm = za + this.segLen / 2;
      const c = this.model.column(zm);
      const d = Math.hypot(c.xr - fx, zm - fz);
      const lod = d < 500 ? 0 : d < 1400 ? 1 : 2;
      const cur = this.segs.get(i);
      if (cur && cur.lod === lod) continue;
      const geo = buildCliffSegment(this.model, { z0: za, z1: za + this.segLen, ds: [4, 8, 16][lod]!, dr: [3, 6, 12][lod]! });
      if (cur) {
        cur.mesh.geometry.dispose();
        cur.mesh.geometry = geo;
        cur.lod = lod;
      } else {
        if (this.segs.size >= this.maxSegments) break;
        const mesh = new THREE.Mesh(geo, this.material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = `cliff-seg-${i}`;
        this.group.add(mesh);
        this.segs.set(i, { mesh, lod });
      }
      built++;
    }
    return built;
  }

  get triangles(): number {
    let t = 0;
    for (const s of this.segs.values()) t += (s.mesh.geometry.index?.count ?? 0) / 3;
    return t;
  }
  get drawCalls(): number {
    return this.segs.size;
  }

  dispose(): void {
    for (const s of this.segs.values()) s.mesh.geometry.dispose();
    this.segs.clear();
    this.group.removeFromParent();
  }
}
