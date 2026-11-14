/**
 * Location scenery: streamed set dressing that belongs to a location but is neither terrain,
 * obstacles, hazards, refuges, caves nor the finish — e.g. the Fjord's water surfaces, sea mist,
 * fishing hamlets, boats, viewpoint cairns and rim markers. Selected by `capabilities.scenery.id`
 * (optional; Alpine has none).
 *
 * World builds it once per course, calls `stream(z)` with the obstacle window (bounded memory on
 * any course length: build what is near, dispose what is far), `pump(ms)` every frame to advance
 * queued builds within a main-thread budget (SCENERY_BUDGET_MS), `update(...)` every frame (in
 * absolute world coordinates; the floating origin is applied by World.renderShifted) and
 * `dispose()` with the world.
 */
import type * as THREE from 'three';
import type { QualityPreset } from '../../core/types';
import type { Mountain } from '../course';
import type { Biome } from '../biome';
import type { TerrainUniforms } from '../snowMaterial';

export interface SceneryContext {
  mountain: Mountain;
  quality: QualityPreset;
  biome: Biome;
  /** the terrain material's uniforms (e.g. to tell the terrain shader where the water line is) */
  terrain: TerrainUniforms;
  /** direction towards the sun (world space, normalised) */
  sunDir: THREE.Vector3;
}

export interface SceneryFrame {
  /** what the camera follows (the skier, the cave mouth in the cave cinematic) */
  focus: THREE.Vector3;
  camPos: THREE.Vector3;
  /** render-space origin (World.origin) */
  origin: THREE.Vector3;
}

export interface SceneryView {
  readonly group: THREE.Group;
  /**
   * Keep what is needed around course position z (called with the obstacle streaming). Heavy
   * builds should only be queued here and done in `pump` (time-sliced), like terrain and caves.
   */
  stream(z: number): void;
  /** advance queued builds for about `budgetMs` of main-thread time (World calls it every frame) */
  pump?(budgetMs: number): void;
  /** queued builds still to do (World's shared frame budget: starvation guard) */
  readonly pending?: number;
  /** finish every queued build now (loading, teleports) */
  flush?(): void;
  update(dt: number, time: number, f: SceneryFrame): void;
  /** optional main-menu camera (the location's establishing view around the start); null = default */
  menuCamera?(time: number, out: { pos: THREE.Vector3; look: THREE.Vector3; fov: number }): boolean;
  /** live object/instance counts (streaming tests, debug) */
  stats?(): Record<string, number>;
  dispose(): void;
}

/** main-thread time per frame for streamed scenery builds (World.update → SceneryView.pump) */
export const SCENERY_BUDGET_MS = 3;

export interface SceneryDefinition {
  readonly id: string;
  build(ctx: SceneryContext): SceneryView;
}

const sceneries = new Map<string, SceneryDefinition>();

export function registerScenery(d: SceneryDefinition): SceneryDefinition {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(d.id)) throw new Error(`scenery id "${d.id}" must be lowercase [a-z0-9-]`);
  const prev = sceneries.get(d.id);
  if (prev && prev !== d) throw new Error(`scenery "${d.id}" is already registered`);
  sceneries.set(d.id, d);
  return d;
}

export function hasScenery(id: string): boolean {
  return sceneries.has(id);
}

export function getScenery(id: string): SceneryDefinition {
  const d = sceneries.get(id);
  if (!d) throw new Error(`unknown scenery "${id}"`);
  return d;
}
