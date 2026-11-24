/**
 * Pursuit tension across locations (W-076, owner's decision 3): with the canonical chase start, how
 * present and threatening the Yeti is for six kinds of player, on Alpine, Fjord and Whiteout.
 *
 * Players (all from the canonical hand-off; the headless game, simulate.ts). On Whiteout every player
 * is built on the weather reader (informed2NoLee) instead of the plain autopilot (WX=0: the autopilot):
 *   skilled      the autopilot's racing line, tucked (a clean expert run)
 *   competent    the autopilot's 'intermediate' style, scrubbing speed for 1 s every 12 s (a sloppy turn:
 *                no tuck, half brake) — competent but imperfect (the 'intermediate' style alone skis the
 *                chase exactly like 'skilled': measured, baseline_872ac4d.jsonl)
 *   cautious     the skilled line, braking whenever faster than 13 m/s (≈47 km/h)
 *   crash        the skilled line, one crash 5 s into the first chase (a realistic mistake)
 *   lateCrash    the same crash 20 s into the chase (once the Yeti is running)
 *   poorRoute    the competent style, wandering ±12 m off the racing line (worse lines, more obstacles)
 *   slowArrival  the skilled line, but at 3 m/s when the chase begins (came into the cave slow)
 *
 * Per first chase: the skier's speed and the Yeti's distance at the start (first grounded frame), the
 * minimum gap, the time the Yeti is within 110 m (rear-view inset, chase music), 45 m (the footsteps
 * caption, the 'near' widget from 40 m), 25 m ('MOVE!') and 13 m (lunge range), the lunges, the outcome
 * and time to catch; for 'crash', the gap at the crash and the minimum after it; and the presence cues
 * (yeti/presence.ts, presentation only): distant calls heard, seconds of 'CLOSING' shown.
 *   OUT=… LENS=sprint,standard DIFFS=normal,hard npx vitest run --config vitest.sim.config.ts tests/sim/tension.measure.test.ts
 */
import { it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, DIFFICULTY, makeCourse, worldSeed, type Difficulty, type LengthMode } from '../../src/game/CourseConfig';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { autopilotInput } from '../../src/debug/autopilot';
import { NO_INPUT, PHYS_DT, type SkierInput, type SkierState } from '../../src/physics/SkierPhysics';
import { clamp, wrapAngle } from '../../src/core/rng';
import type { Mountain } from '../../src/world/course';
import type { BiomeId } from '../../src/world/biome';
import { ChasePresence } from '../../src/yeti/presence';
import { getBiome } from '../../src/world/biome';
import { whiteoutDriver } from './whiteoutDriver';
import { POLICIES } from './balance';
import { outPath } from './outPath';

const P = (globalThis as unknown as { process: { env: Record<string, string | undefined>; stdout: { write(s: string): void } } }).process;

export const BEHAVIOURS = ['skilled', 'competent', 'cautious', 'crash', 'lateCrash', 'poorRoute', 'slowArrival'] as const;
export type Behaviour = (typeof BEHAVIOURS)[number];

type Drive = (s: SkierState, t: number) => SkierInput;
/**
 * `base`: how a good player skis this location — the skilled autopilot, or on Whiteout the weather
 * reader (whiteoutDriver, informed2NoLee: storm line, drift gaps, blizzard stance; review F, F6: the plain
 * autopilot ploughs every drift row there)
 */
function driver(m: Mountain, b: Behaviour, base: Drive): Drive {
  if (b === 'competent')
    return (s, t) => {
      const i = base(s, t);
      return t % 12 < 1 ? { ...i, tuck: 0, brake: 0.5 } : i;
    };
  if (b === 'cautious')
    return (s, t) => {
      const i = base(s, t);
      return s.speed > 13 ? { ...i, tuck: 0, brake: 1 } : { ...i, tuck: Math.min(i.tuck, 0.3) };
    };
  if (b === 'poorRoute')
    return (s) => {
      const look = 7 + s.speed * 0.55;
      const tz = s.pos.z + look;
      const tx = m.routeX(tz) + 12 * Math.sin(tz / 45);
      const err = wrapAngle(Math.atan2(tx - s.pos.x, look) - s.heading);
      return { ...NO_INPUT, steer: clamp(-err * 2.6, -1, 1), tuck: s.speed < 18 ? 0.8 : 0.2, recover: s.crashTime > 1.4 };
    };
  return base;
}

