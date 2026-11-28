/**
 * Round 6, owner ruling 2: the Yeti's settled speed against the gap, for each slope band, with the
 * distance-dependent pursuit on (as shipped) and off. Writes OUT (JSON lines):
 *   OUT=docs/…/curve.jsonl npx vitest run --config vitest.sim.config.ts tests/sim/pursuitCurve.measure.test.ts
 */
import { expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { YETI } from '../../src/yeti/YetiAI';
import { settledSpeed, zAtSlope } from './pursuitProbe';
import { outPath } from './outPath';

const P = globalThis as unknown as { process: { env: Record<string, string | undefined> } };

it('pursuit curve', async () => {
  const fs = (await import('node:fs' as string)) as { writeFileSync: (p: string, d: string) => void; appendFileSync: (p: string, d: string) => void };
  const OUT = await outPath(P.process.env.OUT, '.measure/pursuit_curve.jsonl');
  fs.writeFileSync(OUT, '');
  let n = 0;
  for (const biome of ['alpine', 'fjord', 'whiteout'] as const) {
    const m = buildMountain(makeCourse('classic', 'standard', { biome, difficulty: 'normal' }));
    for (const deg of [6, 9, 12, 15, 18, 22]) {
      const z = zAtSlope(m, deg, 300, 9800);
      if (!Number.isFinite(z)) continue;
      for (const scale of [1, 0]) {
        YETI.pursuit.distanceScale = scale;
        const row: Record<string, number> = {};
        for (let gap = 20; gap <= 260; gap += 20) row[gap] = +settledSpeed(m, null, z, gap).toFixed(2);
        fs.appendFileSync(OUT, JSON.stringify({ biome, slope: deg, z, distanceScale: scale, speedByGap: row }) + '\n');
        n++;
        // a settled speed for every gap, within the Yeti's possible range
        for (const v of Object.values(row)) {
          expect(v).toBeGreaterThan(0);
          expect(v).toBeLessThan(YETI.maxSpeed + YETI.pursuit.farCap + 1);
        }
        // with the distance terms off, the gap makes no difference
        if (scale === 0) expect(Math.max(...Object.values(row)) - Math.min(...Object.values(row))).toBeLessThan(0.05);
      }
    }
  }
  YETI.pursuit.distanceScale = 1;
  expect(n).toBeGreaterThan(12);
}, 600_000);
