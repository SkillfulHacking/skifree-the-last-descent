/** What cinematics may touch: a narrow view over the running session. */
import type * as THREE from 'three';
import type { World } from './World';
import type { SkierModel } from '../player/SkierModel';
import type { YetiModel } from '../yeti/YetiModel';
import type { YetiAI } from '../yeti/YetiAI';
import type { SkierPhysics } from '../physics/SkierPhysics';
import type { AudioEngine } from '../audio/AudioEngine';
import type { FollowCamera } from '../camera/FollowCamera';
import type { Hud } from '../ui/Hud';
import type { Settings } from '../core/settings';
import type { SkierPose, YetiAnimState } from '../core/types';

export interface Stage {
  world: World;
  skier: SkierModel;
  yeti: YetiModel;
  yetiAI: YetiAI;
  phys: SkierPhysics;
  audio: AudioEngine;
  camera: THREE.PerspectiveCamera;
  follow: FollowCamera;
  hud: Hud;
  settings: Settings;
  /** pose overrides applied on top of physics-derived pose during cinematics */
  poseOverride: Partial<SkierPose>;
  yetiAnim: YetiAnimState;
  /** world transform of the yeti root is driven from yetiAI.pos/heading unless this is true */
  yetiManual: boolean;
  shake(amount: number): void;
  /** emit snow falling from tree canopies within radius of a point */
  shakeTrees(center: THREE.Vector3, radius: number, max: number): void;
  setYetiMode(m: YetiAnimState['mode']): void;
}