export interface TensionRow {
  /** 'CLASSIC', a Custom seed text, or 'DAILY:<date>'; `enc`: which encounter (0 = the first chase) */
  seed: string;
  enc: number;
  /** the experiment's per-location pace multiplier (1 = shipped) */
  pace: number;
  /** the gap every 2 s of the chase (m) */
  traj: number[];
  biome: string;
  len: string;
  diff: string;
  behaviour: Behaviour;
  v0: number;
  startGap: number;
  minGap: number;
  t110: number;
  t45: number;
  t25: number;
  t13: number;
  lunges: number;
  chaseTime: number;
  outcome: string;
  captureT: number | null;
  crashGap: number | null;
  minAfterCrash: number | null;
  calls: number;
  closingS: number;
}

export function runTension(biome: BiomeId, len: LengthMode, diff: Difficulty, b: Behaviour, seed = 'CLASSIC', encIdx = 0, pace = 1): TensionRow {
  const course =
    seed === 'CLASSIC'
      ? makeCourse('classic', len, { biome, difficulty: diff })
      : seed.startsWith('DAILY:')
        ? makeCourse('daily', len, { biome, date: seed.slice(6), difficulty: diff })
        : makeCourse('custom', len, { biome, customText: seed, difficulty: diff });
  const ws = worldSeed(course);
  const m = buildMountain(course);
  const f = new ObstacleField(m, ws);
  const env = new BiomeEnvironment(m, ws, { difficulty: diff });
  const enc = m.profile.encounters(0, Number.isFinite(m.finishZ) ? m.finishZ : 30000)[encIdx]!;
  const traj: number[] = [];
  let nextT = 0;
  const crashAt = b === 'crash' ? 5 : b === 'lateCrash' ? 20 : null;
  let v0 = NaN;
  let startGap = NaN;
  let minGap = Infinity;
  const tin = { 110: 0, 45: 0, 25: 0, 13: 0 } as Record<number, number>;
  let lunges = 0;
  let wasLunging = false;
  let lastCt = 0;
  let crashGap: number | null = null;
  let minAfterCrash: number | null = null;
  const pres = new ChasePresence(1);
  let calls = 0;
  let closingS = 0;
  const base: Drive = biome === 'whiteout' && P.env.WX !== '0' ? whiteoutDriver(m, env, ws, POLICIES.informed2NoLee!, undefined, 0.25, f) : (s, t) => autopilotInput(m, s, 'skilled', t);
  const r = simulateCourse(m, f, driver(m, b, base), {
    streaming: true,
    environment: env,
    // (W-077 experiment B) a fixed pace multiplier for every encounter, like an encounter's speedMul
    yetiSpeed: DIFFICULTY[diff].yetiSpeed * pace,
    snowballs: diff === 'hard',
    dodge: diff === 'hard',
    maxZ: Math.min(enc.triggerZ + 1500, Number.isFinite(m.finishZ) ? m.finishZ + 50 : Infinity),
    // (crashes are scheduled per chase in order: the first `encIdx` chases get none)
    crashAtChase: crashAt !== null ? [...Array.from({ length: encIdx }, () => 1e9), crashAt] : [],
    maxTime: 900,
    trace: (e, ct, s, y, start) => {
      if (e.index !== enc.index) return;
      if (start) {
        if (b === 'slowArrival') {
          const sp = s.vel.length();
          if (sp > 1e-3) s.vel.multiplyScalar(3 / sp);
          else s.vel.set(Math.sin(s.heading) * 3, 0, Math.cos(s.heading) * 3);
        }
        v0 = s.vel.length();
        return;
      }
      lastCt = ct;
      const d = y.distance;
      if (ct >= nextT) {
        traj.push(Math.round(d));
        nextT += 2;
      }
      if (!y.airborne || ct > 1.5) {
        const cue = pres.update(PHYS_DT, d);
        if (cue.call) calls++;
        if (cue.closing) closingS += PHYS_DT;
      }
      if (!y.airborne) {
        if (Number.isNaN(startGap)) startGap = d;
        minGap = Math.min(minGap, d);
      }
      for (const k of [110, 45, 25, 13]) if (d < k) tin[k]! += PHYS_DT;
      const lunging = y.lungeTimer > 0;
      if (lunging && !wasLunging) lunges++;
      wasLunging = lunging;
      if (crashAt !== null) {
        if (crashGap === null && ct >= crashAt) crashGap = d;
        if (crashGap !== null) minAfterCrash = Math.min(minAfterCrash ?? Infinity, d);
      }
    },
  });
  const f1 = (x: number) => +x.toFixed(1);
  return {
    seed,
    enc: encIdx,
    pace,
    traj,
    biome,
    len,
    diff,
    behaviour: b,
    v0: +v0.toFixed(2),
    startGap: f1(startGap),
    minGap: Number.isFinite(minGap) ? f1(minGap) : -1,
    t110: f1(tin[110]!),
    t45: f1(tin[45]!),
    t25: f1(tin[25]!),
    t13: f1(tin[13]!),
    lunges,
    chaseTime: f1(lastCt),
    outcome: r.outcome === 'caught' ? 'caught' : 'escaped',
    captureT: r.outcome === 'caught' ? f1(lastCt) : null,
    crashGap: crashGap === null ? null : f1(crashGap),
    minAfterCrash: minAfterCrash === null ? null : f1(minAfterCrash),
    calls,
    closingS: f1(closingS),
  };
}

