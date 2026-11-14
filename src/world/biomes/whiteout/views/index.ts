/** Whiteout Ridge presentation (three.js), registered under the ids the biome's capabilities name. */

import { registerFinish } from '../../../presentation';
import { RescueStation } from './rescue';
import { RescueVictory } from './rescueVictory';
import './hazardViews';
import './scenery';

/** the mountain-rescue station at the foot of the ridge, with the storm-to-shelter victory */
export const WHITEOUT_RESCUE = registerFinish({
  id: 'whiteout-rescue',
  label: 'Mountain rescue station',
  goal: 'rescue station',
  build: (c) => new RescueStation(c),
  victory: (st, finish, d) => new RescueVictory(st, finish, d),
});

