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

describe('RUN. below the rear-view inset (round 6, W-103)', () => {
  it('Hud.fitRun takes the inset box from the shared layout, not the DOM', async () => {
    const { rearInsetRect } = await import('../../src/ui/scale');
    const r = rearInsetRect(1280, 1.5);
    expect(r.top + r.h).toBe(117 + 160);
    const src = ((await import('node:fs' as string)) as { readFileSync(p: string, e: string): string }).readFileSync('src/ui/Hud.ts', 'utf8');
    expect(src).toMatch(/const r = rearInsetRect\(innerWidth, scale\)/);
    expect(src).not.toMatch(/querySelector\('\.rear-view'\)/);
  });
});

describe('RUN. shrink wins over the stylesheet (round 6, W-103)', () => {
  it('the fitted font size is set !important, like the stylesheet rule it overrides', async () => {
    const fs = (await import('node:fs' as string)) as { readFileSync(p: string, e: string): string };
    expect(fs.readFileSync('src/ui/styles.css', 'utf8')).toMatch(/\.hud-center\.run \{[^}]*font-size:[^;]*!important/);
    expect(fs.readFileSync('src/ui/Hud.ts', 'utf8')).toMatch(/setProperty\('font-size', `\$\{fit\}px`, 'important'\)/);
  });
});
