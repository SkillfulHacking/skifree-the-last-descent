// W-105 (round-5 review D5-2): programs linked mid-run. The Whiteout scenery's warm-up includes one of each
// streamed material (instanced rocks and spires, rim lights, wands), and blizzard curtain materials are
// pooled instead of disposed (disposing released the program; the next blizzard re-linked it).
import { describe, expect, it } from 'vitest';

type Fs = { readFileSync(p: string, e: string): string };
const src = async (p: string) => ((await import('node:fs' as string)) as Fs).readFileSync(p, 'utf8');

describe('W-105 shader warm-up', () => {
  it('the scenery warm-up adds probes of the streamed materials', async () => {
    const s = await src('src/world/biomes/whiteout/views/scenery.ts');
    expect(s).toMatch(/this\.rocks\.warmupProbes\(\)/);
    expect(s).toMatch(/new THREE\.Points\(dot, this\.rimLampMat\)/);
    expect(s).toMatch(/if \(this\.probes\) this\.probes\.visible = false;/);
    const r = await src('src/world/biomes/whiteout/views/ridgeRocks.ts');
    expect(r).toMatch(/warmupProbes\(\): THREE\.Object3D\[\]/);
  });
  it('blizzard curtain materials are pooled, not disposed', async () => {
    const h = await src('src/world/biomes/whiteout/views/hazardViews.ts');
    expect(h).toMatch(/curtainPool\.pop\(\) \?\? M\.curtain\.clone\(\)/);
    expect(h).toMatch(/curtainPool\.push\(cm\)/);
    expect(h).not.toMatch(/\bcm\.dispose\(\)/);
  });
});
