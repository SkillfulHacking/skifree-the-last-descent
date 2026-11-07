/**
 * Run phase state machine — pure and unit-tested. Phases are driven by course progress (Z),
 * never by elapsed time, and outcomes are mutually exclusive and final.
 */
import { COURSE } from '../world/course';

export type Phase =
  | 'intro' // short opening shot at the summit (no control)
  | 'learn' // Phase A: tutorial region
  | 'free' // Phase B: free skiing
  | 'foreshadow' // Phase C: warnings
  | 'caveCinematic' // Phase D: non-interactive reveal (simulation frozen)
  | 'chase' // Phase E: pursuit
  | 'caught' // Phase F (defeat cinematic)
  | 'victory' // Phase F (victory cinematic)
  | 'results';

export type Outcome = 'none' | 'caught' | 'victory';

export class RunState {
  phase: Phase = 'intro';
  outcome: Outcome = 'none';
  yetiReleased = false;
  caveTriggered = false;
  /** seconds of active time since the chase began */
  chaseTime = 0;
  /** total active time */
  runTime = 0;
  phaseTime = 0;

  private set(p: Phase) {
    if (p !== this.phase) {
      this.phase = p;
      this.phaseTime = 0;
    }
  }

  get controllable(): boolean {
    return this.phase === 'learn' || this.phase === 'free' || this.phase === 'foreshadow' || this.phase === 'chase';
  }

  get simulating(): boolean {
    // the world simulation runs in these phases; it is frozen during the cave cinematic
    return this.controllable || this.phase === 'intro';
  }

  endIntro() {
    if (this.phase === 'intro') this.set('learn');
  }

  /** Update progress-driven phases. Returns true when the cave cinematic must start now. */
  progress(z: number, dt: number): boolean {
    this.phaseTime += dt;
    if (this.controllable) this.runTime += dt;
    if (this.phase === 'chase') this.chaseTime += dt;
    if (this.outcome !== 'none') return false;
    if (this.phase === 'learn' && z > COURSE.tutorialEndZ) this.set('free');
    if (this.phase === 'free' && z > COURSE.foreshadowZ) this.set('foreshadow');
    // reliable: fires on progress regardless of lateral position, and can't be skipped by speed
    if (!this.caveTriggered && (this.phase === 'learn' || this.phase === 'free' || this.phase === 'foreshadow') && z >= COURSE.caveTriggerZ) {
      this.caveTriggered = true;
      this.set('caveCinematic');
      return true;
    }
    return false;
  }

  endCaveCinematic() {
    if (this.phase !== 'caveCinematic') return;
    this.yetiReleased = true;
    this.set('chase');
  }

  /** Capture: only possible while the Yeti is chasing and no outcome is set. */
  catchPlayer(): boolean {
    if (this.outcome !== 'none' || this.phase !== 'chase') return false;
    this.outcome = 'caught';
    this.set('caught');
    return true;
  }

  /** Finish line crossed. A caught player can never win. */
  reachFinish(): boolean {
    if (this.outcome !== 'none') return false;
    if (this.phase !== 'chase') return false; // the yeti cinematic always precedes the finish
    this.outcome = 'victory';
    this.set('victory');
    return true;
  }

  showResults() {
    if (this.outcome !== 'none') this.set('results');
  }
}
