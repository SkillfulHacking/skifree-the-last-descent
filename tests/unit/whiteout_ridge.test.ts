/**
 * Whiteout Ridge, full production: the ridge terrain, its corniced rim and rim guard, and the
 * storm wall's timing. Pure (no three.js rendering).
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, DIFFICULTY, makeCourse, worldSeed, type Difficulty, type LengthMode } from '../../src/game/CourseConfig';
import { BiomeEnvironment, RIDGE_GUARD } from '../../src/world/capabilities/environment';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import { corniceSamples, wandSpots } from '../../src/world/biomes/whiteout/views/cornice';
import { ridgeRockPlacements } from '../../src/world/biomes/whiteout/views/ridgeRocks';
import { stormWall, SKY } from '../../src/world/biomes/whiteout/views/sky';
import { frontAt } from '../../src/world/biomes/whiteout/storm';
import { SkierPhysics, NO_INPUT } from '../../src/physics/SkierPhysics';

const course = (len: LengthMode, seed: string, difficulty: Difficulty = 'normal') => makeCourse('custom', len, { biome: 'whiteout', customText: seed, difficulty });

describe('Whiteout ridge terrain', () => {
  it('falls away on the drop side beyond the rim and rises to a crest on the other side; the rim is clear of the piste and every line', () => {
    for (const seed of ['R1', 'R2', 'R3']) {
      const m = buildMountain(course('standard', seed));
      const R = m.biome.terrain.ridge!;
      expect(R).toBeTruthy();
      for (let z = 120; z < m.finishZ - 200; z += 37) {
        const cx = m.profile.centerX(z);
        const w = m.profile.halfWidth(z);
        const rim = m.ridgeRimX(z);
        // the rim stands outside the piste edge, and well clear of the line (which swings ≤ 0.3·w)
        expect((rim - cx) * R.dropSide).toBeGreaterThanOrEqual(w + R.rim - 1e-6);
        expect((rim - m.routeX(z)) * R.dropSide).toBeGreaterThan(0.69 * w + R.rim);
        const h0 = m.heightAt(cx, z);
        // 400 m beyond the rim the ground is far below the piste (the valley)
        expect(m.heightAt(rim + R.dropSide * 400, z)).toBeLessThan(h0 - 150);
      }
    }
  });

  it('the cornice sits on the snow (never floating), is never on the piste, and breaks off in places', () => {
    const m = buildMountain(course('standard', 'R4'));
    const S = corniceSamples(m, 0, 4000);
    expect(S.length).toBeGreaterThan(500);
    let broken = 0;
    for (const s of S) {
      expect(Math.abs(s.y - m.heightAt(s.x, s.z))).toBeLessThan(1e-6);
      expect(Math.abs(s.x - m.routeX(s.z))).toBeGreaterThan(m.profile.halfWidth(s.z));
      if (s.k < 0.05) broken++;
    }
    expect(broken).toBeGreaterThan(10);
    expect(broken).toBeLessThan(S.length * 0.6);
    // the rim wands stand inside the rim, on the snow
    for (const w of wandSpots(m, 0, 4000)) expect(Math.abs(w.y - m.heightAt(w.x, w.z))).toBeLessThan(1e-6);
  });
});

describe('Whiteout ridge rock', () => {
  it('every block is bedded below the snow under its footprint and none stands on the piste or a line', () => {
    for (const seed of ['K1', 'K2']) {
      const m = buildMountain(course('standard', seed));
      const pls = ridgeRockPlacements(m, 0, 6000);
      const fam = { tor: 0, rim: 0, flank: 0 };
      for (const p of pls) {
        fam[p.family]++;
        // bedded: the base is below the terrain at the centre by ≥ 25 % of the block's height
        expect(p.y).toBeLessThanOrEqual(m.heightAt(p.x, p.z) - 0.25 * p.sy + 1e-6);
        // off the piste (beyond its edge by more than the block's half size)
        expect(Math.abs(p.x - m.profile.centerX(p.z))).toBeGreaterThan(m.profile.halfWidth(p.z) + 0.3 * Math.max(p.sx, p.sz));
        // rim blocks stand past the rim (the rim guard's ground), never inside it
        if (p.family === 'rim') expect(m.beyondRidgeRim(p.x, p.z)).toBeGreaterThan(0);
      }
      expect(fam.tor).toBeGreaterThan(20);
      expect(fam.flank).toBeGreaterThan(5);
    }
  });
});

describe('Whiteout ridge: the rim guard', () => {
  it('a skier who heads over the rim is put back on the piste, never left on the flank (where the bank is too high to climb, they never get there)', () => {
    const c = course('sprint', 'G1');
    const ws = worldSeed(c);
    const m = buildMountain(c);
    const R = m.biome.terrain.ridge!;
    let returned = 0;
    for (const z0 of [500, 800, 1100, 1500, 1800, 2300]) {
      const env = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
      const p = new SkierPhysics(m, null, () => [], env);
      const x0 = m.routeX(z0);
      p.reset(x0, z0, Math.atan2(R.dropSide * 9, 6), 11);
      let relocated = false;
      for (let i = 0; i < 120 * 30 && !relocated; i++) {
        p.step({ ...NO_INPUT, steer: 0, tuck: 1 }, 1 / 120);
        for (const e of p.drainEvents()) if (e.type === 'relocate') relocated = true;
        // never far past the rim without being returned
        expect(m.beyondRidgeRim(p.s.pos.x, p.s.pos.z)).toBeLessThan(RIDGE_GUARD.over + 25);
      }
      if (relocated) {
        returned++;
        expect(Math.abs(p.s.pos.x - m.routeX(p.s.pos.z))).toBeLessThan(1);
      } else expect(m.beyondRidgeRim(p.s.pos.x, p.s.pos.z)).toBeLessThan(0);
    }
    expect(returned).toBeGreaterThanOrEqual(2);
  });

  it('autopilot runs never go over the rim (the rim is off every line)', () => {
    for (const seed of ['G2', 'G3', 'G4']) {
      const c = course('sprint', seed);
      const ws = worldSeed(c);
      const m = buildMountain(c);
      const log: string[] = [];
      simulateCourse(m, new ObstacleField(m, ws), (s, t) => autopilotInput(m, s, 'skilled', t), {
        streaming: true,
        environment: new BiomeEnvironment(m, ws, { difficulty: 'normal' }),
        yetiSpeed: DIFFICULTY.normal.yetiSpeed,
        maxTime: 600,
        log,
      });
      expect(log.filter((l) => l.includes('cornice')), seed).toEqual([]);
    }
  }, 600_000);
});

describe('Whiteout sky: the storm wall telegraphs every front', () => {
  it('stands on the windward horizon ≥ 20 s before each build, closes in, and is gone in the storm', () => {
    for (const seed of [3, 17, 4242]) {
      let lastBuild = -1;
      for (let t = 0; t < 900; t += 0.5) {
        const f = frontAt(t, seed);
        if (f.phase === 'build' && f.k !== lastBuild) {
          lastBuild = f.k;
          // 20 s earlier (or as early as the clear window allows: a squall hard on the last one) the
          // wall was already visible, further out than now
          let w0 = t - 0.5;
          while (w0 > t - 20 && frontAt(w0 - 0.5, seed).phase === 'clear') w0 -= 0.5;
          const early = stormWall(Math.max(w0, t - 20), seed);
          const now = stormWall(t, seed);
          expect(early.vis, `seed ${seed} t ${t}`).toBeGreaterThan(t - w0 >= 12 ? 0.5 : 0.15);
          expect(early.dist).toBeGreaterThan(now.dist);
          expect(now.dist).toBeLessThanOrEqual(SKY.wallFar * 0.16 + 1);
        }
        if (f.phase === 'storm') expect(stormWall(t, seed).vis).toBe(0);
      }
      expect(lastBuild).toBeGreaterThanOrEqual(3);
    }
  });
});
