import * as THREE from 'three';
import { COURSE, Mountain, caveMouthXZ, centerX } from '../world/course';

/**
 * Where the Yeti stands at the end of the cave cinematic (on the ledge in the cave mouth),
 * and the leap that carries it down onto the slope when the chase begins.
 */
export function yetiSpawnAfterCinematic(m: Mountain): { pos: THREE.Vector3; heading: number; leap: THREE.Vector3 } {
  const c = caveMouthXZ();
  const x = c.x - 3;
  const z = c.z + 1;
  const pos = new THREE.Vector3(x, m.heightAt(x, z), z);
  // leap toward the piste, slightly downhill
  const tx = centerX(COURSE.caveZ + 14) + 18;
  const tz = COURSE.caveZ + 14;
  const heading = Math.atan2(tx - x, tz - z);
  const dist = Math.hypot(tx - x, tz - z);
  const flight = 1.0;
  const leap = new THREE.Vector3(((tx - x) / dist) * (dist / flight), 6.5, ((tz - z) / dist) * (dist / flight));
  return { pos, heading, leap };
}
