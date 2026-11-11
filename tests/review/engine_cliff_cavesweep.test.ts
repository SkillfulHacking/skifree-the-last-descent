// Engine-cliff evidence probe (run: npx vitest run --config tests/review/vitest.config.ts tests/review/engine_cliff_cavesweep.test.ts --disableConsoleIntercept)
// Adapted from Reviewer B r3 cavelaunch.test.ts: approaches toward the cave side around every cave (Alpine side +1;
// Fjord side -1 when BIOME=fjord). Reports long airs, peak vy, one-step speed jumps, energy creation, crash reasons.
import { it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { GRAVITY, NO_INPUT, PHYS_DT, SkierPhysics } from '../../src/physics/SkierPhysics';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { clamp } from '../../src/core/rng';
const ENV = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const wrap2 = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
it('cave sweep', () => {
  const biome = ENV.BIOME ?? 'alpine';
  const side = biome === 'fjord' ? -1 : 1;
  let runs = 0, big = 0, maxAir = 0, maxVy = 0, maxJump = 0, maxDE = 0, maxRunDE = 0, deViol = 0;
  const reasons: Record<string, number> = {}; const ex: string[] = [];
  const seeds = (ENV.SEEDS ?? 'B3F1,B3F2,B3F3,B3F4,B3F5,B3F6,B3F7,B3F8').split(',');
  for (const sd of seeds) for (const len of ['sprint', 'standard', 'endurance'] as const) {
    const c0 = makeCourse('custom', len, { biome: biome as never, customText: sd }); const m = buildMountain(c0); const ws = worldSeed(c0);
    for (const e of m.profile.encounters(-Infinity, m.finishZ)) for (const dz0 of [-140, -110, -80]) for (const v0 of [12, 22, 32]) for (const ang of [0.4, 0.8, 1.1]) {
      const z0 = e.caveZ + dz0;
      const p = new SkierPhysics(m, null, () => [], new BiomeEnvironment(m, ws));
      p.reset(m.routeX(z0) + side * 4, z0, side * ang, v0);
      let air = 0, vy = 0; const E0 = 0.5 * p.s.speed ** 2 + GRAVITY * p.s.pos.y; let runDE = -Infinity;
      for (let i = 0; i < 9 / PHYS_DT; i++) {
        const s = p.s; const err = wrap2(side * ang - s.heading);
        const sp0 = s.speed; const e0 = 0.5 * sp0 * sp0 + GRAVITY * s.pos.y; const g0 = s.grounded && !s.crashed;
        p.step({ ...NO_INPUT, steer: clamp(-err * 3, -1, 1), tuck: 1, recover: s.crashTime > 1.4 });
        const e1 = 0.5 * s.speed ** 2 + GRAVITY * s.pos.y;
        if (g0 && sp0 > 7) { maxDE = Math.max(maxDE, e1 - e0); if (e1 - e0 > 0.3) deViol++; }
        if (!s.crashed && sp0 > 7) runDE = Math.max(runDE, e1 - E0);
        maxJump = Math.max(maxJump, s.speed - sp0);
        for (const ev of p.drainEvents()) if (ev.type === 'crash') reasons[ev.reason] = (reasons[ev.reason] ?? 0) + 1;
        air = Math.max(air, s.airTime); vy = Math.max(vy, s.vel.y);
      }
      runs++; maxAir = Math.max(maxAir, air); maxVy = Math.max(maxVy, vy); maxRunDE = Math.max(maxRunDE, runDE);
      if (air > Number(ENV.AIRX ?? 3)) { big++; if (ex.length < 3) ex.push(`${sd} ${len} cave ${e.index} dz0 ${dz0} v0 ${v0} ang ${ang}: air ${air.toFixed(1)} vy ${vy.toFixed(1)}`); }
    }
  }
  console.log(`CS ${biome}: ${runs} runs; air>3s ${big}; max air ${maxAir.toFixed(2)} s; max vy ${maxVy.toFixed(1)}; max one-step speed gain ${maxJump.toFixed(2)} m/s; max grounded-step energy gain ${maxDE.toFixed(3)} J/kg (steps >0.3: ${deViol}); max energy above start (uncrashed, >7 m/s) ${maxRunDE.toFixed(1)} J/kg; crashes ${JSON.stringify(reasons)}; e.g. ${ex.join(' | ')}`);
});
