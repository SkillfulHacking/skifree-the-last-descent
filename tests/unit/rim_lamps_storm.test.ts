// W-065 (round 6): the drop's red rim lamps grow with the storm (C1 captures: specks in a whiteout).
import { describe, expect, it } from 'vitest';

type Fs = { readFileSync(p: string, e: string): string };

describe('rim lamps in a storm', () => {
  it('scale with the storm and stay steady (no pulsing: Reduce flashes)', async () => {
    const src = ((await import('node:fs' as string)) as Fs).readFileSync('src/world/biomes/whiteout/views/scenery.ts', 'utf8');
    expect(src).toMatch(/this\.rimLampMat\.size = RIM_LAMPS\.size \* \(1 \+ RIM_LAMPS\.stormGrow \* s\)/);
    expect(src).not.toMatch(/rimLampMat\.(size|opacity) = [^;]*(sin|cos)\(/);
    const m = /RIM_LAMPS = \{[^}]*stormGrow: ([\d.]+)/.exec(src);
    expect(Number(m?.[1])).toBeGreaterThanOrEqual(1);
  });
});
