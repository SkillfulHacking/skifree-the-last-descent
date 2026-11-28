/**
 * Whiteout Ridge: registration. Pure parts first (hazard kinds, then the biome), then the three.js
 * presentation (finish, hazard views, scenery).
 */
import { registerBiome } from '../../biome';
import { registerWhiteoutHazards } from './hazards';
import { makeWhiteoutBiome } from './biome';
import './views';

registerWhiteoutHazards();
export const WHITEOUT = registerBiome(makeWhiteoutBiome());
