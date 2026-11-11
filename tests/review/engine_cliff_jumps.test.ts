// Engine-cliff evidence probe (run: npx vitest run --config tests/review/vitest.config.ts tests/review/engine_cliff_jumps.test.ts --disableConsoleIntercept)
// Legit-jump fingerprint (before/after): synthetic kicker, real course kickers (roll + pop), roller pops, flat pops,
// cliff-band drops.
import { it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { Mountain } from '../../src/world/course';
import { NO_INPUT, PHYS_DT, SkierPhysics, type SkierInput } from '../../src/physics/SkierPhysics';
import type { Kicker, CliffBand } from '../../src/world/profile';
import { clamp, wrapAngle } from '../../src/core/rng';
class SynthKicker extends Mountain {
  constructor(private lip: number) { super(1); }
  override heightAt(_x: number, z: number) { const base = -0.3 * z; const u = z - this.lip; if (u > -10 && u <= 0) return base + 1.6 * ((u + 10) / 10) ** 2; if (u > 0 && u < 3) return base + 1.6 * (1 - u / 3); return base; }
  override surfaceWeights() { return { ice: 0, powder: 0, groomed: 1 }; }
}
type J = { air: number; dist: number; land: string; vyMax: number };
function jumpOf(p: SkierPhysics, steps: number, inp: (i: number) => SkierInput): J[] {
  const out: J[] = []; let x0 = 0, z0 = 0, vy = 0;
  for (let i = 0; i < steps; i++) {
    p.step(inp(i)); vy = Math.max(vy, p.s.vel.y);
    for (const e of p.drainEvents()) {
      if (e.type === 'takeoff') { x0 = p.s.pos.x; z0 = p.s.pos.z; vy = p.s.vel.y; }
      if (e.type === 'land') out.push({ air: +e.airTime.toFixed(4), dist: +Math.hypot(p.s.pos.x - x0, p.s.pos.z - z0).toFixed(3), land: e.hard ? 'hard' : e.clean ? 'clean' : 'ok', vyMax: +vy.toFixed(3) });
      if (e.type === 'crash') out.push({ air: -1, dist: 0, land: 'crash:' + e.reason, vyMax: +vy.toFixed(3) });
    }
  }
  return out;
}
it('jumps', () => {
  const res: Record<string, unknown> = {};
  // synthetic kicker (tests/unit/physics.test.ts geometry)
  for (const v of [8, 12, 16, 20, 25, 30]) {
    const p = new SkierPhysics(new SynthKicker(20), null); p.reset(0, 0, 0, v);
    res[`synth v${v}`] = jumpOf(p, 4 / PHYS_DT, () => NO_INPUT);
  }
  // real kickers and cliffs on Alpine generated courses
  for (const seed of ['EC1', 'EC2', 'EC3', 'EC4']) for (const len of ['sprint', 'standard'] as const) {
    const m = buildMountain(makeCourse('custom', len, { customText: seed }));
    const ks: Kicker[] = []; m.profile.kickersNear(0, m.finishZ, ks);
    for (const k of ks.slice(0, 6)) for (const v of [10, 16, 22, 28]) for (const pop of [false, true]) {
      const z0 = k.z - Math.max(k.run, 12) - 6; const x0 = m.centerX(z0) + k.d;
      const p = new SkierPhysics(m, null); p.reset(x0, z0, 0, v); let popped = false;
      res[`${seed}/${len} kicker@${k.z.toFixed(0)} v${v} pop${+pop}`] = jumpOf(p, 3.5 / PHYS_DT, () => {
        const s = p.s; const want = Math.atan2(m.centerX(s.pos.z + 10) + k.d - s.pos.x, 10); const err = wrapAngle(want - s.heading);
        const i: SkierInput = { ...NO_INPUT, steer: clamp(-err * 3, -1, 1), tuck: 1 };
        if (pop && !popped && s.grounded) { if (k.z - s.pos.z > 0.6) i.pop = true; else popped = true; }
        return i;
      });
    }
    const cs: CliffBand[] = []; m.profile.cliffsNear(0, m.finishZ, cs);
    for (const c of cs.slice(0, 4)) for (const v of [10, 20, 28]) {
      const z0 = c.z - 60; const dd = (c.dMin + c.dMax) / 2; const x0 = m.centerX(z0) + dd;
      const p = new SkierPhysics(m, null); p.reset(x0, z0, 0, v);
      res[`${seed}/${len} cliff@${c.z.toFixed(0)} v${v}`] = jumpOf(p, 5 / PHYS_DT, () => { const s = p.s; const err = wrapAngle(Math.atan2(m.centerX(s.pos.z + 10) + dd - s.pos.x, 10) - s.heading); return { ...NO_INPUT, steer: clamp(-err * 3, -1, 1), tuck: 1, recover: s.crashTime > 1.4 }; });
    }
    // rollers: ride the route through roller zones (skilled-ish line), record every takeoff, with and without pops on crests
    for (const popping of [false, true]) {
      let z = 0; for (; z < m.finishZ; z += 20) if (m.profile.rollerZone(z) > 0.5) break;
      if (z >= m.finishZ) continue;
      const p = new SkierPhysics(m, null); p.reset(m.routeX(z), z, 0, 18); let t = 0;
      res[`${seed}/${len} rollers@${z} pop${+popping}`] = jumpOf(p, 12 / PHYS_DT, () => { t += PHYS_DT; const s = p.s; const err = wrapAngle(Math.atan2(m.routeX(s.pos.z + 15) - s.pos.x, 15) - s.heading); return { ...NO_INPUT, steer: clamp(-err * 3, -1, 1), tuck: 1, pop: popping && Math.sin(t * 3) > 0.6, recover: s.crashTime > 1.4 }; });
    }
  }
  console.log('JUMPS ' + JSON.stringify(res));
});
