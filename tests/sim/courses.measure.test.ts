/**
 * Whiteout course matrix (round-1 evidence): every length × difficulty for Classic, Custom and seven
 * consecutive Daily dates, built headless from the shipped generators.
 *
 * Per course: the course code round-trips through parseCourseId, the world is deterministic (two
 * builds give the same hazard list), the finish is where the length says, the cave encounter exists,
 * storm fronts are scheduled, drifts and blizzard cells exist along the whole course, and (Sprint and
 * Standard, Normal) the skilled autopilot's outcome. Endless: the mountain and hazards are sampled
 * out to 60 km.
 *
 *   OUT=… npx vitest run --config vitest.sim.config.ts tests/sim/courses.measure.test.ts
 */
import { it, expect } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, courseId, DIFFICULTY, LENGTH_INFO, LENGTH_MODES, makeCourse, parseCourseId, worldSeed, addDays, utcDate, type Difficulty, type LengthMode, type CourseConfig } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { frontAt } from '../../src/world/biomes/whiteout/storm';
import { whiteoutDriver } from './whiteoutDriver';
import { POLICIES } from './balance';

const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process;
const OUT = proc.env.OUT ?? 'docs/reviews/biomes/whiteout/round-1/courses.json';

function hazardDigest(c: CourseConfig, z1: number) {
  const m = buildMountain(c);
  const env = new BiomeEnvironment(m, worldSeed(c), { difficulty: c.difficulty });
  const list: string[] = [];
  const kinds: Record<string, { n: number; lastZ: number }> = {};
  for (let z = 0; z < z1; z += 1000) {
    env.hazards.ensure(z, z + 1000);
    for (const h of env.hazards.peek(z, z + 1000)) {
      list.push(`${h.kind}:${h.x.toFixed(2)}:${h.z.toFixed(2)}`);
      const k = (kinds[h.kind] ??= { n: 0, lastZ: 0 });
      k.n++;
      k.lastZ = Math.max(k.lastZ, h.z);
    }
    env.hazards.release(z + 1000, z + 2000);
  }
  return { m, list, kinds };
}

it('Whiteout course matrix', async () => {
  const rows: unknown[] = [];
  const diffs = Object.keys(DIFFICULTY) as Difficulty[];
  const today = utcDate();
  const courses: CourseConfig[] = [];
  for (const len of LENGTH_MODES as readonly LengthMode[])
    for (const d of diffs) {
      courses.push(makeCourse('classic', len, { biome: 'whiteout', difficulty: d }));
      courses.push(makeCourse('custom', len, { biome: 'whiteout', difficulty: d, customText: 'WO-R1' }));
    }
  for (let i = 0; i < 7; i++) for (const len of ['sprint', 'standard', 'endless'] as LengthMode[]) courses.push(makeCourse('daily', len, { biome: 'whiteout', date: addDays(today, -i), difficulty: 'normal' }));

  for (const c of courses) {
    const id = courseId(c);
    const back = parseCourseId(id);
    const metres = LENGTH_INFO[c.length].metres;
    const span = Number.isFinite(metres) ? metres : 60_000;
    const a = hazardDigest(c, span);
    const b = hazardDigest(c, Math.min(span, 10_000));
    const deterministic = b.list.every((s, i) => s === a.list[i]);
    const enc = a.m.profile.encounters(0, Number.isFinite(a.m.finishZ) ? a.m.finishZ : span);
    const ws = worldSeed(c);
    let fronts = 0;
    let lastK = -1;
    for (let t = 0; t < 1200; t += 2) {
      const f = frontAt(t, ws);
      if (f.phase === 'storm' && f.k !== lastK) {
        fronts++;
        lastK = f.k;
      }
    }
    let sim: { outcome: string; time: number } | null = null;
    if ((c.length === 'sprint' || c.length === 'standard') && c.difficulty === 'normal') {
      const env = new BiomeEnvironment(a.m, ws, { difficulty: c.difficulty });
      const field = new ObstacleField(a.m, ws);
      const drv = whiteoutDriver(a.m, env, ws, POLICIES.informed!, undefined, 0.25, field);
      const r = simulateCourse(a.m, field, drv, { streaming: true, environment: env, yetiSpeed: DIFFICULTY[c.difficulty].yetiSpeed, maxTime: c.length === 'sprint' ? 900 : 2400 });
      sim = { outcome: r.outcome, time: Math.round(r.time * 10) / 10 };
    }
    const row = {
      id,
      mode: c.mode,
      length: c.length,
      difficulty: c.difficulty,
      date: c.date ?? null,
      roundTrip: !!back && courseId(back) === id,
      finishZ: a.m.finishZ,
      encounters: enc.length,
      stormFrontsIn20min: fronts,
      hazards: a.kinds,
      deterministic,
      sim,
    };
    rows.push(row);
    expect(row.roundTrip, id).toBe(true);
    expect(deterministic, id).toBe(true);
    expect(enc.length, id).toBeGreaterThan(0);
    expect(fronts, id).toBeGreaterThan(0);
    if (Number.isFinite(metres)) expect(Math.abs(a.m.finishZ - metres), id).toBeLessThan(metres * 0.05);
    expect(a.kinds['wind-drift']?.n ?? 0, id).toBeGreaterThan(0);
  }
  const fs = (await import('node:fs' as string)) as { writeFileSync: (p: string, s: string) => void };
  fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
});
