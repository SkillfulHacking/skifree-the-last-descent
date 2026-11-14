/**
 * Cave presentation: location-specific dressing around the shared Yeti cave.
 *
 * The cave GEOMETRY CONTRACT is fixed and shared by every biome: the terrain cut
 * (caveTerrain.ts), the rock shell / floor / clearance bake in Cave.ts, and the anchor points the
 * Yeti and cinematics use (mouth, inside, lipTop, deepStart, ledge, exitPath, floorHeightAt,
 * clearanceAt). Yeti grounding and the cave cinematic depend on it, so a presentation must not
 * move or reshape it. What a presentation MAY do is add its own group of props/materials around
 * it (ice curtains, steam, basalt columns, rescue tape…), which World creates with the cave and
 * disposes with it (caves are streamed per encounter).
 *
 * Alpine: "alpine-cave" (no extra dressing: the original StoryProps), registered in ./alpine.ts.
 */
import { frameBudget } from '../../core/frameBudget';
import type * as THREE from 'three';
import type { QualityPreset } from '../../core/types';
import type { Mountain } from '../course';
import type { CaveAnchor } from '../caveTerrain';
import type { Biome } from '../biome';
import type { Cave } from '../Cave';
import type { Timeline } from '../../cinematic/Timeline';
import type { Stage } from '../../game/Stage';

export interface CaveDressing {
  readonly group: THREE.Object3D;
  /** per frame while the cave exists (optional animation: steam, flicker) */
  update?(dt: number, time: number): void;
  dispose(): void;
}

export interface CaveDressingContext {
  mountain: Mountain;
  anchor: CaveAnchor;
  /** the built cave (read its anchor points; never modify its geometry) */
  cave: Cave;
  quality: QualityPreset;
  biome: Biome;
}

/** What a location's cave-cinematic hook gets: the stage, the cave, the shared timeline. */
export interface CaveCinematicContext {
  st: Stage;
  cave: Cave;
  /** the shared encounter's timeline: add beats with `at`, override shots by adding later ones */
  tl: Timeline;
  /** a point offset from the mouth (along the cave's outward direction, up, +z), as the shared shots use */
  at(ox: number, oy: number, oz: number): THREE.Vector3;
}

/** Extra, location-specific beats layered on the shared cave cinematic (owned and disposed by it). */
export interface CaveCinematicExtras {
  update?(dt: number, t: number): void;
  dispose(): void;
}

export interface CavePresentation {
  readonly id: string;
  /** extra props/materials around the cave; omit (or return null) for none */
  dress?(ctx: CaveDressingContext): CaveDressing | null;
  /**
   * Optional time-sliced form of `dress` (round 3, D2): a generator that builds the same dressing
   * and `yield`s between pieces of work (after each column cluster, the hull, each canvas texture…).
   * World steps it one slice per frame after the cave's own slices, so no single frame pays for the
   * whole dressing. Preferred over `dress` when present; when it is not, World still calls `dress`
   * in a frame of its own (never in the frame that finishes the cave). Run to completion it must
   * return exactly what `dress` returns. Use `dressingTicker(ms)` to yield on a time budget.
   */
  dressSteps?(ctx: CaveDressingContext): Generator<void, CaveDressing | null, void>;
  /**
   * Optional location beats for the cave cinematic (spray, birds, shot overrides). Called once when
   * the cinematic starts; omit for none (Alpine), which leaves the shared encounter unchanged.
   */
  cinematic?(ctx: CaveCinematicContext): CaveCinematicExtras | null;
}

const caves = new Map<string, CavePresentation>();

export function registerCavePresentation(d: CavePresentation): CavePresentation {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(d.id)) throw new Error(`cave presentation id "${d.id}" must be lowercase [a-z0-9-]`);
  const prev = caves.get(d.id);
  if (prev && prev !== d) throw new Error(`cave presentation "${d.id}" is already registered`);
  caves.set(d.id, d);
  return d;
}

export function hasCavePresentation(id: string): boolean {
  return caves.has(id);
}

export function getCavePresentation(id: string): CavePresentation {
  const d = caves.get(id);
  if (!d) throw new Error(`unknown cave presentation "${id}"`);
  return d;
}

/**
 * Time budget helper for `dressSteps` generators: `if (tick.over()) yield;` after each piece of
 * work yields once `ms` of main-thread time has passed since the last yield (or the start).
 */
export function dressingTicker(ms: number): { over(): boolean } {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let t0 = now();
  return {
    over() {
      const t = now();
      // (round 4) also once the frame's shared streaming budget is spent
      if (t - t0 < ms && t < frameBudget.deadline) return false;
      t0 = t;
      return true;
    },
  };
}
