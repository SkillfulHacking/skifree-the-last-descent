// Fjord round-2 balance and environment on/off table (headless simulate.ts). Long-running (~40 min):
//   OUT=/tmp/bal.jsonl npx vitest run --config tests/review/vitest.config.ts tests/review/fjord_r2_balance.test.ts
//   node tests/review/fjord_r2_table.mjs /tmp/bal.jsonl
// PART=sprint|standard|off|all selects a slice. One JSON line per run.
import { it } from 'vitest';
import '../../src/world/biomes';
import { DIFFICULTY, LENGTH_INFO, makeCourse, worldSeed, type Difficulty, type LengthMode } from '../../src/game/CourseConfig';
import { getBiome } from '../../src/world/biome';
import { Mountain } from '../../src/world/course';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput, type AutopilotStyle } from '../../src/debug/autopilot';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { readerDriver } from '../sim/readerDriver';

type Driver = 'reader' | AutopilotStyle;
const DRIVERS: Driver[] = ['reader', 'skilled', 'intermediate', 'average', 'cautious', 'careless'];
const DIFFS: Difficulty[] = ['relaxed', 'normal', 'hard'];
const SEEDS: Record<string, string[]> = { sprint: ['RB1', 'RB2', 'RB3', 'RB4', 'RB5'], standard: ['RB1', 'RB2', 'RB3'] };

function one(biome: string, len: LengthMode, seed: string, diff: Difficulty, driver: Driver, env: boolean) {
  const c = makeCourse('custom', len, { biome, customText: seed, difficulty: diff });
  const ws = worldSeed(c);
  const m = Mountain.generated(ws, LENGTH_INFO[len].metres, getBiome(biome));
  const f = new ObstacleField(m, ws);
  const e = env ? new BiomeEnvironment(m, ws) : null;
  const drive = driver === 'reader' ? readerDriver(m, e) : (s: Parameters<typeof autopilotInput>[1], t: number) => autopilotInput(m, s, driver, t);
  const t0 = Date.now();
  const r = simulateCourse(m, f, drive, { streaming: true, environment: e, yetiSpeed: DIFFICULTY[diff].yetiSpeed, maxTime: len === 'standard' ? 1200 : 900, snowballs: diff === 'hard', dodge: diff === 'hard' && (driver === 'reader' || driver === 'skilled') });
  return { biome, len, seed, diff, driver, env, outcome: r.outcome, time: +r.time.toFixed(2), km: +(r.distance / 1000).toFixed(2), minGap: Number.isFinite(r.minGap) ? +r.minGap.toFixed(1) : null, crashes: r.crashes, ms: Date.now() - t0 };
}

// no @types/node in this project: reach Node through untyped handles
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

it('fjord round-2 balance', async () => {
  const { appendFileSync } = (await import(/* @vite-ignore */ 'node:fs' as string)) as { appendFileSync(p: string, d: string): void };
  const out = env.OUT ?? '/tmp/fjord_r2_balance.jsonl';
  const part = env.PART ?? 'all';
  const jobs: Array<Parameters<typeof one>> = [];
  for (const len of ['sprint', 'standard'] as LengthMode[]) {
    if (part !== 'all' && part !== len) continue;
    for (const biome of ['alpine', 'fjord']) for (const diff of DIFFS) for (const d of DRIVERS) for (const sd of SEEDS[len]!) jobs.push([biome, len, sd, diff, d, true]);
  }
  if (part === 'all' || part === 'off') for (const len of ['sprint', 'standard'] as LengthMode[]) for (const diff of ['relaxed', 'normal'] as Difficulty[]) for (const d of DRIVERS) for (const sd of SEEDS[len]!) jobs.push(['fjord', len, sd, diff, d, false]);
  for (const j of jobs) appendFileSync(out, JSON.stringify(one(...j)) + '\n');
}, 14_400_000);
