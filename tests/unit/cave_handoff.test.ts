/**
 * Round 3 (owner's report): watching the cave cinematic or skipping it at any moment starts the
 * chase from the same state — position, heading, velocity, airborne flight, start delay and slow-start
 * state — and the pursuit then follows the same trajectory for the same skier input. Checked for
 * every location, slow and fast arrivals, a retry after a finished encounter and each encounter of an
 * Endless course.
 *
 * The check is run on the game's hand-off and, to prove it catches the bug, on the pre-round-3
 * hand-off (tests/support/legacyCaveHandoff.ts), which it must reject.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed, type LengthMode } from '../../src/game/CourseConfig';
import { ObstacleField } from '../../src/physics/obstacles';
import { SkierPhysics, PHYS_DT, type SkierInput } from '../../src/physics/SkierPhysics';
import { YetiAI } from '../../src/yeti/YetiAI';
import { yetiSpawnAfterCinematic } from '../../src/yeti/spawn';
import { CAVE_LEAP_AT, startCanonicalChase, type CaveSpawn } from '../../src/cinematic/caveHandoff';
import { cinematicLeapAt, legacyHandoffYeti, LEGACY_CINEMATIC_END } from '../support/legacyCaveHandoff';
import { autopilotInput } from '../../src/debug/autopilot';
import type { BiomeId } from '../../src/world/biome';
import type { Mountain } from '../../src/world/course';

/** a hand-off: start the chase when the player leaves the cinematic at `leftAt` s (Infinity = watched to the end) */
type Handoff = (ai: YetiAI, sp: CaveSpawn, leftAt: number, h: (x: number, z: number) => number) => void;
const GAME: Handoff = (ai, sp, _leftAt, h) => startCanonicalChase(ai, sp, h);
const LEGACY: Handoff = (ai, sp, leftAt, h) => {
  const { leap, pos } = cinematicLeapAt(sp, Math.min(leftAt, LEGACY_CINEMATIC_END), h);
  legacyHandoffYeti(ai, leap, pos, sp, h);
};

/** the moments a player can leave: watched, skipped before the leap event fired, and (old cinematic) during and after the leap */
const LEFT_AT = [Infinity, 1.0, 6.0, 9.0, CAVE_LEAP_AT - 0.05, CAVE_LEAP_AT + 0.4, CAVE_LEAP_AT + 1.2, CAVE_LEAP_AT + 2.5];

interface Snap {
  t: number;
  yeti: number[];
  skier: number[];
}

/**
 * The chase after one hand-off: the skier frozen as the cinematic left them (at `arrive` m/s on the
 * line just past the trigger), then `seconds` of identical input; the state every 0.5 s.
 */
function chase(m: Mountain, f: ObstacleField, enc: number, arrive: number, handoff: Handoff, leftAt: number, seconds = 10): Snap[] {
  const e = m.profile.encounters(0, 1e6)[enc]!;
  const h = (x: number, z: number) => m.heightAt(x, z);
  const phys = new SkierPhysics(m, f);
  const z0 = e.triggerZ + 1;
  phys.reset(m.routeX(z0), z0, 0, arrive);
  const ai = new YetiAI(m, f);
  const sp = yetiSpawnAfterCinematic(m, e.anchor);
  handoff(ai, sp, leftAt, h);
  const out: Snap[] = [];
  const s = phys.s;
  const snap = (t: number) => out.push({ t, yeti: [ai.pos.x, ai.pos.y, ai.pos.z, ai.vel.x, ai.vel.z, ai.vy, ai.speed, ai.delay, ai.airborne ? 1 : 0, ai.heading], skier: [s.pos.x, s.pos.z, s.speed] });
  snap(0);
  let t = 0;
  for (let i = 1; t < seconds; i++) {
    const inp: SkierInput = autopilotInput(m, s, 'skilled', t);
    phys.step(inp, PHYS_DT);
    phys.drainEvents();
    t += PHYS_DT;
    ai.update(PHYS_DT, { pos: s.pos, vel: s.vel, airborne: !s.grounded, down: s.crashed || s.recoverTime > 0 });
    if (i % 30 === 0) snap(t);
  }
  return out;
}

/** every left-at moment gives the watched chase: same start state, same trajectories (frame-stepping tolerance) */
function equivalent(handoff: Handoff, biome: BiomeId, len: LengthMode, enc: number, arrive: number): { ok: boolean; worst: number } {
  const c = makeCourse('classic', len, { biome, difficulty: 'normal' });
  const m = buildMountain(c);
  const f = new ObstacleField(m, worldSeed(c));
  const ref = chase(m, f, enc, arrive, handoff, Infinity);
  let worst = 0;
  for (const at of LEFT_AT.slice(1)) {
    const got = chase(m, f, enc, arrive, handoff, at);
    for (let i = 0; i < ref.length; i++) {
      const d = Math.max(...ref[i]!.yeti.map((v, k) => Math.abs(v - got[i]!.yeti[k]!)), ...ref[i]!.skier.map((v, k) => Math.abs(v - got[i]!.skier[k]!)));
      worst = Math.max(worst, d);
    }
  }
  return { ok: worst <= 1e-6, worst };
}

