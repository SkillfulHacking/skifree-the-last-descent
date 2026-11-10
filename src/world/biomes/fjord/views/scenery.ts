/**
 * "fjord-coast" scenery: everything streamed along the Fjord course that is not terrain, obstacles
 * or hazards — the water surfaces, sea mist, fishing hamlets on the strand flats, boats and the
 * coastal ferry, the cairns along the cliff rim and the viewpoints. Built once per course; pieces
 * are created per 512 m chunk by `stream(z)` and disposed when far away (bounded on any length,
 * Endless included).
 */
import * as THREE from 'three';
import { registerScenery, type SceneryContext, type SceneryFrame, type SceneryView } from '../../../presentation/scenery';
import { Batch, Rand, mat } from '../../../resort/util';
import type { Coast, Lookout } from '../../../coast';
import type { Mountain } from '../../../course';
import { FjordWater } from './water';
import { SeaMist } from './mist';
import { PAINT, cairn, ferry, fishingBoat, house, jetty, kitMaterials } from './buildings';
import { viewpointProps } from './viewpoint';

const CHUNK = 512;
/** chunks kept behind / ahead of the skier (hamlets far below must show from far away) */
const BEHIND = 2;
const AHEAD = 8;

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
  private time = 0;

  constructor(private ctx: SceneryContext) {
    const coast = ctx.mountain.coast;
    if (!coast) throw new Error('fjord-coast scenery needs a coastal mountain');
    this.coast = coast;
    this.m = ctx.mountain;
    this.hi = ctx.quality === 'high' || ctx.quality === 'ultra';
    this.group.name = 'FjordScenery';
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
  stream(z: number): void {
    const c0 = Math.floor(z / CHUNK) - BEHIND;
    const c1 = Math.floor(z / CHUNK) + AHEAD;
    for (let c = c0; c <= c1; c++) if (!this.chunks.has(c) && c * CHUNK > -800 && (!this.coast.finite || c * CHUNK < this.coast.finishZ + 200)) this.buildChunk(c);
    for (const [c, v] of this.chunks) {
      if (c >= c0 - 1 && c <= c1 + 1) continue;
      this.dropChunk(v);
      this.chunks.delete(c);
    }
    this.mist.stream(z);
    this.syncShips(z);
  }

  private dropChunk(v: ChunkView) {
    v.group.removeFromParent();
    for (const g of v.geos) g.dispose();
  }

  private buildChunk(c: number) {
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
    }
    for (const l of looks) if (l.z >= z0 && l.z < z1) this.viewpoint(b, l, rnd);
    for (const h of coast.hamlets(z0, z1 - 1)) this.hamlet(b, h.z, h.seed);
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
  private hamlet(b: Batch, z: number, seed: number) {
    const m = this.m;
    const level = this.coast.seaLevelAt(z);
    const rnd = new Rand(seed);
    // find the strand flat: march out from the rim until the ground reaches the flat's height
    let xf = this.coast.rimX(z);
    for (let i = 0; i < 400; i++) {
      if (m.heightAt(xf, z) < level + 9) break;
      xf -= 6;
    }
    const n = 5 + rnd.int(0, 5);
    for (let i = 0; i < n; i++) {
      const hz = z + rnd.range(-110, 110);
      let hx = xf - rnd.range(8, 46);
      const gy = m.heightAt(hx, hz);
      if (gy < level + 1.5 || gy > level + 14) continue;
      house(b, hx, gy + 0.2, hz, Math.PI / 2 + rnd.range(-0.12, 0.12), { w: rnd.range(8, 12), d: rnd.range(5.5, 7), h: rnd.range(4.2, 6.2), color: PAINT[rnd.int(0, PAINT.length - 1)]!, door: 'side', chimney: rnd.next() < 0.6 }, rnd);
      hx += 0;
    }
    // red boathouses on stilts at the water's edge
    let xw = xf;
    for (let i = 0; i < 200; i++) {
      if (m.heightAt(xw, z) < level - 0.5) break;
      xw -= 2;
    }
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
    const m = this.m;
    const x0 = m.routeX(0);
    const y0 = m.heightAt(x0, 0);
    const a = Math.sin(time * 0.05) * 0.18;
    out.pos.set(x0 + 16 + Math.sin(a) * 10, y0 + 7.5 + Math.sin(time * 0.1), -24 + Math.cos(a) * 4);
    out.pos.y = Math.max(out.pos.y, m.heightAt(out.pos.x, out.pos.z) + 3.5);
    out.look.set(x0 - 120, y0 - 70, 210);
    out.fov = 56;
    return true;
  }

  stats() {
    return { water: this.water.active.length, chunks: this.chunks.size, ships: this.ships.length, mist: this.mist.count };
  }

  dispose(): void {
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

export const FJORD_SCENERY = registerScenery({ id: 'fjord-coast', build: (ctx) => new FjordScenery(ctx) });
