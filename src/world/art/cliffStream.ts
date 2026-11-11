/**
 * The cliff kit in the game (round 4 integration): streams authored cliff segments (./cliffKit.ts)
 * along the course for the location's scenery, time-sliced on the shared per-frame streaming budget
 * (World.update → scenery.pump → here). Bounded: segments outside the window are disposed, and at
 * most `maxSegments` exist. Deterministic: a segment's geometry depends only on the coast and its
 * index and LOD, never on the order of requests.
 *
 *  - only where the Mountain's cliffKitWeight is 1 (not at the headland ridges or the harbour);
 *  - LOD by distance from the skier (4/8/16 m columns), nearest builds first;
 *  - one material per water level (the wet band and the ice line need the arm's level).
 */
import * as THREE from 'three';
import type { Mountain } from '../course';
import type { CliffModel } from './cliffModel';
import { cliffSegmentSteps } from './cliffKit';
import { createRockMaterial, disposeRockMaterial } from './rockMaterial';

export const CLIFF_SEG = 256;
/** LOD by distance from the skier (m): < LOD_NEAR → 0, < LOD_MID → 1, else 2 */
const LOD_NEAR = 520;
const LOD_MID = 1400;
const LOD_DS = [4, 8, 16] as const;
const LOD_DR = [3, 6, 12] as const;

interface Seg {
  mesh: THREE.Mesh;
  lod: number;
}
interface Job {
  i: number;
  lod: number;
  z0: number;
  z1: number;
  dist: number;
  gen: Generator<void, THREE.BufferGeometry, void>;
}

export class CliffStream {
  readonly group = new THREE.Group();
  private model: CliffModel;
  private segs = new Map<number, Seg>();
  private jobs: Job[] = [];
  private mats = new Map<number, THREE.MeshStandardMaterial>();
  private deadline = Infinity;
  private readonly over = () => performance.now() > this.deadline;

  constructor(
    private m: Mountain,
    private quality: string,
    readonly maxSegments = 24,
  ) {
    if (!m.cliff) throw new Error('CliffStream needs a mountain with the cliff kit');
    this.model = m.cliff;
    this.group.name = 'cliff-kit';
  }

  /** the z-range of segment i where the kit fully applies (null: none) */
  private span(i: number): [number, number] | null {
    const za = i * CLIFF_SEG;
    let a = Infinity;
    let b = -Infinity;
    for (let z = za; z <= za + CLIFF_SEG; z += 8) {
      if (this.m.cliffKitWeight(z) >= 0.999) {
        a = Math.min(a, z);
        b = Math.max(b, z);
      }
    }
    if (!(b - a >= 24)) return null;
    return [a, b];
  }

  private material(water: number): THREE.MeshStandardMaterial {
    const key = Math.round(water * 10) / 10;
    let mt = this.mats.get(key);
    if (!mt) {
      mt = createRockMaterial({ kind: 'gneiss', vertexColors: true, water: key, snow: 1, strata: 1, tint: 0xc2cad4, hq: this.quality !== 'low' });
      this.mats.set(key, mt);
    }
    return mt;
  }

  /** Want the segments covering [z0, z1] at the LOD for a skier at (fx, fz); queue what is missing. */
  want(z0: number, z1: number, fx: number, fz: number): void {
    const i0 = Math.floor(z0 / CLIFF_SEG);
    const i1 = Math.floor(z1 / CLIFF_SEG);
    for (const [i, s] of this.segs) {
      if (i >= i0 && i <= i1) continue;
      s.mesh.geometry.dispose();
      s.mesh.removeFromParent();
      this.segs.delete(i);
    }
    this.jobs = this.jobs.filter((j) => {
      if (j.i >= i0 && j.i <= i1) return true;
      j.gen.return(undefined as never);
      return false;
    });
    for (let i = i0; i <= i1; i++) {
      const sp = this.span(i);
      if (!sp) continue;
      const zm = (sp[0] + sp[1]) / 2;
      const c = this.model.column(zm);
      const dist = Math.hypot(c.xr - fx, zm - fz);
      const lod = dist < LOD_NEAR ? 0 : dist < LOD_MID ? 1 : 2;
      const cur = this.segs.get(i);
      const queued = this.jobs.find((j) => j.i === i);
      if (cur && cur.lod === lod) {
        if (queued) {
          queued.gen.return(undefined as never);
          this.jobs.splice(this.jobs.indexOf(queued), 1);
        }
        continue;
      }
      if (queued) {
        queued.dist = dist;
        if (queued.lod === lod) continue;
        queued.gen.return(undefined as never);
        this.jobs.splice(this.jobs.indexOf(queued), 1);
      }
      if (!cur && this.segs.size + this.jobs.length >= this.maxSegments) continue;
      this.jobs.push({ i, lod, z0: sp[0], z1: sp[1], dist, gen: cliffSegmentSteps(this.model, { z0: sp[0], z1: sp[1], ds: LOD_DS[lod], dr: LOD_DR[lod] }, this.over) });
    }
    // missing segments first (a coarse one already standing is better than a hole), nearest first
    this.jobs.sort((a, b) => Number(this.segs.has(a.i)) - Number(this.segs.has(b.i)) || a.dist - b.dist);
  }

  /** Advance the queued builds until `deadlineMs` (performance.now() value). */
  pump(deadlineMs: number): void {
    this.deadline = deadlineMs;
    while (this.jobs.length && performance.now() < deadlineMs) {
      const j = this.jobs[0]!;
      const r = j.gen.next();
      if (!r.done) continue;
      this.jobs.shift();
      this.install(j, r.value);
    }
    this.deadline = Infinity;
  }

  /** finish every queued build now */
  flush(): void {
    this.pump(Infinity);
  }

  private install(j: Job, geo: THREE.BufferGeometry) {
    const water = this.model.column((j.z0 + j.z1) / 2).water;
    const cur = this.segs.get(j.i);
    if (cur) {
      cur.mesh.geometry.dispose();
      cur.mesh.geometry = geo;
      cur.mesh.material = this.material(water);
      cur.lod = j.lod;
      return;
    }
    const mesh = new THREE.Mesh(geo, this.material(water));
    mesh.castShadow = this.quality !== 'low';
    mesh.receiveShadow = true;
    mesh.name = `cliff-seg-${j.i}`;
    mesh.userData['lod'] = j.lod;
    this.group.add(mesh);
    this.segs.set(j.i, { mesh, lod: j.lod });
  }

  get pending(): number {
    return this.jobs.length;
  }
  get segments(): number {
    return this.segs.size;
  }
  get triangles(): number {
    let t = 0;
    for (const s of this.segs.values()) t += (s.mesh.geometry.index?.count ?? 0) / 3;
    return t;
  }
  /** (tests) the meshes standing now */
  meshes(): THREE.Mesh[] {
    return [...this.segs.values()].map((s) => s.mesh);
  }

  /** Floating origin: the rock material samples world space (its textures are anchored to the world). */
  setOrigin(origin: THREE.Vector3): void {
    for (const mt of this.mats.values()) mt.userData.rock.uOrigin.value.copy(origin);
  }

  dispose(): void {
    for (const j of this.jobs) j.gen.return(undefined as never);
    this.jobs.length = 0;
    for (const s of this.segs.values()) s.mesh.geometry.dispose();
    this.segs.clear();
    for (const mt of this.mats.values()) disposeRockMaterial(mt);
    this.mats.clear();
    this.group.removeFromParent();
  }
}
