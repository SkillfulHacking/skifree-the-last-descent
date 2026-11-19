/** W-049: Reduce Weather Effects is a presentation setting — an old save gets it off; it never
 * changes the physics or hazards (the simulation does not read it), and blizzard telegraphs keep
 * most of their opacity. */
import { describe, expect, it } from 'vitest';
import { loadSettings } from '../../src/core/settings';
import { WEATHER_FX_REDUCED, WEATHER_FX_TELEGRAPH_FLOOR, weatherFx } from '../../src/world/look/weatherFx';

describe('Reduce Weather Effects', () => {
  it('defaults off for an existing save (no migration, no key change)', () => {
    const kv = (v: object) => ({ getItem: () => JSON.stringify(v), setItem() {}, removeItem() {} });
    expect(loadSettings(kv({ quality: 'high', captions: true }) as never).reduceWeather).toBe(false);
    expect(loadSettings(kv({ reduceWeather: true }) as never).reduceWeather).toBe(true);
    expect(loadSettings(kv({ reduceWeather: 'yes' }) as never).reduceWeather).toBe(false);
  });
  it('is presentation only: no physics, hazard or simulation module reads it', async () => {
    const fs = (await import('node:fs' as string)) as { readFileSync: (p: string, e: string) => string };
    const physics = ['src/physics/SkierPhysics.ts', 'src/world/capabilities/environment.ts', 'src/world/biomes/whiteout/hazards.ts', 'src/world/biomes/whiteout/storm.ts', 'src/game/simulate.ts'];
    for (const f of physics) expect(fs.readFileSync(f, 'utf8'), f).not.toMatch(/weatherFx|reduceWeather/);
    expect(weatherFx.scale).toBe(1);
  });
  it('keeps hazard telegraphs readable', () => {
    expect(WEATHER_FX_TELEGRAPH_FLOOR).toBeGreaterThanOrEqual(0.7);
    expect(Math.max(WEATHER_FX_TELEGRAPH_FLOOR, WEATHER_FX_REDUCED)).toBe(WEATHER_FX_TELEGRAPH_FLOOR);
  });
});

