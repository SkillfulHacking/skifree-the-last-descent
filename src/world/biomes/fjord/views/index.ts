/** Fjord Coast presentation (three.js), registered under the ids the biome's capabilities name. */
import * as THREE from 'three';
import { registerCavePresentation, registerFinish, registerRefuge } from '../../../presentation';
import { Harbour } from './harbour';
import { HarbourVictory } from './harbourVictory';
import { CoastalShelter } from './shelter';
import { dressSeaCave } from './seaCave';
import { seaCaveCinematic } from './seaCaveCinematic';
import './hazardViews';
import './scenery';
import './start';

/** the harbour at the end of the mountain, with its victory sequence */
export const FJORD_HARBOUR = registerFinish({
  id: 'fjord-harbour',
  label: 'Fishing harbour',
  goal: 'harbour',
  build: (c) => new Harbour({ quality: c.quality, mountain: c.mountain, heightAt: c.heightAt, finishCenter: c.finishCenter as THREE.Vector3 }),
  victory: (st, finish, d) => new HarbourVictory(st, finish, d),
});

/** red warming huts at the refuges */
export const COASTAL_SHELTER = registerRefuge({ id: 'coastal-shelter', build: (c) => new CoastalShelter(c.mountain, c.z, c.index), buildSteps: (c) => CoastalShelter.sliced(c.mountain, c.z, c.index) });

/** sea-worn basalt, a frozen tide pool and the Yeti's beachcombing hoard around the shared cave; gulls and spray in its cinematic */
export const FJORD_SEA_CAVE = registerCavePresentation({ id: 'fjord-sea-cave', dress: dressSeaCave, cinematic: seaCaveCinematic });
