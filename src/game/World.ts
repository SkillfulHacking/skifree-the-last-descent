/**
 * The persistent world for one course: built once per (course, quality) and reused across runs.
 * Owns the scene graph for terrain, vegetation, environment, caves, story props, checkpoints,
 * the resort and FX.
 *
 * Streaming: terrain chunks, obstacle bands, vegetation, caves (one per encounter) and Endless
 * checkpoints exist only in a window around the action, so memory is bounded on any course length.
 *
 * Floating origin: simulation runs in absolute world coordinates (float64 in JS). At render time
 * the whole scene and the camera are shifted by −origin (origin snapped to 1 km steps near the
 * focus), so GPU float32 maths always works with small numbers — no jitter 50 km down the hill.
 */
import * as THREE from 'three';
import type { QualityPreset } from '../core/types';
import type { Encounter, Mountain } from '../world/course';
import { caveMouthXZ } from '../world/caveTerrain';
import { BAND, ObstacleField } from '../physics/obstacles';
import { TerrainRenderer } from '../world/TerrainRenderer';
import { Vegetation } from '../world/Vegetation';
import { Environment } from '../world/Environment';
import { Cave, Footprints, StoryProps } from '../world/Cave';
import { Resort } from '../world/Resort';
import { Particles } from '../fx/Particles';
import { SkiTracks } from '../fx/SkiTracks';
import { StartArea } from '../world/StartArea';
import { Checkpoint } from '../world/Checkpoint';
import { AltMarkers } from '../world/Markers';
import { buildMountain, courseId, type CourseConfig } from './CourseConfig';

export interface CaveSlot {
  enc: Encounter;
  cave: Cave;
  story: StoryProps;
}

const ORIGIN_STEP = 1024;

export class World {
  readonly scene = new THREE.Scene();
  readonly course: CourseConfig;
  readonly id: string;
  readonly mountain: Mountain;
  readonly obstacles: ObstacleField;
  readonly terrain: TerrainRenderer;
  readonly vegetation: Vegetation;
  readonly env: Environment;
  readonly footprints: Footprints;
  readonly yetiPrints: Footprints;
  /** null on Endless (no finish) */
  readonly resort: Resort | null;
  readonly particles: Particles;
  readonly tracks: SkiTracks;
  readonly start: StartArea;
  readonly quality: QualityPreset;
  readonly seed: number;
  /** render-space origin (see header) */
  readonly origin = new THREE.Vector3();
  private caves = new Map<number, CaveSlot>();
  private lodges = new Map<number, Checkpoint>();
  private markers = new Map<number, AltMarkers>();
  /** the encounter the session cares about now (set by GameSession) */
  focusEncounter: Encounter | null = null;
  private streamZ = -Infinity;

  private constructor(renderer: THREE.WebGLRenderer, quality: QualityPreset, course: CourseConfig) {
    this.quality = quality;
    this.course = course;
    this.id = courseId(course);
    this.seed = course.seed;
    this.mountain = buildMountain(course);
    this.obstacles = new ObstacleField(this.mountain, this.seed);
    this.terrain = new TerrainRenderer(this.mountain, quality);
    this.scene.add(this.terrain.group);
    this.env = new Environment(this.scene, renderer, quality);
    this.terrain.uniforms.uSunDir.value.copy(this.env.sunDir);
    this.vegetation = new Vegetation(this.mountain, this.obstacles, quality, this.seed);
    this.scene.add(this.vegetation.group);
    this.footprints = new Footprints(this.mountain, 160);
    this.yetiPrints = new Footprints(this.mountain, 500);
    this.scene.add(this.footprints.mesh, this.yetiPrints.mesh);
    const fz = this.mountain.finishZ;
    if (Number.isFinite(fz)) {
      const fx = this.mountain.routeX(fz);
      this.resort = new Resort({ quality, heightAt: (x, z) => this.mountain.heightAt(x, z), finishCenter: new THREE.Vector3(fx, this.mountain.heightAt(fx, fz), fz) });
      this.scene.add(this.resort.group);
      const t = this.resort.trophy;
      this.trophyHome = { parent: t.parent, pos: t.position.clone(), quat: t.quaternion.clone(), scale: t.scale.clone() };
    } else this.resort = null;
    this.start = new StartArea(this.mountain);
    this.scene.add(this.start.group);
    const cap = { low: 2500, medium: 4500, high: 7000, ultra: 10000 }[quality];
    this.particles = new Particles(cap, renderer.getPixelRatio());
    this.scene.add(this.particles.points);
    this.tracks = new SkiTracks();
    this.scene.add(this.tracks.group);
    this.particles.setFog(this.env.fog.color, this.env.fog.density);
    this.tracks.setFog(this.env.fog.color, this.env.fog.density);
  }

