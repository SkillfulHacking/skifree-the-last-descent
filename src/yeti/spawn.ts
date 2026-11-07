import * as THREE from 'three';
import type { Mountain } from '../world/course';
import { caveMouthXZ, type CaveAnchor } from '../world/caveTerrain';

/**
 * Where the Yeti stands at the end of the cave cinematic (on the ledge in the cave mouth),
 * and the leap that carries it down onto the slope when the chase begins.
 */
export function yetiSpawnAfterCinematic(m: Mountain, anchor: CaveAnchor = m.caves[0]!, ledge?: THREE.Vector3): { pos: THREE.Vector3; heading: number; leap: THREE.Vector3 } {
  const c = caveMouthXZ(anchor);
  // the cave's own ledge point when known (the cinematic ends there), else just outside the mouth
  const x = ledge ? ledge.x : c.x - 3 * anchor.side;
  const z = ledge ? ledge.z : c.z + 1;
  const pos = new THREE.Vector3(x, ledge ? ledge.y : m.heightAt(x, z), z);
  // leap toward the piste, slightly downhill
  const tx = m.centerX(anchor.z + 14) + 18 * anchor.side;
  const tz = anchor.z + 14;
  const heading = Math.atan2(tx - x, tz - z);
  const dist = Math.hypot(tx - x, tz - z);
  const flight = 1.0;
  const leap = new THREE.Vector3(((tx - x) / dist) * (dist / flight), 6.5, ((tz - z) / dist) * (dist / flight));
  return { pos, heading, leap };
}
