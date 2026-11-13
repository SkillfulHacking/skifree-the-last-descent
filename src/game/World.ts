/**
 * The persistent world for one course: built once per (course, quality) and reused across runs.
 * Owns the scene graph for terrain, vegetation, environment, caves, story props, checkpoints,
 * the resort and FX.
 *
 * Streaming: terrain chunks, obstacle bands, hazard bands (+ their views), vegetation, caves (one
 * per encounter) and Endless checkpoints exist only in a window around the action, so memory is
 * bounded on any course length.
 *
 * Location capabilities (src/world/capabilities): `environment` is the biome's pure gameplay
 * environment (surface, weather, hazards) that GameSession hands to SkierPhysics; the finish,
 * refuge and cave dressing are built from the biome's presentation registries
 * (src/world/presentation).
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
import { Particles } from '../fx/Particles';
import { SkiTracks } from '../fx/SkiTracks';
import { StartArea } from '../world/StartArea';
import { AltMarkers } from '../world/Markers';
import { buildMountain, courseId, worldSeed, type CourseConfig } from './CourseConfig';
import type { Biome } from '../world/biome';
import { BiomeEnvironment } from '../world/capabilities/environment';
import { makeWeatherSample } from '../world/capabilities/weather';
import { frameBudget } from '../core/frameBudget';
import { HazardLayer, presentationOf, type BiomePresentation, type CaveDressing, type FinishDefinition, type FinishEnvironment, type RefugeView, type SceneryView } from '../world/presentation';

export interface CaveSlot {
  enc: Encounter;
  cave: Cave;
  story: StoryProps;
  /** the location's extra dressing around the cave (null for Alpine) */
  dressing: CaveDressing | null;
}

const ORIGIN_STEP = 1024;

/**
 * One streaming budget per frame (ms of main-thread time), shared by every streaming consumer in
 * priority order (round 4, Reviewer D r3 defect 1: terrain 3.5 + caves 4 + dressing 3 + scenery 3 +
 * hazard views 2 + vegetation 2 ms each ran in the same frame, and each overshot by one unit).
 */
export const STREAM_BUDGET_MS = 6;
/** a consumer with work pending that has had no turn for this many frames gets one minimal slice */
export const STREAM_STARVE_FRAMES = 8;
/** streaming consumers, highest priority first */
const STREAM_ORDER = ['terrain', 'obstacles', 'vegetation', 'hazards', 'caves', 'scenery', 'lodges', 'far'] as const;
type StreamConsumer = (typeof STREAM_ORDER)[number];

