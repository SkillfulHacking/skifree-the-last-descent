/**
 * Headless whole-run simulation (physics + Yeti AI + phase rules) used by tests and tuning.
 * Mirrors the rules in GameSession without any rendering.
 */
import * as THREE from 'three';
import { COURSE, Mountain, SEED_DEFAULT, routeX } from '../world/course';
import { generateObstacles, type ObstacleField } from '../physics/obstacles';
import { PHYS_DT, SkierPhysics, type SkierInput, type SkierState } from '../physics/SkierPhysics';
import { YetiAI } from '../yeti/YetiAI';
import { yetiSpawnAfterCinematic } from '../yeti/spawn';

export interface SimResult {
  outcome: 'victory' | 'caught' | 'timeout';
  time: number;
  chaseTime: number;
  minGap: number;
  crashes: number;
  maxSpeed: number;
  avgChaseSpeed: number;
  finalGap: number;
  maxGap: number;
}

let cached: { seed: number; m: Mountain; f: ObstacleField } | null = null;
export function worldFor(seed = SEED_DEFAULT) {
  if (!cached || cached.seed !== seed) {
    const m = new Mountain(seed);
    cached = { seed, m, f: generateObstacles(m, seed) };
  }
  return cached;
}

export function simulateRun(driver: (s: SkierState, t: number) => SkierInput, seed = SEED_DEFAULT, maxTime = 400, log: string[] | null = null, crashAtChase: number[] = []): SimResult {
  const { m, f } = worldFor(seed);
  const phys = new SkierPhysics(m, f);
  phys.reset(routeX(0), 0, 0, 0);
  const yeti = new YetiAI(m, f);
  let t = 0;
  let chaseStart = -1;
  let minGap = Infinity;
  let maxGap = 0;
  let chaseDist = 0;
  const target = { pos: phys.s.pos, vel: phys.s.vel, airborne: false };
  while (t < maxTime) {
    const s = phys.s;
    phys.step(driver(s, t), PHYS_DT);
    for (const e of phys.drainEvents()) if (e.type === 'crash' && log) log.push(`${t.toFixed(1)}s z=${s.pos.z.toFixed(0)} ${e.reason}`);
    t += PHYS_DT;
    if (chaseStart < 0 && s.pos.z >= COURSE.caveTriggerZ) {
      // cinematic happens here (simulation frozen) — then the yeti leaps out of the cave
      const sp = yetiSpawnAfterCinematic(m);
      yeti.place(sp.pos.x, sp.pos.z, sp.heading, sp.pos.y - m.heightAt(sp.pos.x, sp.pos.z));
      yeti.startChase(new THREE.Vector3(sp.leap.x, sp.leap.y, sp.leap.z));
      chaseStart = t;
    }
    if (chaseStart >= 0) {
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
        if (t - chaseStart > 5) maxGap = Math.max(maxGap, yeti.distance);
      }
      if (yeti.canCatch(target)) {
        return { outcome: 'caught', time: t, chaseTime: t - chaseStart, minGap, crashes: s.crashes, maxSpeed: s.maxSpeed, avgChaseSpeed: chaseDist / (t - chaseStart), finalGap: 0, maxGap };
      }
    }
    if (s.pos.z >= COURSE.finishZ) {
      return { outcome: 'victory', time: t, chaseTime: t - chaseStart, minGap, crashes: s.crashes, maxSpeed: s.maxSpeed, avgChaseSpeed: chaseDist / (t - chaseStart), finalGap: yeti.distance, maxGap };
    }
  }
  return { outcome: 'timeout', time: t, chaseTime: chaseStart < 0 ? 0 : t - chaseStart, minGap, crashes: phys.s.crashes, maxSpeed: phys.s.maxSpeed, avgChaseSpeed: 0, finalGap: yeti.distance, maxGap };
}
