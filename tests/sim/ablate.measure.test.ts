/** W-034 ablation (in-memory only; nothing persists): which Whiteout weather mechanism the Normal difficulty comes from. OUT=… [ONLY=…] npx vitest run --config vitest.sim.config.ts tests/sim/ablate.measure.test.ts */
import { it } from 'vitest';
import '../../src/world/biomes';
import { getBiome } from '../../src/world/biome';
import { capabilitiesOf } from '../../src/world/capabilities';
import { measure } from './balance';
import { expectSimRows } from './checkRows';
const E = (globalThis as any).process.env;
it('ablate', async () => {
  const fs = await import('node:fs' as string);
  const b = getBiome('whiteout');
  const caps = capabilitiesOf(b) as any;
  const cpl = caps.weather.coupling;
  const hz = caps.hazards;
  const base = { cpl: JSON.parse(JSON.stringify(cpl)), intensity: JSON.parse(JSON.stringify(hz.intensity)), kinds: [...hz.kinds] };
  const restore = () => { Object.assign(cpl, JSON.parse(JSON.stringify(base.cpl))); Object.assign(hz.intensity, JSON.parse(JSON.stringify(base.intensity))); hz.kinds = [...base.kinds]; };
  const V: Record<string, () => void> = {
    baseline: () => {},
    noSlipSkid: () => { cpl.groundSlip = 0; cpl.skidDrag = 0; },
    noHeadwind: () => { cpl.headwind = { relaxed: 0, normal: 0, hard: 0 }; },
    noHazards: () => { hz.intensity.relaxed = 0; hz.intensity.normal = 0; hz.intensity.hard = 0; },
    noAirBalance: () => { cpl.airborne = 0; cpl.balance = 0; },
    noDrifts: () => { hz.kinds = ['blizzard']; },
    noBlizzards: () => { hz.kinds = ['wind-drift']; },
    allOff: () => { cpl.groundSlip = 0; cpl.skidDrag = 0; cpl.headwind = { relaxed: 0, normal: 0, hard: 0 }; cpl.airborne = 0; cpl.balance = 0; hz.intensity.relaxed = 0; hz.intensity.normal = 0; hz.intensity.hard = 0; },
  };
  const rows: Record<string, unknown>[] = [];
  for (const [name, apply] of Object.entries(V)) {
    if (E.ONLY && !E.ONLY.split(',').includes(name)) continue;
    restore(); apply();
    for (let i = 1; i <= 24; i++) {
      const r = measure({ biome: 'whiteout', len: 'sprint', diff: (E.DIFF ?? 'normal'), seed: `W034-${String(i).padStart(2, '0')}`, policy: 'blind' });
      rows.push({ variant: name, ...r });
      fs.appendFileSync(E.OUT, JSON.stringify({ variant: name, ...r }) + '\n');
    }
  }
  restore();
  expectSimRows(rows, ['time', 'distance', 'minGap']);
}, 86_400_000);