  static async create(renderer: THREE.WebGLRenderer, quality: QualityPreset, course: CourseConfig, onProgress: (f: number, label: string) => void): Promise<World> {
    onProgress(0.02, 'Shaping the mountain');
    await tick();
    const w = new World(renderer, quality, course);
    onProgress(0.08, 'Growing the forest');
    await tick();
    const x0 = w.mountain.routeX(0);
    w.stream(0, true);
    w.vegetation.flush();
    await w.terrain.prime(x0, 0, (f) => onProgress(0.15 + f * 0.75, 'Laying down fresh snow'));
    onProgress(0.92, 'Compiling shaders');
    await tick();
    return w;
  }

  // --- streaming ----------------------------------------------------------------------
  /**
   * Keep everything that must exist around z. `all` builds the whole window synchronously
   * (loading / teleports); otherwise at most one new obstacle band per call (bounded frame cost).
   */
  stream(z: number, all = false) {
    const ahead = this.vegetation.farDist;
    // physics-critical window: always complete
    this.obstacles.ensure(z - 80, z + 400);
    // visual window: nearest missing band first, one per frame
    if (all) this.obstacles.ensure(z - 600, z + ahead);
    else {
      for (let d = 0; d <= ahead; d += BAND) {
        const before = this.obstacles.bandCount;
        this.obstacles.ensure(z + d, z + d);
        if (this.obstacles.bandCount !== before) break;
      }
    }
    if (all || Math.abs(z - this.streamZ) > 64) {
      this.streamZ = z;
      this.obstacles.release(z - 900, z + ahead + 400);
      this.syncCaves(z);
      this.syncLodges(z);
    }
  }

  private syncCaves(z: number) {
    const want = new Set<number>();
    for (const e of this.mountain.profile.encounters(z - 400, z + 1800)) {
      if (e.caveZ < z - 400 || e.caveZ > z + 1800) continue;
      want.add(e.index);
      if (!this.caves.has(e.index)) this.buildCave(e);
    }
    if (this.focusEncounter) want.add(this.focusEncounter.index);
    for (const [i, slot] of this.caves) {
      if (want.has(i)) continue;
      this.disposeCave(slot);
      this.caves.delete(i);
    }
    this.terrain.pinned = [...this.caves.values()].map((s) => {
      const cm = caveMouthXZ(s.enc.anchor);
      return { x: cm.x + 10 * s.enc.anchor.side, z: cm.z, r: 20 };
    });
  }

  private buildCave(e: Encounter): CaveSlot {
    const cave = new Cave(this.mountain, e.anchor);
    const story = new StoryProps(this.mountain, this.footprints, e.anchor);
    this.scene.add(cave.group, story.group);
    const slot = { enc: e, cave, story };
    this.caves.set(e.index, slot);
    return slot;
  }

  private disposeCave(s: CaveSlot) {
    this.scene.remove(s.cave.group, s.story.group);
    s.cave.dispose();
    s.story.dispose();
  }

  private syncLodges(z: number) {
    const cps = this.mountain.profile.checkpoints(z - 400, z + 1600);
    const want = new Set(cps);
    cps.forEach((cz) => {
      if (this.lodges.has(cz)) return;
      const idx = this.mountain.profile.encounters(cz - 1, cz + 1).find((e) => e.checkpointZ === cz)?.index ?? 0;
      const c = new Checkpoint(this.mountain, cz, idx);
      this.scene.add(c.group);
      this.lodges.set(cz, c);
    });
    for (const [cz, c] of this.lodges) {
      if (want.has(cz)) continue;
      c.dispose();
      this.lodges.delete(cz);
    }
    // trail markers along alternate lines
    const alts = this.mountain.profile.altRoutes(z - 300, z + 1600);
    const wantA = new Set(alts.map((a) => a.z0));
    for (const a of alts) {
      if (this.markers.has(a.z0)) continue;
      const mk = new AltMarkers(this.mountain, a);
      this.scene.add(mk.mesh);
      this.markers.set(a.z0, mk);
    }
    for (const [k, mk] of this.markers) {
      if (wantA.has(k)) continue;
      mk.dispose();
      this.markers.delete(k);
    }
  }

