// Tabulate fjord_r2_balance.test.ts output: node tests/review/fjord_r2_table.mjs <file.jsonl>
import { readFileSync } from 'node:fs';
const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const drivers = ['reader', 'skilled', 'intermediate', 'average', 'cautious', 'careless'];
const cell = (rs) => {
  if (!rs.length) return '–';
  const w = rs.filter((r) => r.outcome === 'victory');
  const mean = w.length ? ` (${(w.reduce((a, r) => a + r.time, 0) / w.length).toFixed(1)} s)` : '';
  return `${w.length}/${rs.length}${mean}`;
};
for (const len of ['sprint', 'standard']) {
  console.log(`\n### ${len} (wins/runs, mean winning time)\n`);
  console.log(`| location | difficulty | env | ${drivers.join(' | ')} |`);
  console.log(`|---|---|---|${drivers.map(() => '---').join('|')}|`);
  for (const biome of ['alpine', 'fjord']) for (const diff of ['relaxed', 'normal', 'hard']) for (const env of [true, false]) {
    const sel = rows.filter((r) => r.len === len && r.biome === biome && r.diff === diff && r.env === env);
    if (!sel.length) continue;
    console.log(`| ${biome} | ${diff} | ${env ? 'on' : 'off'} | ${drivers.map((d) => cell(sel.filter((r) => r.driver === d))).join(' | ')} |`);
  }
}
// paired env on/off time deltas (both won) per driver
console.log('\n### Fjord environment on − off (same seed and difficulty, both runs won)\n');
console.log('| length | driver | pairs | mean Δt (s) | max Δt (s) | outcome changes (on/off) |');
console.log('|---|---|---|---|---|---|');
for (const len of ['sprint', 'standard']) for (const d of drivers) {
  let n = 0, sum = 0, max = -Infinity, flips = [];
  for (const off of rows.filter((r) => r.len === len && r.biome === 'fjord' && !r.env && r.driver === d)) {
    const on = rows.find((r) => r.len === len && r.biome === 'fjord' && r.env && r.driver === d && r.seed === off.seed && r.diff === off.diff);
    if (!on) continue;
    if (on.outcome !== off.outcome) flips.push(`${off.seed}/${off.diff[0]}: ${on.outcome}/${off.outcome}`);
    if (on.outcome === 'victory' && off.outcome === 'victory') { n++; sum += on.time - off.time; max = Math.max(max, on.time - off.time); }
  }
  console.log(`| ${len} | ${d} | ${n} | ${n ? (sum / n).toFixed(2) : '–'} | ${n ? max.toFixed(2) : '–'} | ${flips.join('; ') || 'none'} |`);
}
