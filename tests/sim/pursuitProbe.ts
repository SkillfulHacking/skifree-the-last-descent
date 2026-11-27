/** Round 6: hold the Yeti at a fixed gap behind a skier and read his settled speed (pursuit characterisation). */
import * as THREE from 'three';
import { ObstacleField } from '../../src/physics/obstacles';
import { YetiAI } from '../../src/yeti/YetiAI';
import type { Mountain } from '../../src/world/course';

/** settled speed (m/s) of a Yeti held `gap` m behind a skier gliding at `vs` m/s, at course z `z` */
export function settledSpeed(m: Mountain, f: ObstacleField | null, z: number, gap: number, vs = 16, speedMul = 1): number {
  const y = new YetiAI(m, f);
  y.speedMul = speedMul;
  y.place(m.routeX(z), z, 0);
  y.startChase(null);
  const target = { pos: new THREE.Vector3(), vel: new THREE.Vector3(0, 0, vs), airborne: false };
  for (let i = 0; i < 60 * 12; i++) {
    const x = m.routeX(z);
    y.pos.set(x, m.heightAt(x, z), z);
    y.heading = 0;
    target.pos.set(x, m.heightAt(x, z + gap), z + gap);
    y.update(1 / 60, target);
  }
  return y.speed;
}

/** a z where the course slope is within 0.5° of `deg` (searching downhill from 400 m), or NaN */
export function zAtSlope(m: Mountain, deg: number, from = 400, to = 2800): number {
  for (let z = from; z < to; z += 5) if (Math.abs(m.slopeDeg(z) - deg) < 0.5) return z;
  return NaN;
}

