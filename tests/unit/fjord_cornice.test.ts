/**
 * Fjord cornice: never a trap. Reviewer B (round 3) defect 1: the round-3 "firmer" cornice (friction
 * ×10, drag +0.12) stopped skiers short of the 1.5 m relocation line and the skate push could not beat
 * it, so a skier who stopped there (87 of 5,600 charged-pop approaches) could only get out by jumping.
 *
 * Now the cornice snow only resists travel toward the sea (and along the rim); inland travel meets
 * ordinary snow. And a skier who lingers slow in the cornice band is put back on the piste
 * ('stuck in the cornice', the out-of-bounds recovery's sibling) after CORNICE_STALL.time.
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import type { Mountain } from '../../src/world/course';
import { NO_INPUT, PHYS_DT, SkierPhysics, type SkierInput } from '../../src/physics/SkierPhysics';
import { BiomeEnvironment, CORNICE_STALL, RIM_GUARD } from '../../src/world/capabilities/environment';
import { CORNICE, FJORD_SURFACE, corniceHeading } from '../../src/world/biomes/fjord/biome';
import { IDENTITY_SURFACE, type SurfaceModifiers, type SurfaceQuery } from '../../src/world/capabilities/surface';
import { clamp, wrapAngle } from '../../src/core/rng';

const mtn = (seed: string) => buildMountain(makeCourse('custom', 'standard', { biome: 'fjord', customText: seed }));
/** one environment per course, shared by every probe on it (SkierPhysics.reset resets it) */
const envs = new Map<Mountain, BiomeEnvironment>();
const envOf = (m: Mountain, seed: string) => {
  let e = envs.get(m);
  if (!e) envs.set(m, (e = new BiomeEnvironment(m, worldSeed(makeCourse('custom', 'standard', { biome: 'fjord', customText: seed })))));
  return e;
};

describe('the cornice resists only travel toward the sea', () => {
  it('heading weight: full toward the sea, a fifth along the rim, none inland; at rest / position-only full', () => {
    expect(corniceHeading(0, -10, 0)).toBe(1); // straight at the sea (−X)
    expect(corniceHeading(0, -8, 6)).toBe(1); // 53° toward the sea
    expect(corniceHeading(0, 0, 10)).toBeGreaterThan(0.15); // along the rim
    expect(corniceHeading(0, 0, 10)).toBeLessThan(0.25);
    expect(corniceHeading(0, 10, 0)).toBe(0); // straight inland
    expect(corniceHeading(0, 2.5, 9.68)).toBe(0); // 15° inland of parallel
    expect(corniceHeading(0, 0, 0)).toBe(1);
    expect(corniceHeading(0, undefined, undefined)).toBe(1);
    // the rim's own direction counts: where it bends, "toward the sea" bends with it
    expect(corniceHeading(1, 0, 10)).toBeCloseTo(corniceHeading(0, -Math.SQRT1_2, Math.SQRT1_2), 6);
    expect(corniceHeading(-1, 0, 10)).toBe(0);
  });

  it('surface numbers at full guard: ×10 friction and +0.12 drag seaward, ordinary snow inland', () => {
    const m = mtn('CN1');
    const c = m.coast!;
    const z = 3000;
    const x = c.rimX(z) + 3; // 3 m inside the crest: full guard
    expect(c.guard(x, z)).toBe(1);
    const q = (vx?: number, vz?: number): SurfaceQuery => ({ biomeId: 'fjord', x, z, kind: 'snow', weights: () => m.surfaceWeights(x, z), mountain: m, vx, vz });
    const out: SurfaceModifiers = { ...IDENTITY_SURFACE };
    FJORD_SURFACE.modifiers(q(-5, 2), out);
    expect(out.friction).toBeCloseTo(CORNICE.friction, 6);
    expect(out.dragAdd).toBeCloseTo(CORNICE.dragAdd, 6);
    FJORD_SURFACE.modifiers(q(5, 1), out);
    expect(out.friction).toBe(1);
    expect(out.dragAdd).toBe(0);
    FJORD_SURFACE.modifiers(q(), out); // position-only queries keep the full cornice
    expect(out.friction).toBeCloseTo(CORNICE.friction, 6);
  });
});

