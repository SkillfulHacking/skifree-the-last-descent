import { it } from 'vitest';
import { Mountain } from '../../src/world/course';
// Emulates TerrainRenderer.buildFar row order (FAR_TILE 2048, FAR_STEP 64) over the Endless frontier,
// comparing each sample with the settled value from a fully generated twin.
it('far-tile emulation on Endless: vertices sampled at the generation frontier', () => {
  for (const seed of [1, 99, 4242]) {
    const a = Mountain.generated(seed, Infinity);
    const b = Mountain.generated(seed, Infinity); b.profile.ensure(60000);
    let bad = 0; let worst = 0; let n = 0;
    for (let iz = 0; iz < 20; iz++) for (const ix of [-2, -1, 0, 1]) {
      const X0 = ix * 2048, Z0 = iz * 2048;
      for (let j = 0; j <= 32; j++) for (let i = 0; i <= 32; i++) {
        const x = X0 + i * 64, z = Z0 + j * 64;
        const d = Math.abs(a.heightAt(x, z) - b.heightAt(x, z)); n++;
        if (d > 0.01) { bad++; worst = Math.max(worst, d); }
      }
    }
    console.log(`seed ${seed}: ${bad}/${n} far-tile vertices differ from settled terrain, worst ${worst.toFixed(1)} m`);
  }
});