/** hazard bands (and their views) are streamed this far ahead of the skier, m */
export const HAZARD_VIEW_AHEAD = 1100;

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
  /** the finish environment (Alpine: the Resort); null on Endless (no finish) */
  readonly finish: FinishEnvironment | null;
  /** the finish definition (scene builder + victory script) of this location */
  readonly finishDef: FinishDefinition;
  /** the location's gameplay environment: surface + weather + streamed hazards (pure) */
  readonly environment: BiomeEnvironment;
  /** three.js views of the streamed hazards (follow the hazard bands) */
  readonly hazardViews: HazardLayer;
  /** finish / refuge / cave presentation of this location */
  readonly presentation: BiomePresentation;
  /** the location's streamed set dressing (Fjord: water, mist, hamlets, boats …); null for Alpine */
  readonly scenery: SceneryView | null;
  /** weather at the focus this frame (physics clock) */
  readonly weather = makeWeatherSample();
  readonly particles: Particles;
  readonly tracks: SkiTracks;
  readonly start: StartArea;
  readonly quality: QualityPreset;
  readonly seed: number;
  /** the location (look + terrain knobs) this world was built for */
  readonly biome: Biome;
  /** render-space origin (see header) */
  readonly origin = new THREE.Vector3();
  private caves = new Map<number, CaveSlot>();
  /** caves being built in time slices (one step per frame) */
  private caveJobs = new Map<number, { enc: Encounter; job: Generator<void, Cave, void> }>();
  /** location dressings being built in time slices after their cave (round 3, D2) */
  private dressJobs = new Map<number, Generator<void, CaveDressing | null, void>>();
  private lodges = new Map<number, RefugeView>();
  /** refuges being built in time slices */
  private lodgeJobs = new Map<number, Generator<void, RefugeView, void>>();
  private markers = new Map<number, AltMarkers>();
  /** the encounter the session cares about now (set by GameSession) */
  focusEncounter: Encounter | null = null;
  private streamZ = -Infinity;
  /** focus z of the last stream() (the visual obstacle window starts here) */
  private streamZ0 = 0;

  private constructor(renderer: THREE.WebGLRenderer, quality: QualityPreset, course: CourseConfig) {
    this.quality = quality;
    this.course = course;
    this.id = courseId(course);
    this.seed = worldSeed(course);
    this.mountain = buildMountain(course);
    this.biome = this.mountain.biome;
    this.obstacles = new ObstacleField(this.mountain, this.seed);
    this.presentation = presentationOf(this.biome);
    this.finishDef = this.presentation.finish;
    this.environment = new BiomeEnvironment(this.mountain, this.seed, { difficulty: course.difficulty });
    this.terrain = new TerrainRenderer(this.mountain, quality);
    this.scene.add(this.terrain.group);
    this.env = new Environment(this.scene, renderer, quality, this.biome);
    this.terrain.uniforms.uSunDir.value.copy(this.env.sunDir);
    this.vegetation = new Vegetation(this.mountain, this.obstacles, quality, this.seed);
    this.scene.add(this.vegetation.group);
    this.footprints = new Footprints(this.mountain, 160);
    this.yetiPrints = new Footprints(this.mountain, 500);
    this.scene.add(this.footprints.mesh, this.yetiPrints.mesh);
    const fz = this.mountain.finishZ;
    if (Number.isFinite(fz)) {
      const fx = this.mountain.routeX(fz);
      this.finish = this.finishDef.build({ quality, mountain: this.mountain, biome: this.biome, heightAt: (x, z) => this.mountain.heightAt(x, z), finishCenter: new THREE.Vector3(fx, this.mountain.heightAt(fx, fz), fz) });
      this.scene.add(this.finish.group);
      const t = this.finish.trophy;
      this.trophyHome = { parent: t.parent, pos: t.position.clone(), quat: t.quaternion.clone(), scale: t.scale.clone() };
    } else this.finish = null;
    this.hazardViews = new HazardLayer(this.environment, { mountain: this.mountain, quality, biome: this.biome });
    this.scene.add(this.hazardViews.group);
    this.scenery = this.presentation.scenery?.build({ mountain: this.mountain, quality, biome: this.biome, terrain: this.terrain.uniforms, sunDir: this.env.sunDir }) ?? null;
    if (this.scenery) this.scene.add(this.scenery.group);
    this.start = new StartArea(this.mountain, quality);
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
    this.environment.stream(z);
    // hazard views further out (a windsock or a rock patch should not pop in 400 m ahead): one
    // more band per call, out to HAZARD_VIEW_AHEAD
    if (!this.environment.hazards.empty) {
      if (all) {
        this.environment.hazards.ensure(z - 80, z + HAZARD_VIEW_AHEAD);
        this.hazardViews.flush();
      }
      else
        for (let d = 400; d <= HAZARD_VIEW_AHEAD; d += BAND) {
          const before = this.environment.hazards.bandCount;
          this.environment.hazards.ensure(z + d, z + d);
          if (this.environment.hazards.bandCount !== before) break;
        }
    }
    // visual window (trees and rocks seen ahead): time-sliced on the frame's streaming budget
    // (round 4: a coastal band was 16–25 ms in one frame); the physics window above is always whole
    this.streamZ0 = z;
    if (all) this.obstacles.ensure(z - 600, z + ahead);
    if (all || Math.abs(z - this.streamZ) > 64) {
      this.streamZ = z;
      this.obstacles.release(z - 900, z + ahead + 400);
      this.environment.release(z - 900, z + ahead + 400);
      this.scenery?.stream(z);
      if (all) this.scenery?.flush?.();
      this.syncCaves(z);
      if (all) for (const j of [...this.caveJobs.values()]) this.buildCave(j.enc);
      this.syncLodges(z, all);
    }
  }

  private syncCaves(z: number) {
    const want = new Set<number>();
    for (const e of this.mountain.profile.encounters(z - 400, z + 1800)) {
      if (e.caveZ < z - 400 || e.caveZ > z + 1800) continue;
      want.add(e.index);
      if (!this.caves.has(e.index) && !this.caveJobs.has(e.index)) this.caveJobs.set(e.index, { enc: e, job: Cave.buildSteps(this.mountain, e.anchor, this.quality) });
    }
    if (this.focusEncounter) want.add(this.focusEncounter.index);
    // the next cave ahead always exists (built while loading, so its shaders are compiled with
    // the rest of the scene and nothing has to be created mid-run for the first encounter)
    const next = this.mountain.profile.encounters(z, z + 60000).find((e) => e.chaseEndZ > z);
    if (next && !want.has(next.index)) {
      want.add(next.index);
      if (!this.caves.has(next.index) && !this.caveJobs.has(next.index)) this.caveJobs.set(next.index, { enc: next, job: Cave.buildSteps(this.mountain, next.anchor, this.quality) });
    }
    for (const [i, slot] of this.caves) {
      if (want.has(i)) continue;
      this.disposeCave(slot);
      this.caves.delete(i);
    }
    for (const i of [...this.caveJobs.keys()]) if (!want.has(i)) this.caveJobs.delete(i);
    this.terrain.pinned = [...this.caves.values()].map((s) => {
      const cm = caveMouthXZ(s.enc.anchor);
      return { x: cm.x + 10 * s.enc.anchor.side, z: cm.z, r: 20 };
    });
  }

  /** Advance pending cave builds by one slice (called every frame): dressings first, then caves. */
  private stepCaves() {
    for (const i of this.dressJobs.keys()) {
      this.stepDressing(i, false);
      return; // one slice per frame
    }
    for (const [i, j] of this.caveJobs) {
      const r = j.job.next();
      if (r.done) {
        this.caveJobs.delete(i);
        this.installCave(j.enc, r.value);
      }
      break; // one job at a time
    }
  }

  private buildCave(e: Encounter): CaveSlot {
    // needed right now (cinematic, loading, teleport): finish any slices synchronously
    const pending = this.caveJobs.get(e.index);
    let cave: Cave;
    if (pending) {
      let r = pending.job.next();
      while (!r.done) r = pending.job.next();
      cave = r.value;
      this.caveJobs.delete(e.index);
    } else cave = new Cave(this.mountain, e.anchor, this.quality);
    return this.installCave(e, cave, true);
  }

  private installCave(e: Encounter, cave: Cave, sync = false): CaveSlot {
    const story = new StoryProps(this.mountain, this.footprints, e.anchor);
    this.scene.add(cave.group, story.group);
    const slot: CaveSlot = { enc: e, cave, story, dressing: null };
    this.caves.set(e.index, slot);
    // the location's dressing: built in slices of its own after the cave (never in the frame that
    // finishes the cave); a presentation without `dressSteps` still gets a frame of its own
    const P = this.presentation.cave;
    const ctx = { mountain: this.mountain, anchor: e.anchor, cave, quality: this.quality, biome: this.biome };
    const job = P.dressSteps
      ? P.dressSteps(ctx)
      : P.dress
        ? (function* (): Generator<void, CaveDressing | null, void> {
            yield;
            return P.dress!(ctx);
          })()
        : null;
    if (job) {
      this.dressJobs.set(e.index, job);
      if (sync) this.stepDressing(e.index, true);
    }
    return slot;
  }

  /** advance (or with `all`, finish) the dressing job of a cave; attach it when done */
  private stepDressing(i: number, all: boolean) {
    const job = this.dressJobs.get(i);
    if (!job) return;
    let r = job.next();
    while (all && !r.done) r = job.next();
    if (!r.done) return;
    this.dressJobs.delete(i);
    const slot = this.caves.get(i);
    const d = r.value;
    if (!d) return;
    if (!slot) {
      d.dispose();
      return;
    }
    slot.dressing = d;
    this.scene.add(d.group);
  }

  private disposeCave(s: CaveSlot) {
    const job = this.dressJobs.get(s.enc.index);
    if (job) {
      // abandon a half-built dressing (a generator's finally blocks dispose its partial work)
      this.dressJobs.delete(s.enc.index);
      job.return(null);
    }
    this.scene.remove(s.cave.group, s.story.group);
    s.cave.dispose();
    s.story.dispose();
    if (s.dressing) {
      this.scene.remove(s.dressing.group);
      s.dressing.dispose();
    }
  }

  private addLodge(cz: number, c: RefugeView) {
    this.scene.add(c.group);
    this.lodges.set(cz, c);
  }

  /** one slice of a pending refuge build (called every frame) */
  private stepLodges() {
    for (const [cz, job] of this.lodgeJobs) {
      const r = job.next();
      if (r.done) {
        this.lodgeJobs.delete(cz);
        this.addLodge(cz, r.value);
      }
      return;
    }
  }

  private syncLodges(z: number, all = false) {
    const cps = this.mountain.profile.checkpoints(z - 400, z + 1600);
    const want = new Set(cps);
    cps.forEach((cz) => {
      if (this.lodges.has(cz) || this.lodgeJobs.has(cz)) return;
      const idx = this.mountain.profile.encounters(cz - 1, cz + 1).find((e) => e.checkpointZ === cz)?.index ?? 0;
      const ctx = { mountain: this.mountain, z: cz, index: idx, quality: this.quality, biome: this.biome };
      const R = this.presentation.refuge;
      // sliced when the location offers it and the refuge is still well ahead (round 3, D6)
      if (R.buildSteps && !all && cz - z > 600) this.lodgeJobs.set(cz, R.buildSteps(ctx));
      else this.addLodge(cz, R.build(ctx));
    });
    for (const [cz, c] of this.lodges) {
      if (want.has(cz)) continue;
      c.dispose();
      this.lodges.delete(cz);
    }
    for (const [cz, job] of this.lodgeJobs) {
      if (want.has(cz)) continue;
      this.lodgeJobs.delete(cz);
      job.return(undefined as unknown as RefugeView);
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
    const slot = this.caves.get(e.index) ?? this.buildCave(e);
    // the cinematic needs the dressing (perches, clearance): finish it if still in slices
    this.stepDressing(e.index, true);
    return slot;
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

  /** The finish environment (kept under its original name for App/GameSession). */
  get resort(): FinishEnvironment | null {
    return this.finish;
  }

  resetTrophy() {
    if (!this.finish || !this.trophyHome) return;
    const t = this.finish.trophy;
    const h = this.trophyHome;
    if (h.parent && t.parent !== h.parent) h.parent.add(t);
    t.position.copy(h.pos);
    t.quaternion.copy(h.quat);
    t.scale.copy(h.scale);
    t.children.forEach((c) => (c.visible = true));
  }

  /** Colliders that are not part of the procedural obstacle field (resort buildings etc). */
  /** the finish's solid props and the cave dressings' (round 9, B r8 #3: the scanned boulders at
   *  the sea-cave mouth had no collision — skiers passed through them) */
  extraColliders = (): ReadonlyArray<{ x: number; z: number; r: number }> => {
    const f = this.finish?.colliders() ?? [];
    // (rebuilt only when the finish list or the set of dressed caves changes: called every physics step)
    let n = 0;
    for (const slot of this.caves.values()) {
      const c = slot.dressing?.colliders?.();
      if (c?.length) n += c.length + c[0]!.x * 7.31 + c[0]!.z * 3.17;
    }
    if (this.extraCache && this.extraCache.f === f && this.extraCache.n === n) return this.extraCache.all;
    const all: Array<{ x: number; z: number; r: number }> = [...f];
    for (const slot of this.caves.values()) all.push(...(slot.dressing?.colliders?.() ?? []));
    this.extraCache = { f, n, all };
    return all;
  };
  private extraCache: { f: ReadonlyArray<unknown>; n: number; all: Array<{ x: number; z: number; r: number }> } | null = null;

  /** Make everything visible for shader pre-compilation (call update() afterwards to restore). */
  showAllForWarmup() {
    this.vegetation.group.traverse((o) => (o.visible = true));
    // one view of every hazard kind (disposed again on the next update)
    this.hazardViews.warmup();
  }

  /** frames each streaming consumer has waited with work pending (starvation guard) */
  private starved: Record<StreamConsumer, number> = { terrain: 0, obstacles: 0, vegetation: 0, hazards: 0, caves: 0, scenery: 0, lodges: 0, far: 0 };
  /** per-frame streaming diagnostics (tests, perf harness): which consumers ran last frame */
  readonly streamStats = { served: [] as StreamConsumer[], starvedTurns: 0 };

  private pendingOf(c: StreamConsumer): boolean {
    switch (c) {
      case 'terrain':
        return this.terrain.pendingNear > 0;
      case 'obstacles':
        return this.obstacles.missing(this.streamZ0, this.streamZ0 + this.vegetation.farDist);
      case 'vegetation':
        return this.vegetation.pending > 0;
      case 'hazards':
        return this.hazardViews.pendingCount > 0;
      case 'caves':
        return this.caveJobs.size + this.dressJobs.size > 0;
      case 'scenery':
        return (this.scenery?.pending ?? 0) > 0;
      case 'lodges':
        return this.lodgeJobs.size > 0;
      case 'far':
        return this.terrain.pendingFar > 0;
    }
  }

  private runConsumer(c: StreamConsumer, ms: number, focus: THREE.Vector3, camPos: THREE.Vector3) {
    switch (c) {
      case 'terrain':
        return this.terrain.pumpNear(focus.x, focus.z, ms);
      case 'obstacles':
        return this.obstacles.prefetch(this.streamZ0, this.streamZ0 + this.vegetation.farDist, ms);
      case 'vegetation':
        return this.vegetation.update(camPos, this.frameTime, ms);
      case 'hazards':
        return this.hazardViews.pump(ms, focus.z, false);
      case 'caves':
        return this.stepCaves();
      case 'scenery':
        return this.scenery?.pump?.(ms);
      case 'lodges':
        return this.stepLodges();
      case 'far':
        return this.terrain.pumpFar(ms);
    }
  }
  private frameTime = 0;

  /**
   * The streaming work of one frame on one shared budget, in priority order (STREAM_ORDER): each
   * consumer runs only while the budget lasts (its own slices also end with it: core/frameBudget),
   * so at most one unit overruns; a consumer starved for STREAM_STARVE_FRAMES gets one minimal
   * slice (one starved consumer per frame), so nothing waits for ever behind higher priorities.
   */
  private stepStreaming(focus: THREE.Vector3, camPos: THREE.Vector3) {
    const served = this.streamStats.served;
    served.length = 0;
    let rescued = false;
    for (const c of STREAM_ORDER) {
      const pending = this.pendingOf(c);
      const left = frameBudget.remaining();
      if (c === 'vegetation') {
        // vegetation also updates its LOD visibility every frame: always called, building only on budget
        const rescue = !(left > 0) && pending && !rescued && this.starved[c] >= STREAM_STARVE_FRAMES;
        if (rescue) {
          rescued = true;
          this.streamStats.starvedTurns++;
        }
        this.vegetation.update(camPos, this.frameTime, left > 0 ? left : rescue ? 0.5 : 0);
        if (pending && (left > 0 || rescue)) served.push(c);
        this.starved[c] = pending && !(left > 0) && !rescue ? this.starved[c] + 1 : 0;
        continue;
      }
      if (left > 0 && pending) {
        this.runConsumer(c, left, focus, camPos);
        if (pending) served.push(c);
        this.starved[c] = 0;
      } else if (pending && !rescued && this.starved[c] >= STREAM_STARVE_FRAMES) {
        rescued = true;
        this.streamStats.starvedTurns++;
        this.runConsumer(c, 0.5, focus, camPos);
        served.push(c);
        this.starved[c] = 0;
      } else if (pending) this.starved[c]++;
      else this.starved[c] = 0;
    }
  }

  update(dt: number, time: number, focus: THREE.Vector3, camPos: THREE.Vector3, streamBudgetMs: number = STREAM_BUDGET_MS) {
    this.frameTime = time;
    frameBudget.begin(streamBudgetMs);
    try {
      // physics-critical streaming first (obstacles and hazards near the skier: bounded, one band)
      this.stream(focus.z);
      // terrain bookkeeping every frame (window, LOD wishes, time uniform), even with no budget left
      this.terrain.syncLod(focus.x, focus.z, time);
      this.stepStreaming(focus, camPos);
    } finally {
      frameBudget.end();
    }
    // weather on the physics clock (Alpine: constant; fog, flakes exactly as before)
    const env = this.environment;
    env.weatherAt(focus.x, focus.z, env.clock, this.weather);
    this.env.applyWeather(this.weather.visibility * env.hazardVisibility(focus.x, focus.z, env.clock), this.weather.snowfall);
    this.env.update(dt, focus, camPos, time, this.weather.windX);
    this.hazardViews.update(dt, focus.z);
    this.scenery?.update(dt, time, { focus, camPos, origin: this.origin });
    for (const s of this.caves.values()) s.dressing?.update?.(dt, time);
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
    this.caveJobs.clear();
    for (const c of this.lodges.values()) c.dispose();
    this.lodges.clear();
    for (const mk of this.markers.values()) mk.dispose();
    this.markers.clear();
    this.terrain.dispose();
    this.vegetation.dispose();
    this.env.dispose();
    this.footprints.dispose();
    this.yetiPrints.dispose();
    this.finish?.dispose();
    this.hazardViews.dispose();
    this.scenery?.dispose();
    this.environment.dispose();
    this.particles.dispose();
    this.tracks.dispose();
    this.start.dispose();
    this.scene.clear();
  }
}

function tick() {
  return new Promise<void>((r) => setTimeout(r, 0));
}
