/**
 * Fjord Coast: registration. Pure parts first (hazard kinds, then the biome), then the three.js
 * presentation (finish, refuge, cave dressing, hazard views, scenery).
 */
import { registerBiome } from '../../biome';
import { registerFjordHazards } from './hazards';
import { makeFjordBiome } from './biome';
import './views';

registerFjordHazards();
export const FJORD = registerBiome(makeFjordBiome());
