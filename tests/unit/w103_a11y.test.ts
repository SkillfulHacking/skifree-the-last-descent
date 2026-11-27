// W-103 (round-5 review E5-3/E5-4): the Whiteout scenery follows Reduce flashes (trail lamps steady) and
// Reduce weather effects (the rim spindrift thins with the rest of the weather).
import { describe, expect, it } from 'vitest';

type Fs = { readFileSync(p: string, e: string): string };
const src = async (p: string) => ((await import('node:fs' as string)) as Fs).readFileSync(p, 'utf8');

describe('W-103 Whiteout scenery accessibility', () => {
  it('trail lamps: the flicker is multiplied out when LAMP_CALM is on, and LAMP_CALM follows Reduce flashes', async () => {
    const s = await src('src/world/biomes/whiteout/views/scenery.ts');
    expect(s).toMatch(/LAMP_CALM\.value = A11Y\.reduceFlashes \? 1 : 0;/);
    // the lamp shader blends its flicker toward a constant by uCalm
    expect(s).toMatch(/uniform float uLampCalm/);
    expect(s).toMatch(/mix\([^;]*uLampCalm\)/);
  });
  it('rim spindrift strength is scaled by the weather-effects setting', async () => {
    const s = await src('src/world/biomes/whiteout/views/scenery.ts');
    expect(s).toMatch(/vm\.uniforms\.uK!\.value = \([^;]*\) \* weatherFx\.scale;/);
  });
});