  /** Cave for an encounter (built on demand). */
  caveFor(e: Encounter): CaveSlot {
    return this.caves.get(e.index) ?? this.buildCave(e);
  }

  /** The cave of the focus encounter (or the nearest built one). */
  get cave(): Cave {
    const e = this.focusEncounter;
    if (e) return this.caveFor(e).cave;
    const first = this.caves.values().next().value as CaveSlot | undefined;
    if (first) return first.cave;
    const e0 = this.mountain.profile.encounters(-Infinity, Infinity)[0]!;
    return this.caveFor(e0).cave;
  }

  get caveCount() {
    return this.caves.size;
  }
  get lodgeCount() {
    return this.lodges.size;
  }

  // --- trophy -------------------------------------------------------------------------
  private trophyHome: { parent: THREE.Object3D | null; pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3 } | null = null;

  resetTrophy() {
    if (!this.resort || !this.trophyHome) return;
    const t = this.resort.trophy;
    const h = this.trophyHome;
    if (h.parent && t.parent !== h.parent) h.parent.add(t);
    t.position.copy(h.pos);
    t.quaternion.copy(h.quat);
    t.scale.copy(h.scale);
    t.children.forEach((c) => (c.visible = true));
  }

  /** Colliders that are not part of the procedural obstacle field (resort buildings etc). */
  extraColliders = () => this.resort?.colliders() ?? [];

  /** Make everything visible for shader pre-compilation (call update() afterwards to restore). */
  showAllForWarmup() {
    this.vegetation.group.traverse((o) => (o.visible = true));
  }

  update(dt: number, time: number, focus: THREE.Vector3, camPos: THREE.Vector3, terrainBudgetMs: number) {
    this.stream(focus.z);
    this.terrain.update(focus.x, focus.z, terrainBudgetMs, time);
    this.vegetation.update(camPos, time);
    this.env.update(dt, focus, camPos, time);
    this.particles.update(dt);
  }

  // --- floating origin ----------------------------------------------------------------
  /** Re-snap the render origin near `focus` (hysteresis: only moves after 1.5 steps). */
  updateOrigin(focus: THREE.Vector3) {
    const o = this.origin;
    const snap = (v: number, cur: number) => (Math.abs(v - cur) > ORIGIN_STEP * 1.5 ? Math.round(v / ORIGIN_STEP) * ORIGIN_STEP : cur);
    o.set(snap(focus.x, o.x), snap(focus.y, o.y), snap(focus.z, o.z));
    this.terrain.uniforms.uOrigin.value.copy(o);
  }

  /**
   * Render with the scene and the given cameras shifted by −origin, then restore absolute
   * coordinates (game code reads world matrices between frames).
   */
  renderShifted(cameras: THREE.Camera[], draw: () => void) {
    const o = this.origin;
    if (o.x === 0 && o.y === 0 && o.z === 0) {
      draw();
      return;
    }
    const kids = this.scene.children;
    for (const c of kids) {
      c.position.sub(o);
      if (!c.matrixAutoUpdate) c.updateMatrix();
    }
    for (const cam of cameras) {
      cam.position.sub(o);
      cam.updateMatrixWorld();
    }
    try {
      draw();
    } finally {
      for (const c of kids) {
        c.position.add(o);
        if (!c.matrixAutoUpdate) c.updateMatrix();
      }
      for (const cam of cameras) {
        cam.position.add(o);
        cam.updateMatrixWorld();
      }
      this.scene.updateMatrixWorld();
    }
  }

  dispose() {
    for (const s of this.caves.values()) this.disposeCave(s);
    this.caves.clear();
    for (const c of this.lodges.values()) c.dispose();
    this.lodges.clear();
    for (const mk of this.markers.values()) mk.dispose();
    this.markers.clear();
    this.terrain.dispose();
    this.vegetation.dispose();
    this.env.dispose();
    this.footprints.dispose();
    this.yetiPrints.dispose();
    this.resort?.dispose();
    this.particles.dispose();
    this.tracks.dispose();
    this.start.dispose();
    this.scene.clear();
  }
}

function tick() {
  return new Promise<void>((r) => setTimeout(r, 0));
}