/** escape policies a player might try after stopping in the cornice */
const POLICIES = ['idle', 'skate inland', 'skate straight inland', 'tuck downhill', 'dither'] as const;
type Policy = (typeof POLICIES)[number];
function policyInput(pol: Policy, heading: number, t: number, crashTime: number): SkierInput {
  const want = pol === 'skate inland' ? 0.9 : pol === 'skate straight inland' ? Math.PI / 2 : pol === 'tuck downhill' ? 0 : pol === 'dither' ? Math.sin(t * 2) * 1.2 : null;
  if (want === null) return { ...NO_INPUT, recover: crashTime > 1.4 };
  return { ...NO_INPUT, steer: clamp(-wrapAngle(want - heading) * 3, -1, 1), tuck: 1, recover: crashTime > 1.4 };
}

describe('no skier is ever trapped in the cornice', () => {
  it('stopped anywhere in the band, any heading, any escape attempt: out or back on the piste within seconds (5,600 seeded starts)', { timeout: 300_000 }, () => {
    let n = 0;
    let own = 0;
    let put = 0;
    let worstT = 0;
    const idleT: number[] = [];
    const ownByPol: Record<string, number> = {};
    for (const seed of ['CN1', 'CN2', 'CN3', 'CN4']) {
      const m = mtn(seed);
      const c = m.coast!;
      for (const z0 of [900, 3100, 5600, 8100]) {
        for (const b0 of [-16, -11, -6, -3, -1, 0.5, 1.4]) {
          for (let hk = 0; hk < 5; hk++) {
            for (const v0 of [0, 1.5]) {
              for (const pol of POLICIES) {
                const heading = -Math.PI + (hk * 2 * Math.PI) / 5 + 0.3;
                const p = new SkierPhysics(m, null, () => [], envOf(m, seed));
                p.reset(c.rimX(z0) - b0, z0, heading, v0);
                let t = 0;
                let out: 'own' | 'put' | null = null;
                const x0 = p.s.pos.x;
                const zs = p.s.pos.z;
                while (t < 12 && !out) {
                  const s = p.s;
                  p.step(policyInput(pol, s.heading, t, s.crashTime));
                  t += PHYS_DT;
                  for (const e of p.drainEvents()) if (e.type === 'relocate') out = 'put';
                  // out of the band, or moving freely (8 m from where they stood, e.g. along the rim)
                  if (!out && (c.beyondRim(s.pos.x, s.pos.z) < -CORNICE_STALL.zone - 1 || Math.hypot(s.pos.x - x0, s.pos.z - zs) > 8)) out = 'own';
                }
                n++;
                expect(out, `${seed} z0 ${z0} b0 ${b0} h ${heading.toFixed(2)} v0 ${v0} ${pol}`).not.toBeNull();
                if (out === 'own') {
                  own++;
                  ownByPol[pol] = (ownByPol[pol] ?? 0) + 1;
                } else put++;
                if (pol === 'idle') idleT.push(t);
                worstT = Math.max(worstT, t);
              }
            }
          }
        }
      }
    }
    expect(n).toBe(5600);
    expect(own + put).toBe(n);
    // an idle skier is put back after the stall time (a slow slide first, at most)
    idleT.sort((a, b) => a - b);
    expect(idleT[Math.floor(idleT.length * 0.5)]!).toBeLessThan(CORNICE_STALL.time + 0.5);
    expect(idleT[Math.floor(idleT.length * 0.95)]!).toBeLessThan(CORNICE_STALL.time + 3);
    // skating inland gets out on its own most of the time (the rest — mostly those who first had to
    // pivot round from facing the sea — are put back first): 60 % here
    expect((ownByPol['skate inland']! + ownByPol['skate straight inland']!) / ((2 * n) / POLICIES.length)).toBeGreaterThan(0.5);
    expect(worstT).toBeLessThan(10);
  });

  it('charged pops and straight runs at the rim, every timing: never past the crest unrecovered, never trapped (seeded set)', { timeout: 300_000 }, () => {
    let over = 0;
    let trapped = 0;
    let runs = 0;
    for (const seed of ['CN1', 'CN2']) {
      const m = mtn(seed);
      const c = m.coast!;
            for (let z0 = 700; z0 < m.finishZ - 600; z0 += 1500) {
        for (const popAt of [2, 0.05, 0.5, 0.95]) {
          for (const v0 of [8, 18, 30, 45]) {
            for (const ang of [0.5, 1.1]) {
              for (const pol of ['idle', 'skate straight inland'] as const) {
                const p = new SkierPhysics(m, null, () => [], envOf(m, seed));
                p.reset(m.routeX(z0) - 4, z0, -ang, v0);
                runs++;
                let popped = popAt > 1;
                let reloc = false;
                let stopped = false;
                let stopT = 0;
                let beyond = 0;
                // 45 s: a skier who first stops late in the run still gets the stall backstop's 3 s plus
                // margin (round 4: wind gates changed some paths so that a stop fell in the last 3 s of a 30 s window)
                for (let i = 0; i < 45 / PHYS_DT && !reloc; i++) {
                  const s = p.s;
                  if (!popped && c.guard(s.pos.x, s.pos.z) > popAt && s.grounded) {
                    popped = true;
                    for (let j = 0; j < 28; j++) p.step({ ...NO_INPUT, pop: true });
                  }
                  if (!stopped && i > 60 && s.grounded && !s.crashed && s.speed < 0.3) {
                    stopped = true;
                    stopT = i * PHYS_DT;
                  }
                  // resolved: back out of the band after stopping (or never stopped near the rim)
                  if (stopped && c.beyondRim(s.pos.x, s.pos.z) < -CORNICE_STALL.zone - 1) break;
                  if (stopped && i * PHYS_DT > stopT + 10) break;
                  const inp = stopped ? policyInput(pol, s.heading, i * PHYS_DT, s.crashTime) : { ...NO_INPUT, steer: clamp(-wrapAngle(-ang - s.heading) * 3, -1, 1), tuck: 1, recover: s.crashTime > 1.4 };
                  p.step(inp);
                  for (const e of p.drainEvents()) if (e.type === 'relocate') reloc = true;
                  // standing past the out-of-bounds line (a step can cross it; the next one relocates)
                  // (a tumbling skier is put back once up, as before)
                  beyond = !reloc && s.grounded && !s.crashed && c.beyondRim(s.pos.x, s.pos.z) > RIM_GUARD.over ? beyond + 1 : 0;
                  if (beyond === 3) over++;
                }
                const b = c.beyondRim(p.s.pos.x, p.s.pos.z);
                // (still skiing slowly seaward when the time ran out is not a stop)
                if (stopped && !reloc && b > -CORNICE_STALL.zone && p.s.speed < CORNICE_STALL.speed) trapped++;
              }
            }
          }
        }
      }
    }
    expect(runs).toBeGreaterThan(400);
    expect(over).toBe(0);
    expect(trapped).toBe(0);
  });

  it('skiing straight at the cliff at full speed is still stopped by the cornice before the crest', () => {
    for (const seed of ['CN1', 'CN3']) {
      const m = mtn(seed);
      const c = m.coast!;
      for (const z0 of [900, 2600, 5200]) {
        for (const v0 of [20, 35, 45]) {
          const p = new SkierPhysics(m, null, () => [], envOf(m, seed));
          p.reset(c.rimX(z0) + 40, z0, -Math.PI / 2, v0);
          let worst = -Infinity;
          let reloc = 0;
          for (let i = 0; i < 6 / PHYS_DT; i++) {
            p.step({ ...NO_INPUT, tuck: 1 });
            for (const e of p.drainEvents()) if (e.type === 'relocate' && e.reason === 'over the cornice') reloc++;
            worst = Math.max(worst, c.beyondRim(p.s.pos.x, p.s.pos.z));
          }
          expect(reloc, `${seed} ${z0} ${v0}`).toBe(0);
          expect(worst, `${seed} ${z0} ${v0}`).toBeLessThan(RIM_GUARD.over);
        }
      }
    }
  });
});
