/**
 * Instanced trees, rocks, logs and stumps, bucketed into Z bands for culling and two-level LOD.
 */
import * as THREE from 'three';
import type { QualityPreset } from '../core/types';
import { Rng, fbm, smoothstep } from '../core/rng';
import type { Obstacle } from '../physics/obstacles';
import { centerX, halfWidth, type Mountain } from './course';
import { createFoliageMaterial, logGeometry, pineGeometry, rockGeometry, stumpGeometry } from './props';

const CELL = 160;

interface Band {
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

export class Vegetation {
  readonly group = new THREE.Group();
  private bands: Band[] = [];
  readonly uTime = { value: 0 };
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  private nearDist: number;
  private farDist: number;
  private shadowDist: number;

  constructor(
    mountain: Mountain,
    obstacles: Obstacle[],
    quality: QualityPreset,
    seed: number,
  ) {
    this.nearDist = { low: 110, medium: 170, high: 230, ultra: 320 }[quality];
    this.farDist = { low: 1300, medium: 1900, high: 2500, ultra: 3200 }[quality];
    this.shadowDist = { low: 60, medium: 90, high: 120, ultra: 160 }[quality];
    const foliage = createFoliageMaterial(this.uTime, quality !== 'low');
    const foliageFar = createFoliageMaterial(this.uTime, false);
    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    this.mats.push(foliage, foliageFar, rockMat);

    const treeNear = [0, 1, 2].map((v) => pineGeometry(v, true));
    const treeFar = [0, 1, 2].map((v) => pineGeometry(v, false));
    const rockNear = [0, 1, 2, 3].map((v) => rockGeometry(v, true));
    const rockFar = [0, 1, 2, 3].map((v) => rockGeometry(v, false));
    const log = logGeometry();
    const stump = stumpGeometry();
    this.geos.push(...treeNear, ...treeFar, ...rockNear, ...rockFar, log, stump);

    // bucket instances: key = band index, then type
    type Bucket = { trees: Inst[][]; rocks: Inst[][]; logs: Inst[]; stumps: Inst[]; farTrees: Inst[][] };
    const buckets = new Map<number, Bucket>();
    const key = (x: number, z: number) => Math.floor(x / CELL) * 100000 + Math.floor(z / CELL);
    const get = (z: number, x: number) => {
      const b = key(x, z);
      let v = buckets.get(b);
      if (!v) buckets.set(b, (v = { trees: [[], [], []], rocks: [[], [], [], []], logs: [], stumps: [], farTrees: [[], [], []] }));
      return v;
    };
    for (const o of obstacles) {
      const b = get(o.z, o.x);
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
    const rng = new Rng(seed ^ 0xf0e57);
    for (let i = 0; i < (quality === 'low' ? 6000 : quality === 'medium' ? 10000 : 15000); i++) {
      const z = rng.range(-300, 4200);
      const side = rng.chance(0.5) ? 1 : -1;
      const cx = centerX(z);
      const w = halfWidth(z);
      const off = w + 60 + Math.pow(rng.float(), 1.4) * 900;
      const x = cx + side * off;
      if (Math.abs(x) < 560 && z < 3420) continue; // corridor trees come from the obstacle field
      const y = mountain.heightAt(x, z);
      // tree line by altitude relative to the local valley floor
      const rel = y - mountain.heightAt(cx, z);
      const dens = smoothstep(260, 120, rel) * (0.5 + 0.5 * smoothstep(-0.3, 0.3, fbm(x / 140, z / 140, seed + 3, 2)));
      if (rng.float() > dens) continue;
      const s = rng.range(0.8, 1.5);
      get(z, x).farTrees[rng.int(0, 2)]!.push({ x, y: y - 0.4, z, rot: rng.range(0, 6.28), sx: s, sy: s * rng.range(0.9, 1.2), sz: s });
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
    for (const [bi, b] of buckets) {
      const bx = Math.round(bi / 100000);
      const bz = bi - bx * 100000;
      const band: Band = { x0: bx * CELL, z0: bz * CELL, near: [], far: [], shadowCasters: [], mid: [] };
      b.trees.forEach((list, v) => {
        if (!list.length) return;
        const n = make(treeNear[v]!, foliage, list, true);
        band.near.push(n);
        band.shadowCasters.push(n);
      });
      const decorative = b.farTrees.flat();
      const allTrees = [...b.trees.flat(), ...decorative];
      // one draw call per cell for distant trees (all variants share the far mesh)
      if (allTrees.length) band.far.push(make(treeFar[0]!, foliageFar, allTrees, false));
      if (decorative.length) band.near.push(make(treeFar[1]!, foliageFar, decorative, false));
      b.rocks.forEach((list, v) => {
        if (!list.length) return;
        const n = make(rockNear[v]!, rockMat, list, true);
        band.near.push(n);
        band.shadowCasters.push(n);
      });
      const rocks = b.rocks.flat();
      if (rocks.length) band.mid.push(make(rockFar[0]!, rockMat, rocks, false));
      if (b.logs.length) band.near.push(make(log, rockMat, b.logs, true));
      if (b.stumps.length) band.near.push(make(stump, rockMat, b.stumps, true));
      for (const m of new Set([...band.near, ...band.far, ...band.mid])) {
        m.visible = false;
        this.group.add(m);
      }
      this.bands.push(band);
    }
  }

  get instanceCount(): number {
    let n = 0;
    for (const b of this.bands) for (const m of b.near) n += m.count;
    return n;
  }

  update(camPos: THREE.Vector3, time: number) {
    this.uTime.value = time;
    for (const b of this.bands) {
      const dx = Math.max(0, Math.abs(camPos.x - (b.x0 + CELL / 2)) - CELL / 2);
      const dz = Math.max(0, Math.abs(camPos.z - (b.z0 + CELL / 2)) - CELL / 2);
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
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const b of this.bands) for (const m of new Set([...b.near, ...b.far, ...b.mid])) m.dispose();
  }
}
