/**
 * Headless whole-run simulation (physics + Yeti AI + phase rules) used by tests and tuning.
 * Mirrors the rules in GameSession without any rendering. Works for any course: classic,
 * generated finite lengths, and Endless (bounded by `maxZ`).
 */
import * as THREE from 'three';
import { Mountain, SEED_DEFAULT, type Encounter } from '../world/course';
import { ObstacleField, generateObstacles } from '../physics/obstacles';
import { PHYS_DT, SkierPhysics, type SkierInput, type SkierState } from '../physics/SkierPhysics';
import { YetiAI } from '../yeti/YetiAI';
import { yetiSpawnAfterCinematic } from '../yeti/spawn';

export interface SimResult {
  outcome: 'victory' | 'caught' | 'timeout' | 'distance';
  time: number;
  chaseTime: number;
  minGap: number;
  crashes: number;
  maxSpeed: number;
  avgChaseSpeed: number;
  finalGap: number;
  maxGap: number;
  /** distance travelled down the course */
  distance: number;
  encountersSurvived: number;
  /** peak number of obstacle bands resident at once (streaming check) */
  peakBands: number;
}

let cached: { seed: number; m: Mountain; f: ObstacleField } | null = null;
/** Classic world for a seed (cached; fully generated obstacles). */
export function worldFor(seed = SEED_DEFAULT) {
  if (!cached || cached.seed !== seed) {
    const m = new Mountain(seed);
    cached = { seed, m, f: generateObstacles(m, seed) };
  }
  return cached;
}

export interface SimOptions {
  maxTime?: number;
  log?: string[] | null;
  crashAtChase?: number[];
  /** Endless/long runs: stop once this z is reached (outcome 'distance') */
  maxZ?: number;
  /** stream obstacles in a window instead of using a pre-generated field */
  streaming?: boolean;
  /** difficulty scale on the Yeti's speed (1 = normal) */
  yetiSpeed?: number;
}

export function simulateCourse(m: Mountain, f: ObstacleField, driver: (s: SkierState, t: number) => SkierInput, opts: SimOptions = {}): SimResult {
  const maxTime = opts.maxTime ?? 400;
  const log = opts.log ?? null;
  const crashAtChase = opts.crashAtChase ?? [];
  const maxZ = opts.maxZ ?? Infinity;
  const finishZ = m.finishZ;
  const phys = new SkierPhysics(m, f);
  phys.reset(m.routeX(0), 0, 0, 0);
  const yeti = new YetiAI(m, f);
  let t = 0;
  let chaseStart = -1;
  let firstChase = -1;
  let chaseAccum = 0;
  let minGap = Infinity;
  let maxGap = 0;
  let chaseDist = 0;
  let survived = 0;
  let peakBands = 0;
  let active: Encounter | null = null;
  const done = new Set<number>();
  const target = { pos: phys.s.pos, vel: phys.s.vel, airborne: false };
  let nextEncCheck = -Infinity;
  let upcoming: Encounter[] = [];
  const result = (outcome: SimResult['outcome'], finalGap: number): SimResult => {
    const ct = chaseAccum + (chaseStart >= 0 ? t - chaseStart : 0);
    return {
      outcome,
      time: t,
      chaseTime: ct,
      minGap,
      crashes: phys.s.crashes,
      maxSpeed: phys.s.maxSpeed,
      avgChaseSpeed: ct > 0 ? chaseDist / ct : 0,
      finalGap,
      maxGap,
      distance: phys.s.pos.z,
      encountersSurvived: survived,
      peakBands,
    };
  };
  while (t < maxTime) {
    const s = phys.s;
    if (opts.streaming) {
      f.ensure(s.pos.z - 300, s.pos.z + 700);
      f.release(s.pos.z - 400, s.pos.z + 800);
      peakBands = Math.max(peakBands, f.bandCount);
    }
    phys.step(driver(s, t), PHYS_DT);
    for (const e of phys.drainEvents()) if (e.type === 'crash' && log) log.push(`${t.toFixed(1)}s z=${s.pos.z.toFixed(0)} ${e.reason}`);
    t += PHYS_DT;
    if (s.pos.z > nextEncCheck) {
      upcoming = m.profile.encounters(s.pos.z - 50, s.pos.z + 400);
      nextEncCheck = s.pos.z + 200;
    }
    if (!active) {
      for (const e of upcoming) {
        if (done.has(e.index) || s.pos.z < e.triggerZ || s.pos.z > e.chaseEndZ) continue;
        // cinematic happens here (simulation frozen) — then the yeti leaps out of the cave
        const sp = yetiSpawnAfterCinematic(m, e.anchor);
        yeti.speedMul = e.speedMul * (opts.yetiSpeed ?? 1);
        yeti.place(sp.pos.x, sp.pos.z, sp.heading, sp.pos.y - m.heightAt(sp.pos.x, sp.pos.z));
        yeti.startChase(new THREE.Vector3(sp.leap.x, sp.leap.y, sp.leap.z));
        chaseStart = t;
        if (firstChase < 0) firstChase = t;
        active = e;
        if (log) log.push(`${t.toFixed(1)}s encounter ${e.index} at z=${e.caveZ.toFixed(0)} (x${e.speedMul.toFixed(2)})`);
        break;
      }
    }
    if (active) {
      const ct = t - chaseStart;
      for (let i = 0; i < crashAtChase.length; i++) {
        if (crashAtChase[i]! >= 0 && ct >= crashAtChase[i]!) {
          crashAtChase[i] = -1;
          phys.forceCrash('injected');
        }
      }
      target.airborne = !s.grounded;
      yeti.update(PHYS_DT, target);
      chaseDist += s.speed * PHYS_DT;
      if (yeti.phase === 'chase' && !yeti.airborne) {
        minGap = Math.min(minGap, yeti.distance);
        if (ct > 5) maxGap = Math.max(maxGap, yeti.distance);
      }
      if (yeti.canCatch(target)) return result('caught', 0);
      if (active.checkpointZ !== null && s.pos.z >= active.chaseEndZ) {
        // Endless: reached the lodge — the Yeti gives up until the next cave
        survived++;
        done.add(active.index);
        chaseAccum += t - chaseStart;
        chaseStart = -1;
        yeti.standDown();
        active = null;
      }
    }
    if (s.pos.z >= finishZ) {
      if (active) survived++;
      return result('victory', yeti.distance);
    }
    if (s.pos.z >= maxZ) return result('distance', yeti.distance);
  }
  return result('timeout', yeti.distance);
}

/** Classic-course run (back-compatible signature). */
export function simulateRun(driver: (s: SkierState, t: number) => SkierInput, seed = SEED_DEFAULT, maxTime = 400, log: string[] | null = null, crashAtChase: number[] = []): SimResult {
  const { m, f } = worldFor(seed);
  return simulateCourse(m, f, driver, { maxTime, log, crashAtChase });
}

/** Generated course run (streams obstacles; any length or Endless with maxZ). */
export function simulateGenerated(seed: number, length: number, driver: (m: Mountain) => (s: SkierState, t: number) => SkierInput, opts: SimOptions = {}): SimResult {
  const m = Mountain.generated(seed, length);
  const f = new ObstacleField(m, seed);
  return simulateCourse(m, f, driver(m), { streaming: true, ...opts });
}
