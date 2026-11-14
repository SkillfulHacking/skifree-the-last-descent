// Fjord round-3 balance harness (headless simulate.ts). Env-configurable slices, one JSON line per run:
//   OUT=/tmp/b.jsonl LENS=sprint,standard SEEDS=V1,V2 BIOMES=fjord,alpine DIFFS=relaxed,normal,hard \
//   DRIVERS=reader,skilled,intermediate,average,cautious,careless ENV=on|off|both \
//   npx vitest run --config tests/review/vitest.config.ts tests/review/fjord_r3_balance.test.ts
// Tabulate: node tests/review/fjord_r3_table.mjs <file.jsonl> [...]
// Runs already present in OUT (same key) are skipped, so a slice can be resumed / Alpine reused.
import { it } from 'vitest';
import '../../src/world/biomes';
import { DIFFICULTY, buildMountain, makeCourse, worldSeed, type Difficulty, type LengthMode } from '../../src/game/CourseConfig';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput, type AutopilotStyle } from '../../src/debug/autopilot';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { readerDriver } from '../sim/readerDriver';

type Driver = 'reader' | AutopilotStyle;

function one(biome: string, len: LengthMode, seed: string, diff: Difficulty, driver: Driver, envOn: boolean) {
  const c = makeCourse('custom', len, { biome, customText: seed, difficulty: diff });
  const ws = worldSeed(c);
  const m = buildMountain(c);
  const f = new ObstacleField(m, ws);
  const e = envOn ? new BiomeEnvironment(m, ws, { difficulty: diff }) : null;
  const drive = driver === 'reader' ? readerDriver(m, e) : (s: Parameters<typeof autopilotInput>[1], t: number) => autopilotInput(m, s, driver, t);
  const t0 = Date.now();
  const log: string[] = [];
  const r = simulateCourse(m, f, drive, {
    streaming: true,
    log,
    environment: e,
    yetiSpeed: DIFFICULTY[diff].yetiSpeed,
    maxTime: len === 'endurance' ? 2400 : len === 'standard' ? 1300 : 900,
    snowballs: diff === 'hard',
    dodge: diff === 'hard' && (driver === 'reader' || driver === 'skilled'),
  });
  const crashes = log.filter((l) => !l.includes('encounter') && !l.includes('snowball')).map((l) => l.replace(/^[\d.]+s z=\d+ /, ''));
  return { biome, len, seed, diff, driver, env: envOn, outcome: r.outcome, time: +r.time.toFixed(2), km: +(r.distance / 1000).toFixed(2), minGap: Number.isFinite(r.minGap) ? +r.minGap.toFixed(1) : null, crashes: r.crashes, crashReasons: crashes, ms: Date.now() - t0 };
}

const penv = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const list = (k: string, d: string) => (penv[k] ?? d).split(',').map((s) => s.trim()).filter(Boolean);

it('fjord round-3 balance', async () => {
  const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { appendFileSync(p: string, d: string): void; existsSync(p: string): boolean; readFileSync(p: string, e: string): string };
  const out = penv.OUT ?? '/tmp/fjord_r3_balance.jsonl';
  const key = (r: { biome: string; len: string; seed: string; diff: string; driver: string; env: boolean }) => [r.biome, r.len, r.seed, r.diff, r.driver, r.env].join('|');
  const have = new Set<string>();
  if (fs.existsSync(out)) for (const l of fs.readFileSync(out, 'utf8').split('\n')) if (l.trim()) have.add(key(JSON.parse(l)));
  const envs = (penv.ENV ?? 'on') === 'both' ? [true, false] : [(penv.ENV ?? 'on') === 'on'];
  for (const len of list('LENS', 'sprint') as LengthMode[])
    for (const seed of list('SEEDS', 'V1'))
      for (const biome of list('BIOMES', 'fjord,alpine'))
        for (const diff of list('DIFFS', 'relaxed,normal,hard') as Difficulty[])
          for (const driver of list('DRIVERS', 'reader,skilled,intermediate,average,cautious,careless') as Driver[])
            for (const env of envs) {
              if (biome === 'alpine' && !env) continue;
              if (have.has(key({ biome, len, seed, diff, driver, env }))) continue;
              fs.appendFileSync(out, JSON.stringify(one(biome, len, seed, diff, driver, env)) + '\n');
            }
}, 86_400_000);
