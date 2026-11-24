// W-087: the tension summary tool opens only measurement files it found itself under fixed
// measurement directories; a path from the command line is a lookup key, never opened.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const TOOL = resolve(__dirname, '../../tools/tension_summary.py');
const ROW = JSON.stringify({ biome: 'alpine', len: 'sprint', diff: 'normal', behaviour: 'clean', outcome: 'escaped', minGap: 40, t45: 0, t25: 0, t110: 3, enc: 0 });

function tree() {
  const root = mkdtempSync(join(tmpdir(), 'w087-'));
  mkdirSync(join(root, 'tools'));
  cpSync(TOOL, join(root, 'tools', 'tension_summary.py'));
  mkdirSync(join(root, '.measure'), { recursive: true });
  writeFileSync(join(root, '.measure', 'ok.jsonl'), ROW + '\n');
  mkdirSync(join(root, 'docs/reviews/biomes/whiteout/balance/w077'), { recursive: true });
  writeFileSync(join(root, 'docs/reviews/biomes/whiteout/balance/w077/doc.jsonl'), ROW + '\n');
  mkdirSync(join(root, 'node_modules/x'), { recursive: true });
  writeFileSync(join(root, 'node_modules/x/stray.jsonl'), ROW + '\n');
  const outside = mkdtempSync(join(tmpdir(), 'w087-out-'));
  writeFileSync(join(outside, 'secret.jsonl'), ROW + '\n');
  symlinkSync(join(outside, 'secret.jsonl'), join(root, '.measure', 'link.jsonl'));
  return { root, outside };
}
const run = (cwd: string, ...args: string[]) => spawnSync('python3', ['-I', 'tools/tension_summary.py', ...args], { cwd, encoding: 'utf8' });

describe('W-087 tension_summary path handling', () => {
  it('summarises a measurement file by its path or bare name', () => {
    const { root } = tree();
    for (const a of ['.measure/ok.jsonl', 'ok.jsonl', 'docs/reviews/biomes/whiteout/balance/w077/doc.jsonl']) {
      const r = run(root, a);
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toContain('caught 0/1');
    }
  });
  it('refuses files outside the measurement directories, even inside the tree', () => {
    const { root, outside } = tree();
    for (const a of ['node_modules/x/stray.jsonl', '../etc/passwd', join(outside, 'secret.jsonl'), '.measure/../node_modules/x/stray.jsonl', 'link.jsonl', '.measure/link.jsonl']) {
      const r = run(root, a);
      expect(r.status, `${a}: ${r.stdout}`).not.toBe(0);
      expect(r.stdout).not.toContain('caught');
    }
  });
});
