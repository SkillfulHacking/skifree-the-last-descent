// Tabulate round-4 wind runs: node table.mjs file.jsonl [...]
import fs from 'node:fs';
const rows = process.argv.slice(2).flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))).filter((r) => r.env);
const POL = ['read', 'cue', 'ignore', 'wrong', 'lee', 'notch'];
const f1 = (x) => (x === null || Number.isNaN(x) ? '–' : x.toFixed(1));
const f2 = (x) => (x === null || Number.isNaN(x) ? '–' : (x >= 0 ? '+' : '') + x.toFixed(2));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const get = (b, len, seed, diff, d) => rows.find((r) => r.biome === b && r.len === len && r.seed === seed && r.diff === diff && r.driver === d);
for (const len of [...new Set(rows.map((r) => r.len))]) {
  const seeds = [...new Set(rows.filter((r) => r.len === len).map((r) => r.seed))];
  console.log(`\n### ${len} — ${seeds.length} seeds (${seeds[0]} … ${seeds[seeds.length - 1]})\n`);
  console.log('Decision value: Fjord, reader with each wind policy. Δt = policy − read, paired per seed over runs both won (mean, [min … max]); W = wins; gap = mean min Yeti gap (m); lee = share of gates taken in the lee.\n');
  console.log('| difficulty | policy | wins | mean time (won) | Δt vs read | Δt range | seeds slower than read | gap | lee share |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const diff of ['relaxed', 'normal', 'hard']) {
    if (!rows.some((r) => r.len === len && r.diff === diff)) continue;
    for (const p of POL) {
      const rs = seeds.map((s) => get('fjord', len, s, diff, p)).filter(Boolean);
      if (!rs.length) continue;
      const won = rs.filter((r) => r.outcome === 'victory');
      const d = [];
      let slower = 0;
      for (const s of seeds) {
        const a = get('fjord', len, s, diff, p);
        const b = get('fjord', len, s, diff, 'read');
        if (a && b && a.outcome === 'victory' && b.outcome === 'victory') { d.push(a.time - b.time); if (a.time - b.time > 0.05) slower++; }
      }
      const g = rs.reduce((s, r) => s + r.gates, 0);
      const l = rs.reduce((s, r) => s + r.lee, 0);
      console.log(`| ${diff} | ${p} | ${won.length}/${rs.length} | ${f1(mean(won.map((r) => r.time)))} s | ${p === 'read' ? '–' : f2(mean(d))} | ${p === 'read' || !d.length ? '–' : `${f2(Math.min(...d))} … ${f2(Math.max(...d))}`} | ${p === 'read' ? '–' : `${slower}/${d.length}`} | ${f1(mean(rs.map((r) => r.minGap ?? 0)))} | ${g ? Math.round((100 * l) / g) + ' %' : '–'} |`);
    }
  }
  console.log('\nLadder: Alpine vs Fjord (environment on). Cells: wins · mean winning time · mean min gap. Paired = Fjord − Alpine on seeds both won (mean [min … max]).\n');
  console.log('| difficulty | driver | Alpine | Fjord | paired F − A |');
  console.log('|---|---|---|---|---|');
  for (const diff of ['relaxed', 'normal', 'hard'])
    for (const d of ['read', 'cue', 'ignore', 'skilled', 'intermediate', 'average']) {
      const A = seeds.map((s) => get('alpine', len, s, diff, d === 'cue' || d === 'ignore' ? 'read' : d)).filter(Boolean);
      const F = seeds.map((s) => get('fjord', len, s, diff, d)).filter(Boolean);
      if (!A.length || !F.length) continue;
      const cell = (rs) => { const w = rs.filter((r) => r.outcome === 'victory'); return `${w.length}/${rs.length} · ${f1(mean(w.map((r) => r.time)))} s · gap ${f1(mean(rs.map((r) => r.minGap ?? 0)))}`; };
      const p = [];
      for (const s of seeds) { const a = get('alpine', len, s, diff, d === 'cue' || d === 'ignore' ? 'read' : d); const b = get('fjord', len, s, diff, d); if (a && b && a.outcome === 'victory' && b.outcome === 'victory') p.push(b.time - a.time); }
      console.log(`| ${diff} | ${d}${d === 'cue' || d === 'ignore' ? ' (Alpine: read)' : ''} | ${cell(A)} | ${cell(F)} | ${p.length ? `${f2(mean(p))} [${f2(Math.min(...p))} … ${f2(Math.max(...p))}] (${p.length})` : '–'} |`);
    }
}
const cr = {};
for (const r of rows) for (const c of r.crashReasons ?? []) cr[`${r.biome}: ${c}`] = (cr[`${r.biome}: ${c}`] ?? 0) + 1;
console.log(`\nCrash reasons (all runs): ${JSON.stringify(cr)}; runs: ${rows.length}`);
