/**
 * F-039: the Alpine → Fjord difficulty step on Normal Sprint must be larger than seed noise.
 *
 * Fjord's onshore breeze now costs a grounded skier speed (WeatherCoupling.headwind: extra drag ×
 * gusts, per difficulty: Normal and Hard; none on Relaxed). It never pushes a grounded skier sideways and does
 * not touch the Yeti. Alpine stays physics-identity.
 *
 * Seeds P5S01..P5S08 are the first eight of the 20-seed measurement used to tune the coupling
 * (Pass 5: Fjord slower on 18/20, mean +11.7 s, sd 8.7 s); they include both seeds where Fjord was
 * still faster, so the bound is not cherry-picked.
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, DIFFICULTY, makeCourse, worldSeed, type Difficulty } from '../../src/game/CourseConfig';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { makeEnvQuery, makeEnvSample } from '../../src/physics/environment';
import { FJORD_HEADWIND, FJORD_WEATHER } from '../../src/world/biomes/fjord/biome';
import { validateWeather } from '../../src/world/capabilities/weather';
import { readerDriver } from '../sim/readerDriver';

function sprint(biome: string, seed: string, diff: Difficulty = 'normal') {
  const c = makeCourse('custom', 'sprint', { biome, customText: seed, difficulty: diff });
  const ws = worldSeed(c);
  const m = buildMountain(c);
  const e = new BiomeEnvironment(m, ws, { difficulty: diff });
  const r = simulateCourse(m, new ObstacleField(m, ws), readerDriver(m, e, { rocks: true, alts: true, wind: 'read' }), {
    streaming: true,
    environment: e,
    yetiSpeed: DIFFICULTY[diff].yetiSpeed,
    maxTime: 900,
  });
  return r;
}

describe('Fjord headwind coupling', () => {
  const fjordEnv = (diff: Difficulty) => {
    const c = makeCourse('custom', 'sprint', { biome: 'fjord', customText: 'P5H', difficulty: diff });
    return new BiomeEnvironment(buildMountain(c), worldSeed(c), { difficulty: diff });
  };
  // the headwind's share of dragAdd (grounded minus the same query airborne), averaged over two
  // minutes just inland of the line (a little of the surface model's own grounded drag remains)
  const dragAt = (e: BiomeEnvironment, grounded: boolean, crashed = false) => {
    const q = makeEnvQuery();
    const out = makeEnvSample();
    let sum = 0;
    let n = 0;
    for (let t = 0; t < 120; t += 0.5, n++) {
      q.z = 300 + t * 15;
      q.x = e.mountain.routeX(q.z) + 30; // inland of the line: no hazards, no cornice
      q.vz = 15;
      q.speed = 15;
      q.crashed = crashed;
      q.t = t;
      q.grounded = false;
      e.sample(q, out);
      const air = out.surface.dragAdd;
      q.grounded = grounded;
      e.sample(q, out);
      sum += out.surface.dragAdd - air;
    }
    return sum / n;
  };

  it('is valid weather and adds drag only to a grounded, upright skier', () => {
    expect(validateWeather(FJORD_WEATHER)).toEqual([]);
    const n = fjordEnv('normal');
    const d = dragAt(n, true);
    expect(d).toBeGreaterThan(FJORD_HEADWIND * 0.7);
    expect(d).toBeLessThan(FJORD_HEADWIND * 1.5); // gusts above the mean in this window
    expect(dragAt(n, false)).toBe(0);
    expect(dragAt(n, true, true)).toBe(0);
  });

  it('applies on Normal and Hard; Relaxed has none (an upright skier must still outrun its Yeti)', () => {
    const r = fjordEnv('relaxed');
    expect(r.headwind).toBe(0);
    expect(dragAt(r, true)).toBeLessThan(FJORD_HEADWIND * 0.15); // (the surface model's own grounded drag only)
    expect(fjordEnv('hard').headwind).toBe(FJORD_HEADWIND);
    expect(fjordEnv('normal').headwind).toBe(FJORD_HEADWIND);
  });

  it('leaves Alpine physics-identity', () => {
    const c = makeCourse('custom', 'sprint', { biome: 'alpine', customText: 'P5H', difficulty: 'normal' });
    const e = new BiomeEnvironment(buildMountain(c), worldSeed(c), { difficulty: 'normal' });
    expect(e.physicsIdentity).toBe(true);
  });
});

describe('F-039: Normal Sprint ladder (Alpine → Fjord)', () => {
  it('Fjord is slower than Alpine on most seeds, by more than seed noise on average', () => {
    const seeds = ['P5S01', 'P5S02', 'P5S03', 'P5S04', 'P5S05', 'P5S06', 'P5S07', 'P5S08'];
    const steps: number[] = [];
    for (const s of seeds) {
      const a = sprint('alpine', s);
      const f = sprint('fjord', s);
      expect(a.outcome).toBe('victory');
      expect(f.outcome).toBe('victory');
      steps.push(f.time - a.time);
    }
    const mean = steps.reduce((x, y) => x + y, 0) / steps.length;
    expect(steps.filter((d) => d > 0).length, steps.map((d) => d.toFixed(1)).join(' ')).toBeGreaterThanOrEqual(6);
    expect(mean).toBeGreaterThan(6);
  }, 600_000);
});
