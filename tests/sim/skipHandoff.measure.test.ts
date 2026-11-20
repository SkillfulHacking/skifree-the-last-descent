/**
 * Cinematic skip vs watch (round 3, owner's report): the chase state on the first controllable frame
 * and the Yeti gap 1, 3, 5 and 10 s later, for the same course, skier arrival and input, when the
 * cave cinematic is watched to its end or skipped at different moments.
 *
 * The cinematic freezes the skier; the Yeti's filmed leap (caveHandoff.stepCineLeap from the leap
 * beat) is replayed at 60 fps up to the skip time, then the hand-off under test starts the chase.
 *   HANDOFF=legacy|canonical OUT=… npx vitest run --config vitest.sim.config.ts tests/sim/skipHandoff.measure.test.ts
 */
import { it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { buildMountain, DIFFICULTY, makeCourse, worldSeed, type Difficulty, type LengthMode } from '../../src/game/CourseConfig';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import { CAVE_LEAP_AT, startCanonicalChase } from '../../src/cinematic/caveHandoff';
import { LEGACY_CINEMATIC_END, cinematicLeapAt, legacyHandoffYeti } from '../support/legacyCaveHandoff';
import type { BiomeId } from '../../src/world/biome';

const P = (globalThis as unknown as { process: { env: Record<string, string | undefined>; stdout: { write(s: string): void } } }).process;

/** the moments a player can leave the cinematic: watched to the end, or skipped at t (s) */
export const SKIP_CASES: Array<{ name: string; t: number }> = [
  { name: 'watched', t: Infinity },
  { name: 'skip before emergence (3.0 s)', t: 3.0 },
  { name: 'skip during emergence (9.0 s)', t: 9.0 },
  { name: 'skip just before the leap', t: CAVE_LEAP_AT - 0.1 },
  { name: 'skip while airborne (+0.4 s)', t: CAVE_LEAP_AT + 0.4 },
  { name: 'skip after landing (+1.9 s)', t: CAVE_LEAP_AT + 1.9 },
];

it('skip vs watch', async () => {
  const fs = (await import('node:fs' as string)) as { writeFileSync: (p: string, d: string) => void };
  const rows: unknown[] = [];
  const biomes = (P.env.BIOMES ?? 'alpine,fjord,whiteout').split(',') as BiomeId[];
  const diffs = (P.env.DIFFS ?? 'normal').split(',') as Difficulty[];
  for (const biome of biomes)
    for (const diff of diffs)
      for (const len of (P.env.LENS ?? 'sprint').split(',') as LengthMode[])
        for (const style of ['skilled', 'cautious'] as const) {
          const c = makeCourse('classic', len, { biome, difficulty: diff });
          for (const k of SKIP_CASES) {
            const m = buildMountain(c);
            const f = new ObstacleField(m, worldSeed(c));
            const h = (x: number, z: number) => m.heightAt(x, z);
            const rec: Record<string, unknown> = { biome, diff, len, style, case: k.name, skipT: k.t };
            const gapAt: Record<string, number> = {};
            let first = true;
            const res = simulateCourse(m, f, (s, t) => autopilotInput(m, s, style, t), {
              streaming: true,
              yetiSpeed: DIFFICULTY[diff].yetiSpeed,
              maxTime: 200,
              maxZ: m.finishZ,
              handoff: (yeti, sp, e) => {
                // HANDOFF=legacy: the pre-round-3 hand-off (watched = the old 18 s cinematic); otherwise the
                // game's: the canonical start, whatever the moment (the cinematic now ends at the leap)
                if (P.env.HANDOFF === 'legacy' && e.index === 0) {
                  const { leap, pos } = cinematicLeapAt(sp, Math.min(k.t, LEGACY_CINEMATIC_END), h);
                  legacyHandoffYeti(yeti, leap, pos, sp, h);
                } else startCanonicalChase(yeti, sp, h);
              },
              trace: (e, ct, s, yeti, start) => {
                if (e.index !== 0) return;
                if (start || first) {
                  if (!start) first = false;
                  if (start)
                    Object.assign(rec, {
                      skier: { x: +s.pos.x.toFixed(2), z: +s.pos.z.toFixed(2), speed: +s.speed.toFixed(2), vx: +s.vel.x.toFixed(2), vz: +s.vel.z.toFixed(2) },
                      yeti: { x: +yeti.pos.x.toFixed(2), y: +yeti.pos.y.toFixed(2), z: +yeti.pos.z.toFixed(2), vx: +yeti.vel.x.toFixed(2), vy: +yeti.vy.toFixed(2), vz: +yeti.vel.z.toFixed(2), speed: +yeti.speed.toFixed(2), airborne: yeti.airborne, delay: +yeti.delay.toFixed(2), heading: +yeti.heading.toFixed(3) },
                      separation: +new THREE.Vector3(s.pos.x - yeti.pos.x, s.pos.y - yeti.pos.y, s.pos.z - yeti.pos.z).length().toFixed(2),
                    });
                  return;
                }
                for (const mark of [1, 3, 5, 10]) if (gapAt[mark] === undefined && ct >= mark) gapAt[mark] = +yeti.distance.toFixed(2);
                if (ct >= 1 && rec.slowStart === undefined) rec.slowStart = { startSkierSpeed: +yeti.startSkierSpeed.toFixed(2), extraDelay: +yeti.extraDelay.toFixed(2) };
              },
            });
            Object.assign(rec, { gapAt, outcome: res.outcome, time: +res.time.toFixed(1), minGap: +res.minGap.toFixed(1) });
            rows.push(rec);
            P.stdout.write(`\n${biome} ${diff} ${len} ${style} | ${k.name.padEnd(32)} | yeti ${JSON.stringify(rec.yeti)} sep ${rec.separation} | gaps ${JSON.stringify(gapAt)} | ${res.outcome}`);
          }
        }
  fs.writeFileSync(P.env.OUT ?? '/tmp/skip_handoff.json', JSON.stringify(rows, null, 1));
  P.stdout.write('\n');
}, 3_600_000);
