/**
 * Alpine presentation: the original finish, refuge and cave, registered under the ids the Alpine
 * capability defaults name (ALPINE_CAPABILITIES in src/world/capabilities/index.ts).
 */
import { Resort } from '../Resort';
import { Checkpoint } from '../Checkpoint';
import { AlpineResortVictory } from '../../cinematic/victory/alpineResort';
import { registerFinish } from './finish';
import { registerRefuge } from './refuge';
import { registerCavePresentation } from './cave';

/** the lodge resort at the bottom of the valley (src/world/Resort.ts) */
export const ALPINE_RESORT_FINISH = registerFinish({
  id: 'alpine-resort',
  label: 'Alpine resort',
  build: (c) => new Resort({ quality: c.quality, heightAt: c.heightAt, finishCenter: c.finishCenter }),
  victory: (st, finish, d) => new AlpineResortVictory(st, finish, d),
});

/** the timber ski-patrol cabin with its gate (src/world/Checkpoint.ts) */
export const SKI_PATROL_CABIN = registerRefuge({
  id: 'ski-patrol-cabin',
  build: (c) => new Checkpoint(c.mountain, c.z, c.index),
});

/** the shared cave with its original story props and nothing else */
export const ALPINE_CAVE = registerCavePresentation({ id: 'alpine-cave' });
