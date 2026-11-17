/**
 * A deterministic walk through one Fjord sea squall (PR #11 / Gitar finding r4581847939).
 *
 * The skier is moved straight downhill through the hazard in 0.25 m steps with the physics clock held
 * at the peak of the gust's active phase, and every step's environment sample (side-slip, airborne
 * acceleration, surface drag / friction, knock) and every hazard event is recorded. Only APIs that
 * exist on production `main` are used, so the identical walk can be run against `main`, the first
 * PR #11 commit and the fix, and the physics compared step by step.
 */
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { BiomeEnvironment, type EnvironmentEvent } from '../../src/world/capabilities/environment';
import { makeEnvQuery, makeEnvSample } from '../../src/physics/environment';
import { getHazardKind, hazardPhase, type HazardInstance } from '../../src/world/hazards/hazard';
import type { HazardField } from '../../src/world/hazards/field';
import type { Mountain } from '../../src/world/course';

export interface WalkStep {
  z: number;
  /** distance from the hazard's centre beyond its radius (m): the effect reaches to `reach` */
  over: number;
  slipX: number;
  airX: number;
  drag: number;
  friction: number;
  knock: boolean;
}
export interface WalkEvent {
  type: string;
  id: number;
  z: number;
  hit?: boolean;
  entered?: boolean;
  closest?: number;
  effect?: string;
}
export interface Walk {
  seed: string;
  hazard: { id: number; x: number; z: number; r: number; reach: number; gate: boolean };
  t: number;
  x: number;
  grounded: boolean;
  tuck: number;
  steps: WalkStep[];
  events: WalkEvent[];
}

type GustParams = { gate?: { x: number; z: number; r: number } };
const fieldOf = (env: BiomeEnvironment) => (env as unknown as { hazards: HazardField }).hazards;

/** the first sea squall on the course (gate or plain) with no other wind hazard reaching its walk line */
export function findGust(m: Mountain, ws: number, gate: boolean): HazardInstance<GustParams> | null {
  const env = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
  const f = fieldOf(env);
  f.ensure(0, Math.min(m.finishZ, 3000));
  const all = f.peek(0, Math.min(m.finishZ, 3000));
  for (const h of all) {
    if (h.kind !== 'sea-gust' || !!(h.params as GustParams).gate !== gate) continue;
    if (h.z < 150) continue;
    const k = getHazardKind(h.kind);
    // no other hazard's effect reaches the walk line (x fixed, z from 10 m before to 8 m past this one)
    const G = (h.params as GustParams).gate;
    const x = G ? G.x - 0.8 * G.r : h.x;
    const z0 = h.z - h.r - 10;
    const z1 = h.z + h.r + k.reach + 8;
    const alone = all.every((o) => {
      // scoured rock acts on the surface only (no wind, slip or knock), identically in every implementation
      if (o === h || getHazardKind(o.kind).severity === 'cosmetic' || o.kind === 'scoured-rock') return true;
      const dz = o.z < z0 ? z0 - o.z : o.z > z1 ? o.z - z1 : 0;
      return Math.hypot(o.x - x, dz) > o.r + getHazardKind(o.kind).reach + 2;
    });
    if (alone) return h as HazardInstance<GustParams>;
  }
  return null;
}

/** a physics time at the peak of the hazard's active phase */
export function peakTime(h: HazardInstance): number {
  const k = getHazardKind(h.kind);
  for (let t = 20; t < 400; t += 0.01) {
    const ph = hazardPhase(k, h, t);
    if (ph.phase === 'active' && Math.abs(ph.u - 0.41) < 0.01) return Math.round(t * 100) / 100;
  }
  throw new Error('no active phase');
}

export function walk(seed: string, gate: boolean, grounded: boolean, tuck: number): Walk {
  const c = makeCourse('custom', 'sprint', { biome: 'fjord', customText: seed, difficulty: 'normal' });
  const ws = worldSeed(c);
  const m = buildMountain(c);
  const h = findGust(m, ws, gate);
  if (!h) throw new Error(`no isolated ${gate ? 'gate' : 'plain'} sea squall on ${seed}`);
  const k = getHazardKind(h.kind);
  const t = peakTime(h);
  // through the notch of a wind gate (its sea side), or straight through the middle of a plain squall
  const G = h.params.gate;
  const x = G ? G.x - 0.8 * G.r : h.x;
  const env = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
  const events: WalkEvent[] = [];
  let zNow = 0;
  env.listen((e: EnvironmentEvent) => {
    if (!('hazard' in e) || e.hazard.id !== h.id) return;
    const ev: WalkEvent = { type: e.type, id: e.hazard.id, z: zNow };
    if (e.type === 'hazard-passed') Object.assign(ev, { hit: e.hit, entered: e.entered, closest: Math.round(e.closest * 1000) / 1000 });
    if (e.type === 'hazard-hit') ev.effect = e.effect;
    events.push(ev);
  });
  const q = makeEnvQuery();
  const out = makeEnvSample();
  const steps: WalkStep[] = [];
  const z0 = h.z - h.r - 10;
  const z1 = h.z + h.r + k.reach + 8;
  for (let z = z0; z <= z1 + 1e-9; z += 0.25) {
    zNow = z;
    q.x = x;
    q.z = z;
    q.y = m.heightAt(x, z) + (grounded ? 0 : 1.5);
    q.vx = 0;
    q.vz = 18;
    q.vy = 0;
    q.speed = 18;
    q.grounded = grounded;
    q.crashed = false;
    q.surface = 'snow';
    q.t = t;
    q.tuck = tuck;
    env.sample(q, out);
    const d = Math.hypot(x - h.x, z - h.z);
    steps.push({
      z: Math.round(z * 100) / 100,
      over: Math.round((d - h.r) * 1000) / 1000,
      slipX: out.groundSlipX,
      airX: out.airAccelX,
      drag: out.surface.dragAdd,
      friction: out.surface.friction,
      knock: !!out.knock,
    });
  }
  return { seed, hazard: { id: h.id, x: h.x, z: h.z, r: h.r, reach: k.reach, gate: !!G }, t, x, grounded, tuck, steps, events };
}

/** the walks compared across implementations */
export const WALKS = [
  { name: 'plain-grounded', gate: false, grounded: true, tuck: 0 },
  { name: 'plain-airborne', gate: false, grounded: false, tuck: 0 },
  { name: 'gate-grounded-braced', gate: true, grounded: true, tuck: 0 },
  { name: 'gate-grounded-tucked', gate: true, grounded: true, tuck: 1 },
  { name: 'gate-airborne', gate: true, grounded: false, tuck: 0 },
] as const;
export const WALK_SEED = 'HP-GUST-0';
