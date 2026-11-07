/**
 * Chunked, LOD'd terrain streaming with skirts (no visible cracks), plus a coarse far-field mesh
 * for the distant ranges. Chunk builds are time-sliced (row by row) so streaming never hitches;
 * a chunk keeps showing its previous LOD until the replacement is complete.
 */
import * as THREE from 'three';
import type { QualityPreset } from '../core/types';
import type { Mountain } from './course';
import { createSnowMaterial, type TerrainUniforms } from './snowMaterial';

export const CHUNK = 128;
export const CORRIDOR = { x0: -512, x1: 512, z0: -384, z1: 3712 };
const STEPS = [1, 2, 4, 8, 16] as const;

interface Chunk {
  ix: number;
  iz: number;
  cx: number;
  cz: number;
  mesh: THREE.Mesh | null;
  step: number;
  building: number; // step currently being built (0 = none)
  job: Generator<void, THREE.BufferGeometry, void> | null;
}

function lodRanges(q: QualityPreset): number[] {
  // max distance for steps 1,2,4,8 (beyond → 16)
  switch (q) {
    case 'low':
      return [0, 150, 380, 900];
    case 'medium':
      return [90, 260, 560, 1200];
    case 'high':
      return [120, 300, 640, 1400];
    case 'ultra':
      return [200, 440, 900, 1800];
  }
}

export class TerrainRenderer {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshStandardMaterial;
  readonly uniforms: TerrainUniforms;
  private chunks: Chunk[] = [];
  private far: THREE.Mesh | null = null;
  private ranges: number[];
  private queue: Chunk[] = [];

  constructor(
    private mountain: Mountain,
    quality: QualityPreset,
  ) {
    const m = createSnowMaterial(quality);
    this.material = m.material;
    this.uniforms = m.uniforms;
    this.ranges = lodRanges(quality);
    for (let ix = CORRIDOR.x0 / CHUNK; ix < CORRIDOR.x1 / CHUNK; ix++) {
      for (let iz = CORRIDOR.z0 / CHUNK; iz < CORRIDOR.z1 / CHUNK; iz++) {
        this.chunks.push({ ix, iz, cx: ix * CHUNK + CHUNK / 2, cz: iz * CHUNK + CHUNK / 2, mesh: null, step: 0, building: 0, job: null });
      }
    }
  }

  /** Points that always get full terrain detail (e.g. the cave notch). */
  pinned: Array<{ x: number; z: number; r: number }> = [];

  desiredStep(c: Chunk, px: number, pz: number): number {
    for (const p of this.pinned) {
      if (Math.abs(p.x - c.cx) < CHUNK / 2 + p.r && Math.abs(p.z - c.cz) < CHUNK / 2 + p.r) return 1;
    }
    // distance from the focus to the chunk's nearest point
    const dx = Math.max(0, Math.abs(px - c.cx) - CHUNK / 2);
    const dz = Math.max(0, Math.abs(pz - c.cz) - CHUNK / 2);
    const d = Math.hypot(dx, dz);
    const want = this.stepAt(d);
    // hysteresis: only coarsen once well past the boundary (no rebuild thrash when carving across it)
    if (c.step > 0 && want > c.step && this.stepAt(d - 24) <= c.step) return c.step;
    return want;
  }

  private stepAt(d: number): number {
    for (let i = 0; i < this.ranges.length; i++) if (d <= this.ranges[i]!) return STEPS[i]!;
    return 16;
  }

  /** Build everything needed around a focus synchronously-ish (yields to the caller for progress). */
  async prime(px: number, pz: number, onProgress: (f: number) => void): Promise<void> {
    this.buildFar();
    const todo = this.chunks.map((c) => ({ c, step: this.desiredStep(c, px, pz) }));
    let done = 0;
    let last = performance.now();
    for (const t of todo) {
      const g = this.buildGeometry(t.c, t.step);
      let r = g.next();
      while (!r.done) r = g.next();
      this.swap(t.c, r.value, t.step);
      done++;
      if (performance.now() - last > 30) {
        onProgress(done / todo.length);
        await new Promise((res) => setTimeout(res, 0));
        last = performance.now();
      }
    }
    onProgress(1);
  }

