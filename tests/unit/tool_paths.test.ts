// W-087: the tension summary tool opens only measurement files it found itself under fixed
// measurement directories; a path from the command line is a lookup key, never opened.
import { beforeAll, describe, expect, it } from 'vitest';

// node modules loaded at run time (the project's tsconfig carries no node types; as scan_lod.test.ts)
type Fn = (...a: never[]) => never;
let spawnSync: Fn, mkdtempSync: Fn, mkdirSync: Fn, writeFileSync: Fn, symlinkSync: Fn, cpSync: Fn, tmpdir: Fn, join: (...p: string[]) => string;
let TOOLS_DIR = '';
beforeAll(async () => {
  const cp = (await import('node:child_process' as string)) as Record<string, Fn>;
  const fs = (await import('node:fs' as string)) as Record<string, Fn>;
  const os = (await import('node:os' as string)) as Record<string, Fn>;
  const path = (await import('node:path' as string)) as Record<string, (...p: string[]) => string>;
  ({ spawnSync } = cp);
  ({ mkdtempSync, mkdirSync, writeFileSync, symlinkSync, cpSync } = fs);
  ({ tmpdir } = os);
  join = path.join!;
  TOOLS_DIR = path.resolve!(path.dirname!(new URL(import.meta.url).pathname), '../../tools');

});
const ROW = JSON.stringify({ biome: 'alpine', len: 'sprint', diff: 'normal', behaviour: 'clean', outcome: 'escaped', minGap: 40, t45: 0, t25: 0, t110: 3, enc: 0 });

function tree(): { root: string; outside: string } {
  const F = { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, cpSync, tmpdir } as unknown as Record<string, (...a: unknown[]) => string>;
  const root = F.mkdtempSync!(join(F.tmpdir!(), 'w087-'));
  F.mkdirSync!(join(root, 'tools'));
  for (const t of ['tension_summary.py', 'tension_table.py', 'ladder_table.py']) F.cpSync!(join(TOOLS_DIR, t), join(root, 'tools', t));
  F.mkdirSync!(join(root, '.measure'), { recursive: true });
  F.writeFileSync!(join(root, '.measure', 'ok.jsonl'), ROW + '\n');
  F.mkdirSync!(join(root, 'docs/reviews/biomes/whiteout/balance/w077'), { recursive: true });
  F.writeFileSync!(join(root, 'docs/reviews/biomes/whiteout/balance/w077/doc.jsonl'), ROW + '\n');
  F.mkdirSync!(join(root, 'node_modules/x'), { recursive: true });
  F.writeFileSync!(join(root, 'node_modules/x/stray.jsonl'), ROW + '\n');
  const outside = F.mkdtempSync!(join(F.tmpdir!(), 'w087-out-'));
  F.writeFileSync!(join(outside, 'secret.jsonl'), ROW + '\n');
  F.symlinkSync!(join(outside, 'secret.jsonl'), join(root, '.measure', 'link.jsonl'));
  return { root, outside };
}
const runTool = (tool: string, cwd: string, ...args: string[]) => (spawnSync as unknown as (c: string, a: string[], o: object) => { status: number | null; stdout: string; stderr: string })('python3', ['-I', `tools/${tool}`, ...args], { cwd, encoding: 'utf8' });
const run = (cwd: string, ...args: string[]) => runTool('tension_summary.py', cwd, ...args);

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

// (Round 5, SonarCloud AaIXUMn7HHykExLUeKFl / AaIXUMmpHHykExLUeKFk: "Path Traversal via command-line
// argument" in tension_table.main() and ladder_table.main()) the round's two table tools follow W-087
const LADDER_ROW = JSON.stringify({ biome: 'alpine', len: 'sprint', diff: 'hard', seed: 'R5V-01', policy: 'blind', outcome: 'victory', minGap: 40 });
const TENSION_ROW = JSON.stringify({ biome: 'alpine', len: 'sprint', diff: 'normal', behaviour: 'skilled', outcome: 'escaped', startGap: 40, minGap: 40, t45: 0, t25: 0, closingS: 0 });
for (const [tool, row, ok] of [
  ['tension_table.py', TENSION_ROW, /alpine\s+sprint\s+normal\s+skilled/],
  ['ladder_table.py', LADDER_ROW, /alpine\s+hard\s+blind/],
] as const)
  describe(`${tool} path handling (round 5)`, () => {
    const setup = () => {
      const { root, outside } = tree();
      const F = { writeFileSync } as unknown as Record<string, (...a: unknown[]) => string>;
      for (const f of [join(root, '.measure', 'ok.jsonl'), join(root, 'docs/reviews/biomes/whiteout/balance/w077/doc.jsonl'), join(root, 'node_modules/x/stray.jsonl'), join(outside, 'secret.jsonl')]) F.writeFileSync!(f, row + '\n');
      return { root, outside };
    };
    it('reads a measurement file by its path, its path in a measurement directory, or its name', () => {
      const { root } = setup();
      for (const a of ['.measure/ok.jsonl', 'ok.jsonl', 'w077/doc.jsonl', 'docs/reviews/biomes/whiteout/balance/w077/doc.jsonl']) {
        const r = runTool(tool, root, a);
        expect(r.status, `${a}: ${r.stderr}`).toBe(0);
        expect(r.stdout).toMatch(ok);
      }
    });
    it('refuses anything outside the measurement directories (traversal, absolute, symlink)', () => {
      const { root, outside } = setup();
      for (const a of ['node_modules/x/stray.jsonl', '../etc/passwd', '/etc/passwd', join(outside, 'secret.jsonl'), '.measure/../node_modules/x/stray.jsonl', 'link.jsonl', '.measure/link.jsonl']) {
        const r = runTool(tool, root, a);
        expect(r.status, `${a}: ${r.stdout}`).not.toBe(0);
        expect(r.stdout).not.toMatch(ok);
      }
    });
  });
