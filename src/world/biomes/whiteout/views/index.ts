/** Whiteout Ridge presentation (three.js), registered under the ids the biome's capabilities name. */

import { registerCavePresentation, registerFinish, registerRefuge } from '../../../presentation';
import { RidgeRescueHut } from './refuge';
import { dressStormCave, stormCaveCinematic } from './stormCave';
import { RescueStation } from './rescue';
import { RescueVictory } from './rescueVictory';
import './hazardViews';
import './scenery';
import './start';

/** the mountain-rescue station at the foot of the ridge, with the storm-to-shelter victory */
export const WHITEOUT_RESCUE = registerFinish({
  id: 'whiteout-rescue',
  label: 'Mountain rescue station',
  goal: 'rescue station',
  build: (c) => new RescueStation(c),
  victory: (st, finish, d) => new RescueVictory(st, finish, d),
});

/** the illuminated rescue-hut refuge (spec: "Whiteout: illuminated rescue stations") */
export const RIDGE_RESCUE_HUT = registerRefuge({ id: 'ridge-rescue-hut', build: (c) => new RidgeRescueHut(c.mountain, c.z, c.index) });

/** the storm-beaten cave: rimed granite, snow off the brow, a squall around the Yeti's emergence */
export const WHITEOUT_STORM_CAVE = registerCavePresentation({ id: 'whiteout-storm-cave', dress: dressStormCave, cinematic: stormCaveCinematic });

