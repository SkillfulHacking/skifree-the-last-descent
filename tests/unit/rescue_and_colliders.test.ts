/**
 * Pass 5 (reviewers B and E, round 9): regression tests for the pinned-skier rescue and the
 * world-added colliders.
 * - The rescue must never move a skier who chose to stop, turn, brake or skate uphill / away from the
 *   piste: only one skating back toward the piste and getting nowhere (SkierPhysics.pinWatchdog).
 * - The sea cave's boulders respond as rock (sound and crash message), can be jumped, and are solid
 *   only once their scan is on screen (none when the scans never load, as in Node).
 */
import '../support/domStub';
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { NO_INPUT, PHYS_DT, SkierPhysics, type ExtraCollider } from '../../src/physics/SkierPhysics';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { dressSeaCave } from '../../src/world/biomes/fjord/views/seaCave';
import { Cave } from '../../src/world/Cave';

type Ev = { type: string; kind?: string; reason?: string };

function sim(biome: 'alpine' | 'fjord') {
  const c = makeCourse('classic', 'standard', { biome });
  const m = buildMountain(c);
  return { m, env: new BiomeEnvironment(m, worldSeed(c)) };
}

/** off-piste spots on open snow along the course: both sides, 12–24 m out */
function spots(m: ReturnType<typeof buildMountain>) {
  const out: Array<{ x: number; z: number }> = [];
  for (let z = 400; z < Math.min(m.finishZ - 200, 6000); z += 450)
    for (const off of [-24, -16, 14, 22]) {
      const x = m.routeX(z) + off;
      // skip the sea and anything far below the piste (a cliff edge)
      if (m.heightAt(x, z) < m.heightAt(m.routeX(z), z) - 8) continue;
      out.push({ x, z });
    }
  return out;
}

describe('pinned-skier rescue: no false positives', () => {
  for (const biome of ['alpine', 'fjord'] as const)
    it(`${biome}: standing, turning, braking or skating uphill off the piste is never relocated`, () => {
      const { m, env } = sim(biome);
      const pts = spots(m);
      expect(pts.length).toBeGreaterThan(20);
      const behaviours: Array<{ name: string; input: (t: number) => typeof NO_INPUT; heading: number }> = [
        { name: 'stand still', input: () => ({ ...NO_INPUT }), heading: 0 },
        { name: 'hold a steer key', input: () => ({ ...NO_INPUT, steer: 1 }), heading: 0 },
        { name: 'brake + steer', input: () => ({ ...NO_INPUT, brake: 1, steer: -1 }), heading: 0 },
        { name: 'skate straight uphill', input: () => ({ ...NO_INPUT, tuck: 1 }), heading: Math.PI },
        { name: 'skate up and across, away from the piste', input: () => ({ ...NO_INPUT, tuck: 1 }), heading: NaN },
      ];
      const moved: string[] = [];
      for (const p0 of pts)
        for (const b of behaviours) {
          const p = new SkierPhysics(m, null, () => [], env);
          // away from the piste, uphill: heading points back up the course and out to the side
          const away = Math.sign(p0.x - m.routeX(p0.z)) || 1;
          const heading = Number.isNaN(b.heading) ? Math.PI - away * 0.9 : b.heading;
          p.reset(p0.x, p0.z, heading, 0);
          const evs: Ev[] = [];
          for (let i = 0; i < 10 / PHYS_DT; i++) {
            p.step({ ...b.input(i * PHYS_DT), recover: p.s.crashTime > 1.4 });
            evs.push(...(p.drainEvents() as Ev[]));
          }
          if (evs.some((e) => e.type === 'relocate' && e.reason === 'pinned against the rock')) moved.push(`${b.name} at (${p0.x.toFixed(0)}, ${p0.z})`);
        }
      expect(moved).toEqual([]);
    });
});

describe('world-added colliders', () => {
  const { m } = sim('fjord');
  const boulder: ExtraCollider = { x: m.routeX(1200) + 3, z: 1200, r: 1.6, kind: 'boulder', y: m.heightAt(m.routeX(1200) + 3, 1200), height: 1.4 };

  it('a cave boulder is a rock: rock-heavy impact and "hit a boulder" at speed', () => {
    const p = new SkierPhysics(m, null, () => [boulder], undefined);
    p.reset(boulder.x, boulder.z - 14, 0, 16);
    const evs: Ev[] = [];
    for (let i = 0; i < 2 / PHYS_DT && !p.s.crashed; i++) {
      p.step({ ...NO_INPUT });
      evs.push(...(p.drainEvents() as Ev[]));
    }
    expect(p.s.crashed).toBe(true);
    expect(evs.some((e) => e.type === 'impact' && e.kind === 'rock-heavy')).toBe(true);
    expect(evs.some((e) => e.type === 'impact' && (e.kind === 'tree-heavy' || e.kind === 'branch'))).toBe(false);
    expect(evs.some((e) => e.type === 'crash' && e.reason === 'hit a boulder')).toBe(true);
  });

  it('a skier in the air above its top clears it', () => {
    const p = new SkierPhysics(m, null, () => [boulder], undefined);
    p.reset(boulder.x, boulder.z - 0.5, 0, 12);
    p.s.pos.y = boulder.y! + boulder.height! + 0.6;
    p.s.grounded = false;
    p.s.vel.y = 2;
    const evs: Ev[] = [];
    for (let i = 0; i < 6; i++) {
      p.step({ ...NO_INPUT });
      evs.push(...(p.drainEvents() as Ev[]));
    }
    expect(evs.filter((e) => e.type === 'impact')).toEqual([]);
  });

  it('a sea cave adds no collider for a boulder that is not on screen (scans not loaded)', () => {
    const e = m.profile.encounters(-Infinity, m.finishZ)[0]!;
    const cave = new Cave(m, e.anchor, 'high');
    const d = dressSeaCave({ cave, mountain: m, anchor: e.anchor, quality: 'high', biome: m.biome } as never);
    // in Node the scans never load (no fetch of local files): the dressing has boulder picks but
    // must not expose a single invisible collider
    expect(d.colliders?.() ?? []).toEqual([]);
    d.dispose();
  });
});
