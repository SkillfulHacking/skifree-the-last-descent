/**
 * W-034 balance measurement: one instrumented headless run (Whiteout, Alpine or Fjord).
 *
 * The driver is tests/sim/whiteoutDriver (the skilled path follower with a 0.25 s reaction, obstacle
 * avoidance), with a weather policy. Policies differ ONLY in the three weather decisions (route line,
 * drift gaps, blizzard stance); path following, reaction and avoidance are identical. On Alpine and
 * Fjord the weather decisions have nothing to act on (no fronts, drifts or blizzards), so the
 * weather-blind policy there is the same driver on the same terms.
 *
 * Recorded per run, from the engine itself (no re-implementation of its physics):
 * - outcome, time, distance, crashes, chase time, the Yeti gap (min / final / at 10-20-30 s of each
 *   chase), snowball throws and hits (Hard);
 * - from every environment sample: hazard knocks; lateral displacement from side-slip (∫|slip|dt);
 *   time-weighted exposure and time on fully exposed ground (≥ 0.86, where skid drag applies);
 *   mean speed overall and while a blizzard is acting on the skier;
 * - blizzards: cells encountered (skier within r + reach while it blows), time under their effect, and
 *   the part of that time in the trailing zone beyond r + 2 — the zone the old hazard-pass skip cut
 *   off (W-034) — with the side-slip displacement accumulated there;
 * - route: samples on the exposed alternate line vs the sheltered main line.
 */
import '../../src/world/biomes';
import { buildMountain, courseId, DIFFICULTY, makeCourse, worldSeed, type Difficulty, type LengthMode } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { getHazardKind, hazardPhase, type HazardInstance } from '../../src/world/hazards/hazard';
import { BLIZZARD, blizzardStrength } from '../../src/world/biomes/whiteout/hazards';
import type { EnvQuery, EnvSample } from '../../src/physics/environment';
import { whiteoutDriver, type WhiteoutPolicy } from './whiteoutDriver';
import type { BiomeId } from '../../src/world/biome';

export const POLICIES: Record<string, WhiteoutPolicy> = {
  informed: { lines: 'weather', drifts: 'gap', blizzard: 'brake' },
  blind: { lines: 'always', drifts: 'ignore', blizzard: 'ignore' },
  // one decision at a time (the others weather-blind)
  linesOnly: { lines: 'weather', drifts: 'ignore', blizzard: 'ignore' },
  driftsOnly: { lines: 'always', drifts: 'gap', blizzard: 'ignore' },
  blizzOnly: { lines: 'always', drifts: 'ignore', blizzard: 'brake' },
  // a competent drift reader: sees the row earlier, crosses to the gap gradually, keeps the tuck
  driftsEarly: { lines: 'always', drifts: 'gapEarly', blizzard: 'ignore' },
  informedEarly: { lines: 'weather', drifts: 'gapEarly', blizzard: 'brake' },
  // route choice with the other decisions informed: always exposed / always sheltered
  exposed: { lines: 'always', drifts: 'gap', blizzard: 'brake' },
  sheltered: { lines: 'never', drifts: 'gap', blizzard: 'brake' },
  // round 2 (W-035): the full weather reader — storm line, drift gaps, blizzard stance and the lee
  // of the piste in a front — and its variants; the drift-hop policies (W-045)
  informed2: { lines: 'weather', drifts: 'gap', blizzard: 'brake', lee: true },
  informed2Edge: { lines: 'weather', drifts: 'gap', blizzard: 'brake', lee: true, edge: true },
  leeOnly: { lines: 'always', drifts: 'ignore', blizzard: 'ignore', lee: true },
  informed2NoLee: { lines: 'weather', drifts: 'gap', blizzard: 'brake' },
  edgeOnly: { lines: 'always', drifts: 'ignore', blizzard: 'ignore', edge: true },
  hopTimed: { lines: 'always', drifts: 'hopTimed', blizzard: 'ignore' },
  hopSpam: { lines: 'always', drifts: 'hopSpam', blizzard: 'ignore' },
};

export interface RunSpec {
  biome: BiomeId;
  len: LengthMode;
  diff: Difficulty;
  seed: string;
  policy: keyof typeof POLICIES;
  react?: number;
}

