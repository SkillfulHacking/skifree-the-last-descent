/**
 * Instanced trees, rocks, logs and stumps. Streamed: follows the ObstacleField's 256 m bands
 * (built when a band is generated, disposed when it is released), split into x-cells for culling
 * and two-level LOD. Decorative forests on the outer valley walls are generated per band too,
 * deterministically, so memory stays bounded on any course length.
 */
import * as THREE from 'three';
import type { QualityPreset } from '../core/types';
import { Rng, fbm, smoothstep } from '../core/rng';
import { BAND, type Obstacle, type ObstacleField } from '../physics/obstacles';
import type { Mountain } from './course';
import { createFoliageMaterial, logGeometry, pineGeometry, rockGeometry, stumpGeometry } from './props';

const CELL = 256;

interface Cell {
  x0: number;
  z0: number;
  near: THREE.InstancedMesh[];
  far: THREE.InstancedMesh[];
  shadowCasters: THREE.InstancedMesh[];
  mid: THREE.InstancedMesh[];
}

interface Inst {
  x: number;
  y: number;
  z: number;
  rot: number;
  sx: number;
  sy: number;
  sz: number;
}

type Bucket = { trees: Inst[][]; rocks: Inst[][]; logs: Inst[]; stumps: Inst[]; farTrees: Inst[][] };

export class Vegetation {
  readonly group = new THREE.Group();
  /** band index → cells */
  private bands = new Map<number, Cell[]>();
  private queue: Array<{ band: number; list: readonly Obstacle[] }> = [];
  readonly uTime = { value: 0 };
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  private nearDist: number;
  readonly farDist: number;
  private shadowDist: number;
  private decorPerBand: number;
  private foliage: THREE.Material;
  private foliageFar: THREE.Material;
  private rockMat: THREE.Material;
  private treeNear: THREE.BufferGeometry[];
  private treeFar: THREE.BufferGeometry[];
  private rockNear: THREE.BufferGeometry[];
  private rockFar: THREE.BufferGeometry[];
  private logGeo: THREE.BufferGeometry;
  private stumpGeo: THREE.BufferGeometry;

  constructor(
    private mountain: Mountain,
    field: ObstacleField,
    quality: QualityPreset,
    private seed: number,
  ) {
    // near LOD trees are ~600–800 triangles since the pass-2 conifers: keep the near ring tight
    this.nearDist = { low: 100, medium: 140, high: 185, ultra: 280 }[quality];
    this.farDist = { low: 1300, medium: 1900, high: 2500, ultra: 3200 }[quality];
    this.shadowDist = { low: 60, medium: 90, high: 120, ultra: 160 }[quality];
    // the original static build scattered 6k/10k/15k decorative trees over ~4.5 km
    this.decorPerBand = Math.round(({ low: 6000, medium: 10000, high: 15000, ultra: 15000 }[quality] * BAND) / 4500);
    this.foliage = createFoliageMaterial(this.uTime, quality !== 'low');
    this.foliageFar = createFoliageMaterial(this.uTime, false);
    this.rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    this.mats.push(this.foliage, this.foliageFar, this.rockMat);

    this.treeNear = [0, 1, 2].map((v) => pineGeometry(v, true));
    this.treeFar = [0, 1, 2].map((v) => pineGeometry(v, false));
    this.rockNear = [0, 1, 2, 3].map((v) => rockGeometry(v, true));
    this.rockFar = [0, 1, 2, 3].map((v) => rockGeometry(v, false));
    this.logGeo = logGeometry();
    this.stumpGeo = stumpGeometry();
    this.geos.push(...this.treeNear, ...this.treeFar, ...this.rockNear, ...this.rockFar, this.logGeo, this.stumpGeo);

    field.onBand((band, list, added) => {
      if (added) this.queue.push({ band, list });
      else this.dropBand(band);
    });
  }

  /** Build every queued band now (loading screen). */
  flush() {
    while (this.queue.length) {
      const q = this.queue.shift()!;
      this.buildBand(q.band, q.list);
    }
  }

  get pending() {
    return this.queue.length;
  }
  get bandCount() {
    return this.bands.size;
  }

  private dropBand(band: number) {
    const qi = this.queue.findIndex((q) => q.band === band);
    if (qi >= 0) this.queue.splice(qi, 1);
    const cells = this.bands.get(band);
    if (!cells) return;
    for (const c of cells)
      for (const m of new Set([...c.near, ...c.far, ...c.mid])) {
        this.group.remove(m);
        m.dispose();
      }
    this.bands.delete(band);
  }

