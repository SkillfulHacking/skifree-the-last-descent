/**
 * Hazard test kit (pure; imported by tests only — nothing in the game imports it, so it is not
 * bundled). Use it to prove a new hazard kind is deterministic, streams cleanly, telegraphs fairly
 * and does what it says. See docs/BIOMES.md, "Testing a hazard".
 *
 * EXAMPLE_PULSE_HAZARD is a tiny periodic kind that exists only to exercise the pipeline in unit
 * tests. It is never registered by the game and no biome uses it.
 */
import { LANE_HALF } from '../../physics/obstacles';
import { makeEnvQuery, makeEnvSample, type EnvSample } from '../../physics/environment';
import type { Mountain } from '../course';
import type { BiomeEnvironment, EnvironmentEvent } from '../capabilities/environment';
import { generateHazardBand, type HazardField } from './field';
import { hazardPhase, type HazardInstance, type HazardKind, type HazardPhase } from './hazard';
import { BAND } from '../../physics/obstacles';

export interface PulseParams {
  /** fraction of speed kept when hit */
  keep: number;
}

/** Test-only kind: a 3 m pad beside the lane that pulses (2 s dormant, 1 s telegraph, 0.8 s active, 0.6 s recovery). */
export const EXAMPLE_PULSE_HAZARD: HazardKind<PulseParams> = {
  id: 'test-pulse',
  label: 'Test pulse pad',
  severity: 'knock',
  timing: { kind: 'periodic', dormant: 2, telegraph: 1, active: 0.8, recovery: 0.6 },
  reach: 0,
  place(ctx) {
    const out = [];
    const n = Math.round(2 * ctx.density);
    for (let i = 0; i < n; i++) {
      const z = ctx.z0 + ctx.rng.range(0.1, 0.9) * (ctx.z1 - ctx.z0);
      const side = ctx.rng.chance(0.5) ? 1 : -1;
      const r = 3;
      const x = ctx.mountain.routeX(z) + side * (LANE_HALF + r + ctx.rng.range(1, 6));
      if (ctx.reserved(x, z, r)) continue;
      out.push({ x, z, r, params: { keep: 0.75 } });
    }
    return out;
  },
  effect(h, ph, c) {
    if (!c.inside) return null;
    if (ph.phase === 'active') return { knock: { keep: h.params.keep, wobble: 0.6 }, visibility: 1.5 };
    if (ph.phase === 'recovery') return { surface: { grip: 0.8 } };
    return null;
  },
  audio: { telegraph: 'test-pulse-warn', hit: 'test-pulse-hit' },
  view: 'test-pulse',
};

/** Every instance a set of kinds places in [z0, z1), band by band (no field, no streaming). */
export function collectPlacements(m: Mountain, seed: number, kinds: readonly HazardKind[], density: number, z0: number, z1: number): HazardInstance[] {
  const out: HazardInstance[] = [];
  for (let b = Math.floor(z0 / BAND); b <= Math.floor((z1 - 1) / BAND); b++) out.push(...generateHazardBand(m, seed, kinds, density, b).filter((h) => h.z >= z0 && h.z < z1));
  return out;
}

/** Count instance creation/disposal as a view layer would see it. */
export function lifecycleCounter(field: HazardField) {
  const c = { created: 0, disposed: 0, live: new Set<number>(), stop: () => {} };
  c.stop = field.onBand((_b, list, added) => {
    for (const h of list) {
      if (added) {
        c.created++;
        c.live.add(h.id);
      } else {
        c.disposed++;
        c.live.delete(h.id);
      }
    }
  });
  return c;
}

/** First time ≥ t0 (s, 0.01 s steps) at which an instance is in `phase`. */
export function timeOfPhase(kind: HazardKind, h: HazardInstance, phase: HazardPhase, t0 = 0, horizon = 120): number {
  for (let t = t0; t < t0 + horizon; t += 0.01) if (hazardPhase(kind, h, t).phase === phase) return t;
  return NaN;
}

/**
 * Sample the environment for a skier at (x, z) at time t (grounded, `speed` m/s downhill).
 * Returns the physics sample and the events emitted during that one sample.
 */
export function probe(env: BiomeEnvironment, x: number, z: number, t: number, speed = 15, grounded = true): { sample: EnvSample; events: EnvironmentEvent[] } {
  const events: EnvironmentEvent[] = [];
  const off = env.listen((e) => events.push(e));
  const q = makeEnvQuery();
  q.x = x;
  q.z = z;
  q.y = env.mountain.heightAt(x, z);
  q.vz = speed;
  q.speed = speed;
  q.grounded = grounded;
  q.surface = env.mountain.surfaceAt(x, z);
  q.t = t;
  const sample = makeEnvSample();
  env.sample(q, sample);
  off();
  return { sample, events };
}
