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
import { fbm3, noise3, terraced, smoothstep, clamp } from './noise3';
import { gnoise } from '../../core/rng';

export { CliffModel, DS, type Column, type CoastFrame } from './cliffModel';
import { CliffModel, DS, type Column } from './cliffModel';

/**
 * relief displacement (m) of the face at a world point, along the face normal (+ = seaward).
 * Only forms the vertex grid can carry (≥ ~15 m): high-frequency noise here aliases against the
 * grid into a regular hatch (the baked normal map does the small scale).
 */
function relief(x: number, y: number, z: number, s: number, faceK: number, H: number, ledgeLod = 1): number {
  const A = clamp(H / 60, 1, 2.4);
  // big blocks: terraced noise → steps and ledges
  const blocks = terraced(0.5 + 0.5 * fbm3(x / 110, y / 60, z / 110, s + 601, 3), 4, 0.3) - 0.5;
  // strata ledges: each bed juts out at its top and recedes at its base (sawtooth in height, beds
  // 9–22 m thick, wavering along the coast) — the low sun turns every ledge into a shadow line
  const bedY = y / (14 + 5 * noise3(x / 300, 0.5, z / 300, s + 611)) + 0.6 * noise3(x / 160, y / 400, z / 160, s + 612);
  const fr = bedY - Math.floor(bedY);
  const ledge = (fr < 0.6 ? fr / 0.6 : (1 - fr) / 0.4) - 0.5;
  const ledgeK = 0.5 + 0.5 * smoothstep(-0.2, 0.4, noise3(x / 220, y / 90, z / 220, s + 613));
  // round 4 (art: "a flat canvas wall" at a kilometre): buttresses and ribs. Outward only (the
  // inward cap keeps the face ahead of the backing): vertical ribs 40–90 m apart that wander down the
  // face and die out at random heights, and broad buttresses a few hundred metres across, so the low
  // sun draws vertical shadow lines and the wall breaks into masses instead of one plane
  const zr = z + 22 * noise3(x / 200, y / 160, z / 200, s + 614);
  const rib = Math.pow(Math.max(0, noise3(zr / 62, y / 420, x / 62, s + 615)), 1.6) * smoothstep(-0.3, 0.3, noise3(z / 140, y / 110, 0.7, s + 616));
  const butt = Math.max(0, fbm3(z / 340, y / 700, x / 340, s + 617, 2));
  return faceK * A * (8 * blocks + 3.2 * ledge * ledgeK * ledgeLod + 22 * rib + 26 * butt);
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
  const job = cliffSegmentSteps(model, o, () => false);
  let r = job.next();
  while (!r.done) r = job.next();
  return r.value;
}

/**
 * The same build as a time-sliced job: yields between columns whenever `over()` says the slice is
 * spent (the game streams segments on the shared per-frame budget). Identical output.
 */
export function* cliffSegmentSteps(model: CliffModel, o: CliffSegmentOptions, over: () => boolean): Generator<void, THREE.BufferGeometry, void> {
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
    if (over()) yield;
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
      // displacement along the (horizontal) face normal; none on the buried part, eased in under the
      // lip; a hamlet's strand flat keeps the lowest ~40 m plain (the houses stand at its foot: P-M6)
      let faceK = t <= 0 ? 0 : smoothstep(2, 14, dz) * (1 - smoothstep(c.H - 8, c.H - 2, dz) * 0.5);
      faceK *= 1 - c.hm * smoothstep(c.H - 45, c.H - 4, dz);
      faceKs[j * nr + i] = faceK;
      const x0 = c.xr - t;
      // (the 9–22 m strata ledges only where the rows resolve them: on coarse LODs they alias into a
      // regular hatch at distance)
      const r = faceK > 0 ? relief(x0, y, z, s, faceK, c.H, o.dr <= 3 ? 1 : o.dr <= 6 ? 0.45 : 0) : 0;
      // snow benches (review p1): where the profile lies back (a bench), the snow has body: lift the
      // surface up to ~1.3 m and round its outer edge into a soft lip over the band below
      const sA = (model.offsetAt(c, dz + 2) - model.offsetAt(c, dz - 2)) / 4;
      const bench = t <= 0 ? 0 : smoothstep(0.75, 1.5, sA) * smoothstep(6, 16, dz) * (1 - smoothstep(c.H - 10, c.H - 3, dz)) * (1 - c.hm * smoothstep(c.H - 30, c.H - 4, dz));
      const sB = (model.offsetAt(c, dz + 5) - model.offsetAt(c, dz + 1)) / 4;
      const lip = t <= 0 ? 0 : bench * (1 - smoothstep(0.6, 1.2, sB)); // the bench's outer edge
      const idx = (j * nr + i) * 3;
      pos[idx] = x0 - Math.max(-7, r) - 0.7 * lip; // seaward = −X; inward displacement capped (stays ahead of the backing)
      pos[idx + 1] = y + 0.15 * r + 1.3 * bench - 0.3 * lip;
      pos[idx + 2] = z;
      // baked colour: concavity AO × a slow warm/cool drift (kept gentle: deep relief cuts must not
      // read as black blotches, review p6)
      const occ = c.occ[Math.min(c.occ.length - 1, Math.max(0, Math.round(dz / DS)))] ?? 0;
      const ao = clamp(1 - 0.38 * occ - 0.022 * Math.max(0, -r), 0.62, 1);
      const warm = 0.5 + 0.5 * gnoise(z / 800, y / 400, s + 650);
      col[idx] = ao * (0.95 + 0.1 * warm);
      col[idx + 1] = ao * (0.97 + 0.03 * warm);
      col[idx + 2] = ao * (1.04 - 0.08 * warm);
    }
    if (over()) yield;
  }
  // where each column's displaced face meets the water (the surf line, review P-M5): x, z per column
  // (NaN: none — a hamlet's strand flat meets the water as heightfield, which has its own surf)
  const foam = new Float32Array(nc * 2).fill(NaN);
  for (let j = 0; j < nc; j++) {
    const c = cols[j]!.c;
    if (c.hm > 0.5) continue;
    for (let i = 1; i < nr; i++) {
      const a = (j * nr + i - 1) * 3, b2 = (j * nr + i) * 3;
      const ya = pos[a + 1]!, yb = pos[b2 + 1]!;
      if (ya >= c.water && yb < c.water) {
        const f = (ya - c.water) / Math.max(1e-6, ya - yb);
        foam[j * 2] = pos[a]! + (pos[b2]! - pos[a]!) * f;
        foam[j * 2 + 1] = c.z;
        break;
      }
    }
  }
  const idx = new Uint32Array((nc - 1) * (nr - 1) * 6);
  let q = 0;
  for (let j = 0; j < nc - 1; j++)
    for (let i = 0; i < nr - 1; i++) {
      const a = j * nr + i, b = a + 1, c2 = a + nr, d = c2 + 1;
      // winding: the face looks seaward (−X)
      // alternate the diagonal (no directional streaks in the shading)
      if ((i + j) & 1) {
        idx[q++] = a; idx[q++] = b; idx[q++] = c2;
        idx[q++] = b; idx[q++] = d; idx[q++] = c2;
      } else {
        idx[q++] = a; idx[q++] = d; idx[q++] = c2;
        idx[q++] = a; idx[q++] = b; idx[q++] = d;
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  if (over()) yield;
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
    if (over()) yield;
    g.computeVertexNormals();
  }
  g.computeBoundingSphere();
  g.computeBoundingBox();
  g.userData['faceK'] = faceKs;
  g.userData['foam'] = foam;
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
