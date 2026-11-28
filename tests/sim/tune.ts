/**
 * Balance-experiment overrides for the measurement runners (never used by the game). Each key names a
 * live tuning object; its value is deep-merged into it for the current process, before any course or
 * environment is built. Unknown keys and unknown fields throw, so a typo never measures the baseline.
 *   { "biome:whiteout": { "terrain": { "slopeScale": 1.1 } }, "weather:whiteout": { "coupling": { … } },
 *     "whiteout:DRIFT": { "drag": 0.2 }, "whiteout:BLIZZARD": { … }, "whiteout:LEE": { … } }
 */
import { getBiome, type BiomeId } from '../../src/world/biome';
import { WHITEOUT_WEATHER, LEE, CREST_LEE } from '../../src/world/biomes/whiteout/storm';
import { BLIZZARD, DRIFT } from '../../src/world/biomes/whiteout/hazards';
import { HEADWIND_STANCE } from '../../src/physics/environment';
import { FJORD_WEATHER } from '../../src/world/biomes/fjord/biome';
import { YETI } from '../../src/yeti/YetiAI';

type Obj = Record<string, unknown>;
const TARGETS: Record<string, () => Obj> = {
  'weather:whiteout': () => WHITEOUT_WEATHER as unknown as Obj,
  'whiteout:DRIFT': () => DRIFT as unknown as Obj,
  'whiteout:BLIZZARD': () => BLIZZARD as unknown as Obj,
  'whiteout:LEE': () => LEE as unknown as Obj,
  'whiteout:CREST_LEE': () => CREST_LEE as unknown as Obj,
  'weather:fjord': () => FJORD_WEATHER as unknown as Obj,
  'physics:HEADWIND_STANCE': () => HEADWIND_STANCE as unknown as Obj,
  'yeti:YETI': () => YETI as unknown as Obj,
};

function merge(dst: Obj, src: Obj, path: string) {
  for (const [k, v] of Object.entries(src)) {
    if (!(k in dst)) throw new Error(`tune: unknown field ${path}.${k}`);
    const d = dst[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && d && typeof d === 'object' && !Array.isArray(d)) merge(d as Obj, v as Obj, `${path}.${k}`);
    else dst[k] = v;
  }
}

export function applyTune(t: Record<string, Obj>): void {
  for (const [key, val] of Object.entries(t)) {
    const target = key.startsWith('biome:') ? (getBiome(key.slice(6) as BiomeId) as unknown as Obj) : TARGETS[key]?.();
    if (!target) throw new Error(`tune: unknown target ${key}`);
    merge(target, val, key);
  }
}
