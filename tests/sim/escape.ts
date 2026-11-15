/**
 * Yeti escape analysis (Pass 6): for one course and driver, run the headless game up to ~1.2 km past
 * the first cave and record what decides the chase — the skier's speed at the start, the grade of
 * the run-out, the Yeti's start distance and real pursuit speed, the gap over time and the outcome.
 */
import '../../src/world/biomes';
import { DIFFICULTY, buildMountain, makeCourse, worldSeed, type Difficulty, type LengthMode, type CourseMode } from '../../src/game/CourseConfig';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { NO_INPUT, type SkierInput, type SkierState } from '../../src/physics/SkierPhysics';
import { clamp, wrapAngle } from '../../src/core/rng';
import type { Mountain } from '../../src/world/course';

/** the 'poles' driver holds the button below this speed (m/s), tucks above it */
export const POLE_UNTIL = 40 / 3.6;

export type EscapeDriver = 'skilled' | 'intermediate' | 'straight' | 'gravity' | 'poles';

export interface EscapeCase {
  mode: CourseMode;
  len: LengthMode;
  key: string; // date (daily) or text (custom)
  biome: string;
  diff: Difficulty;
  driver: EscapeDriver;
  /** the skier's speed when the chase starts (m/s): a player who came into the cave slow; absent = as skied */
  startV?: number;
  /** the skier crashes this many seconds into the chase (the one mistake a player makes) */
  crashAt?: number;
}

/** follow the racing line; tuck `tuck(speed)`; optional extra input (pole push) */
function lineDriver(m: Mountain, tuck: (v: number) => number, extra?: (s: SkierState) => Partial<SkierInput>) {
  return (s: SkierState): SkierInput => {
    const look = 7 + s.speed * 0.55;
    const tz = s.pos.z + look;
    const err = wrapAngle(Math.atan2(m.routeX(tz) - s.pos.x, look) - s.heading);
    // (a held pole button also gets a crashed skier up: it is the Recover button)
    const e = extra ? extra(s) : {};
    return { ...NO_INPUT, steer: clamp(-err * 3.2, -1, 1), tuck: tuck(s.speed), recover: s.crashTime > 1.4, ...e };
  };
}

export function driverFor(m: Mountain, d: EscapeDriver): (s: SkierState, t: number) => SkierInput {
  if (d === 'skilled' || d === 'intermediate') return (s, t) => autopilotInput(m, s, d, t);
  // straight: always tucked (the old skate assist engages below 7 m/s)
  if (d === 'straight') return lineDriver(m, () => 1);
  // gravity: tucked only above 7 m/s (no skate assist): what the slope alone gives
  if (d === 'gravity') return lineDriver(m, (v) => (v >= 7 ? 1 : 0.1));
  // poles: like 'straight', but pole-pushing (the Recover button held) below 40 km/h
  // (a player lets go of the button after getting up, then holds it again: poleArmed)
  return lineDriver(m, () => 1, (s) => ({ pole: s.speed < POLE_UNTIL && !s.crashed && s.poleArmed }));
}

export interface EscapeRow extends EscapeCase {
  code: string;
  caveZ: number;
  v0: number;
  /** base grade (profile) mean/min over 400 m past the trigger; effective grade along the racing line */
  gradeMean: number;
  gradeMin: number;
  gradeEff: number;
  yetiStart: number;
  yetiMeanSpeed: number;
  yetiMaxSpeed: number;
  skierMeanSpeed: number;
  /** gap (m) at t = 0, 5, 10, 15, 20, 30 s into the chase (null after the end) */
  gaps: Array<number | null>;
  /** skier speed (m/s) at the same times */
  speeds: Array<number | null>;
  minGap: number;
  outcome: string;
  captureT: number | null;
  crashes: number;
}

const SAMPLE_T = [0, 5, 10, 15, 20, 30];

