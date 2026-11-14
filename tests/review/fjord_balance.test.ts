// Fjord Coast chase balance table (headless simulate.ts). Long-running; run from the repo root:
//   npx vitest run --config tests/review/vitest.config.ts tests/review/fjord_balance.test.ts --disableConsoleIntercept
// Prints one row per (length, seed, difficulty, autopilot) and the same for Alpine for comparison.
import { it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, DIFFICULTY, makeCourse, worldSeed, type Difficulty, type LengthMode } from '../../src/game/CourseConfig';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput, type AutopilotStyle } from '../../src/debug/autopilot';

const STYLES: AutopilotStyle[] = ['skilled', 'intermediate', 'careless'];
const DIFFS: Difficulty[] = ['relaxed', 'normal', 'hard'];

function row(biome: string, len: LengthMode, seed: string, diff: Difficulty, style: AutopilotStyle) {
  const c = makeCourse('custom', len, { biome, customText: seed, difficulty: diff });
  const m = buildMountain(c);
  const f = new ObstacleField(m, worldSeed(c));
  const maxZ = len === 'endless' ? 20000 : undefined;
  const r = simulateCourse(m, f, (s, t) => autopilotInput(m, s, style, t), { streaming: true, yetiSpeed: DIFFICULTY[diff].yetiSpeed, maxTime: len === 'expedition' ? 4000 : len === 'endurance' ? 1800 : 1000, maxZ, snowballs: diff === 'hard', dodge: diff === 'hard' && style === 'skilled' });
  return { biome, len, seed, diff, style, outcome: r.outcome, km: (r.distance / 1000).toFixed(1), minGap: Number.isFinite(r.minGap) ? r.minGap.toFixed(1) : '-', crashes: r.crashes, time: r.time.toFixed(0) };
}

it('fjord balance table', () => {
  const rows: ReturnType<typeof row>[] = [];
  const plan: Array<[LengthMode, string[]]> = [
    ['sprint', ['FJ1', 'FJ2', 'FJ3']],
    ['standard', ['FJ1', 'FJ2', 'FJ3']],
    ['endurance', ['FJ1']],
    ['expedition', ['FJ1']],
    ['endless', ['FJ1']],
  ];
  for (const biome of ['fjord', 'alpine'])
    for (const [len, seeds] of plan)
      for (const seed of biome === 'alpine' ? seeds.slice(0, 1) : seeds)
        for (const diff of DIFFS)
          for (const style of STYLES) {
            if ((len === 'expedition' || len === 'endless' || len === 'endurance') && style === 'careless' && diff !== 'normal') continue;
            const r = row(biome, len, seed, diff, style);
            rows.push(r);
            console.log(`| ${r.biome} | ${r.len} | ${r.seed} | ${r.diff} | ${r.style} | ${r.outcome} | ${r.km} | ${r.minGap} | ${r.crashes} | ${r.time} |`);
          }
  console.log('\n| biome | length | seed | difficulty | autopilot | outcome | km | min gap (m) | crashes | time (s) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.biome} | ${r.len} | ${r.seed} | ${r.diff} | ${r.style} | ${r.outcome} | ${r.km} | ${r.minGap} | ${r.crashes} | ${r.time} |`);
}, 7_200_000);
