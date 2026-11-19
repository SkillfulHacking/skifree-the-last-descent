/**
 * TEST SUPPORT — the pre-round-3 cave hand-off, kept only to measure and to prove the regression
 * (tests/sim/skipHandoff.measure.test.ts, tests/unit/cave_handoff.test.ts): the filmed leap replayed
 * to the moment the cinematic was left, then the old state-dependent hand-off. Not used by the game.
 *
 * - `stepCineLeap`: the Yeti's scripted leap from the ledge (a ballistic arc), and the run after the
 *   landing, as the cinematic films it.
 * - `handoffYeti`: the Yeti state the chase starts from when the cinematic ends or is skipped.
 */
import * as THREE from 'three';
import type { YetiAI } from '../../src/yeti/YetiAI';
import type { CaveSpawn } from '../../src/cinematic/caveHandoff';
export type { CaveSpawn };

/** the scripted leap while the cinematic films it */
export interface CineLeap {
  /** seconds since take-off */
  t: number;
  from: THREE.Vector3;
  vel: THREE.Vector3;
  heading: number;
  landed: boolean;
  /** ground speed after the landing (decelerating to a jog) */
  runV: number;
  /** the touchdown frame (it already moved along the flight path) */
  justLanded?: boolean;
}


/**
 * Advance the filmed leap by dt: the flight (p = from + v·t − g·t²/2) until it meets the ground,
 * then a decelerating run along the leap's heading. Writes the Yeti's position into `p`. Returns
 * whether this step was the touchdown.
 */
export function stepCineLeap(L: CineLeap, dt: number, p: THREE.Vector3, heightAt: (x: number, z: number) => number): boolean {
  let touchdown = false;
  if (!L.landed) {
    L.t += dt;
    p.set(L.from.x + L.vel.x * L.t, L.from.y + L.vel.y * L.t - 4.905 * L.t * L.t, L.from.z + L.vel.z * L.t);
    const h = heightAt(p.x, p.z);
    if (L.t > 0.2 && p.y <= h) {
      p.y = h;
      L.landed = true;
      L.runV = Math.hypot(L.vel.x, L.vel.z);
      L.justLanded = true;
      touchdown = true;
    }
  }
  if (L.landed && !L.justLanded) {
    const target = 9;
    L.runV += (target - L.runV) * (1 - Math.exp(-2.5 * dt));
    p.x += Math.sin(L.heading) * L.runV * dt;
    p.z += Math.cos(L.heading) * L.runV * dt;
    p.y = heightAt(p.x, p.z);
  }
  L.justLanded = false;
  return touchdown;
}

/**
 * Start the chase. `leap` / `p`: the filmed leap's state and the Yeti's position when the cinematic
 * ended (null when the leap was never filmed). The ROUND-3 rule is applied by the caller.
 */
export function legacyHandoffYeti(ai: YetiAI, leap: CineLeap | null, p: THREE.Vector3, spawn: CaveSpawn, heightAt: (x: number, z: number) => number): void {
  if (leap?.landed) {
    ai.place(p.x, p.z, leap.heading);
    ai.startChase(null);
    ai.speed = Math.min(leap.runV, 9);
    ai.vel.set(Math.sin(leap.heading) * leap.runV, 0, Math.cos(leap.heading) * leap.runV);
  } else if (leap) {
    ai.pos.copy(p);
    ai.heading = leap.heading;
    ai.startChase(new THREE.Vector3(leap.vel.x, leap.vel.y - 9.81 * leap.t, leap.vel.z));
  } else {
    ai.place(spawn.pos.x, spawn.pos.z, spawn.heading, spawn.pos.y - heightAt(spawn.pos.x, spawn.pos.z));
    ai.startChase(spawn.leap);
  }
}

/** the leap beat (s into the cave cinematic) and the cinematic's end */
export const LEGACY_LEAP_AT = 14.6;
export const LEGACY_CINEMATIC_END = 18.0;

/**
 * The filmed leap's state when the cinematic is left at `t` s (watched to the end or skipped),
 * replayed at 60 fps as CaveCinematic.update films it: null before the leap beat.
 */
export function cinematicLeapAt(spawn: CaveSpawn, t: number, heightAt: (x: number, z: number) => number): { leap: CineLeap | null; pos: THREE.Vector3 } {
  const pos = spawn.pos.clone();
  if (t < LEGACY_LEAP_AT) return { leap: null, pos };
  const leap: CineLeap = { t: 0, from: spawn.pos.clone(), vel: spawn.leap.clone(), heading: spawn.heading, landed: false, runV: 0 };
  const dt = 1 / 60;
  for (let tt = LEGACY_LEAP_AT; tt + dt <= Math.min(t, LEGACY_CINEMATIC_END) + 1e-9; tt += dt) stepCineLeap(leap, dt, pos, heightAt);
  return { leap, pos };
}
