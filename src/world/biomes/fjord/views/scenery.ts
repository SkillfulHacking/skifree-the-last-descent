/**
 * "fjord-coast" scenery: everything streamed along the Fjord course that is not terrain, obstacles
 * or hazards — the water surfaces, sea mist, fishing hamlets on the strand flats, boats and the
 * coastal ferry, the cairns along the cliff rim and the viewpoints. Built once per course; pieces
 * are created per 512 m chunk by `stream(z)` and disposed when far away (bounded on any length,
 * Endless included).
 */
import * as THREE from 'three';
import { SCENERY_BUDGET_MS, registerScenery, type SceneryContext, type SceneryFrame, type SceneryView } from '../../../presentation/scenery';
import { NEVER, makeTick, type Tick } from '../../../cave/budget';
import { Batch, Rand, mat } from '../../../resort/util';
import type { Coast, Lookout } from '../../../coast';
import type { Mountain } from '../../../course';
import { FjordWater } from './water';
import { SeaMist } from './mist';
import { PAINT, cairn, ferry, fishingBoat, house, jetty, kitMaterials, rimOutcrop } from './buildings';
import { viewpointProps } from './viewpoint';

const CHUNK = 512;
/** chunks kept behind / ahead of the skier (hamlets far below must show from far away) */
const BEHIND = 2;
const AHEAD = 8;
/** the low preset keeps 2.5 km ahead (the far terrain is coarser and fogged there anyway) */
const AHEAD_LOW = 5;

interface ChunkView {
  group: THREE.Group;
  geos: THREE.BufferGeometry[];
}

export class FjordScenery implements SceneryView {
  readonly group = new THREE.Group();
  readonly water: FjordWater;
  readonly mist: SeaMist;
  private coast: Coast;
  private m: Mountain;
  private mats = kitMaterials();
  private chunks = new Map<number, ChunkView>();
  private ships: Array<{ obj: THREE.Group; reach: number; x: number; z0: number; z1: number; speed: number; phase: number; level: number }> = [];
  private shipGeo: THREE.Mesh[] = [];
  private hi: boolean;
  private terrainU: SceneryContext['terrain'];
  private time = 0;

  constructor(private ctx: SceneryContext) {
    const coast = ctx.mountain.coast;
    if (!coast) throw new Error('fjord-coast scenery needs a coastal mountain');
    this.coast = coast;
    this.m = ctx.mountain;
    this.hi = ctx.quality === 'high' || ctx.quality === 'ultra';
    this.group.name = 'FjordScenery';
    this.terrainU = ctx.terrain;
    this.water = new FjordWater(coast, ctx.terrain, ctx.sunDir, new THREE.Color(...ctx.biome.ranges.skyColor), ctx.quality);
    this.group.add(this.water.group);
    this.mist = new SeaMist(coast, ctx.mountain, ctx.sunDir, ctx.quality);
    this.group.add(this.mist.mesh);
    // one ferry template (merged), cloned per ship
    const b = new Batch();
    ferry(b, 92);
    this.shipGeo = b.build(this.mats, { cast: false, receive: false });
  }

  // --- streaming ------------------------------------------------------------------------------
  /** queued chunk builds (time-sliced by pump(), nearest to the skier first) */
  private jobs: Array<{ c: number; job: Generator<void, void, void> }> = [];
  private tick = makeTick(SCENERY_BUDGET_MS);

  stream(z: number): void {
    const cz = Math.floor(z / CHUNK);
    const c0 = cz - BEHIND;
    const c1 = cz + (this.ctx.quality === 'low' ? AHEAD_LOW : AHEAD);
    for (let c = c0; c <= c1; c++) {
      if (this.chunks.has(c) || this.jobs.some((j) => j.c === c) || c * CHUNK <= -800 || (this.coast.finite && c * CHUNK >= this.coast.finishZ + 200)) continue;
      this.jobs.push({ c, job: this.chunkSteps(c, this.tick) });
    }
    // nearest first (the one under the skier, then ahead), drop jobs that left the window
    this.jobs = this.jobs.filter((j) => j.c >= c0 - 1 && j.c <= c1 + 1);
    this.jobs.sort((a, b) => Math.abs(a.c - cz - 0.25) - Math.abs(b.c - cz - 0.25));
    for (const [c, v] of this.chunks) {
      if (c >= c0 - 1 && c <= c1 + 1) continue;
      this.dropChunk(v);
      this.chunks.delete(c);
    }
    this.mist.stream(z);
    this.syncShips(z);
  }