  private buildBand(band: number, obstacles: readonly Obstacle[]) {
    if (this.bands.has(band)) this.dropBand(band);
    const mountain = this.mountain;
    const seed = this.seed;
    const buckets = new Map<number, Bucket>();
    const get = (x: number) => {
      const b = Math.floor(x / CELL);
      let v = buckets.get(b);
      if (!v) buckets.set(b, (v = { trees: [[], [], []], rocks: [[], [], [], []], logs: [], stumps: [], farTrees: [[], [], []] }));
      return v;
    };
    for (const o of obstacles) {
      const b = get(o.x);
      const base: Inst = { x: o.x, y: o.y, z: o.z, rot: o.rot, sx: o.scale, sy: o.scale, sz: o.scale };
      switch (o.kind) {
        case 'tree':
          base.y -= 0.3;
          b.trees[o.variant % 3]!.push(base);
          break;
        case 'rock':
        case 'boulder':
          base.y -= 0.12 * o.scale;
          base.sy = o.scale * 0.95;
          b.rocks[o.variant % 4]!.push(base);
          break;
        case 'log':
          b.logs.push({ ...base, sx: 1, sy: 1, sz: o.halfLen * 2, y: o.y - 0.05 });
          break;
        case 'stump':
          b.stumps.push(base);
          break;
      }
    }
    // decorative forests on the outer valley walls (render only, no collision)
    const zA = band * BAND;
    if (zA + BAND > -300) {
      const rng = new Rng((seed ^ 0xf0e57 ^ Math.imul(band + 101, 0x27d4eb2d)) >>> 0);
      for (let i = 0; i < this.decorPerBand; i++) {
        const z = zA + rng.float() * BAND;
        const side = rng.chance(0.5) ? 1 : -1;
        const cx = mountain.centerX(z);
        const w = mountain.halfWidth(z);
        const off = w + 60 + Math.pow(rng.float(), 1.4) * 900;
        const x = cx + side * off;
        const r1 = rng.float();
        const s = rng.range(0.8, 1.5);
        const sy = rng.range(0.9, 1.2);
        const rot = rng.range(0, 6.28);
        const v = rng.int(0, 2);
        if (Math.abs(x) < 560) continue; // corridor trees come from the obstacle field
        if (z < -300) continue;
        const y = mountain.heightAt(x, z);
        // tree line by altitude relative to the local valley floor
        const rel = y - mountain.heightAt(cx, z);
        const dens = smoothstep(260, 120, rel) * (0.5 + 0.5 * smoothstep(-0.3, 0.3, fbm(x / 140, z / 140, seed + 3, 2))) * (0.35 + 0.65 * mountain.profile.treeLine(z));
        if (r1 > dens) continue;
        get(x).farTrees[v]!.push({ x, y: y - 0.4, z, rot, sx: s, sy: s * sy, sz: s });
      }
    }

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const make = (geo: THREE.BufferGeometry, mat: THREE.Material, list: Inst[], shadow: boolean) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => {
        e.set(0, it.rot, 0);
        q.setFromEuler(e);
        p.set(it.x, it.y, it.z);
        sc.set(it.sx, it.sy, it.sz);
        m4.compose(p, q, sc);
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = shadow;
      im.receiveShadow = shadow;
      im.computeBoundingSphere();
      im.frustumCulled = true;
      return im;
    };
    const cells: Cell[] = [];
    for (const [bx, b] of buckets) {
      const cell: Cell = { x0: bx * CELL, z0: zA, near: [], far: [], shadowCasters: [], mid: [] };
      b.trees.forEach((list, v) => {
        if (!list.length) return;
        const n = make(this.treeNear[v]!, this.foliage, list, true);
        cell.near.push(n);
        cell.shadowCasters.push(n);
      });
      const decorative = b.farTrees.flat();
      const allTrees = [...b.trees.flat(), ...decorative];
      // one draw call per cell for distant trees (all variants share the far mesh)
      if (allTrees.length) cell.far.push(make(this.treeFar[0]!, this.foliageFar, allTrees, false));
      if (decorative.length) cell.near.push(make(this.treeFar[1]!, this.foliageFar, decorative, false));
      b.rocks.forEach((list, v) => {
        if (!list.length) return;
        const n = make(this.rockNear[v]!, this.rockMat, list, true);
        cell.near.push(n);
        cell.shadowCasters.push(n);
      });
      const rocks = b.rocks.flat();
      if (rocks.length) cell.mid.push(make(this.rockFar[0]!, this.rockMat, rocks, false));
      if (b.logs.length) cell.near.push(make(this.logGeo, this.rockMat, b.logs, true));
      if (b.stumps.length) cell.near.push(make(this.stumpGeo, this.rockMat, b.stumps, true));
      for (const m of new Set([...cell.near, ...cell.far, ...cell.mid])) {
        m.visible = false;
        this.group.add(m);
      }
      cells.push(cell);
    }
    this.bands.set(band, cells);
  }

  get instanceCount(): number {
    let n = 0;
    for (const cells of this.bands.values()) for (const c of cells) for (const m of c.near) n += m.count;
    return n;
  }

  update(camPos: THREE.Vector3, time: number, budgetMs = 2) {
    this.uTime.value = time;
    if (this.queue.length) {
      // nearest band first
      this.queue.sort((a, b) => Math.abs(a.band * BAND + BAND / 2 - camPos.z) - Math.abs(b.band * BAND + BAND / 2 - camPos.z));
      const t0 = performance.now();
      do {
        const q = this.queue.shift()!;
        this.buildBand(q.band, q.list);
      } while (this.queue.length && performance.now() - t0 < budgetMs);
    }
    for (const cells of this.bands.values())
      for (const b of cells) {
        const dx = Math.max(0, Math.abs(camPos.x - (b.x0 + CELL / 2)) - CELL / 2);
        const dz = Math.max(0, Math.abs(camPos.z - (b.z0 + BAND / 2)) - BAND / 2);
        const d = Math.hypot(dx, dz);
        const near = d < this.nearDist;
        const far = !near && d < this.farDist;
        for (const m of b.far) m.visible = far;
        for (const m of b.near) m.visible = near;
        for (const m of b.mid) m.visible = far && d < 600;
        const shadows = d < this.shadowDist;
        for (const m of b.shadowCasters) m.castShadow = shadows;
      }
  }

  dispose() {
    for (const band of [...this.bands.keys()]) this.dropBand(band);
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
