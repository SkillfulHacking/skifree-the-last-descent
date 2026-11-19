/**
 * The cave encounter's hand-off to the chase (pure: no rendering). Used by CaveCinematic (watched or
 * skipped), the headless simulation (simulate.ts) and the tests.
 *
 * Round 3 (owner's report: skipping the cinematic gave a far bigger head start than watching it).
 * Measured before the fix (tests/sim/skipHandoff.measure.test.ts, balance/skip-handoff/): watched to
 * the end, the Yeti had already leapt, landed and run on, and the chase began 6–11 m from the skier
 * at a 9 m/s run; skipped before the leap, it began from the ledge 40–61 m away, the leap still to
 * come. Skipping mid-leap or after the landing gave anything in between.
 *
 * Now there is one start, the generous one the skip gave (the start every balance simulation has
 * always used): the Yeti on the ledge, his leap toward the piste beginning on the first controllable
 * frame, then the AI's usual start delay (YETI.startDelay, counted from the landing) and slow-start
 * rules, untouched. The cinematic ends at the leap beat (CAVE_LEAP_AT), so watching it hands over
 * exactly this state; skipping at any moment removes only the presentation.
 */
import * as THREE from 'three';
import type { YetiAI } from '../yeti/YetiAI';

/** the leap beat (s into the cave cinematic): the cinematic ends here and the chase begins */
export const CAVE_LEAP_AT = 14.6;

/** the spawn the chase leaps from (yeti/spawn.ts yetiSpawnAfterCinematic) */
export interface CaveSpawn {
  pos: THREE.Vector3;
  heading: number;
  leap: THREE.Vector3;
}

/** Start the chase from the canonical state: on the spawn point, leaping. */
export function startCanonicalChase(ai: YetiAI, spawn: CaveSpawn, heightAt: (x: number, z: number) => number): void {
  ai.place(spawn.pos.x, spawn.pos.z, spawn.heading, spawn.pos.y - heightAt(spawn.pos.x, spawn.pos.z));
  ai.vel.set(0, 0, 0);
  ai.speed = 0;
  ai.startChase(new THREE.Vector3(spawn.leap.x, spawn.leap.y, spawn.leap.z));
}