export interface RunResult extends RunSpec {
  courseId: string;
  outcome: string;
  time: number;
  distance: number;
  finishZ: number;
  crashes: number;
  chaseTime: number;
  minGap: number | null;
  finalGap: number | null;
  gapAt: (number | null)[];
  knocks: number;
  snowballThrows: number;
  snowballHits: number;
  slipDisplacement: number;
  exposureMean: number;
  exposedTime: number;
  speedMean: number;
  blizzards: number;
  blizzardTime: number;
  blizzardTrailTime: number;
  blizzardTrailSlip: number;
  speedInBlizzard: number | null;
  altSamples: number;
  mainSamples: number;
  driftSteers: number;
  blizzardStandUps: number;
  /** what each crash was (time, z, reason), from the simulation's log */
  crashLog: string[];
  /** steps spent on the lee line (round-2 policies) */
  leeSamples: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function measure(spec: RunSpec): RunResult {
  const c = makeCourse('custom', spec.len, { biome: spec.biome, customText: spec.seed, difficulty: spec.diff });
  const ws = worldSeed(c);
  const m = buildMountain(c);
  const env = new BiomeEnvironment(m, ws, { difficulty: spec.diff });
  const field = new ObstacleField(m, ws);
  const stats = { alt: 0, main: 0, gapSteers: 0, brakes: 0 };
  const driver = whiteoutDriver(m, env, ws, POLICIES[spec.policy]!, stats, spec.react ?? 0.25, field);

  // ---- environment instrumentation (reads the engine's own outputs) ----
  let lastT = -1;
  let knocks = 0;
  let slipDisp = 0;
  let expoAcc = 0;
  let expoT = 0;
  let exposedT = 0;
  let spdAcc = 0;
  let spdT = 0;
  let blizT = 0;
  let blizTrailT = 0;
  let blizTrailSlip = 0;
  let blizSpd = 0;
  const blizSeen = new Set<number>();
  const near: HazardInstance[] = [];
  const orig = env.sample.bind(env);
  env.sample = (q: EnvQuery, out: EnvSample) => {
    orig(q, out);
    const dt = lastT < 0 ? 0 : Math.max(0, Math.min(0.1, q.t - lastT));
    lastT = q.t;
    if (dt <= 0 || q.crashed) return;
    if (out.knock) knocks++;
    const slip = Math.hypot(out.groundSlipX, out.groundSlipZ);
    slipDisp += slip * dt;
    const ex = env.lastExposure ?? 0;
    expoAcc += ex * dt;
    expoT += dt;
    if (ex >= 0.86) exposedT += dt;
    spdAcc += q.speed * dt;
    spdT += dt;
    if (spec.biome !== 'whiteout') return;
    env.hazards.near(q.x, q.z, BLIZZARD.r + BLIZZARD.reach + 4, near);
    let inBliz = false;
    let trail = false;
    for (const h of near) {
      if (h.kind !== 'blizzard') continue;
      const ph = hazardPhase(getHazardKind(h.kind), h, q.t);
      if (blizzardStrength(ph.phase, ph.u) <= 0) continue;
      const d = Math.hypot(q.x - h.x, q.z - h.z);
      if (d > h.r + BLIZZARD.reach) continue;
      inBliz = true;
      blizSeen.add(h.id);
      if (q.z > h.z + h.r + 2) trail = true;
    }
    if (inBliz) {
      blizT += dt;
      blizSpd += q.speed * dt;
    }
    if (trail) {
      blizTrailT += dt;
      blizTrailSlip += slip * dt;
    }
  };

  // ---- Yeti gap trajectory (per chase: the gap at 10 / 20 / 30 s into it) ----
  const gapAt: (number | null)[] = [];
  let mark = 0;
  const simLog: string[] = [];
  const res = simulateCourse(m, field, driver, {
    log: simLog,
    streaming: true,
    environment: env,
    yetiSpeed: DIFFICULTY[spec.diff].yetiSpeed,
    maxTime: spec.len === 'sprint' ? 900 : 2400,
    snowballs: spec.diff === 'hard',
    dodge: spec.diff === 'hard',
    trace: (_e, ct, _s, yeti, start) => {
      if (start) {
        mark = 0;
        return;
      }
      while (mark < 3 && ct >= (mark + 1) * 10) {
        gapAt.push(yeti.phase === 'chase' ? r1(yeti.distance) : null);
        mark++;
      }
    },
  });
  return {
    ...spec,
    courseId: courseId(c),
    outcome: res.outcome,
    time: r1(res.time),
    distance: Math.round(res.distance),
    finishZ: Math.round(m.finishZ),
    crashes: res.crashes,
    chaseTime: r1(res.chaseTime),
    minGap: Number.isFinite(res.minGap) ? r1(res.minGap) : null,
    finalGap: Number.isFinite(res.finalGap) ? r1(res.finalGap) : null,
    gapAt,
    knocks,
    snowballThrows: res.snowballs?.throws ?? 0,
    snowballHits: res.snowballs?.hits ?? 0,
    slipDisplacement: r1(slipDisp),
    exposureMean: r2(expoT ? expoAcc / expoT : 0),
    exposedTime: r1(exposedT),
    speedMean: r2(spdT ? spdAcc / spdT : 0),
    blizzards: blizSeen.size,
    blizzardTime: r1(blizT),
    blizzardTrailTime: r1(blizTrailT),
    blizzardTrailSlip: r1(blizTrailSlip),
    speedInBlizzard: blizT > 0 ? r2(blizSpd / blizT) : null,
    altSamples: stats.alt,
    mainSamples: stats.main,
    driftSteers: stats.gapSteers,
    blizzardStandUps: stats.brakes,
    crashLog: simLog.filter((l) => !/encounter/.test(l)),
    leeSamples: (stats as { lee?: number }).lee ?? 0,
  };
}
