/** W-048 (round-1 E3 / F3): the wind bed follows the storm — louder and rougher as a front builds,
 * quieter in shelter, panned toward where the wind comes from, and calm again as it clears. */
import { describe, expect, it } from 'vitest';
import { windTargets } from '../../src/audio/logic';

describe('storm wind bed', () => {
  const calm = windTargets(18, 0, 0.5);
  it('is exactly the old bed with no weather', () => {
    expect(windTargets(18, 0, 0.5, undefined)).toEqual(calm);
    expect(windTargets(18, 0, 0.5, { storm: 0, exposure: 1, pan: 1 }).lowGain).toBeCloseTo(calm.lowGain, 9);
  });
  it('rises through a front (≥ 6 dB on the low band at full storm, exposed)', () => {
    const steps = [0, 0.25, 0.5, 0.75, 1].map((s) => windTargets(18, 0, 0.5, { storm: s, exposure: 1, pan: 0 }).lowGain);
    for (let i = 1; i < steps.length; i++) expect(steps[i]!).toBeGreaterThan(steps[i - 1]!);
    expect(20 * Math.log10(steps[4]! / steps[0]!)).toBeGreaterThan(6);
  });
  it('is quieter in shelter', () => {
    const open = windTargets(18, 0, 0.5, { storm: 1, exposure: 1, pan: 0 });
    const lee = windTargets(18, 0, 0.5, { storm: 1, exposure: 0.4, pan: 0 });
    expect(lee.lowGain).toBeLessThan(open.lowGain * 0.8);
    expect(lee.whistleGain).toBeLessThan(open.whistleGain);
  });
  it('comes from the side the wind blows from', () => {
    expect(windTargets(18, 0, 0.5, { storm: 1, exposure: 1, pan: 1 }).pan).toBeGreaterThan(0.6);
    expect(windTargets(18, 0, 0.5, { storm: 1, exposure: 1, pan: -1 }).pan).toBeLessThan(-0.6);
  });
});
