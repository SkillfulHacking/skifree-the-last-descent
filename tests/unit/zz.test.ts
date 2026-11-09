import fs from 'node:fs';
import { it } from 'vitest';
import { simulateGenerated } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
it('x', () => {
  const out: string[] = [];
  const cases: [number, number, 'skilled' | 'intermediate' | 'careless', number, boolean][] = [];
  for (const L of [20000, 50000]) for (const seed of [4242, 7, 2026]) for (const st of ['skilled', 'intermediate', 'careless'] as const) cases.push([L, seed, st, 1, false]);
  for (const seed of [4242, 7, 2026, 11, 99]) for (const st of ['skilled'] as const) cases.push([3000, seed, st, 1.07, true], [20000, seed, st, 1.07, true]);
  for (const [L, seed, st, ys, sb] of cases) {
    const r = simulateGenerated(seed, L, (m) => (s, t) => autopilotInput(m, s, st, t), { maxTime: 4000, yetiSpeed: ys, snowballs: sb, dodge: sb });
    out.push(`${L} ${seed} ${st} ${ys > 1 ? 'HARD' : 'normal'}: ${r.outcome} t=${r.time.toFixed(0)} chase=${r.chaseTime.toFixed(0)} min=${r.minGap.toFixed(0)} dist=${r.distance.toFixed(0)} ${r.snowballs ? JSON.stringify(r.snowballs) : ''}`);
    fs.writeFileSync('/tmp/zz.out', out.join('\n') + '\n');
  }
}, 3600000);
