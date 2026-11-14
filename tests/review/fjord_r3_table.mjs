// Tabulate fjord_r3_balance.test.ts output:  node tests/review/fjord_r3_table.mjs a.jsonl [b.jsonl ...]
// Prints markdown: per length a wins table (wins/runs, mean winning time, mean minimum Yeti gap), a
// ladder summary (Alpine vs Fjord per style group) and the Fjord environment on − off deltas.
import { readFileSync } from 'node:fs';
const all = process.argv.slice(2).flatMap((f) => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));
const key = (r) => [r.biome, r.len, r.seed, r.diff, r.driver, r.env].join('|');
const rows = [...new Map(all.map((r) => [key(r), r])).values()];
const DRV = ['reader', 'skilled', 'intermediate', 'average', 'cautious', 'careless'];
const DIF = ['relaxed', 'normal', 'hard'];
const won = (r) => r.outcome === 'victory' || r.outcome === 'distance';
const mean = (a) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : NaN);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '–');
const lens = [...new Set(rows.map((r) => r.len))];
const seedsOf = (len) => [...new Set(rows.filter((r) => r.len === len).map((r) => r.seed))].sort();
const cell = (rs) => {
  if (!rs.length) return '–';
  const w = rs.filter(won);
  const g = rs.map((r) => r.minGap).filter((x) => x !== null);
  return `${w.length}/${rs.length}${w.length ? ` · ${f1(mean(w.map((r) => r.time)))} s` : ''}${g.length ? ` · gap ${f1(mean(g))}` : ''}`;
};
for (const len of lens) {
  // only seeds that both locations ran (fair comparison)
  const sd = seedsOf(len).filter((s) => rows.some((r) => r.len === len && r.seed === s && r.biome === 'alpine') && rows.some((r) => r.len === len && r.seed === s && r.biome === 'fjord'));
  const R = rows.filter((r) => r.len === len && sd.includes(r.seed));
  console.log(`\n### ${len} — ${sd.length} seeds (${sd.join(', ')})\n`);
  console.log('Cells: wins/runs · mean winning time · mean minimum Yeti gap in the chase (m).\n');
  console.log(`| location | difficulty | env | ${DRV.join(' | ')} |`);
  console.log(`|---|---|---|${DRV.map(() => '---').join('|')}|`);
  for (const diff of DIF)
    for (const [b, env] of [['alpine', true], ['fjord', true], ['fjord', false]]) {
      const sel = R.filter((r) => r.biome === b && r.diff === diff && r.env === env);
      if (!sel.length) continue;
      console.log(`| ${b} | ${diff} | ${env ? 'on' : 'off'} | ${DRV.map((d) => cell(sel.filter((r) => r.driver === d))).join(' | ')} |`);
    }
  console.log(`\nLadder (environment on): wins, mean minimum gap, and mean time on the seeds both locations won.\n`);
  console.log('| difficulty | group | Alpine wins | Fjord wins | Alpine gap | Fjord gap | paired-won time Alpine → Fjord |');
  console.log('|---|---|---|---|---|---|---|');
  for (const diff of DIF)
    for (const [gname, grp] of [['competent (reader, skilled, intermediate)', ['reader', 'skilled', 'intermediate']], ['weaker (average, cautious)', ['average', 'cautious']]]) {
      const A = R.filter((r) => r.biome === 'alpine' && r.env && r.diff === diff && grp.includes(r.driver));
      const F = R.filter((r) => r.biome === 'fjord' && r.env && r.diff === diff && grp.includes(r.driver));
      if (!A.length || !F.length) continue;
      const ga = mean(A.map((r) => r.minGap).filter((x) => x !== null));
      const gf = mean(F.map((r) => r.minGap).filter((x) => x !== null));
      const ta = [];
      const tf = [];
      for (const a of A.filter(won)) {
        const f = F.find((r) => r.seed === a.seed && r.driver === a.driver && won(r));
        if (f) (ta.push(a.time), tf.push(f.time));
      }
      console.log(`| ${diff} | ${gname} | ${A.filter(won).length}/${A.length} | ${F.filter(won).length}/${F.length} | ${f1(ga)} | ${f1(gf)} | ${ta.length ? `${f1(mean(ta))} → ${f1(mean(tf))} s (${tf.length})` : '–'} |`);
    }
  const off = R.filter((r) => r.biome === 'fjord' && !r.env);
  if (off.length) {
    console.log(`\nFjord environment on − off (same seed and difficulty; Δt over runs both won; flips = outcome changes off → on):\n`);
    console.log('| driver | pairs won | mean Δt (s) | min Δt | max Δt | win→caught | caught→win |');
    console.log('|---|---|---|---|---|---|---|');
    for (const d of DRV) {
      const dts = [];
      let lost = 0;
      let gained = 0;
      for (const o of off.filter((r) => r.driver === d)) {
        const on = R.find((r) => r.biome === 'fjord' && r.env && r.seed === o.seed && r.diff === o.diff && r.driver === d);
        if (!on) continue;
        if (won(o) && won(on)) dts.push(on.time - o.time);
        else if (won(o) && !won(on)) lost++;
        else if (!won(o) && won(on)) gained++;
      }
      console.log(`| ${d} | ${dts.length} | ${f1(mean(dts))} | ${dts.length ? f1(Math.min(...dts)) : '–'} | ${dts.length ? f1(Math.max(...dts)) : '–'} | ${lost} | ${gained} |`);
    }
  }
}
const cr = {};
for (const r of rows) for (const x of r.crashReasons ?? []) cr[`${r.biome}: ${x}`] = (cr[`${r.biome}: ${x}`] ?? 0) + 1;
console.log(`\nCrash reasons (all runs): ${JSON.stringify(cr)}; runs: ${rows.length}`);
