/**
 * Instanced trees, rocks, logs and stumps. Streamed: follows the ObstacleField's 256 m bands
 * (built when a band is generated, disposed when it is released), split into x-cells for culling
 * and two-level LOD. Decorative forests on the outer valley walls are generated per band too,
 * deterministically, so memory stays bounded on any course length.
 */
import * as THREE from 'three';
import type { QualityPreset } from '../core/types';
import { Rng, fbm, smoothstep } from '../core/rng';
import { BAND, pickSpecies, type Obstacle, type ObstacleField } from '../physics/obstacles';
import type { Mountain } from './course';
import { createFoliageMaterial, createRockMaterial, logGeometry, pineGeometry, rockGeometry, stumpGeometry } from './props';

/** rock geometry variants (see rockGeometry: boulder, blocky, slab, split block, dome, wedge) */
const ROCK_VARIANTS = 6;

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
  /** optional tilt (rocks) */
  rx?: number;
  rz?: number;
}

/** small deterministic hash → [0,1) */
function hash01(a: number, b: number, c = 0): number {
  let h = Math.imul(Math.floor(a * 7.31) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.floor(b * 3.17) + c * 0x27d4eb2d, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

type Bucket = { trees: Inst[][]; rocks: Inst[][]; pebbles: Inst[]; logs: Inst[]; stumps: Inst[]; farTrees: Inst[][] };

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
  private woodMat: THREE.Material;
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
    // the location's palette and species (alpine: the original look)
    const biome = mountain.biome;
    this.foliage = createFoliageMaterial(this.uTime, quality !== 'low', biome);
    this.foliageFar = createFoliageMaterial(this.uTime, false, biome);
    this.rockMat = createRockMaterial(biome);
    this.woodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    this.mats.push(this.foliage, this.foliageFar, this.rockMat, this.woodMat);

    this.treeNear = [0, 1, 2].map((v) => pineGeometry(v, true, biome));
    this.treeFar = [0, 1, 2].map((v) => pineGeometry(v, false, biome));
    this.rockNear = Array.from({ length: ROCK_VARIANTS }, (_, v) => rockGeometry(v, true, { snow: 0, color: biome.rocks.base }));
    // mid/far LOD: three angular characters (one shared boulder made every distant rock identical)
    this.rockFar = [1, 3, 5].map((v) => rockGeometry(v, false, { snow: 0, detail: 1, color: biome.rocks.base }));
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
      if (!v) buckets.set(b, (v = { trees: [[], [], []], rocks: Array.from({ length: ROCK_VARIANTS }, () => []), pebbles: [], logs: [], stumps: [], farTrees: [[], [], []] }));
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
        case 'boulder': {
          // per-instance character: variant, footprint aspect (within ±25 % of the collision
          // scale), height, burial depth and tilt are hashed from the position (deterministic)
          const h1 = hash01(o.x, o.z, 1);
          const h2 = hash01(o.x, o.z, 2);
          const h3 = hash01(o.x, o.z, 3);
          const sc = o.scale;
          // chunky, not discs: height 0.85–1.6× the footprint scale, buried by 20–45 % of it (the
          // geometry runs below its origin, so the rock grows out of the snow), varied tilt.
          // Away from the piste (distance from the centre line) rocks get taller and more tilted:
          // weathered blocks on the margins, lower rounded ones where the piste is groomed.
          const off = Math.min(1, Math.abs(o.x - mountain.centerX(o.z)) / Math.max(20, mountain.halfWidth(o.z)));
          base.sx = sc * (0.85 + 0.35 * h1);
          base.sz = sc * (0.85 + 0.35 * h2);
          base.sy = sc * (0.85 + 0.45 * h3 + 0.3 * off * hash01(o.x, o.z, 8));
          base.y = o.y - sc * (0.2 + 0.25 * hash01(o.x, o.z, 4));
          base.rx = (hash01(o.x, o.z, 5) - 0.5) * (0.4 + 0.3 * off);
          base.rz = (hash01(o.x, o.z, 6) - 0.5) * (0.4 + 0.3 * off);
          b.rocks[(o.variant + Math.floor(h3 * 3) * 2) % ROCK_VARIANTS]!.push(base);
          // a few small, half-buried satellite stones (render only; power-law sizes) so rocks
          // read as clusters/talus instead of an even sprinkle
          const nSat = Math.floor(hash01(o.x, o.z, 7) * (o.kind === 'boulder' ? 3 : 1.6));
          for (let k = 0; k < nSat; k++) {
            const a = hash01(o.x, o.z, 10 + k) * Math.PI * 2;
            const d = sc * (1.0 + 1.4 * hash01(o.x, o.z, 20 + k));
            const sz = Math.min(0.32 * sc, 0.1 * sc * Math.pow(1 / Math.max(0.08, hash01(o.x, o.z, 30 + k)), 0.55));
            const x = o.x + Math.cos(a) * d;
            const z = o.z + Math.sin(a) * d;
            get(x).pebbles.push({ x, y: mountain.heightAt(x, z) - sz * 0.3, z, rot: a * 3, sx: sz, sy: sz * (0.8 + 0.5 * hash01(o.x, o.z, 40 + k)), sz: sz * 1.1, rx: 0.3 * (hash01(o.x, o.z, 50 + k) - 0.5), rz: 0.3 * (hash01(o.x, o.z, 60 + k) - 0.5) });
          }
          break;
        }
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
    const decorK = mountain.biome.trees.decorDensity;
    const coast = mountain.coast;
    const speciesW = mountain.biome.trees.speciesWeights;
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
        const v = speciesW ? pickSpecies(rng.float(), speciesW) : rng.int(0, 2);
        if (Math.abs(x) < 560) continue; // corridor trees come from the obstacle field
        if (z < -300) continue;
        const y = mountain.heightAt(x, z);
        // coast: no trees in or at the water, nor on the cornice
        if (coast && (y < coast.seaLevelAt(z) + 5 || (coast.beyondRim(x, z) > -5 && coast.beyondRim(x, z) < 60))) continue;
        // cliff kit (round 4): the heightfield under the authored cliffs is a hidden backing, behind
        // and below the rock mesh: nothing grows on it
        if (coast && mountain.cliff && coast.beyondRim(x, z) > 0 && mountain.cliffKitWeight(z) > 0 && coast.beyondRim(x, z) < mountain.cliff.footOffset(mountain.cliff.gridColumn(z)) + 40) continue;
        // tree line by altitude relative to the local valley floor
        const rel = y - mountain.heightAt(cx, z);
        const dens = smoothstep(260, 120, rel) * (0.5 + 0.5 * smoothstep(-0.3, 0.3, fbm(x / 140, z / 140, seed + 3, 2))) * (0.35 + 0.65 * mountain.profile.treeLine(z)) * decorK;
        if (r1 > dens) continue;
        // no forest on cliffs: thin with the local slope (gone above ~45°)
        const g = Math.hypot(mountain.heightAt(x + 4, z) - y, mountain.heightAt(x, z + 4) - y) / 4;
        if (r1 > dens * (1 - smoothstep(0.55, 1.0, g))) continue;
        get(x).farTrees[v]!.push({ x, y: y - 0.4, z, rot, sx: s, sy: s * sy, sz: s });
      }
      // talus: clusters of decorative rocks where moderate slopes sit below steeper ground
      // (cliff bases); sizes follow a power law, so a few big blocks and many small ones
      const talus = Math.round(this.decorPerBand * 0.08);
      for (let i = 0; i < talus; i++) {
        const z = zA + rng.float() * BAND;
        const side = rng.chance(0.5) ? 1 : -1;
        const cx = mountain.centerX(z);
        const x = cx + side * (mountain.halfWidth(z) + 60 + rng.float() * 700);
        const n = 2 + rng.int(0, 3);
        const seedA = rng.float();
        if (Math.abs(x) < 560 || z < -300) continue;
        const y = mountain.heightAt(x, z);
        if (coast && y < coast.seaLevelAt(z) + 1) continue;
        const gx = (mountain.heightAt(x + 6, z) - y) / 6;
        const gz = (mountain.heightAt(x, z + 6) - y) / 6;
        const g = Math.hypot(gx, gz);
        if (g < 0.3 || g > 1.0) continue;
        // ground 30 m uphill must be clearly steeper
        const ux = x + (gx / g) * 30;
        const uz = z + (gz / g) * 30;
        const yu = mountain.heightAt(ux, uz);
        const gu = Math.hypot(mountain.heightAt(ux + 6, uz) - yu, mountain.heightAt(ux, uz + 6) - yu) / 6;
        if (gu < g + 0.35) continue;
        for (let k = 0; k < n; k++) {
          const a = rng.float() * Math.PI * 2;
          const d = rng.float() * 14;
          const rx = x + Math.cos(a) * d;
          const rz = z + Math.sin(a) * d * 0.6;
          const sz = Math.min(4.0, 0.7 * Math.pow(1 / Math.max(0.06, rng.float()), 0.7));
          const vv = Math.floor(((seedA * 7 + k * 0.37) % 1) * ROCK_VARIANTS);
          const rotA = rng.float() * 6.28;
          const sxA = rng.range(0.85, 1.25);
          const syA = rng.range(0.85, 1.5);
          const rxA = rng.range(-0.4, 0.4);
          const rzA = rng.range(-0.4, 0.4);
          // coast (Fjord art review D9): a block spread off its cluster onto a sheer wall would hang
          // on the face; keep only blocks whose own ground is below ~45°
          if (coast) {
            const yr = mountain.heightAt(rx, rz);
            if (Math.hypot(mountain.heightAt(rx + 3, rz) - yr, mountain.heightAt(rx, rz + 3) - yr) / 3 > 1.0) continue;
          }
          get(rx).rocks[vv]!.push({ x: rx, y: mountain.heightAt(rx, rz) - sz * 0.35, z: rz, rot: rotA, sx: sz * sxA, sy: sz * syA, sz: sz, rx: rxA, rz: rzA });
        }
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
        e.set(it.rx ?? 0, it.rot, it.rz ?? 0);
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
      // small satellite stones: cheap far-LOD geometry, near ring only
      if (b.pebbles.length) cell.near.push(make(this.rockFar[0]!, this.rockMat, b.pebbles, false));
      const midSets: Inst[][] = [[], [], []];
      b.rocks.forEach((list, v) => midSets[v % 3]!.push(...list));
      midSets.forEach((list, k) => {
        if (list.length) cell.mid.push(make(this.rockFar[k]!, this.rockMat, list, false));
      });
      if (b.logs.length) cell.near.push(make(this.logGeo, this.woodMat, b.logs, true));
      if (b.stumps.length) cell.near.push(make(this.stumpGeo, this.woodMat, b.stumps, true));
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
    // (budgetMs ≤ 0: World's shared frame budget is spent — build nothing this frame, round 4)
    if (this.queue.length && budgetMs > 0) {
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
        for (const m of b.mid) m.visible = far && d < 480;
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
