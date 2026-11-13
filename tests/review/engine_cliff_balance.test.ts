// Engine-cliff evidence probe (run: npx vitest run --config tests/review/vitest.config.ts tests/review/engine_cliff_balance.test.ts --disableConsoleIntercept)
// Alpine headless balance + trajectory fingerprints. Used before/after the engine fix.
import { it } from 'vitest';
import '../../src/world/biomes';
import { DIFFICULTY, buildMountain, makeCourse, worldSeed, type Difficulty, type LengthMode } from '../../src/game/CourseConfig';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse, worldFor } from '../../src/game/simulate';
import { autopilotInput, type AutopilotStyle } from '../../src/debug/autopilot';
import type { SkierState } from '../../src/physics/SkierPhysics';
const ENV = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const E = ENV;
const list = (k: string, d: string) => (E[k] ?? d).split(',').map((s) => s.trim()).filter(Boolean);
const f64 = new Float64Array(1); const u32 = new Uint32Array(f64.buffer);
function mix(h: number, x: number) { f64[0] = x; h = Math.imul(h ^ u32[0]!, 0x9e3779b1) >>> 0; return Math.imul(h ^ u32[1]!, 0x85ebca6b) >>> 0; }
it('alpine balance', () => {
  const rows: string[] = [];
  const runs: Array<{ len: LengthMode | 'classic'; seed: string; diff: Difficulty }> = [];
  for (const len of list('LENS', 'sprint,standard') as LengthMode[]) for (const seed of list('SEEDS', 'EC1,EC2,EC3,EC4,EC5,EC6')) for (const diff of list('DIFFS', 'normal,hard') as Difficulty[]) runs.push({ len, seed, diff });
  runs.push({ len: 'classic', seed: 'classic', diff: 'normal' });
  for (const r of runs) for (const style of list('STYLES', 'skilled,intermediate,average,cautious,careless') as AutopilotStyle[]) {
    let m, f;
    if (r.len === 'classic') ({ m, f } = worldFor());
    else { const c = makeCourse('custom', r.len, { customText: r.seed, difficulty: r.diff }); const ws = worldSeed(c); m = buildMountain(c); f = new ObstacleField(m, ws); }
    let h = 0x811c9dc5, steps = 0, air = 0, maxVy = 0;
    const log: string[] = [];
    const res = simulateCourse(m, f, (s: SkierState, t: number) => { h = mix(mix(mix(mix(h, s.pos.x), s.pos.y), s.pos.z), s.vel.y); steps++; if (!s.grounded) air++; maxVy = Math.max(maxVy, s.vel.y); return autopilotInput(m!, s, style, t); }, {
      streaming: r.len !== 'classic', log, yetiSpeed: DIFFICULTY[r.diff].yetiSpeed, maxTime: r.len === 'standard' ? 1400 : 900, snowballs: r.diff === 'hard', dodge: r.diff === 'hard' && style === 'skilled',
    });
    rows.push(JSON.stringify({ len: r.len, seed: r.seed, diff: r.diff, style, outcome: res.outcome, time: +res.time.toFixed(3), minGap: Number.isFinite(res.minGap) ? +res.minGap.toFixed(2) : null, crashes: res.crashes, maxSpeed: +res.maxSpeed.toFixed(3), enc: res.encountersSurvived, airSteps: air, maxVy: +maxVy.toFixed(3), hash: h.toString(16), steps, crashLog: log.filter((l) => !l.includes('encounter') && !l.includes('snowball')) }));
  }
  for (const r of rows) console.log('BAL ' + r);
});
