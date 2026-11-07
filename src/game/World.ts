/**
 * The persistent world: built once per quality preset and reused across runs (retry without reload).
 * Owns the scene graph for terrain, vegetation, environment, cave, story props, resort and FX.
 */
import * as THREE from 'three';
import type { QualityPreset } from '../core/types';
import { COURSE, Mountain, SEED_DEFAULT, caveMouthXZ, routeX } from '../world/course';
import { generateObstacles, type ObstacleField } from '../physics/obstacles';
import { TerrainRenderer } from '../world/TerrainRenderer';
import { Vegetation } from '../world/Vegetation';
import { Environment } from '../world/Environment';
import { Cave, Footprints, StoryProps } from '../world/Cave';
import { Resort } from '../world/Resort';
import { Particles } from '../fx/Particles';
import { SkiTracks } from '../fx/SkiTracks';
import { StartArea } from '../world/StartArea';

export class World {
  readonly scene = new THREE.Scene();
  readonly mountain: Mountain;
  readonly obstacles: ObstacleField;
  readonly terrain: TerrainRenderer;
  readonly vegetation: Vegetation;
  readonly env: Environment;
  readonly cave: Cave;
  readonly footprints: Footprints;
  readonly yetiPrints: Footprints;
  readonly story: StoryProps;
  readonly resort: Resort;
  readonly particles: Particles;
  readonly tracks: SkiTracks;
  readonly start: StartArea;
  readonly quality: QualityPreset;
  readonly seed: number;

  private constructor(renderer: THREE.WebGLRenderer, quality: QualityPreset, seed: number) {
    this.quality = quality;
    this.seed = seed;
    this.mountain = new Mountain(seed);
    this.obstacles = generateObstacles(this.mountain, seed);
    this.terrain = new TerrainRenderer(this.mountain, quality);
    const cm = caveMouthXZ();
    this.terrain.pinned.push({ x: cm.x + 10, z: cm.z, r: 20 });
    this.scene.add(this.terrain.group);
    this.env = new Environment(this.scene, renderer, quality);
    this.terrain.uniforms.uSunDir.value.copy(this.env.sunDir);
    this.vegetation = new Vegetation(this.mountain, this.obstacles.list, quality, seed);
    this.scene.add(this.vegetation.group);
    this.cave = new Cave(this.mountain);
    this.scene.add(this.cave.group);
    this.footprints = new Footprints(this.mountain, 120);
    this.yetiPrints = new Footprints(this.mountain, 500);
    this.scene.add(this.footprints.mesh, this.yetiPrints.mesh);
    this.story = new StoryProps(this.mountain, this.footprints);
    this.scene.add(this.story.group);
    const fz = COURSE.finishZ;
    const fx = routeX(fz);
    this.resort = new Resort({ quality, heightAt: (x, z) => this.mountain.heightAt(x, z), finishCenter: new THREE.Vector3(fx, this.mountain.heightAt(fx, fz), fz) });
    this.scene.add(this.resort.group);
    this.start = new StartArea(this.mountain);
    this.scene.add(this.start.group);
    const cap = { low: 2500, medium: 4500, high: 7000, ultra: 10000 }[quality];
    this.particles = new Particles(cap, renderer.getPixelRatio());
    this.scene.add(this.particles.points);
    this.tracks = new SkiTracks();
    this.scene.add(this.tracks.group);
    this.particles.setFog(this.env.fog.color, this.env.fog.density);
    const t = this.resort.trophy;
    this.trophyHome = { parent: t.parent, pos: t.position.clone(), quat: t.quaternion.clone(), scale: t.scale.clone() };
    this.tracks.setFog(this.env.fog.color, this.env.fog.density);
  }

  static async create(renderer: THREE.WebGLRenderer, quality: QualityPreset, onProgress: (f: number, label: string) => void, seed = SEED_DEFAULT): Promise<World> {
    onProgress(0.02, 'Shaping the mountain');
    await tick();
    const w = new World(renderer, quality, seed);
    onProgress(0.15, 'Growing the forest');
    await tick();
    await w.terrain.prime(routeX(0), 0, (f) => onProgress(0.15 + f * 0.75, 'Laying down fresh snow'));
    onProgress(0.92, 'Compiling shaders');
    await tick();
    return w;
  }

  private trophyHome: { parent: THREE.Object3D | null; pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3 };

  resetTrophy() {
    const t = this.resort.trophy;
    const h = this.trophyHome;
    if (h.parent && t.parent !== h.parent) h.parent.add(t);
    t.position.copy(h.pos);
    t.quaternion.copy(h.quat);
    t.scale.copy(h.scale);
    t.children.forEach((c) => (c.visible = true));
  }

  /** Colliders that are not part of the procedural obstacle field (resort buildings etc). */
  extraColliders = () => this.resort.colliders();

  /** Make everything visible for shader pre-compilation (call update() afterwards to restore). */
  showAllForWarmup() {
    this.vegetation.group.traverse((o) => (o.visible = true));
  }

  update(dt: number, time: number, focus: THREE.Vector3, camPos: THREE.Vector3, terrainBudgetMs: number) {
    this.terrain.update(focus.x, focus.z, terrainBudgetMs, time);
    this.vegetation.update(camPos, time);
    this.env.update(dt, focus, camPos, time);
    this.particles.update(dt);
  }

  dispose() {
    this.terrain.dispose();
    this.vegetation.dispose();
    this.env.dispose();
    this.cave.dispose();
    this.footprints.dispose();
    this.yetiPrints.dispose();
    this.story.dispose();
    this.resort.dispose();
    this.particles.dispose();
    this.tracks.dispose();
    this.start.dispose();
    this.scene.clear();
  }
}

function tick() {
  return new Promise<void>((r) => setTimeout(r, 0));
}
