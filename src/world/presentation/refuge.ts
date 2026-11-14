/**
 * Refuge presentation: the building at each refuge / checkpoint (Endless lodges and the safe
 * stops after each chase on long courses). Selected by `capabilities.refuge.id`.
 * Alpine: "ski-patrol-cabin" (the original Checkpoint), registered in ./alpine.ts.
 *
 * The refuge *logic* (where refuges are, when one is reached) stays in the course profile and
 * RunState; only what it looks like is pluggable.
 */
import type * as THREE from 'three';
import type { QualityPreset } from '../../core/types';
import type { Mountain } from '../course';
import type { Biome } from '../biome';

export interface RefugeView {
  readonly group: THREE.Group;
  /** gate centre on the route (the line the skier crosses) */
  readonly gate: THREE.Vector3;
  dispose(): void;
}

export interface RefugeBuildContext {
  mountain: Mountain;
  /** refuge position along the course */
  z: number;
  /** encounter index the refuge follows (0 for the first) */
  index: number;
  quality: QualityPreset;
  biome: Biome;
}

export interface RefugeDefinition {
  readonly id: string;
  build(ctx: RefugeBuildContext): RefugeView;
  /**
   * Optional time-sliced build (round 3, D6): a generator that yields between pieces of work and
   * returns the same view as `build`. World steps it one slice per frame while the refuge is still
   * far ahead (refuges stream in 1.6 km early) and builds it at once when loading.
   */
  buildSteps?(ctx: RefugeBuildContext): Generator<void, RefugeView, void>;
}

const refuges = new Map<string, RefugeDefinition>();

export function registerRefuge(d: RefugeDefinition): RefugeDefinition {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(d.id)) throw new Error(`refuge id "${d.id}" must be lowercase [a-z0-9-]`);
  const prev = refuges.get(d.id);
  if (prev && prev !== d) throw new Error(`refuge "${d.id}" is already registered`);
  refuges.set(d.id, d);
  return d;
}

export function hasRefuge(id: string): boolean {
  return refuges.has(id);
}

export function getRefuge(id: string): RefugeDefinition {
  const d = refuges.get(id);
  if (!d) throw new Error(`unknown refuge presentation "${id}"`);
  return d;
}