  /** Advance queued chunk builds for about `budgetMs` (one slice is ≤ ~budget; see chunkSteps). */
  pump(budgetMs: number): void {
    if (!this.jobs.length) return;
    const t0 = performance.now();
    while (this.jobs.length && performance.now() - t0 < budgetMs) {
      this.tick.reset();
      if (this.jobs[0]!.job.next().done) this.jobs.shift();
    }
  }

  flush(): void {
    while (this.jobs.length) {
      const j = this.jobs.shift()!;
      while (!j.job.next().done);
    }
  }

  /** pending chunk builds (tests) */
  get pending(): number {
    return this.jobs.length;
  }

  private dropChunk(v: ChunkView) {
    v.group.removeFromParent();
    for (const g of v.geos) g.dispose();
  }

  /** build one chunk synchronously (tests, diagnostics) */
  buildChunk(c: number) {
    const job = this.chunkSteps(c, NEVER);
    while (!job.next().done);
  }

  /**
   * One chunk, in slices: the cairns, each viewpoint and each hamlet are built between yields
   * (when `tk` says the frame's budget is used), then the merged meshes are added at once.
   */
  private *chunkSteps(c: number, tk: Tick): Generator<void, void, void> {
    const z0 = c * CHUNK;
    const z1 = z0 + CHUNK;
    const m = this.m;
    const coast = this.coast;
    const b = new Batch();
    const rnd = new Rand((m.seed ^ Math.imul(c + 977, 0x2c1b3c6d)) >>> 0);
    const looks = coast.lookouts(z0 - 60, z1 + 60);
    const nearLook = (z: number) => looks.some((l) => Math.abs(l.z - z) < 22);
    // cairns along the cliff rim (every ~36 m), on the cornice berm, warning of the edge
    for (let z = z0 + rnd.range(0, 36); z < z1; z += 34 + rnd.range(0, 8)) {
      if (z < 30 || nearLook(z) || (coast.finite && z > coast.finishZ - 140)) continue;
      if (m.profile.checkpoints(z - 160, z + 160).some((q) => Math.abs(q - z) < 120)) continue;
      const x = coast.rimX(z) + 7;
      cairn(b, x, m.heightAt(x, z), z, rnd.range(1.4, 2.0), rnd);
      if (tk.over()) yield;
    }
    for (const l of looks) {
      if (l.z < z0 || l.z >= z1) continue;
      this.viewpoint(b, l, rnd);
      if (tk.over()) yield;
    }
    for (const h of coast.hamlets(z0, z1 - 1)) {
      yield* this.hamlet(b, h.z, h.seed, tk);
      if (tk.over()) yield;
    }
    // granite outcrops along the rim (lichen, rime, snow in the lee): coastal dressing that sits
    // in the gameplay camera's view on the sea side, between the cairns
    for (let z = z0 + rnd.range(10, 40); z < z1; z += rnd.range(38, 70)) {
      if (z < 40 || nearLook(z) || (coast.finite && z > coast.finishZ - 160)) continue;
      if (m.profile.checkpoints(z - 160, z + 160).some((q) => Math.abs(q - z) < 120)) continue;
      const x = coast.rimX(z) + rnd.range(12, 26);
      const size = rnd.range(1.1, 2.6);
      rimOutcrop(b, x, m.heightAt(x, z), z, size, rnd);
      if (tk.over()) yield;
    }
    const meshes = b.build(this.mats, { cast: this.hi, receive: true });
    const group = new THREE.Group();
    group.name = `fjord-chunk-${c}`;
    for (const me of meshes) group.add(me);
    this.group.add(group);
    this.chunks.set(c, { group, geos: meshes.map((me) => me.geometry) });
  }