it('pursuit tension', async () => {
  const fs = (await import('node:fs' as string)) as { writeFileSync: (p: string, d: string) => void; appendFileSync: (p: string, d: string) => void; existsSync: (p: string) => boolean; readFileSync: (p: string, e: string) => string };
  const out = await outPath(P.env.OUT, '.measure/tension.jsonl');
  // resumable: rows already in OUT are kept
  const done = new Set<string>();
  const keyOf = (r: { seed: string; enc: number; pace: number; biome: string; len: string; diff: string; behaviour: string }) => `${r.seed}|${r.enc}|${r.pace}|${r.biome}|${r.len}|${r.diff}|${r.behaviour}`;
  if (fs.existsSync(out))
    for (const l of fs.readFileSync(out, 'utf8').split('\n').filter(Boolean)) {
      const r = JSON.parse(l) as TensionRow;
      done.add(keyOf({ ...r, seed: r.seed ?? 'CLASSIC', enc: r.enc ?? 0, pace: r.pace ?? 1 }));
    }
  // PACE='alpine:1.1,whiteout:1.05' (experiment B); SEEDS='CLASSIC,T4H-01'; ENCS='0,1,2' (Endless)
  // (W-077 experiment A) SLOPE='alpine:0.9': scale a location's generated-course slopes (its terrain
  // knob, mutated for this run only; Alpine's hand-made Classic Sprint is not generated)
  for (const kv of (P.env.SLOPE ?? '').split(',').filter(Boolean)) {
    const [bid, v] = kv.split(':');
    const B = getBiome(bid as BiomeId) as unknown as { terrain: { slopeScale: number } };
    B.terrain.slopeScale *= Number(v);
  }
  const paceOf = (b: string) => Number((P.env.PACE ?? '').split(',').find((x) => x.startsWith(b + ':'))?.split(':')[1] ?? 1);
  const biomes = (P.env.BIOMES ?? 'alpine,fjord,whiteout').split(',') as BiomeId[];
  for (const seed of (P.env.SEEDS ?? 'CLASSIC').split(','))
    for (const biome of biomes)
      for (const len of (P.env.LENS ?? 'sprint').split(',') as LengthMode[])
        for (const enc of (P.env.ENCS ?? '0').split(',').map(Number))
          for (const diff of (P.env.DIFFS ?? 'normal,hard').split(',') as Difficulty[])
            for (const b of (P.env.BEHAVIOURS?.split(',') as Behaviour[] | undefined) ?? BEHAVIOURS) {
              const pace = paceOf(biome);
              const key = keyOf({ seed, enc, pace, biome, len, diff, behaviour: b });
              if (done.has(key)) continue;
              const row = runTension(biome, len, diff, b, seed, enc, pace);
              fs.appendFileSync(out, JSON.stringify(row) + '\n');
              P.stdout.write(`${key}: ${row.outcome} start ${row.startGap} m, min ${row.minGap} m, <45 m ${row.t45} s\n`);
            }
});
