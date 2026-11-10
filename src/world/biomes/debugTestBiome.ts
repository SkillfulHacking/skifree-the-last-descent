/**
 * DEBUG ONLY: an internal placeholder location used to exercise the multi-location menu in the
 * browser (`?debug&testbiome`). It is registered by src/main.ts only when both flags are in the
 * URL, so players never see it. A stored selection of it falls back to Alpine on the next normal
 * load (settings repair unknown biome ids). It is NOT a biome and must never ship as one.
 */
import { ALPINE, deriveBiome, registerBiome, type Biome } from '../biome';

export const DEBUG_TEST_BIOME_ID = 'debug-test';

export function makeDebugTestBiome(): Biome {
  return deriveBiome(ALPINE, {
    id: DEBUG_TEST_BIOME_ID,
    code: 'DBGTEST',
    name: '[debug] Test Range',
    description: 'Internal test location for debug builds, not a real destination.',
    lighting: { sunColor: [1.0, 0.72, 0.55], sunIntensity: 3.4 },
    atmosphere: { fogColor: [0.74, 0.74, 0.82] },
    terrain: { widthScale: 1.15, slopeScale: 0.95 },
    capabilities: { rating: { level: 3, label: 'Test' } },
  });
}

/** True when the page URL asks for the debug test location (`?debug&testbiome`). */
export function wantsDebugTestBiome(search: string): boolean {
  const q = new URLSearchParams(search);
  return q.has('debug') && q.has('testbiome');
}

export function registerDebugTestBiome(): Biome {
  return registerBiome(makeDebugTestBiome());
}
