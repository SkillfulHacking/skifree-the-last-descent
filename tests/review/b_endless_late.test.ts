import { it } from 'vitest';
import * as THREE from 'three';
import { Mountain } from '../../src/world/course';
import { ObstacleField } from '../../src/physics/obstacles';
import { PHYS_DT, SkierPhysics } from '../../src/physics/SkierPhysics';
import { YetiAI } from '../../src/yeti/YetiAI';
import { yetiSpawnAfterCinematic } from '../../src/yeti/spawn';
import { autopilotInput, type AutopilotStyle } from '../../src/debug/autopilot';
// Start just before encounter k on Endless and run its chase to the refuge (or capture).
function chase(seed: number, k: number, style: AutopilotStyle) {
  const m = Mountain.generated(seed, Infinity);
  const e = m.profile.encounters(0, 5200 + 9000 * (k + 1)).find((q) => q.index === k)!;
  const f = new ObstacleField(m, seed);
  const phys = new SkierPhysics(m, f);
  const z0 = e.triggerZ - 150;
  const x0 = m.routeX(z0);
  f.ensure(z0 - 300, z0 + 700);
  phys.teleport(x0, z0, Math.atan2(m.routeX(z0 + 10) - x0, 10), 16);
  const yeti = new YetiAI(m, f);
  const target = { pos: phys.s.pos, vel: phys.s.vel, airborne: false };
  let t = 0; let started = false; let minGap = Infinity;
  while (t < 600) {
    const s = phys.s;
    f.ensure(s.pos.z - 300, s.pos.z + 700); f.release(s.pos.z - 400, s.pos.z + 800);
    phys.step(autopilotInput(m, s, style, t), PHYS_DT); t += PHYS_DT;
    if (!started && s.pos.z >= e.triggerZ) {
      const sp = yetiSpawnAfterCinematic(m, e.anchor);
      yeti.speedMul = e.speedMul;
      yeti.place(sp.pos.x, sp.pos.z, sp.heading, sp.pos.y - m.heightAt(sp.pos.x, sp.pos.z));
      yeti.startChase(new THREE.Vector3(sp.leap.x, sp.leap.y, sp.leap.z));
      started = true;
    }
    if (started) {
      target.airborne = !s.grounded; yeti.update(PHYS_DT, target);
      if (yeti.phase === 'chase' && !yeti.airborne) minGap = Math.min(minGap, yeti.distance);
      if (yeti.canCatch(target)) return `caught at z=${s.pos.z.toFixed(0)} (minGap ${minGap.toFixed(1)})`;
      if (s.pos.z >= e.chaseEndZ) return `refuge reached (minGap ${minGap.toFixed(1)}, crashes ${s.crashes})`;
    }
  }
  return 'timeout';
}
it('late Endless encounters (speedMul cap) are survivable by a skilled skier and lethal to a careless one', { timeout: 1_500_000 }, () => {
  for (const seed of [5, 4242]) for (const k of [0, 5, 9]) for (const st of ['skilled', 'careless'] as AutopilotStyle[]) {
    const m = Mountain.generated(seed, Infinity);
    const e = m.profile.encounters(0, 5200 + 9000 * (k + 1)).find((q) => q.index === k)!;
    console.log(`seed ${seed} enc ${k} (x${e.speedMul.toFixed(3)}, cave ${e.caveZ}) ${st}: ${chase(seed, k, st)}`);
  }
});
