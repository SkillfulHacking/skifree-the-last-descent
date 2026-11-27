// Round 6 (W-087 hardening, W-106): the evidence and perf tools identify the build without a shell and
// without looking a program up on PATH, and record the build that was served.
// This is defensive hardening; it is NOT claimed to be the unidentified SonarCloud issue (W-087 stays
// blocked until that issue's key, rule, file and line are known).
import { describe, expect, it } from 'vitest';

type Fs = { readFileSync(p: string, e: string): string; readdirSync(p: string): string[] };
const load = async () => (await import('node:fs' as string)) as Fs;

const TOOLS = ['whiteout_evidence.mjs', 'handoff_strip.mjs', 'rim_view.mjs', 'prod_frames.mjs', 'biome_evidence.mjs'];

describe('evidence tools: no shell, served build', () => {
  it('no tool runs a shell command string (exec/execSync) or names git as a program', async () => {
    const fs = await load();
    for (const f of fs.readdirSync('tools').filter((f) => f.endsWith('.mjs'))) {
      const s = fs.readFileSync(`tools/${f}`, 'utf8');
      expect(s, f).not.toMatch(/\bexecSync\s*\(/);
      expect(s, f).not.toMatch(/\bexec\s*\(\s*['"`]/);
      expect(s, f).not.toMatch(/['"`]git['"`\s]/);
    }
  });

  it('the evidence tools and Whiteout browser specs build no code from strings (eval / new Function)', async () => {
    const fs = await load();
    const files = ['tools/whiteout_evidence.mjs', 'tools/w031_probe.mjs', 'tests/e2e/whiteout.spec.ts', 'tests/e2e/whiteout_rerun.spec.ts'];
    for (const f of files) {
      const s = fs.readFileSync(f, 'utf8');
      expect(s, f).not.toMatch(/\(0,\s*eval\)|\beval\s*\(|new Function\s*\(/);
    }
  });

  it('each capture tool records the served build', async () => {
    const fs = await load();
    for (const f of TOOLS) {
      const s = fs.readFileSync(`tools/${f}`, 'utf8');
      expect(s, f).toMatch(/await servedBuild\(base\)/);
      expect(s, f).toMatch(/\bbuild\b[,}]/);
    }
  });

  it('build_info reads the commit from .git files and hashes the sources deterministically', async () => {
    // @ts-expect-error: plain ESM helper (no types)
    const bi = (await import('../../tools/lib/build_info.mjs')) as { gitHead(): string; srcHash(): string; buildInfo(): { gitHead: string; srcHash: string } };
    expect(bi.gitHead()).toMatch(/^([0-9a-f]{40}|unknown)$/);
    const a = bi.srcHash();
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(bi.srcHash()).toBe(a);
    expect(bi.buildInfo().srcHash).toBe(a);
    const s = (await load()).readFileSync('tools/lib/build_info.mjs', 'utf8');
    expect(s).not.toMatch(/child_process/);
  });

  it('the build emits build-info.json', async () => {
    const s = (await load()).readFileSync('vite.config.ts', 'utf8');
    expect(s).toMatch(/fileName: 'build-info\.json'/);
  });
});
