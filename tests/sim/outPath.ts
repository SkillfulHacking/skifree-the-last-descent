/**
 * (Round 4, Gitar on PR #9) Where a measurement runner writes: the OUT override or its default under
 * `.measure/` (git-ignored, so absent in a fresh checkout). The parent folder is created before the
 * first write — round 3 threw ENOENT on a clean clone.
 */
type Fs = { mkdirSync(p: string, o: { recursive: boolean }): unknown };
type Path = { dirname(p: string): string };

export async function outPath(override: string | undefined, fallback: string): Promise<string> {
  const out = override ?? fallback;
  const fs = (await import('node:fs' as string)) as Fs;
  const path = (await import('node:path' as string)) as Path;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  return out;
}
