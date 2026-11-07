/**
 * Streamed, LOD'd terrain with skirts (no visible cracks) plus streamed far-field tiles for the
 * distant ranges. Works for any course length: only a window around the focus exists in memory.
 *
 * - Corridor chunks (128 m, LOD steps 1–16 m) cover x ∈ [−512, 512] in a z-window around the focus.
 * - Far-field tiles (2048 m, 64 m step) cover x ∈ [−7168, 7168] with a hole for the corridor.
 * - Vertex data is stored relative to each mesh's origin (mesh.position), so precision holds at
 *   any distance down the mountain (see also World's floating origin).
 * - Builds are time-sliced (row by row); a chunk keeps its previous LOD until the new one is ready.
 */
import * as THREE from 'three';
import type { QualityPreset } from '../core/types';
import type { Mountain } from './course';
import { createSnowMaterial, type TerrainUniforms } from './snowMaterial';

export const CHUNK = 128;
export const CORRIDOR_X = { x0: -512, x1: 512 } as const;
const FAR_TILE = 2048;
const FAR_STEP = 64;
const FAR_X = 7168;
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

interface FarTile {
  ix: number;
  iz: number;
  mesh: THREE.Mesh | null;
  job: Generator<void, THREE.BufferGeometry | null, void> | null;
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
  private chunks = new Map<number, Chunk>();
  private far = new Map<number, FarTile>();
  private ranges: number[];
  private queue: Chunk[] = [];
  private farQueue: FarTile[] = [];
  /** z-window of corridor chunks around the focus */
  private behind = 1024;
  private ahead: number;
  private farBehind = 4096;
  private farAhead: number;
  /** Points that always get full terrain detail (e.g. cave notches). */
  pinned: Array<{ x: number; z: number; r: number }> = [];

  constructor(
    private mountain: Mountain,
    quality: QualityPreset,
  ) {
    const m = createSnowMaterial(quality);
    this.material = m.material;
    this.uniforms = m.uniforms;
    this.ranges = lodRanges(quality);
    this.ahead = { low: 2400, medium: 3000, high: 3600, ultra: 4200 }[quality];
    this.farAhead = { low: 8192, medium: 10240, high: 12288, ultra: 14336 }[quality];
  }

  private key(ix: number, iz: number) {
    return (iz + 1_000_000) * 64 + (ix + 32);
  }

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

  /** Create/destroy chunk records for the window around pz. */
  private syncWindow(pz: number) {
    const iz0 = Math.floor((pz - this.behind) / CHUNK);
    const iz1 = Math.floor((pz + this.ahead) / CHUNK);
    for (let iz = iz0; iz <= iz1; iz++)
      for (let ix = CORRIDOR_X.x0 / CHUNK; ix < CORRIDOR_X.x1 / CHUNK; ix++) {
        const k = this.key(ix, iz);
        if (!this.chunks.has(k)) this.chunks.set(k, { ix, iz, cx: ix * CHUNK + CHUNK / 2, cz: iz * CHUNK + CHUNK / 2, mesh: null, step: 0, building: 0, job: null });
      }
    for (const [k, c] of this.chunks) {
      if (c.iz >= iz0 - 1 && c.iz <= iz1 + 1) continue;
      if (c.mesh) {
        c.mesh.geometry.dispose();
        this.group.remove(c.mesh);
      }
      c.job = null;
      this.chunks.delete(k);
      const qi = this.queue.indexOf(c);
      if (qi >= 0) this.queue.splice(qi, 1);
    }
    // far tiles
    const fz0 = Math.floor((pz - this.farBehind) / FAR_TILE);
    const fz1 = Math.floor((pz + this.farAhead) / FAR_TILE);
    for (let iz = fz0; iz <= fz1; iz++)
      for (let ix = -FAR_X / FAR_TILE; ix < FAR_X / FAR_TILE; ix++) {
        const k = this.key(ix, iz);
        if (this.far.has(k)) continue;
        const t: FarTile = { ix, iz, mesh: null, job: null };
        t.job = this.buildFar(t);
        this.far.set(k, t);
        this.farQueue.push(t);
      }
    for (const [k, t] of this.far) {
      if (t.iz >= fz0 - 1 && t.iz <= fz1 + 1) continue;
      if (t.mesh) {
        t.mesh.geometry.dispose();
        this.group.remove(t.mesh);
      }
      this.far.delete(k);
      const qi = this.farQueue.indexOf(t);
      if (qi >= 0) this.farQueue.splice(qi, 1);
    }
  }

