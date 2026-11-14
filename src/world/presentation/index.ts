/**
 * Presentation registries (three.js): finish environments, refuges, cave dressing and hazard
 * views, resolved from the ids in a biome's capabilities. Importing this module registers the
 * Alpine presentation. A new location registers its own in its biome folder and imports it from
 * src/world/biomes/index.ts (see docs/BIOMES.md).
 */
import './alpine';
import type { Biome } from '../biome';
import { capabilitiesOf } from '../capabilities';
import { getHazardKind } from '../hazards/hazard';
import { getFinish, hasFinish, type FinishDefinition } from './finish';
import { getRefuge, hasRefuge, type RefugeDefinition } from './refuge';
import { getCavePresentation, hasCavePresentation, type CavePresentation } from './cave';
import { hasHazardView } from './hazardViews';
import { getScenery, hasScenery, type SceneryDefinition } from './scenery';

export * from './finish';
export * from './refuge';
export * from './cave';
export * from './hazardViews';
export * from './scenery';

/** Presentation problems for a biome (empty = every id it names is registered). */
export function validateBiomePresentation(b: Biome): string[] {
  const c = capabilitiesOf(b);
  const out: string[] = [];
  if (!hasFinish(c.finish.id)) out.push(`finish environment "${c.finish.id}" is not registered`);
  if (!hasRefuge(c.refuge.id)) out.push(`refuge presentation "${c.refuge.id}" is not registered`);
  if (!hasCavePresentation(c.cave.id)) out.push(`cave presentation "${c.cave.id}" is not registered`);
  if (c.scenery && !hasScenery(c.scenery.id)) out.push(`scenery "${c.scenery.id}" is not registered`);
  for (const id of c.hazards.kinds) {
    const v = getHazardKind(id).view;
    if (v && !hasHazardView(v)) out.push(`hazard "${id}" view "${v}" is not registered`);
  }
  return out;
}

export interface BiomePresentation {
  finish: FinishDefinition;
  refuge: RefugeDefinition;
  cave: CavePresentation;
  /** streamed location set dressing (null: none, e.g. Alpine) */
  scenery: SceneryDefinition | null;
}

/** Resolve a biome's presentation (throws with every problem listed if something is missing). */
export function presentationOf(b: Biome): BiomePresentation {
  const errs = validateBiomePresentation(b);
  if (errs.length) throw new Error(`biome "${b.id}": ${errs.join('; ')}`);
  const c = capabilitiesOf(b);
  return { finish: getFinish(c.finish.id), refuge: getRefuge(c.refuge.id), cave: getCavePresentation(c.cave.id), scenery: c.scenery ? getScenery(c.scenery.id) : null };
}