export function runEscape(c: EscapeCase): EscapeRow {
  const course = makeCourse(c.mode, c.len, c.mode === 'daily' ? { date: c.key, difficulty: c.diff, biome: c.biome } : { customText: c.key, difficulty: c.diff, biome: c.biome });
  const ws = worldSeed(course);
  const m = buildMountain(course);
  const f = new ObstacleField(m, ws);
  const env = new BiomeEnvironment(m, ws, { difficulty: c.diff });
  const enc = m.profile.encounters(0, Number.isFinite(m.finishZ) ? m.finishZ : 30000)[0]!;
  let first: number | null = null;
  let yStart = NaN;
  let ySum = 0;
  let yMax = 0;
  let sSum = 0;
  let n = 0;
  let lastCt = 0;
  const gaps: Array<number | null> = SAMPLE_T.map(() => null);
  const speeds: Array<number | null> = SAMPLE_T.map(() => null);
  let v0 = NaN;
  const r = simulateCourse(m, f, driverFor(m, c.driver), {
    streaming: true,
    environment: env,
    yetiSpeed: DIFFICULTY[c.diff].yetiSpeed,
    snowballs: c.diff === 'hard',
    dodge: c.diff === 'hard',
    maxZ: enc.triggerZ + 1200,
    crashAtChase: c.crashAt !== undefined ? [c.crashAt] : [],
    maxTime: 600,
    trace: (e, ct, s, y, start) => {
      if (e.index !== enc.index) return;
      if (start) {
        if (c.startV !== undefined) {
          const sp = s.vel.length();
          if (sp > 1e-3) s.vel.multiplyScalar(c.startV / sp);
          else s.vel.set(Math.sin(s.heading) * c.startV, 0, Math.cos(s.heading) * c.startV);
        }
        v0 = s.speed;
        first = 0;
        return;
      }
      lastCt = ct;
      if (Number.isNaN(yStart) && !y.airborne) yStart = y.distance;
      if (!y.airborne) {
        ySum += y.speed;
        yMax = Math.max(yMax, y.speed);
        sSum += s.speed;
        n++;
      }
      SAMPLE_T.forEach((T, i) => {
        if (gaps[i] === null && ct >= T) {
          gaps[i] = +y.distance.toFixed(1);
          speeds[i] = +s.speed.toFixed(2);
        }
      });
    },
  });
  // terrain past the trigger
  let gs = 0;
  let gmin = 90;
  for (let z = enc.triggerZ; z <= enc.triggerZ + 400; z += 10) {
    const g = m.slopeDeg(z);
    gs += g;
    gmin = Math.min(gmin, g);
  }
  // effective grade along the line: height drop over path length
  let path = 0;
  let px = m.routeX(enc.triggerZ);
  let pz = enc.triggerZ;
  const h0 = m.heightAt(px, pz);
  for (let z = enc.triggerZ + 5; z <= enc.triggerZ + 400; z += 5) {
    const x = m.routeX(z);
    path += Math.hypot(x - px, z - pz);
    px = x;
    pz = z;
  }
  const drop = h0 - m.heightAt(px, pz);
  void first;
  return {
    ...c,
    code: `${course.seed}`,
    caveZ: Math.round(enc.caveZ),
    v0: +v0.toFixed(2),
    gradeMean: +(gs / 41).toFixed(1),
    gradeMin: +gmin.toFixed(1),
    gradeEff: +((Math.atan2(drop, path) * 180) / Math.PI).toFixed(1),
    yetiStart: +yStart.toFixed(1),
    yetiMeanSpeed: n ? +(ySum / n).toFixed(2) : 0,
    yetiMaxSpeed: +yMax.toFixed(2),
    skierMeanSpeed: n ? +(sSum / n).toFixed(2) : 0,
    gaps,
    speeds,
    minGap: Number.isFinite(r.minGap) ? +r.minGap.toFixed(1) : -1,
    outcome: r.outcome,
    captureT: r.outcome === 'caught' ? +lastCt.toFixed(1) : null,
    crashes: r.crashes,
  };
}