  private viewpoint(b: Batch, l: Lookout, rnd: Rand) {
    viewpointProps(b, this.m, l, rnd);
  }

  /** a fishing hamlet on the strand flat at the foot of the wall: houses, boathouses, a jetty, boats */
  private *hamlet(b: Batch, z: number, seed: number, tk: Tick): Generator<void, void, void> {
    const m = this.m;
    const level = this.coast.seaLevelAt(z);
    const rnd = new Rand(seed);
    // find the strand flat: march out from the rim until the ground reaches the flat's height
    // (6 m steps; coarse 48 m strides first, then the 6 m steps inside the stride that crossed)
    let xf = marchOut(this.coast.rimX(z), 6, 400, (x) => m.heightAt(x, z) < level + 9);
    if (tk.over()) yield;
    const n = 5 + rnd.int(0, 5);
    for (let i = 0; i < n; i++) {
      const hz = z + rnd.range(-110, 110);
      let hx = xf - rnd.range(8, 46);
      const gy = m.heightAt(hx, hz);
      if (gy < level + 1.5 || gy > level + 14) continue;
      house(b, hx, gy + 0.2, hz, Math.PI / 2 + rnd.range(-0.12, 0.12), { w: rnd.range(8, 12), d: rnd.range(5.5, 7), h: rnd.range(4.2, 6.2), color: PAINT[rnd.int(0, PAINT.length - 1)]!, door: 'side', chimney: rnd.next() < 0.6 }, rnd);
      hx += 0;
      if (tk.over()) yield;
    }
    // red boathouses on stilts at the water's edge
    const xw = marchOut(xf, 2, 200, (x) => m.heightAt(x, z) < level - 0.5);
    for (let k = 0; k < 3; k++) {
      const bz = z - 50 + k * rnd.range(14, 22);
      house(b, xw + 2, level + 1.6, bz, Math.PI / 2, { w: rnd.range(6, 8), d: rnd.range(4.5, 5.5), h: 3.6, color: k === 1 ? PAINT[1] : PAINT[0], stilts: 6, door: 'boat', windows: k !== 2 }, rnd);
    }
    const ja = new THREE.Vector3(xw + 4, level + 1.4, z + 18);
    const jc = new THREE.Vector3(xw - 34, level + 1.4, z + 24);
    jetty(b, ja, jc, 2.4, 8);
    fishingBoat(b, xw - 22, level, z + 28.5, 0.15, { len: 11, hull: 0x2d4c78, stripe: 0xf2efe7, cabin: 0xf2efe7 });
    fishingBoat(b, xw - 40, level, z + 6, -0.6, { len: 9, hull: 0xb8321f, stripe: 0x1d1f22, cabin: 0xf2efe7 });
  }

  // --- ships on the fjord -------------------------------------------------------------------
  private syncShips(z: number) {
    const want = this.coast.reaches(z - 1500, z + 9000).filter((r) => (Number.isFinite(r.z1) ? r.z1 - r.z0 : 6000) > 1500);
    const keep = new Set(want.map((r) => r.index));
    this.ships = this.ships.filter((s) => {
      if (keep.has(s.reach)) return true;
      s.obj.removeFromParent();
      return false;
    });
    for (const r of want) {
      if (this.ships.some((s) => s.reach === r.index)) continue;
      const rr = new Rand((this.m.seed ^ Math.imul(r.index + 31, 0x9e3779b1)) >>> 0);
      if (!r.ocean && rr.next() < 0.35) continue;
      const z0 = Math.max(r.z0 + 500, -1500);
      const z1 = Number.isFinite(r.z1) ? r.z1 - 500 : (this.coast.finite ? this.coast.finishZ + 4000 : z0 + 3000);
      if (z1 - z0 < 600) continue;
      const mid = (z0 + z1) / 2;
      const x = -(this.coast.farShore(mid) * rr.range(0.45, 0.62));
      const obj = new THREE.Group();
      for (const me of this.shipGeo) obj.add(new THREE.Mesh(me.geometry, me.material));
      obj.scale.setScalar(rr.range(0.8, 1.1));
      this.group.add(obj);
      this.ships.push({ obj, reach: r.index, x, z0, z1, speed: rr.range(5, 8) * (rr.next() < 0.5 ? 1 : -1), phase: rr.next(), level: r.level });
    }
  }

