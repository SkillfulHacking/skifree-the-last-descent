/**
 * Shared contracts between game modules.
 * Coordinate convention: +Y up. The course runs downhill toward +Z.
 * Units: metres, seconds, radians.
 */
import type * as THREE from 'three';

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export type SurfaceType = 'snow' | 'packed' | 'powder' | 'ice';

/** Pose/animation drivers for the skier character model (src/player/SkierModel.ts). */
export interface SkierPose {
  /** Steering input, -1 (left) .. 1 (right). */
  steer: number;
  /** Body lean into the turn (roll, radians, + = lean right). Already smoothed by caller. */
  lean: number;
  /** 0..1 aerodynamic tuck ("french fry"). */
  tuck: number;
  /** 0..1 snowplow ("pizza") — ski tips together, tails apart. */
  pizza: number;
  /** 0..1 drift / skid intensity (skis turned across direction of travel). */
  drift: number;
  /** Signed yaw (radians) of skis relative to the direction of travel during drift. */
  driftAngle: number;
  /** 0..1 crouch preparing a pop/jump (Space held). */
  crouch: number;
  airborne: boolean;
  /** Seconds since takeoff (0 when grounded). */
  airTime: number;
  /** 0..1, decays after landing; drives knee compression. */
  landImpact: number;
  crashed: boolean;
  /** Seconds since crash began (tumble then lying in snow). */
  crashTime: number;
  /** 0..1 recovering from a crash (getting up). */
  recover: number;
  /** Speed m/s (drives subtle animation such as pole tuck, jacket flutter). */
  speed: number;
  /** Head yaw for looking back over shoulder (radians, + = look left). */
  lookBack: number;
  /** 0..1 raise trophy / arms up celebration. */
  celebrate: number;
  /** 0..1 stumble / balance wobble after light impacts. */
  wobble: number;
  /** Elapsed game time (for idle motion). */
  time: number;
}

/** Yeti animation modes (src/yeti/YetiModel.ts). */
export type YetiMode =
  | 'hidden'
  | 'lurk' // deep in cave: only eyes glint, slight sway
  | 'grip' // hand grips cave entrance edge, body still in shadow
  | 'crawl' // low all-fours prowl (approach from deep inside the cave); root translated along the floor at ~0.8–1.4 m/s
  | 'emerge' // heavy hunched step-out of the cave (stride tied to speed)
  | 'stand' // deliberate crouch-to-stand, feet planted (height comes from the skeleton unfolding)
  | 'roar' // chest out, arms wide, jaw wide open
  | 'walk'
  | 'run' // knuckle-gallop / powerful bipedal sprint depending on speed
  | 'leap' // airborne leap
  | 'grab' // lunges and grabs with right hand
  | 'eat' // comedic: lifts held object to mouth, gulps, pats belly
  | 'disgust' // stops, recoils, shakes head
  | 'turnAway'; // turns around and walks off

export interface YetiAnimState {
  mode: YetiMode;
  /** Seconds since entering this mode. */
  modeTime: number;
  /** Ground speed m/s (drives gait frequency/stride). */
  speed: number;
  /** -1..1 turning (lean into turns). */
  turn: number;
  /** Elapsed game time. */
  time: number;
  /** Seconds since a snowball throw began (wind-up, release, follow-through), or undefined. Layered over the gait. */
  throwT?: number;
}

/** Per-frame inputs for continuous audio (src/audio/AudioEngine.ts). */
export interface AudioFrameState {
  listenerPos: THREE.Vector3;
  /** Unit forward vector of the camera. */
  listenerForward: THREE.Vector3;
  /** Skier speed m/s. */
  speed: number;
  grounded: boolean;
  /** 0..1 how hard the ski edges are working (carving/skidding). */
  edgeLoad: number;
  /** 0..1 pizza braking. */
  brake: number;
  drifting: boolean;
  surface: SurfaceType;
  crashed: boolean;
  /** Yeti world position, or null when not present. */
  yetiPos: THREE.Vector3 | null;
  /** Distance skier↔yeti metres or null. */
  yetiDistance: number | null;
  yetiRunning: boolean;
  /** 0..1 chase intensity (1 = yeti about to catch). */
  chaseIntensity: number;
  /** 0..1 resort crowd ambience level. */
  crowdLevel: number;
  /** 0..1 closeness to the sea (coastal locations: surf/gull beds); absent/0 inland */
  coast?: number;
  /** 0..1 how deep the player is inside the "eerie" zone before the cave (ducks wind/music). */
  eerie: number;
}

export type MusicMode = 'none' | 'menu' | 'explore' | 'tension' | 'chase' | 'victory' | 'defeat';

export type ImpactKind = 'branch' | 'rock-light' | 'rock-heavy' | 'tree-heavy' | 'crash' | 'log';