  /** Per-frame streaming. budgetMs limits CPU time spent building. */
  update(px: number, pz: number, budgetMs: number, time: number): void {
    this.uniforms.uTime.value = time;
    // schedule rebuilds (desiredStep applies hysteresis); a job for a no-longer-wanted LOD is replaced
    for (const c of this.chunks) {
      const want = this.desiredStep(c, px, pz);
      if (want !== c.step && want !== c.building) {
        c.building = want;
        c.job = this.buildGeometry(c, want);
        if (!this.queue.includes(c)) this.queue.push(c);
      }
    }
    if (this.queue.length === 0) return;
    // nearest first
    this.queue.sort((a, b) => Math.hypot(a.cx - px, a.cz - pz) - Math.hypot(b.cx - px, b.cz - pz));
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < budgetMs) {
      const c = this.queue[0]!;
      if (!c.job) {
        this.queue.shift();
        continue;
      }
      const r = c.job.next();
      if (r.done) {
        this.swap(c, r.value, c.building);
        c.job = null;
        c.building = 0;
        this.queue.shift();
      }
    }
  }

  get pending(): number {
    return this.queue.length;
  }

  private swap(c: Chunk, geo: THREE.BufferGeometry, step: number) {
    if (c.mesh) {
      c.mesh.geometry.dispose();
      c.mesh.geometry = geo;
    } else {
      c.mesh = new THREE.Mesh(geo, this.material);
      c.mesh.receiveShadow = true;
      c.mesh.matrixAutoUpdate = false;
      c.mesh.updateMatrix();
      this.group.add(c.mesh);
    }
    c.mesh.castShadow = step <= 2;
    c.step = step;
  }

  private *buildGeometry(c: Chunk, step: number): Generator<void, THREE.BufferGeometry, void> {
    const m = this.mountain;
    const n = CHUNK / step; // quads per side
    const vs = n + 1;
    const x0 = c.ix * CHUNK;
    const z0 = c.iz * CHUNK;
    // heights with a 1-vertex ring for normals
    const hs = vs + 2;
    const H = new Float32Array(hs * hs);
    for (let j = 0; j < hs; j++) {
      const z = z0 + (j - 1) * step;
      for (let i = 0; i < hs; i++) H[j * hs + i] = m.heightAt(x0 + (i - 1) * step, z);
      if ((j & 3) === 3) yield;
    }
    const skirtCount = 4 * n;
    const vCount = vs * vs + skirtCount + 4;
    const pos = new Float32Array(vCount * 3);
    const nor = new Float32Array(vCount * 3);
    const surf = new Float32Array(vCount * 3);
    let k = 0;
    for (let j = 0; j < vs; j++) {
      const z = z0 + j * step;
      for (let i = 0; i < vs; i++) {
        const x = x0 + i * step;
        const hi = (j + 1) * hs + (i + 1);
        const h = H[hi]!;
        pos[k * 3] = x;
        pos[k * 3 + 1] = h;
        pos[k * 3 + 2] = z;
        const nx = H[hi - 1]! - H[hi + 1]!;
        const nz = H[hi - hs]! - H[hi + hs]!;
        const ny = 2 * step;
        const l = Math.hypot(nx, ny, nz);
        nor[k * 3] = nx / l;
        nor[k * 3 + 1] = ny / l;
        nor[k * 3 + 2] = nz / l;
        if (step <= 8) {
          const w = m.surfaceWeights(x, z);
          surf[k * 3] = w.ice;
          surf[k * 3 + 1] = w.powder;
          surf[k * 3 + 2] = w.groomed;
        } else surf[k * 3 + 1] = 0.5;
        k++;
      }
      if ((j & 7) === 7) yield;
    }
    // indices
    const quads = n * n;
    const idx = new Uint32Array(quads * 6 + skirtCount * 6);
    let t = 0;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const a = j * vs + i;
        const b = a + 1;
        const cc = a + vs;
        const d = cc + 1;
        // alternate diagonal for less directional artefacts
        if ((i + j) & 1) {
          idx[t++] = a; idx[t++] = cc; idx[t++] = b;
          idx[t++] = b; idx[t++] = cc; idx[t++] = d;
        } else {
          idx[t++] = a; idx[t++] = cc; idx[t++] = d;
          idx[t++] = a; idx[t++] = d; idx[t++] = b;
        }
      }
    // skirts: duplicate border vertices pushed down; hides cracks between LODs
    const depth = 2 + step * 1.5;
    const border: number[] = [];
    for (let i = 0; i < n; i++) border.push(i); // bottom edge (j=0)
    for (let j = 0; j < n; j++) border.push(j * vs + n); // right edge
    for (let i = n; i > 0; i--) border.push(n * vs + i); // top edge
    for (let j = n; j > 0; j--) border.push(j * vs); // left edge
    const skirtStart = k;
    for (const bi of border) {
      pos[k * 3] = pos[bi * 3]!;
      pos[k * 3 + 1] = pos[bi * 3 + 1]! - depth;
      pos[k * 3 + 2] = pos[bi * 3 + 2]!;
      nor[k * 3] = nor[bi * 3]!;
      nor[k * 3 + 1] = nor[bi * 3 + 1]!;
      nor[k * 3 + 2] = nor[bi * 3 + 2]!;
      surf[k * 3] = surf[bi * 3]!;
      surf[k * 3 + 1] = surf[bi * 3 + 1]!;
      surf[k * 3 + 2] = surf[bi * 3 + 2]!;
      k++;
    }
    for (let e = 0; e < border.length; e++) {
      const a = border[e]!;
      const b = border[(e + 1) % border.length]!;
      const as = skirtStart + e;
      const bs = skirtStart + ((e + 1) % border.length);
      // double-sided via two windings is unnecessary: border loop is CCW from above → outward faces
      idx[t++] = a; idx[t++] = b; idx[t++] = as;
      idx[t++] = b; idx[t++] = bs; idx[t++] = as;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, k * 3), 3));
    geo.setAttribute('aSurf', new THREE.BufferAttribute(surf.subarray(0, k * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, t), 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }

  /** Far field: coarse grid over the whole valley + ranges, with a hole where corridor chunks live. */
  private buildFar() {
    if (this.far) return;
    const m = this.mountain;
    const step = 64;
    const X0 = -7040;
    const X1 = 7040;
    const Z0 = -5120;
    const Z1 = 10240;
    const nx = (X1 - X0) / step;
    const nz = (Z1 - Z0) / step;
    const vs = nx + 1;
    const pos = new Float32Array(vs * (nz + 1) * 3);
    const surf = new Float32Array(vs * (nz + 1) * 3);
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) {
        const k = j * vs + i;
        const x = X0 + i * step;
        const z = Z0 + j * step;
        pos[k * 3] = x;
        pos[k * 3 + 1] = m.heightAt(x, z);
        pos[k * 3 + 2] = z;
        surf[k * 3 + 1] = 0.6;
      }
    const idx: number[] = [];
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const x = X0 + i * step;
        const z = Z0 + j * step;
        const inside = x >= CORRIDOR.x0 && x + step <= CORRIDOR.x1 && z >= CORRIDOR.z0 && z + step <= CORRIDOR.z1;
        if (inside) continue;
        const a = j * vs + i;
        idx.push(a, a + vs, a + vs + 1, a, a + vs + 1, a + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSurf', new THREE.BufferAttribute(surf, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    this.far = new THREE.Mesh(geo, this.material);
    this.far.receiveShadow = false;
    this.far.matrixAutoUpdate = false;
    this.group.add(this.far);
  }

  dispose() {
    for (const c of this.chunks) c.mesh?.geometry.dispose();
    this.far?.geometry.dispose();
    this.material.dispose();
  }
}