  update(dt: number, time: number, f: SceneryFrame): void {
    this.time += dt;
    this.water.update(time, f.camPos, f.origin);
    // clear skies: only thin, high cloud shadows drift over the snow (cinematics may still dim)
    if (this.terrainU.uCloudShadow.value === 1) this.terrainU.uCloudShadow.value = 0.45;
    this.mist.update(time, f.camPos);
    for (const s of this.ships) {
      const span = s.z1 - s.z0;
      let u = (s.phase * span + s.speed * time) % (2 * span);
      if (u < 0) u += 2 * span;
      const fwd = u < span;
      const zz = s.z0 + (fwd ? u : 2 * span - u);
      s.obj.position.set(s.x + 40 * Math.sin(zz / 900), s.level + 0.15 * Math.sin(time * 0.7), zz);
      s.obj.rotation.set(0.01 * Math.sin(time * 0.9), fwd === s.speed > 0 ? 0 : Math.PI, 0.012 * Math.sin(time * 0.6 + 1));
    }
  }

  /** menu: a slow drift behind the skier at the start gate, the fjord opening below on the right */
  menuCamera(time: number, out: { pos: THREE.Vector3; look: THREE.Vector3; fov: number }): boolean {
    // above the cliff rim beside the start: the start gate and skier to the left, the fjord far
    // below on the right (the menu panel covers the left of the screen)
    const m = this.m;
    const c = this.coast;
    const z = 30 + Math.sin(time * 0.05) * 12;
    const xr = c.rimX(z);
    const y = m.heightAt(xr + 20, z);
    // round 2 (art review D12): a little further out over the rim and looking further down, so
    // the top of the wall drops away below the cornice (the height of the cliffs reads)
    out.pos.set(xr + 24 + Math.sin(time * 0.04) * 5, y + 48 + Math.sin(time * 0.1) * 2, z - 76);
    out.look.set(xr - 700, c.seaLevelAt(z) + 215, z + 900);
    out.fov = 58;
    return true;
  }

  stats() {
    return { water: this.water.active.length, chunks: this.chunks.size, pending: this.jobs.length, ships: this.ships.length, mist: this.mist.count };
  }

  dispose(): void {
    this.jobs.length = 0;
    for (const v of this.chunks.values()) this.dropChunk(v);
    this.chunks.clear();
    for (const s of this.ships) s.obj.removeFromParent();
    for (const me of this.shipGeo) me.geometry.dispose();
    this.water.dispose();
    this.mist.dispose();
    for (const mt of Object.values(this.mats)) mt.dispose();
    this.group.removeFromParent();
    void mat;
    void this.ctx;
  }
}

/**
 * x after stepping `step` m toward −X (seaward) from x0 until `hit(x)`, at most `n` steps — the
 * same answer as the plain loop (`for i < n: if hit(x) break; x -= step`) when the ground falls
 * monotonically, with ~8× fewer height samples: strides of 8 steps, then single steps.
 */
function marchOut(x0: number, step: number, n: number, hit: (x: number) => boolean): number {
  if (hit(x0)) return x0;
  let i = 0;
  while (i + 8 < n && !hit(x0 - (i + 8) * step)) i += 8;
  for (let k = i + 1; k < n; k++) if (hit(x0 - k * step)) return x0 - k * step;
  return x0 - n * step;
}

export const FJORD_SCENERY = registerScenery({ id: 'fjord-coast', build: (ctx) => new FjordScenery(ctx) });
