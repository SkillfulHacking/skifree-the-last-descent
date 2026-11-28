// W-100 (round-5 review A5-2): the scoured-flank shading lands on the drop side beyond the rim only, keyed to
// world geometry (metres past the rim), never to the camera's height (round 5 darkened the uphill wall).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../../src/world/biomes';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { getBiome } from '../../src/world/biome';
import { createSnowMaterial } from '../../src/world/snowMaterial';

function compiledFragment(biome = getBiome('whiteout')): { vs: string; fs: string } {
  const { material } = createSnowMaterial('high', biome);
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader } as unknown as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, undefined as unknown as THREE.WebGLRenderer);
  return { vs: shader.vertexShader, fs: shader.fragmentShader };
}

describe('W-100 scoured flank', () => {
  it('the flank mask reads the metres past the rim (vRim), not the camera height', () => {
    const { vs, fs } = compiledFragment();
    expect(vs).toMatch(/attribute float aRim;/);
    expect(vs).toMatch(/vRim = aRim;/);
    const block = fs.slice(fs.indexOf('wind-scoured flank'), fs.indexOf('sf_rock = max(sf_rock, flank)'));
    expect(block).toMatch(/float flank = smoothstep\([^;]*vRim\)/);
    expect(block).not.toMatch(/cameraPosition/);
  });

  it('beyond the rim is the drop side; the crest and the racing line are not', () => {
    const T = getBiome('whiteout').terrainLook.scouredFlank!;
    expect(T.past[0]).toBeGreaterThanOrEqual(0);
    for (const len of ['sprint', 'standard'] as const) {
      const m = buildMountain(makeCourse('classic', len, { biome: 'whiteout', difficulty: 'normal' }));
      const side = Math.sign(m.ridgeRimX(1000) - m.centerX(1000));
      for (let z = 400; z < m.finishZ - 200; z += 200) {
        // the racing line and the uphill (crest) side: on the ridge side of the rim, so never shaded
        expect(m.beyondRidgeRim(m.routeX(z), z), `line at z ${z}`).toBeLessThan(T.past[0]);
        expect(m.beyondRidgeRim(m.centerX(z) - side * 60, z), `crest side at z ${z}`).toBeLessThan(T.past[0]);
        // the face of the drop, 20 m beyond the lip: inside the mask
        expect(m.beyondRidgeRim(m.ridgeRimX(z) + side * 20, z)).toBeGreaterThan(T.past[1]);
      }
    }
  });

  it('locations without a ridge compile without the flank', () => {
    expect(compiledFragment(getBiome('alpine')).fs).not.toMatch(/wind-scoured flank/);
  });
});
