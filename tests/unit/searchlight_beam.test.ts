/**
 * Round 5, W-083: the searchlight's shaft. The distance term the shader fades by must run 0 → 1 from the
 * lamp to the far end of the cone as it is actually built — for three review rounds it was negated
 * (vD = −z/60 on a cone along +Z), so every fragment's alpha was 0 and no camera or intensity change
 * could make the beam show.
 */
import { describe, expect, it } from 'vitest';
import { BEAM_LEN, searchBeam } from '../../src/world/biomes/whiteout/views/rescue';

/** the shader's vD for a vertex, read from the vertex shader's own expression */
function vDOf(vs: string, z: number): number {
  const m = /vD\s*=\s*(-?)position\.z\s*\/\s*([0-9.]+)/.exec(vs);
  if (!m) throw new Error('vD expression not found');
  return ((m[1] === '-' ? -1 : 1) * z) / Number(m[2]);
}

describe('searchlight beam (W-083)', () => {
  it('the cone runs from the lamp out along +Z', () => {
    const { geometry } = searchBeam();
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.z).toBeCloseTo(0, 3);
    expect(geometry.boundingBox!.max.z).toBeCloseTo(BEAM_LEN, 3);
  });
  it('the fade term is 0 at the lamp and 1 at the far end (so the shaft is drawn)', () => {
    const { geometry, material } = searchBeam();
    const pos = geometry.getAttribute('position');
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const v = vDOf(material.vertexShader, pos.getZ(i));
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeGreaterThanOrEqual(-1e-6);
    expect(hi).toBeCloseTo(1, 3);
    // the fragment shader's alpha is non-zero for a mid-shaft fragment: smoothstep(0, 0.04, vD) > 0
    expect(material.fragmentShader).toMatch(/smoothstep\(0\.0, 0\.04, vD\)/);
  });
});
