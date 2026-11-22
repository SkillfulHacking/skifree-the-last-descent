/**
 * Whiteout Ridge, full production: the ridge terrain, its corniced rim and rim guard, and the
 * storm wall's timing. Pure (no three.js rendering).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { buildMountain, DIFFICULTY, makeCourse, worldSeed, type Difficulty, type LengthMode } from '../../src/game/CourseConfig';
import { BiomeEnvironment, RIDGE_GUARD } from '../../src/world/capabilities/environment';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import { corniceSamples, wandSpots } from '../../src/world/biomes/whiteout/views/cornice';
import { ridgeRockPlacements, rockBaseRing } from '../../src/world/biomes/whiteout/views/ridgeRocks';
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
      // (off the piste: the piste is centred on centerX — round 2 brought the rim to 10 m beyond its edge,
      // so the racing line, which wanders across the piste, can come closer than a half-width)
      expect(Math.abs(s.x - m.profile.centerX(s.z))).toBeGreaterThan(m.profile.halfWidth(s.z));
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
      const fam = { tor: 0, rim: 0, flank: 0, spire: 0 };
      for (const p of pls) {
        fam[p.family]++;
        // bedded: the base is below the terrain at the centre by ≥ 25 % of the block's height
        expect(p.y).toBeLessThanOrEqual(m.heightAt(p.x, p.z) - 0.25 * p.sy + 1e-6);
        // and no point of its base stands above the snow (no gap underneath on a slope)
        for (const [bx, by, bz] of rockBaseRing(p)) expect(by).toBeLessThanOrEqual(m.heightAt(bx, bz) + 1e-6);
        // it shows: the block is seated on its slope, not buried to a sliver on the uphill side —
        // the top of the block (base + sy along its up axis) stands clear of the snow at the centre
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(...p.q));
        expect(p.y + up.y * p.sy - m.heightAt(p.x + up.x * p.sy, p.z + up.z * p.sy), `${p.family} at ${p.z.toFixed(0)}`).toBeGreaterThan(0.35 * p.sy);
        // off the piste (beyond its edge by more than the block's half size)
        expect(Math.abs(p.x - m.profile.centerX(p.z))).toBeGreaterThan(m.profile.halfWidth(p.z) + 0.3 * Math.max(p.sx, p.sz));
        // rim blocks stand past the rim (the rim guard's ground), never inside it
        if (p.family === 'rim') expect(m.beyondRidgeRim(p.x, p.z)).toBeGreaterThan(0);
        // (W-065) spires stand on the flank past the rim, and their tops rise above the rim's snow
        if (p.family === 'spire') {
          expect(m.beyondRidgeRim(p.x, p.z)).toBeGreaterThan(10);
          const rim = m.ridgeRimX(p.z);
          expect(p.y + up.y * p.sy, `spire top at ${p.z.toFixed(0)}`).toBeGreaterThan(m.heightAt(rim - m.biome.terrain.ridge!.dropSide * 2, p.z) + 3);
        }
      }
      expect(fam.tor).toBeGreaterThan(20);
      expect(fam.flank).toBeGreaterThan(5);
      expect(fam.spire, 'rim spires').toBeGreaterThan(10);
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

describe('Hazard pass reports (W-023, engine-wide)', () => {
  it('each hazard is reported passed at most once per run (Fjord and Whiteout)', async () => {
    const { simulateCourse: sim } = await import('../../src/game/simulate');
    const { autopilotInput: ap } = await import('../../src/debug/autopilot');
    for (const biome of ['fjord', 'whiteout'] as const) {
      const c = makeCourse('custom', 'sprint', { biome, customText: 'HP1', difficulty: 'normal' });
      const ws = worldSeed(c);
      const m = buildMountain(c);
      const env = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
      const seen = new Map<number, number>();
      env.listen((e) => {
        if (e.type === 'hazard-passed') seen.set(e.hazard.id, (seen.get(e.hazard.id) ?? 0) + 1);
      });
      sim(m, new ObstacleField(m, ws), (s, t) => ap(m, s, 'skilled', t), { streaming: true, environment: env, yetiSpeed: DIFFICULTY.normal.yetiSpeed, maxTime: 400 });
      expect(seen.size, biome).toBeGreaterThan(3);
      for (const [id, n] of seen) expect(n, `${biome} hazard ${id}`).toBe(1);
    }
  }, 300_000);
});

describe('Whiteout Ridge: scanned obstacle rocks (W-003)', () => {
  it('a scan is normalised to the procedural rock frame (footprint ~1 m, base buried), all variants', async () => {
    const THREE = await import('three');
    const { scanRockGeometry } = await import('../../src/world/props');
    const { getBiome } = await import('../../src/world/biome');
    expect(getBiome('whiteout').rocks.scan?.length).toBe(3);
    const unit = new THREE.SphereGeometry(0.5, 12, 8).translate(0, 0.5, 0);
    for (let v = 0; v < 6; v++) {
      const g = scanRockGeometry(unit, v, [0.2, 0.2, 0.2]);
      g.computeBoundingBox();
      const b = g.boundingBox!;
      expect(Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z)).toBeLessThan(1.1);
      expect(Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z)).toBeGreaterThan(0.9);
      expect(b.min.y).toBeLessThan(-0.6);
      expect(b.max.y).toBeGreaterThan(0.8);
      expect(g.getAttribute('color').count).toBe(g.getAttribute('position').count);
    }
  });
});

describe('Whiteout Ridge: the cornice is drawn with the terrain snow (front faces only)', () => {
  it('its faces wind outward: the top of the lip faces up, the overhang faces down', async () => {
    const { buildCorniceGeometry } = await import('../../src/world/biomes/whiteout/views/cornice');
    for (const seed of ['WR1', 'WR2']) {
      const m = buildMountain(makeCourse('custom', 'standard', { biome: 'whiteout', customText: seed }));
      const g = buildCorniceGeometry(m, corniceSamples(m, 600, 1400))!;
      expect(g).toBeTruthy();
      expect(g.getAttribute('aSurf')).toBeTruthy();
      // area-weighted face normals: the strip is mostly a cap seen from above
      const p = g.getAttribute('position');
      const idx = g.getIndex()!;
      let up = 0, down = 0;
      for (let i = 0; i < idx.count; i += 3) {
        const [a, b, c] = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
        const ux = p.getX(b) - p.getX(a), uy = p.getY(b) - p.getY(a), uz = p.getZ(b) - p.getZ(a);
        const vx = p.getX(c) - p.getX(a), vy = p.getY(c) - p.getY(a), vz = p.getZ(c) - p.getZ(a);
        const ny = uz * vx - ux * vz;
        void uy; void vy;
        if (ny > 0) up += ny;
        else down -= ny;
      }
      expect(up, seed).toBeGreaterThan(down * 1.5);
    }
  });
});
