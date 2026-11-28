/**
 * Round 4 (owner's decision A): the headless simulator against the browser game. The same driver (the
 * game's 'skilled' autopilot, no snowball dodging — the in-game autopilot has none) on the same courses;
 * tools/browser_parity.mjs plays them in the production build.
 *   RUNS=alpine:sprint:hard,… OUT=… npx vitest run --config vitest.sim.config.ts tests/sim/parity.measure.test.ts
 */
import { it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, DIFFICULTY, makeCourse, worldSeed, type Difficulty, type LengthMode } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import type { BiomeId } from '../../src/world/biome';
import { outPath } from './outPath';
import { expectSimRows } from './checkRows';

const P = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process;
it('parity', async () => {
  const fs = (await import('node:fs' as string)) as { writeFileSync(p: string, d: string): void };
  const rows: unknown[] = [];
  for (const spec of (P.env.RUNS ?? 'alpine:sprint:hard').split(',')) {
    const [biome, len, diff] = spec.split(':') as [BiomeId, LengthMode, Difficulty];
    const c = makeCourse('classic', len, { biome, difficulty: diff });
    const ws = worldSeed(c);
    const m = buildMountain(c);
    const env = new BiomeEnvironment(m, ws, { difficulty: diff });
    const gapAt: number[] = [];
    let mark = 0;
    const r = simulateCourse(m, new ObstacleField(m, ws), (s, t) => autopilotInput(m, s, 'skilled', t), {
      streaming: true, environment: env, yetiSpeed: DIFFICULTY[diff].yetiSpeed, maxTime: len === 'sprint' ? 900 : 2400,
      snowballs: diff === 'hard', dodge: false,
      trace: (_e, ct, _s, y, start) => {
        if (start) return;
        if (ct >= mark + 10) { mark += 10; gapAt.push(Math.round(y.distance * 10) / 10); }
      },
    });
    rows.push({ biome, len, diff, outcome: r.outcome, time: r.time, minGap: r.minGap, distance: r.distance, gapAt });
  }
  fs.writeFileSync(await outPath(P.env.OUT, '.measure/parity_sim.json'), JSON.stringify(rows, null, 1));
  expectSimRows(rows as Record<string, unknown>[], ['time', 'distance'], (P.env.RUNS ?? 'alpine:sprint:hard').split(',').length);
}, 86_400_000);
