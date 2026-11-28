// Gitar (PR #9, round 4): the measurement runners' default output folder `.measure/` is git-ignored and
// absent in a fresh checkout; every runner creates it before writing (tests/sim/outPath.ts).
import { describe, expect, it } from 'vitest';
import { outPath } from '../sim/outPath';

type Fs = { existsSync(p: string): boolean; mkdtempSync(p: string): string; readFileSync(p: string, e: string): string; readdirSync(p: string): string[] };
const node = async () => ({
  fs: (await import('node:fs' as string)) as Fs,
  os: (await import('node:os' as string)) as { tmpdir(): string },
  path: (await import('node:path' as string)) as { join(...p: string[]): string; resolve(...p: string[]): string; dirname(p: string): string },
});

describe('measurement output folders', () => {
  it('outPath creates the folder of its default (and of an override)', async () => {
    const { fs, os, path } = await node();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-'));
    const a = await outPath(undefined, path.join(root, '.measure', 'deep', 'x.jsonl'));
    expect(fs.existsSync(path.dirname(a))).toBe(true);
    const b = await outPath(path.join(root, 'other', 'y.json'), path.join(root, 'unused', 'z.json'));
    expect(b).toBe(path.join(root, 'other', 'y.json'));
    expect(fs.existsSync(path.join(root, 'other'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'unused'))).toBe(false);
  });

  it('every runner that defaults to .measure/ writes through outPath', async () => {
    const { fs, path } = await node();
    const here = path.dirname(new URL(import.meta.url).pathname);
    const files: string[] = [];
    for (const dir of ['../sim', '../review']) for (const f of fs.readdirSync(path.resolve(here, dir))) if (f.endsWith('.ts')) files.push(path.resolve(here, dir, f));
    const users = files.filter((f) => /['"`]\.measure\//.test(fs.readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n')));
    expect(users.length).toBeGreaterThan(5);
    for (const f of users) expect(fs.readFileSync(f, 'utf8'), f).toMatch(/outPath\(/);
  });
});