describe('cave cinematic hand-off: watched = skipped at any moment', () => {
  for (const biome of ['alpine', 'fjord', 'whiteout'] as BiomeId[])
    for (const arrive of [4, 22]) {
      it(`${biome}, ${arrive < 10 ? 'slow' : 'fast'} arrival (${arrive} m/s): same start and the same pursuit for 10 s`, () => {
        const r = equivalent(GAME, biome, 'sprint', 0, arrive);
        expect(r.worst).toBeLessThanOrEqual(1e-6);
      });
    }

  it('the canonical start: on the spawn point, leaping, the usual start delay; the slow-start rules then apply', () => {
    const c = makeCourse('classic', 'sprint', { biome: 'alpine', difficulty: 'normal' });
    const m = buildMountain(c);
    const f = new ObstacleField(m, worldSeed(c));
    const e = m.profile.encounters(0, 1e6)[0]!;
    const sp = yetiSpawnAfterCinematic(m, e.anchor);
    const ai = new YetiAI(m, f);
    startCanonicalChase(ai, sp, (x, z) => m.heightAt(x, z));
    expect(ai.phase).toBe('chase');
    expect(ai.airborne).toBe(true);
    expect([ai.pos.x, ai.pos.z]).toEqual([sp.pos.x, sp.pos.z]);
    expect(ai.pos.y).toBeCloseTo(sp.pos.y, 6);
    expect([ai.vel.x, ai.vy, ai.vel.z]).toEqual([sp.leap.x, sp.leap.y, sp.leap.z]);
    expect(ai.delay).toBe(0.6);
    // slow start (a skier stopped at the cave): the first update adds the roar, as before
    ai.update(PHYS_DT, { pos: new THREE.Vector3(m.routeX(e.triggerZ), m.heightAt(m.routeX(e.triggerZ), e.triggerZ), e.triggerZ), vel: new THREE.Vector3(), airborne: false });
    expect(ai.startSkierSpeed).toBe(0);
    expect(ai.extraDelay).toBeGreaterThan(1.5);
  });

  it('a retry after a finished encounter starts the same chase again (no state carried over)', () => {
    const c = makeCourse('classic', 'sprint', { biome: 'whiteout', difficulty: 'normal' });
    const m = buildMountain(c);
    const f = new ObstacleField(m, worldSeed(c));
    const first = chase(m, f, 0, 18, GAME, Infinity, 6);
    // the same AI instance, after a chase that ran (as a retry reuses the session's Yeti)
    const e = m.profile.encounters(0, 1e6)[0]!;
    const ai = new YetiAI(m, f);
    const sp = yetiSpawnAfterCinematic(m, e.anchor);
    startCanonicalChase(ai, sp, (x, z) => m.heightAt(x, z));
    for (let i = 0; i < 400; i++) ai.update(PHYS_DT, { pos: new THREE.Vector3(0, 0, e.triggerZ + 60), vel: new THREE.Vector3(0, 0, 15), airborne: false });
    ai.standDown();
    startCanonicalChase(ai, sp, (x, z) => m.heightAt(x, z));
    expect([ai.pos.x, ai.pos.z, ai.vel.x, ai.vy, ai.vel.z, ai.speed, ai.delay, ai.airborne ? 1 : 0]).toEqual([first[0]!.yeti[0], first[0]!.yeti[2], first[0]!.yeti[3], first[0]!.yeti[5], first[0]!.yeti[4], first[0]!.yeti[6], first[0]!.yeti[7], first[0]!.yeti[8]]);
    expect(ai.chaseTime).toBe(0);
    expect(Number.isNaN(ai.startSkierSpeed)).toBe(true);
  });

  it('every encounter of an Endless course hands off the same way (encounters 1–3)', () => {
    for (const enc of [1, 2, 3]) expect(equivalent(GAME, 'alpine', 'endless', enc, 18).ok).toBe(true);
  });

  it('the check catches the pre-round-3 hand-off (watched vs skipped differed by tens of metres)', () => {
    const r = equivalent(LEGACY, 'alpine', 'sprint', 0, 18);
    expect(r.ok).toBe(false);
    expect(r.worst).toBeGreaterThan(20);
  });
});

