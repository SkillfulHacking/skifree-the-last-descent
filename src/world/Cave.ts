/**
 * The Yeti cave: one continuous procedural rock formation (SDF → surface nets) standing in the valley
 * cliff — a stratified face with an overhanging brow, a chamber that runs ~24 m in and bends downhill into
 * darkness, a rubble floor that blends into the snow of the mouth ledge, and icicles under the brow.
 *
 * The heightfield cut (src/world/caveTerrain.ts) and this mesh are built from the same layout functions:
 * inside the formation the terrain stays hidden inside the rock, and along the chamber it sits just
 * under the cave's own floor mesh, so no seam between heightfield and rock is ever visible.
 *
 * Grounding contract for the Yeti/cinematic: `floorHeightAt` is the exact visible walking surface
 * (floor mesh inside, heightfield outside), `clearanceAt` the roof clearance, `exitPath` the walk-out line.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../core/rng';
import type { QualityPreset } from '../core/types';
import type { Mountain } from './course';
import {
  type CaveAnchor,
  type ChamberHit,
  bankOffset,
  caveTerrainOffset,
  chamberHalfWidth,
  chamberPoint,
  chamberQuery,
  floorCover,
  floorDip,
  formBand,
  floorLiftRaw,
  liftMask,
} from './caveTerrain';
import { RockField } from './cave/rockField';
import { surfaceNetsSteps } from './cave/surfaceNets';
import { makeTick, NEVER, type Tick } from './cave/budget';
import { VisibilityGrid, localAO, type Ground } from './cave/bake';
import { createCaveRockMaterial, createIcicleMaterial } from './cave/rockMaterial';

export { Footprints, StoryProps } from './cave/StoryProps';

const QUALITY: Record<QualityPreset, { cell: number; visCell: number; rays: number; detail: number }> = {
  low: { cell: 0.8, visCell: 2.6, rays: 8, detail: 0 },
  medium: { cell: 0.65, visCell: 2.3, rays: 10, detail: 0.7 },
  high: { cell: 0.62, visCell: 2.2, rays: 10, detail: 1 },
  ultra: { cell: 0.45, visCell: 1.8, rays: 16, detail: 1 },
};

const FLOOR_CELL = 0.5;
const DEFER = Symbol('defer');

export class Cave {
  readonly group = new THREE.Group();
  /** floor-level centre of the mouth (on the floor surface) */
  readonly mouth = new THREE.Vector3();
  /** a point ~8 m inside on the floor */
  readonly inside = new THREE.Vector3();
  /** outward direction of the mouth (toward the piste) */
  readonly outward = new THREE.Vector3(-1, 0, 0);
  /** top of the brow above the mouth (snow falls from here) */
  readonly lipTop = new THREE.Vector3();
  /** on the floor, ≥ 12 m inside, where the Yeti waits in the dark */
  readonly deepStart = new THREE.Vector3();
  /** on the floor just outside the mouth, where he stands and roars */
  readonly ledge = new THREE.Vector3();
  /** deepStart → mouth → ledge, every point on the floor */
  readonly exitPath: THREE.Vector3[] = [];
  /** build statistics (dev) */
  readonly stats = { ms: 0, maxStepMs: 0, steps: 0, triangles: 0, drawCalls: 0, fieldEvals: 0, phases: {} as Record<string, number> };

  private readonly m: Mountain;
  private readonly a: CaveAnchor;
  private readonly side: 1 | -1;
  private readonly mx: number;
  private disposables: Array<{ dispose(): void }> = [];
  // floor grid (world aligned)
  private fx0 = 0;
  private fz0 = 0;
  private fnx = 0;
  private fnz = 0;
  private fY!: Float32Array;
  private fCell!: Uint8Array;
  private fClr!: Float32Array;
  private debugGroup: THREE.Group | null = null;

  /**
   * Builds the cave synchronously (~150–400 ms on 'high'). For streaming use `Cave.buildSteps`, which
   * yields whenever a step has used its time budget.
   */
  constructor(m: Mountain, anchor: CaveAnchor, quality: QualityPreset = 'high', defer?: typeof DEFER) {
    this.m = m;
    this.a = anchor;
    this.side = anchor.side;
    this.outward.set(-anchor.side, 0, 0);
    this.mx = anchor.centerX + anchor.side * (anchor.d + 2);
    this.quality = quality;
    if (defer !== DEFER) {
      const t0 = performance.now();
      const g = this.build(NEVER);
      while (!g.next().done);
      this.stats.ms = performance.now() - t0;
      this.stats.maxStepMs = this.stats.ms;
    }
  }

  /**
   * Time-sliced construction: step the generator (e.g. once per frame) until it returns the Cave.
   * Each step runs for about `budgetMs` (a few unavoidable single operations — normal computation,
   * geometry merge — take a few ms more). Add `cave.group` to the scene once done.
   */
  static *buildSteps(m: Mountain, anchor: CaveAnchor, quality: QualityPreset = 'high', budgetMs = 4): Generator<void, Cave, void> {
    const cave = new Cave(m, anchor, quality, DEFER);
    const tk = makeTick(budgetMs);
    const g = cave.build(tk);
    for (;;) {
      const t = performance.now();
      tk.reset();
      const r = g.next();
      const dt = performance.now() - t;
      cave.stats.ms += dt;
      cave.stats.maxStepMs = Math.max(cave.stats.maxStepMs, dt);
      cave.stats.steps++;
      if (r.done) return cave;
      yield;
    }
  }

  private readonly quality: QualityPreset;

  private *build(tk: Tick): Generator<void, void, void> {
    let tp = performance.now();
    const phase = (k: string) => {
      const t = performance.now();
      this.stats.phases[k] = Math.round((t - tp) * 10) / 10;
      tp = t;
    };
    const m = this.m, anchor = this.a, side = this.side, mx = this.mx;
    const q = QUALITY[this.quality];
    const seed = m.seed;
    const cx = (z: number) => m.centerX(z);
    const offsetAt = (x: number, z: number) => caveTerrainOffset(anchor, x, z, x - cx(z), seed);

    // --- terrain grids (1 m, like the pinned terrain chunk): visible ground and natural ground
    const gx0 = Math.floor(Math.min(mx + side * -18, mx + side * 40)), gz0 = Math.floor(anchor.z - 52);
    const gnx = 60, gnz = 106;
    const gTer = new Float32Array(gnx * gnz), gRaw = new Float32Array(gnx * gnz);
    for (let j = 0; j < gnz; j++) {
      if (tk.over()) {
        yield;
        tk.reset();
      }
      for (let i = 0; i < gnx; i++) {
        const x = gx0 + i, z = gz0 + j;
        const hv = m.heightAt(x, z);
        gTer[i + j * gnx] = hv;
        gRaw[i + j * gnx] = hv - offsetAt(x, z);
      }
    }
    const bil = (g: Float32Array, x: number, z: number) => {
      const fx = Math.max(0, Math.min(gnx - 1.001, x - gx0)), fz = Math.max(0, Math.min(gnz - 1.001, z - gz0));
      const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
      const k = i + j * gnx;
      const a0 = g[k]! + (g[k + 1]! - g[k]!) * tx, a1 = g[k + gnx]! + (g[k + gnx + 1]! - g[k + gnx]!) * tx;
      return a0 + (a1 - a0) * tz;
    };
    const ground: Ground = { at: (x, z) => bil(gTer, x, z) };
    // conservative lower bound of the visible terrain (min of the surrounding 1 m nodes)
    const groundMin = (x: number, z: number) => {
      const fx = Math.max(0, Math.min(gnx - 1.001, x - gx0)), fz = Math.max(0, Math.min(gnz - 1.001, z - gz0));
      const k = Math.floor(fx) + Math.floor(fz) * gnx;
      return Math.min(gTer[k]!, gTer[k + 1]!, gTer[k + gnx]!, gTer[k + gnx + 1]!);
    };

    phase('grids');
    // --- the rock field
    const field = new RockField({ anchor, seed, cell: q.cell, centerX: cx, hRaw: (x, z) => bil(gRaw, x, z), ground: groundMin });
    yield* field.buildSteps(tk);
    phase('field');
    this.stats.fieldEvals = field.evals;
    const nets = yield* surfaceNetsSteps(field, tk);

    phase('nets');
    // drop triangles that are entirely buried under the heightfield
    const P = nets.positions;
    const keep: number[] = [];
    const I = nets.indices;
    const buried = new Uint8Array(P.length / 3);
    for (let i = 0; i < buried.length; i++) buried[i] = P[i * 3 + 1]! < groundMin(P[i * 3]!, P[i * 3 + 2]!) - 0.3 ? 1 : 0;
    for (let t = 0; t < I.length; t += 3) {
      if (buried[I[t]!]! && buried[I[t + 1]!]! && buried[I[t + 2]!]!) continue;
      keep.push(I[t]!, I[t + 1]!, I[t + 2]!);
    }
    const rockGeo = compactGeometry(P, keep);
    yield;
    tk.reset();
    rockGeo.computeVertexNormals();
    orientOutward(rockGeo, field);
    yield;
    tk.reset();

    phase('cull+normals');
    // --- floor mesh
    const floorGeo = yield* this.buildFloor(tk);
    const floorRim = floorGeo.userData.rim as Float32Array;

    phase('floor');
    // --- bake sky visibility + AO
    const vis = new VisibilityGrid(field, ground, q.visCell, q.rays, (z) => formBand(z - anchor.z) > 0.6, false);
    yield* vis.compute(tk);
    yield* bakeAttr(tk, rockGeo, field, ground, vis, 0, 0.9);
    yield* bakeAttr(tk, floorGeo, field, ground, vis, 1, 0.7, floorRim);

    phase('bake');
    yield;
    tk.reset();
    const geo = mergeGeometries([rockGeo, floorGeo], false)!;
    rockGeo.dispose();
    floorGeo.dispose();
    geo.computeBoundingSphere();

    // --- key points
    const at = (s: number, out: THREE.Vector3) => {
      const p = chamberPoint(s);
      const x = mx + side * p.u, z = anchor.z + p.v;
      return out.set(x, this.floorHeightAt(x, z), z);
    };
    at(0, this.mouth);
    at(8, this.inside);
    at(14, this.deepStart);
    at(-2.2, this.ledge);
    for (let s = 14; s > -2.2; s -= 0.75) this.exitPath.push(at(s, new THREE.Vector3()));
    this.exitPath.push(this.ledge.clone());
    {
      // brow top: first rock from above, just in front of the main face
      // the brow surface just above the mouth (snow sloughs off from here)
      const z = anchor.z + 0.3;
      const y = this.mouth.y + 8.5;
      let u = -12;
      while (u < 6 && field.sample(mx + side * u, y, z) > 0) u += 0.1;
      this.lipTop.set(mx + side * (u - 0.3), y, z);
    }

    // --- claw gouges beside the mouth (shader decal in the rock's own material)
    const claw = this.findClawFrame(field);
    const rockMat = createCaveRockMaterial(claw, q.detail);
    const rock = new THREE.Mesh(geo, rockMat);
    rock.castShadow = true;
    rock.receiveShadow = true;
    rock.name = 'cave-rock';
    this.group.add(rock);
    this.disposables.push(geo, rockMat);

    phase('claw+points');
    // --- icicles under the brow
    const ice = this.buildIcicles(field, new Rng(seed ^ 0x1c1c1e));
    if (ice) {
      const iceMat = createIcicleMaterial();
      const im = new THREE.Mesh(ice, iceMat);
      im.castShadow = true;
      im.name = 'cave-icicles';
      this.group.add(im);
      this.disposables.push(ice, iceMat);
    }

    phase('icicles');
    yield;
    tk.reset();
    this.bakeClearance(field, ice, ground);

    phase('clearance');
    let tris = 0;
    this.group.traverse((o) => {
      const g = (o as THREE.Mesh).geometry;
      if (g) tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    });
    this.stats.triangles = tris;
    this.stats.drawCalls = this.group.children.length;
  }

  // --------------------------------------------------------------------------------------------
  private localOf(x: number, z: number) {
    const u = (x - this.mx) * this.side, v = z - this.a.z;
    const uc = (x - this.m.centerX(z)) * this.side - (this.a.d + 2);
    return { u, v, uc };
  }

  private *buildFloor(tk: Tick): Generator<void, THREE.BufferGeometry, void> {
    const a = this.a, side = this.side, m = this.m;
    const ua = -3.5, ub = 24, va = -8, vb = 22;
    const xa = this.mx + side * ua, xb = this.mx + side * ub;
    this.fx0 = Math.min(xa, xb);
    this.fz0 = a.z + va;
    this.fnx = Math.ceil(Math.abs(xb - xa) / FLOOR_CELL) + 1;
    this.fnz = Math.ceil((vb - va) / FLOOR_CELL) + 1;
    const n = this.fnx * this.fnz;
    this.fY = new Float32Array(n);
    const E = new Float32Array(n);
    const hit: ChamberHit = { s: 0, l: 0, dist: 0 };
    for (let j = 0; j < this.fnz; j++) {
      if (tk.over()) {
        yield;
        tk.reset();
      }
      for (let i = 0; i < this.fnx; i++) {
        const x = this.fx0 + i * FLOOR_CELL, z = this.fz0 + j * FLOOR_CELL;
        const L = this.localOf(x, z);
        chamberQuery(L.u, L.v, hit);
        const cd = hit.dist - chamberHalfWidth(hit.s);
        const e = floorCover(L.u, cd);
        E[i + j * this.fnx] = e;
        if (e > 1.2) continue;
        const d = x - m.centerX(z);
        const raw = m.heightAt(x, z) - caveTerrainOffset(a, x, z, d, m.seed);
        this.fY[i + j * this.fnx] = raw + bankOffset(L.uc) + floorLiftRaw(L.u, L.v, L.uc, hit.s) * liftMask(L.u, L.v, cd) - floorDip(e);
      }
    }
    this.fCell = new Uint8Array((this.fnx - 1) * (this.fnz - 1));
    const pos: number[] = [];
    const idx: number[] = [];
    const vmap = new Int32Array(n).fill(-1);
    const rim: number[] = [];
    const vert = (i: number, j: number) => {
      const k = i + j * this.fnx;
      if (vmap[k]! < 0) {
        vmap[k] = pos.length / 3;
        pos.push(this.fx0 + i * FLOOR_CELL, this.fY[k]!, this.fz0 + j * FLOOR_CELL);
        const e = E[k]!;
        rim.push(e < -1.2 ? 0 : Math.min(1, Math.max(0, (e + 1.2) / 1.0)) ** 2);
      }
      return vmap[k]!;
    };
    for (let j = 0; j < this.fnz - 1; j++) {
      for (let i = 0; i < this.fnx - 1; i++) {
        const k = i + j * this.fnx;
        const emax = Math.max(E[k]!, E[k + 1]!, E[k + this.fnx]!, E[k + this.fnx + 1]!);
        if (emax > 0.6) continue;
        this.fCell[i + j * (this.fnx - 1)] = 1;
        const A = vert(i, j), B = vert(i + 1, j), C = vert(i, j + 1), D = vert(i + 1, j + 1);
        // triangles (A, C, B) and (B, C, D): diagonal B–C (floorHeightAt interpolates the same way)
        idx.push(A, C, B, B, C, D);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.userData.rim = new Float32Array(rim);
    g.computeVertexNormals();
    // ensure normals point up (winding depends on x direction)
    const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
    if (nrm.count && nrm.getY(0) < 0) {
      const ix = g.getIndex()!;
      for (let t = 0; t < ix.count; t += 3) {
        const b = ix.getX(t + 1);
        ix.setX(t + 1, ix.getX(t + 2));
        ix.setX(t + 2, b);
      }
      g.computeVertexNormals();
    }
    return g;
  }

  /** Exact walkable surface height: the cave floor mesh where it is visible, else the heightfield. */
  floorHeightAt(x: number, z: number): number {
    const terrain = this.m.heightAt(x, z);
    const fx = (x - this.fx0) / FLOOR_CELL, fz = (z - this.fz0) / FLOOR_CELL;
    if (fx < 0 || fz < 0 || fx >= this.fnx - 1 || fz >= this.fnz - 1) return terrain;
    const i = Math.floor(fx), j = Math.floor(fz);
    if (!this.fCell[i + j * (this.fnx - 1)]) return terrain;
    const tx = fx - i, tz = fz - j;
    const k = i + j * this.fnx;
    const A = this.fY[k]!, B = this.fY[k + 1]!, C = this.fY[k + this.fnx]!, D = this.fY[k + this.fnx + 1]!;
    const y = tx + tz <= 1 ? A + (B - A) * tx + (C - A) * tz : D + (C - D) * (1 - tx) + (B - D) * (1 - tz);
    return Math.max(y, terrain);
  }

  /** Roof clearance above the floor at a point inside the cave (Infinity outside). */
  clearanceAt(x: number, z: number): number {
    const fx = (x - this.fx0) / FLOOR_CELL, fz = (z - this.fz0) / FLOOR_CELL;
    if (fx < 0 || fz < 0 || fx >= this.fnx - 1 || fz >= this.fnz - 1) return Infinity;
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const k = i + j * this.fnx;
    const c = [this.fClr[k]!, this.fClr[k + 1]!, this.fClr[k + this.fnx]!, this.fClr[k + this.fnx + 1]!];
    if (c.every(Number.isFinite)) {
      const a0 = c[0]! + (c[1]! - c[0]!) * tx, a1 = c[2]! + (c[3]! - c[2]!) * tx;
      return a0 + (a1 - a0) * tz;
    }
    const f = c.filter(Number.isFinite);
    return f.length ? Math.min(...f) : Infinity;
  }

  private bakeClearance(field: RockField, ice: THREE.BufferGeometry | null, ground: Ground) {
    const n = this.fnx * this.fnz;
    this.fClr = new Float32Array(n).fill(Infinity);
    const tips = (ice?.userData.tips as number[] | undefined) ?? [];
    for (let j = 0; j < this.fnz; j++) {
      for (let i = 0; i < this.fnx; i++) {
        const x = this.fx0 + i * FLOOR_CELL, z = this.fz0 + j * FLOOR_CELL;
        const inMesh = !!this.fCell[Math.min(i, this.fnx - 2) + Math.min(j, this.fnz - 2) * (this.fnx - 1)];
        const y0 = inMesh ? this.fY[i + j * this.fnx]! : ground.at(x, z);
        let c = Infinity;
        {
          for (let y = y0 + 0.05; y < y0 + 14; ) {
            const dv = field.sample(x, y, z);
            if (dv < 0) {
              c = y - y0;
              break;
            }
            y += Math.max(0.06, dv * 0.7);
          }
        }
        for (let t = 0; t < tips.length; t += 3) {
          if (Math.hypot(tips[t]! - x, tips[t + 2]! - z) < 0.45) c = Math.min(c, tips[t + 1]! - y0);
        }
        this.fClr[i + j * this.fnx] = c;
      }
    }
  }

  private findClawFrame(field: RockField) {
    const side = this.side;
    const z = this.a.z - 5.4;
    const y = this.mouth.y + 3.0;
    let u = -9;
    const X = (uu: number) => this.mx + side * uu;
    while (u < 6 && field.sample(X(u), y, z) > 0) u += 0.05;
    const p = new THREE.Vector3(X(u), y, z);
    const e = 0.3;
    const nrm = new THREE.Vector3(
      field.sample(p.x + e, p.y, p.z) - field.sample(p.x - e, p.y, p.z),
      field.sample(p.x, p.y + e, p.z) - field.sample(p.x, p.y - e, p.z),
      field.sample(p.x, p.y, p.z + e) - field.sample(p.x, p.y, p.z - e),
    ).normalize();
    if (!Number.isFinite(nrm.x)) nrm.copy(this.outward);
    const up = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3().crossVectors(up, nrm).normalize();
    const upv = new THREE.Vector3().crossVectors(nrm, tangent).normalize();
    return { origin: p, tangent, up: upv, normal: nrm };
  }

  private buildIcicles(field: RockField, rng: Rng): THREE.BufferGeometry | null {
    const side = this.side;
    const parts: THREE.BufferGeometry[] = [];
    const tips: number[] = [];
    for (let v = -6.5; v <= 7.5; v += rng.range(0.22, 0.55)) {
      const z = this.a.z + v;
      // the most outward underside within the brow band
      let found: THREE.Vector3 | null = null;
      const yfm = this.floorHeightAt(this.mouth.x, z);
      for (let u = -5.5; u <= 0.5 && !found; u += 0.2) {
        const x = this.mx + side * u;
        const yf = Math.max(yfm, this.mouth.y);
        for (let y = yf + 3.0; y < yf + 9; y += 0.1) {
          if (field.sample(x, y, z) < 0) {
            // must be an underside: rock continues above
            if (field.sample(x, y + 0.6, z) < 0) found = new THREE.Vector3(x + side * 0.2, y + 0.05, z);
            break;
          }
        }
      }
      if (!found || rng.float() < 0.25) continue;
      const yf = this.floorHeightAt(found.x, z);
      const nearPath = Math.abs(v - 0.1) < 3.0;
      let len = rng.range(0.25, 1.0) * (rng.float() < 0.2 ? 1.9 : 1);
      if (nearPath) len = Math.min(len, found.y - yf - 4.5);
      if (len < 0.18) continue;
      const r = 0.035 + len * rng.range(0.04, 0.07);
      const g = new THREE.ConeGeometry(r, len, 6, 3, true);
      // wobble the cone a little so they are not perfect
      const pa = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pa.count; i++) {
        const t = (pa.getY(i) + len / 2) / len;
        const k = 1 + 0.25 * Math.sin(t * 9 + v * 5) * t;
        pa.setXYZ(i, pa.getX(i) * k, pa.getY(i), pa.getZ(i) * k);
      }
      g.rotateX(Math.PI);
      g.translate(found.x, found.y - len / 2, found.z);
      parts.push(g);
      tips.push(found.x, found.y - len, found.z);
    }
    if (!parts.length) return null;
    const merged = mergeGeometries(parts, false)!;
    for (const p of parts) p.dispose();
    merged.computeVertexNormals();
    merged.userData.tips = tips;
    return merged;
  }

  setDebug(v: boolean): void {
    if (!v) {
      if (this.debugGroup) this.debugGroup.visible = false;
      return;
    }
    if (!this.debugGroup) {
      const g = new THREE.Group();
      const pts: number[] = [];
      const cols: number[] = [];
      for (let j = 0; j < this.fnz; j += 2) {
        for (let i = 0; i < this.fnx; i += 2) {
          const ci = Math.min(i, this.fnx - 2) + Math.min(j, this.fnz - 2) * (this.fnx - 1);
          if (!this.fCell[ci]) continue;
          const x = this.fx0 + i * FLOOR_CELL, z = this.fz0 + j * FLOOR_CELL;
          pts.push(x, this.floorHeightAt(x, z) + 0.04, z);
          const c = this.fClr[i + j * this.fnx]!;
          if (c < 3.6) cols.push(1, 0.1, 0.1);
          else if (c < 4.2) cols.push(1, 0.8, 0.1);
          else cols.push(0.1, 1, 0.3);
        }
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      pg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const pm = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, depthTest: false });
      g.add(new THREE.Points(pg, pm));
      const lg = new THREE.BufferGeometry().setFromPoints(this.exitPath.map((p) => p.clone().add(new THREE.Vector3(0, 0.08, 0))));
      const lm = new THREE.LineBasicMaterial({ color: 0x00ffff, depthTest: false });
      g.add(new THREE.Line(lg, lm));
      const sg = new THREE.SphereGeometry(0.25, 10, 6);
      const marks: Array<[THREE.Vector3, number]> = [
        [this.mouth, 0xff00ff],
        [this.inside, 0xffff00],
        [this.deepStart, 0xff4400],
        [this.ledge, 0x00ff00],
        [this.lipTop, 0x0088ff],
      ];
      const mats: THREE.Material[] = [];
      for (const [p, c] of marks) {
        const mm = new THREE.MeshBasicMaterial({ color: c, depthTest: false });
        mats.push(mm);
        const s = new THREE.Mesh(sg, mm);
        s.position.copy(p);
        s.renderOrder = 999;
        g.add(s);
      }
      g.traverse((o) => (o.renderOrder = 999));
      this.disposables.push(pg, pm, lg, lm, sg, ...mats);
      this.debugGroup = g;
      this.group.add(g);
    }
    this.debugGroup.visible = true;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.group.clear();
    this.group.removeFromParent();
  }
}

