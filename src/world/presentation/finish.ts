/**
 * Finish environments: what is at the bottom of the mountain and how the victory plays out.
 *
 * A FinishDefinition (registered by id, selected by `capabilities.finish.id`) provides:
 *  - `build`: the scene (a FinishEnvironment: group, trophy, stop points, colliders, update);
 *  - `victory`: the victory-cinematic script (camera shots + timed beats on the director's
 *    Timeline, the Yeti's exit, the trophy/celebration). VictoryCinematic (EndCinematics.ts) is a
 *    thin shell that GameSession drives; the script does the location-specific work.
 *
 * Alpine's "alpine-resort" (the Resort + its original victory) is registered in ./alpine.ts.
 */
import type * as THREE from 'three';
import type { QualityPreset } from '../../core/types';
import type { Mountain } from '../course';
import type { Biome } from '../biome';
import type { Timeline } from '../../cinematic/Timeline';
import type { Stage } from '../../game/Stage';

export interface CircleCollider {
  x: number;
  z: number;
  r: number;
}

export interface FinishState {
  /** 0..1 crowd excitement */
  cheer: number;
  /** what guests look at (the skier), or null */
  lookAt: THREE.Vector3 | null;
  /** 0..1 welcome gesture */
  welcome: number;
}

/** The finish scene. Everything is in world coordinates. */
export interface FinishEnvironment {
  readonly group: THREE.Group;
  /** the trophy object (World returns it to its home between runs) */
  readonly trophy: THREE.Object3D;
  readonly finishZ: number;
  update(dt: number, time: number, state: FinishState): void;
  /** where the skier comes to a stop after crossing the line */
  getStopPoint(target: THREE.Vector3): THREE.Vector3;
  /** where the Yeti halts at the edge of safety */
  getYetiStopPoint(target: THREE.Vector3): THREE.Vector3;
  /** top of the trophy podium */
  getPodiumTop(target: THREE.Vector3): THREE.Vector3;
  /** the heart of the celebration (Alpine: the hot tub) — camera framing target */
  getCelebrationFocus(target: THREE.Vector3): THREE.Vector3;
  /** solid footprints (buildings, posts) the skier collides with */
  colliders(): CircleCollider[];
  dispose(): void;
}

export interface FinishBuildContext {
  quality: QualityPreset;
  mountain: Mountain;
  biome: Biome;
  /** centre of the finish line on the snow */
  finishCenter: THREE.Vector3;
  heightAt: (x: number, z: number) => number;
}

/** What a victory script can drive on the VictoryCinematic shell. */
export interface VictoryDirector {
  readonly tl: Timeline;
  /** where the skier is auto-steered to (from finish.getStopPoint) */
  readonly stopPoint: THREE.Vector3;
  /** 0..1 how much the game auto-steers the skier to the stop point */
  autopilot: number;
  /** crowd / welcome levels fed back to FinishEnvironment.update */
  cheer: number;
  welcome: number;
  /** show the results screen (call once, at the end of the script) */
  results(): void;
}

export interface VictoryScript {
  /** per frame, after the timeline advanced */
  update(dt: number): void;
}

export interface FinishDefinition {
  readonly id: string;
  readonly label: string;
  /** what the intro calls the goal ("Reach the <goal>, N km down the mountain"); default "resort" */
  readonly goal?: string;
  build(ctx: FinishBuildContext): FinishEnvironment;
  /** the victory cinematic + trophy/celebration for this finish */
  victory(st: Stage, finish: FinishEnvironment, d: VictoryDirector): VictoryScript;
}

const finishes = new Map<string, FinishDefinition>();

export function registerFinish(d: FinishDefinition): FinishDefinition {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(d.id)) throw new Error(`finish id "${d.id}" must be lowercase [a-z0-9-]`);
  const prev = finishes.get(d.id);
  if (prev && prev !== d) throw new Error(`finish "${d.id}" is already registered`);
  finishes.set(d.id, d);
  return d;
}

export function hasFinish(id: string): boolean {
  return finishes.has(id);
}

export function getFinish(id: string): FinishDefinition {
  const d = finishes.get(id);
  if (!d) throw new Error(`unknown finish environment "${id}"`);
  return d;
}

export function listFinishes(): FinishDefinition[] {
  return [...finishes.values()];
}
