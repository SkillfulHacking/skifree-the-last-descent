// Round 6, owner ruling 2: characterise the Yeti's speed against the gap to the skier before changing it.
// `pursuitCurve` holds the Yeti and the skier at a fixed gap on a stretch of known slope, lets his speed
// settle, and reads it. The round 1–5 behaviour is pinned here so a change to it is deliberate.
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { YETI } from '../../src/yeti/YetiAI';
import { settledSpeed, zAtSlope } from '../sim/pursuitProbe';

describe('Yeti pursuit: speed against distance (round 1–5 behaviour)', () => {
  const c = makeCourse('classic', 'sprint', { biome: 'alpine', difficulty: 'normal' });
  const m = buildMountain(c);
  const f = null;
  const z15 = zAtSlope(m, 15);

  it('defaults reproduce the shipped constants', () => {
    expect(YETI.catchUpGap).toBe(60);
    expect(YETI.catchUpBoost).toBe(9);
    expect(YETI.pursuit).toMatchObject({ nearSpan: 120, farBoost: 7, farFrom: 105, farTo: 170, farCap: 6, distanceScale: 1, sprintEvery: 0, gentleBase: 13, gentlePerDeg: 0.5, gentleTerminal: true, mode: 'legacy' });
  });

  it('on a 15° slope his speed rises with the gap (the hidden catch-up)', () => {
    expect(Number.isFinite(z15)).toBe(true);
    const s30 = settledSpeed(m, f, z15, 30);
    const s100 = settledSpeed(m, f, z15, 100);
    const s200 = settledSpeed(m, f, z15, 200);
    // own pace 16.5 at 30 m (beyond the lunge range), boosted beyond 60 m and again beyond 105 m
    expect(s30).toBeCloseTo(16.5, 0);
    expect(s100).toBeGreaterThan(s30 + 2);
    expect(s200).toBeGreaterThan(s100 + 8);
  });

  it('with distanceScale 0 his speed no longer depends on the gap', () => {
    const keep = YETI.pursuit.distanceScale;
    YETI.pursuit.distanceScale = 0;
    try {
      const s = [30, 100, 200].map((g) => settledSpeed(m, f, z15, g));
      expect(Math.max(...s) - Math.min(...s)).toBeLessThan(0.05);
    } finally {
      YETI.pursuit.distanceScale = keep;
    }
  });
});

describe('W-101 / W-102: on gentle ground the Yeti is no faster than a tucked skier settles there', () => {
  it('below 12° his settled speed never exceeds the tucked terminal speed (or the 9 m/s run floor)', async () => {
    const { tuckedTerminalSpeed } = await import('../../src/yeti/YetiAI');
    for (const biome of ['alpine', 'whiteout'] as const) {
      const m = buildMountain(makeCourse('classic', 'standard', { biome, difficulty: 'hard' }));
      let n = 0;
      for (const deg of [4, 6, 8, 9, 10, 11]) {
        const z = zAtSlope(m, deg, 300, 9800);
        if (!Number.isFinite(z)) continue;
        n++;
        // far behind (the old boost's range) and at Hard's pace: still capped on this ground
        for (const gap of [40, 150]) {
          const v = settledSpeed(m, null, z, gap, 16, 1.07 * 1.13);
          expect(v, `${biome} ${deg}° gap ${gap}`).toBeLessThanOrEqual(Math.max(YETI.pursuit.runFloor, tuckedTerminalSpeed(m.slopeDeg(z))) + 0.05);
        }
      }
      expect(n).toBeGreaterThan(1);
    }
  });
});
