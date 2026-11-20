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

/**
 * The cinematic's last beats (s), owner's decision 1 (W-076): the Yeti takes his place on the ledge at
 * CAVE_GATHER_AT (a cut), the camera holds on him, then from CAVE_TURN_AT swings around the skier to
 * the follow camera's own forward view; at CAVE_LEAP_AT the cinematic ends, control returns facing
 * downhill and he leaps — the chase's first second, behind the player (rear-view inset, sound, the
 * landing's thud and shake).
 */
export const CAVE_GATHER_AT = 14.2;
export const CAVE_TURN_AT = 14.7;
/**
 * (W-076 review C, C1) the leap set-up shot (14.2–14.7 s), over the skier's shoulder: the camera `back` m
 * behind the skier on the line from the cave and `lift` m above the reaction shot's height, aimed along
 * the angular blend (`toSkier` of the way) between the directions to the Yeti (1.6 m up) and to the
 * skier's head, at `fov`° — both inside the letterbox (a positional blend aimed almost at the Yeti and
 * left the skier under the bar)
 */
export const LEAP_SETUP = { back: 6, lift: 0.3, toSkier: 0.5, fov: 40 } as const;
/** where the set-up shot looks from `cam` (the angular blend; see LEAP_SETUP) */
export function leapSetupLook(cam: THREE.Vector3, yeti: THREE.Vector3, skierHead: THREE.Vector3): THREE.Vector3 {
  const a = yeti.clone().sub(cam).normalize();
  const b = skierHead.clone().sub(cam).normalize();
  return cam.clone().add(a.multiplyScalar(1 - LEAP_SETUP.toSkier).addScaledVector(b, LEAP_SETUP.toSkier).normalize().multiplyScalar(20));
}
/** the leap beat: the cinematic ends here and the chase begins */
export const CAVE_LEAP_AT = 15.8;

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
