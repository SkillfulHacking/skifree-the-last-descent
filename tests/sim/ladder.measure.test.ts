/**
 * Round 4 difficulty ladder (owner's decision A): full-course outcomes for an expert driver across
 * locations × lengths × difficulties, on the Classic course and on seed sets. Not part of the unit suite.
 *
 * Drivers (balance.ts POLICIES, whiteoutDriver): Alpine and Fjord 'blind' = the skilled autopilot's
 * racing line (they have no weather to read); Whiteout 'informed2NoLee' = the weather reader (storm
 * line, drift gaps, blizzard stance) and 'blind' for the reading advantage.
 *
 *   OUT=.measure/ladder.jsonl BIOMES=alpine,fjord,whiteout LENS=sprint,standard DIFFS=normal,hard \
 *   SEEDS=CLASSIC,W2H-01,… PACE='alpine:1.05' TUNE='{"whiteout":{…}}' SHARD=0 SHARDS=2 \
 *   npx vitest run --config vitest.sim.config.ts tests/sim/ladder.measure.test.ts
 *
 * SLOPPY=1 (the Relaxed check: a competent, unoptimised skier): every 12 s a sloppy turn (1 s, no tuck, half
 * brake), no pole pushes, round 3's all-or-nothing tuck.
 * POLE=1 adds pole pushes on slow ground (balance.ts withPoles); FJORD_READ=1 drives Fjord with the squall
 * reader. The expert driver of the round-4 ladder is POLE=1 FJORD_READ=1 (TAG names the variant).
 * PACE overrides a location's terrain.encounterPace for this process (experiments only).
 * TUNE (JSON) applies experiment overrides to a location before any course is built: see applyTune.
 * Each row records the pace, the tune tag (TAG) and the git-free inputs; resumable (rows already in OUT
 * with the same key are skipped).
 */
import { it } from 'vitest';
import '../../src/world/biomes';
import { getBiome, type BiomeId } from '../../src/world/biome';
import { measure, POLICIES, type RunSpec } from './balance';
import { applyTune } from './tune';
import { EXPERT_TUCK } from './whiteoutDriver';
import { outPath } from './outPath';

const P = (globalThis as unknown as { process: { env: Record<string, string | undefined>; stdout: { write(s: string): void } } }).process;
const E = P.env;
const list = (v: string | undefined, d: string) => (v ?? d).split(',').map((s) => s.trim()).filter(Boolean);
/** 'W2H:12' → W2H-01 … W2H-12 */
const seeds = list(E.SEEDS, 'CLASSIC').flatMap((s) => (/^[A-Z0-9]+:\d+$/.test(s) ? Array.from({ length: Number(s.split(':')[1]) }, (_, i) => `${s.split(':')[0]}-${String(i + 1).padStart(2, '0')}`) : [s]));

it('ladder', async () => {
  const fs = (await import('node:fs' as string)) as { appendFileSync(p: string, d: string): void; existsSync(p: string): boolean; readFileSync(p: string, e: string): string };
  const paceOf = (b: string) => (E.PACE ?? '').split(',').find((x) => x.startsWith(b + ':'))?.split(':')[1];
  for (const b of ['alpine', 'fjord', 'whiteout'] as BiomeId[]) {
    const p = paceOf(b);
    if (p) (getBiome(b) as unknown as { terrain: { encounterPace: number } }).terrain.encounterPace = Number(p);
  }
  if (E.TUNE) applyTune(JSON.parse(E.TUNE));
  if (E.XTUCK) Object.assign(EXPERT_TUCK, { on: true, band: Number(E.XTUCK) });
  const tag = E.TAG ?? 'base';
  const out = await outPath(E.OUT, '.measure/ladder.jsonl');
  const key = (r: { biome: string; len: string; diff: string; seed: string; policy: string; pace: number; tag: string }) => `${r.biome}|${r.len}|${r.diff}|${r.seed}|${r.policy}|${r.pace}|${r.tag}`;
  const done = new Set<string>();
  if (fs.existsSync(out)) for (const l of fs.readFileSync(out, 'utf8').split('\n')) if (l.trim()) done.add(key(JSON.parse(l)));
  const specs: (RunSpec & { pace: number })[] = [];
  for (const biome of list(E.BIOMES, 'alpine,fjord,whiteout') as BiomeId[]) {
    const pace = (getBiome(biome).terrain as { encounterPace?: number }).encounterPace ?? 1;
    const pols = list(biome === 'whiteout' ? E.POLS_WHITEOUT : E.POLS, biome === 'whiteout' ? 'informed2NoLee,blind' : 'blind');
    for (const len of list(E.LENS, 'sprint,standard'))
      for (const diff of list(E.DIFFS, 'normal,hard'))
        for (const seed of seeds)
          for (const policy of pols) {
            if (!(policy in POLICIES)) throw new Error(`unknown policy ${policy}`);
            specs.push({ biome, len: len as RunSpec['len'], diff: diff as RunSpec['diff'], seed, policy, pace, pole: E.POLE === '1', fjordRead: E.FJORD_READ === '1', sloppy: E.SLOPPY === '1' });
          }
  }
  const shards = Number(E.SHARDS ?? 1);
  const shard = Number(E.SHARD ?? 0);
  specs.forEach((s, i) => {
    if (i % shards !== shard || done.has(key({ ...s, tag }))) return;
    const r = measure(s);
    fs.appendFileSync(out, JSON.stringify({ ...r, pace: s.pace, tag }) + '\n');
    P.stdout.write(`${key({ ...s, tag })}: ${r.outcome} min ${r.minGap}\n`);
  });
}, 86_400_000);
