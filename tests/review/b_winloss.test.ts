import { it } from 'vitest';
import { Mountain } from '../../src/world/course';
import { simulateGenerated, simulateRun } from '../../src/game/simulate';
import { autopilotInput, type AutopilotStyle } from '../../src/debug/autopilot';
const drv = (st: AutopilotStyle) => (m: Mountain) => (s: Parameters<typeof autopilotInput>[1], t: number) => autopilotInput(m, s, st, t);
const cases: Array<[number, number, AutopilotStyle, number]> = [];
for (const seed of [1, 77, 31337, 20261107]) for (const st of ['skilled', 'careless', 'cautious'] as AutopilotStyle[]) cases.push([seed, 3000, st, 500]);
for (const seed of [1, 77, 31337]) for (const st of ['skilled', 'careless', 'cautious'] as AutopilotStyle[]) cases.push([seed, 10000, st, 1300]);
for (const st of ['skilled', 'careless'] as AutopilotStyle[]) cases.push([77, 20000, st, 2400]);
cases.push([31337, 50000, 'skilled', 5500]);
cases.push([31337, 50000, 'careless', 5500]);
cases.push([5, Infinity, 'skilled', 4000]);
cases.push([5, Infinity, 'careless', 4000]);
it('win/loss matrix', { timeout: 3_000_000 }, () => {
  for (const [seed, L, st, maxTime] of cases) {
    const t0 = performance.now();
    const r = simulateGenerated(seed, L, drv(st), { maxTime, maxZ: Number.isFinite(L) ? Infinity : 40000 });
    console.log(`L=${L} seed=${seed} ${st}: ${r.outcome} dist=${r.distance.toFixed(0)} t=${r.time.toFixed(0)}s chase=${r.chaseTime.toFixed(0)}s minGap=${r.minGap.toFixed(1)} enc=${r.encountersSurvived} crashes=${r.crashes} peakBands=${r.peakBands} (${((performance.now() - t0) / 1000).toFixed(0)}s wall)`);
  }
  for (const st of ['skilled', 'careless', 'cautious'] as AutopilotStyle[]) {
    const r = simulateRun((s, t) => autopilotInput(new Mountain(), s, st, t));
    console.log(`classic sprint ${st}: ${r.outcome}`);
  }
});
