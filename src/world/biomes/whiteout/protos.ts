/**
 * Round 6 (owner priority 2): three cheap art-direction prototypes for Whiteout's signature view, applied
 * before a world is built and only in the debug harness (`?debug&proto=A|B|C`). They change existing
 * terrain and scenery knobs, never the racing line (the rim's distance from the line, `ridge.rim`, and
 * the line itself are untouched), so they can be captured at the same gameplay-camera positions.
 *   A. an exposed corniced ridgeline above a deep valley: a deeper, dark valley floor in view past the lip,
 *      no cloud deck hiding it, a heavier cornice overhang;
 *   B. a dark, fractured glacier wall: a much steeper, darker drop face below the corridor, the cloud deck
 *      lower than the wall's top;
 *   C. a high-alpine saddle: a higher crest on the far side and close-set tall dark spires standing out of
 *      the drop along the rim, silhouetted against the void.
 * Nothing here is used unless a prototype is asked for. Round 6's blind read chose C, which is now the
 * production default (RIM_SPIRES, ridge.crest); the knobs stay for comparison captures.
 */
import { getBiome } from '../../biome';
import { CLOUD_SEA } from './views/cloudSea';
import { CORNICE } from './views/cornice';
import { RIM_SPIRES } from './views/ridgeRocks';

export type WhiteoutProto = 'A' | 'B' | 'C';

type Mut<T> = { -readonly [K in keyof T]: T[K] extends readonly unknown[] ? number[] : T[K] extends object ? Mut<T[K]> : T[K] };

export function applyWhiteoutProto(id: WhiteoutProto): void {
  const b = getBiome('whiteout') as unknown as { terrain: { ridge: Record<string, number> }; terrainLook: Record<string, unknown> };
  const ridge = b.terrain.ridge;
  const look = b.terrainLook as { valleyShade: { tint: number[]; amount: number; below: number[]; dist: number[] }; scouredFlank: { rock: number[]; slope: number[]; past: number[]; streak: number } };
  const sea = CLOUD_SEA as unknown as Mut<typeof CLOUD_SEA> & { hidden?: boolean };
  const cor = CORNICE as unknown as Mut<typeof CORNICE>;
  if (id === 'A') {
    ridge.depth = 1100;
    ridge.farRanges = 0.15;
    sea.hidden = true;
    Object.assign(look.valleyShade, { tint: [0.16, 0.2, 0.24], amount: 0.95, below: [60, 400], dist: [150, 600] });
    cor.height = [1.5, 3.2];
    cor.overhang = [3, 7];
  } else if (id === 'B') {
    ridge.flank = 260;
    ridge.depth = 700;
    sea.drop = 620;
    Object.assign(look.scouredFlank, { rock: [0.08, 0.1, 0.14], slope: [0.08, 0.16], past: [1, 6], streak: 0.25 });
    RIM_SPIRES.skip = 1;
  } else {
    ridge.crest = 160;
    Object.assign(RIM_SPIRES, { every: 45, rise: [14, 16], skip: 0 });
  }
}