function compactGeometry(P: Float32Array, idx: number[]): THREE.BufferGeometry {
  const map = new Int32Array(P.length / 3).fill(-1);
  const pos: number[] = [];
  const out = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) {
    const v = idx[i]!;
    if (map[v]! < 0) {
      map[v] = pos.length / 3;
      pos.push(P[v * 3]!, P[v * 3 + 1]!, P[v * 3 + 2]!);
    }
    out[i] = map[v]!;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(out, 1));
  return g;
}

/** Flip the winding if the mesh normals point into the rock. */
function orientOutward(g: THREE.BufferGeometry, f: RockField) {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  let agree = 0;
  for (let i = 0; i < p.count; i += 7) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const out = f.sample(x + n.getX(i) * 0.3, y + n.getY(i) * 0.3, z + n.getZ(i) * 0.3) - f.sample(x - n.getX(i) * 0.3, y - n.getY(i) * 0.3, z - n.getZ(i) * 0.3);
    agree += out > 0 ? 1 : -1;
  }
  if (agree < 0) {
    const ix = g.getIndex()!;
    for (let t = 0; t < ix.count; t += 3) {
      const b = ix.getX(t + 1);
      ix.setX(t + 1, ix.getX(t + 2));
      ix.setX(t + 2, b);
    }
    g.computeVertexNormals();
  }
}

function* bakeAttr(tk: Tick, g: THREE.BufferGeometry, f: RockField, ground: Ground, vis: VisibilityGrid, kind: number, off: number, rim?: Float32Array): Generator<void, void, void> {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  const out = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    if (tk()) {
      yield;
      tk.reset();
    }
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    out[i * 4] = vis.at(x + nx * off, y + ny * off, z + nz * off);
    out[i * 4 + 1] = localAO(f, ground, x, y, z, nx, ny, nz);
    out[i * 4 + 2] = kind + (rim ? rim[i]! : 0);
    out[i * 4 + 3] = kind ? 0 : formBand(z - f.a.z);
  }
  g.setAttribute('aCave', new THREE.BufferAttribute(out, 4));
}