  /** Build everything needed around a focus up front (yields to the caller for progress). */
  async prime(px: number, pz: number, onProgress: (f: number) => void): Promise<void> {
    this.syncWindow(pz);
    const todo = [...this.chunks.values()];
    const total = todo.length + this.farQueue.length;
    let done = 0;
    let last = performance.now();
    const tick = async () => {
      done++;
      if (performance.now() - last > 30) {
        onProgress(done / total);
        await new Promise((res) => setTimeout(res, 0));
        last = performance.now();
      }
    };
    while (this.farQueue.length) {
      const t = this.farQueue.shift()!;
      let r = t.job!.next();
      while (!r.done) r = t.job!.next();
      this.swapFar(t, r.value);
      await tick();
    }
    for (const c of todo) {
      const step = this.desiredStep(c, px, pz);
      const g = this.buildGeometry(c, step);
      let r = g.next();
      while (!r.done) r = g.next();
      this.swap(c, r.value, step);
      await tick();
    }
    onProgress(1);
  }

  /** Per-frame streaming. budgetMs limits CPU time spent building. */
  update(px: number, pz: number, budgetMs: number, time: number): void {
    this.uniforms.uTime.value = time;
    this.syncWindow(pz);
    for (const c of this.chunks.values()) {
      const want = this.desiredStep(c, px, pz);
      if (want !== c.step && want !== c.building) {
        c.building = want;
        c.job = this.buildGeometry(c, want);
        if (!this.queue.includes(c)) this.queue.push(c);
      }
    }
    const t0 = performance.now();
    if (this.queue.length) {
      // nearest first
      this.queue.sort((a, b) => Math.hypot(a.cx - px, a.cz - pz) - Math.hypot(b.cx - px, b.cz - pz));
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
    // far tiles: whatever budget is left, but always at least a small guaranteed slice so the
    // distant ranges can never starve behind a long corridor queue
    const tf = performance.now();
    while (this.farQueue.length && (performance.now() - t0 < budgetMs * 1.2 || performance.now() - tf < 0.75)) {
      const t = this.farQueue[0]!;
      const r = t.job!.next();
      if (r.done) {
        this.swapFar(t, r.value);
        this.farQueue.shift();
      }
    }
  }

  /** Build every missing far tile now (after a teleport; loading screens). */
  flushFar() {
    while (this.farQueue.length) {
      const t = this.farQueue.shift()!;
      let r = t.job!.next();
      while (!r.done) r = t.job!.next();
      this.swapFar(t, r.value);
    }
  }

  /** Synchronously bring every chunk around a focus to its wanted LOD (teleports). */
  flushAround(px: number, pz: number) {
    this.syncWindow(pz);
    this.flushFar();
    for (const c of this.chunks.values()) {
      const want = this.desiredStep(c, px, pz);
      if (c.mesh && c.step <= Math.max(want, 4)) continue;
      const g = this.buildGeometry(c, want);
      let r = g.next();
      while (!r.done) r = g.next();
      this.swap(c, r.value, want);
      c.job = null;
      c.building = 0;
    }
    this.queue = this.queue.filter((c) => c.job);
  }

  get pending(): number {
    return this.queue.length + this.farQueue.length;
  }
  get chunkCount(): number {
    return this.chunks.size;
  }
  get farCount(): number {
    return this.far.size;
  }

  private swap(c: Chunk, geo: THREE.BufferGeometry, step: number) {
    if (!this.chunks.has(this.key(c.ix, c.iz))) {
      geo.dispose(); // chunk left the window while building
      return;
    }
    if (c.mesh) {
      c.mesh.geometry.dispose();
      c.mesh.geometry = geo;
    } else {
      c.mesh = new THREE.Mesh(geo, this.material);
      c.mesh.receiveShadow = true;
      c.mesh.position.set(c.ix * CHUNK, (geo.userData['y0'] as number) ?? 0, c.iz * CHUNK);
      this.group.add(c.mesh);
    }
    c.mesh.position.y = (geo.userData['y0'] as number) ?? 0;
    c.mesh.updateMatrix();
    c.mesh.matrixAutoUpdate = false;
    c.mesh.castShadow = step <= 2;
    c.step = step;
  }

  private swapFar(t: FarTile, geo: THREE.BufferGeometry | null) {
    if (!geo) return;
    if (!this.far.has(this.key(t.ix, t.iz))) {
      geo.dispose();
      return;
    }
    t.mesh = new THREE.Mesh(geo, this.material);
    t.mesh.position.set(t.ix * FAR_TILE, (geo.userData['y0'] as number) ?? 0, t.iz * FAR_TILE);
    t.mesh.updateMatrix();
    t.mesh.matrixAutoUpdate = false;
    t.mesh.receiveShadow = false;
    this.group.add(t.mesh);
  }

  private *buildGeometry(c: Chunk, step: number): Generator<void, THREE.BufferGeometry, void> {
    const m = this.mountain;
    const n = CHUNK / step; // quads per side
    const vs = n + 1;
    const x0 = c.ix * CHUNK;
    const z0 = c.iz * CHUNK;
    // heights with a 1-vertex ring for normals
    const hs = vs + 2;
    const H = new Float64Array(hs * hs);
    for (let j = 0; j < hs; j++) {
      const z = z0 + (j - 1) * step;
      for (let i = 0; i < hs; i++) H[j * hs + i] = m.heightAt(x0 + (i - 1) * step, z);
      if ((j & 3) === 3) yield;
    }
    // local vertical origin keeps vertex values small (precision on long courses)
    const y0 = Math.round(H[(1 + (vs >> 1)) * hs + 1 + (vs >> 1)]!);
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
        pos[k * 3] = i * step;
        pos[k * 3 + 1] = H[hi]! - y0;
        pos[k * 3 + 2] = j * step;
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
    for (let i = 0; i < n; i++) border.push(i);
    for (let j = 0; j < n; j++) border.push(j * vs + n);
    for (let i = n; i > 0; i--) border.push(n * vs + i);
    for (let j = n; j > 0; j--) border.push(j * vs);
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
      idx[t++] = a; idx[t++] = b; idx[t++] = as;
      idx[t++] = b; idx[t++] = bs; idx[t++] = as;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, k * 3), 3));
    geo.setAttribute('aSurf', new THREE.BufferAttribute(surf.subarray(0, k * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, t), 1));
    geo.userData['y0'] = y0;
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }

  /** Far-field tile with a hole where corridor chunks live. Returns null if fully inside the corridor. */
  private *buildFar(tile: FarTile): Generator<void, THREE.BufferGeometry | null, void> {
    const m = this.mountain;
    const X0 = tile.ix * FAR_TILE;
    const Z0 = tile.iz * FAR_TILE;
    const n = FAR_TILE / FAR_STEP;
    const vs = n + 1;
    const H = new Float64Array(vs * vs);
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) H[j * vs + i] = m.heightAt(X0 + i * FAR_STEP, Z0 + j * FAR_STEP);
      if ((j & 7) === 7) yield;
    }
    const y0 = Math.round(H[(vs >> 1) * vs + (vs >> 1)]!);
    const pos = new Float32Array(vs * vs * 3);
    const surf = new Float32Array(vs * vs * 3);
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        const k = j * vs + i;
        pos[k * 3] = i * FAR_STEP;
        pos[k * 3 + 1] = H[k]! - y0;
        pos[k * 3 + 2] = j * FAR_STEP;
        surf[k * 3 + 1] = 0.6;
      }
    const idx: number[] = [];
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = X0 + i * FAR_STEP;
        // corridor chunks cover x ∈ [−512, 512] for the whole streamed z-range
        const inside = x >= CORRIDOR_X.x0 && x + FAR_STEP <= CORRIDOR_X.x1;
        if (inside) continue;
        const a = j * vs + i;
        idx.push(a, a + vs, a + vs + 1, a, a + vs + 1, a + 1);
      }
    if (!idx.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSurf', new THREE.BufferAttribute(surf, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geo.userData['y0'] = y0;
    return geo;
  }

  dispose() {
    for (const c of this.chunks.values()) c.mesh?.geometry.dispose();
    for (const t of this.far.values()) t.mesh?.geometry.dispose();
    this.chunks.clear();
    this.far.clear();
    this.material.dispose();
  }
}
