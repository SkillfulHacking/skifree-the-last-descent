/** Hazard knocks per hazard per run (W-036 double-knock probe). OUT=… [BIOMES, DIFFS, N] npx vitest run --config vitest.sim.config.ts tests/sim/knock.measure.test.ts — for the one-strike counterfactual, run it on a scratch copy with `tr.struck = false;` removed from the hazard-exit branch of BiomeEnvironment.sampleHazards. */
import { it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, DIFFICULTY, makeCourse, worldSeed, courseId, type Difficulty } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import { whiteoutDriver } from './whiteoutDriver';
const E = (globalThis as any).process.env;
it('knock probe', async () => {
  const fs = await import('node:fs' as string);
  const out = E.OUT;
  for (const biome of (E.BIOMES ?? 'fjord').split(','))
    for (const diff of (E.DIFFS ?? 'normal,hard').split(',') as Difficulty[])
      for (let i = 1; i <= Number(E.N ?? 24); i++)
        for (const drv of ['skilled', 'blind']) {
          const seed = `W034-${String(i).padStart(2, '0')}`;
          const c = makeCourse('custom', 'sprint', { biome, customText: seed, difficulty: diff });
          const ws = worldSeed(c); const m = buildMountain(c);
          const env = new BiomeEnvironment(m, ws, { difficulty: diff });
          const field = new ObstacleField(m, ws);
          const hits = new Map<number, { kind: string; gate: boolean; n: number; t: number[] }>();
          env.listen((e) => {
            if (e.type !== 'hazard-hit' || e.effect !== 'knock') return;
            const g = hits.get(e.hazard.id) ?? { kind: e.kind, gate: !!(e.hazard.params as { gate?: unknown })?.gate, n: 0, t: [] };
            g.n++; g.t.push(+e.t.toFixed(2)); hits.set(e.hazard.id, g);
          });
          const driver = drv === 'skilled' ? (s: any, t: number) => autopilotInput(m, s, 'skilled', t) : whiteoutDriver(m, env, ws, { lines: 'always', drifts: 'ignore', blizzard: 'ignore' }, undefined, 0.25, field);
          const r = simulateCourse(m, field, driver, { streaming: true, environment: env, yetiSpeed: DIFFICULTY[diff].yetiSpeed, maxTime: 900, snowballs: diff === 'hard', dodge: diff === 'hard' });
          fs.appendFileSync(out, JSON.stringify({ biome, diff, seed, courseId: courseId(c), drv, outcome: r.outcome, time: +r.time.toFixed(1), distance: Math.round(r.distance), minGap: Number.isFinite(r.minGap) ? +r.minGap.toFixed(1) : null, knocks: [...hits.values()] }) + '\n');
        }
}, 86_400_000);
