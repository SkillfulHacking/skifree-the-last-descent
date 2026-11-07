/**
 * Run phase state machine — pure and unit-tested. Phases are driven by course progress (Z),
 * never by elapsed time, and outcomes are mutually exclusive and final.
 *
 * Works for any course: the encounters (cave → chase → finish or Endless checkpoint) come from the
 * course profile. On a finite course the last encounter's chase ends at the finish line; on
 * Endless each chase ends at a refuge (checkpoint) and the cycle repeats, escalating.
 */
import { Mountain, type Encounter } from '../world/course';

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

export type Outcome = 'none' | 'caught' | 'victory' | 'retired';

export interface RunCourse {
  readonly tutorialEndZ: number;
  readonly finishZ: number;
  encounters(z0: number, z1: number): Encounter[];
}

let classic: RunCourse | null = null;
function classicCourse(): RunCourse {
  if (!classic) {
    const m = new Mountain();
    classic = { tutorialEndZ: m.profile.tutorialEndZ, finishZ: m.finishZ, encounters: (a, b) => m.profile.encounters(a, b) };
  }
  return classic;
}

export class RunState {
  phase: Phase = 'intro';
  outcome: Outcome = 'none';
  /** the Yeti is out (current chase) */
  yetiReleased = false;
  /** at least one cave cinematic has fired this run */
  caveTriggered = false;
  /** seconds of active time spent being chased (all encounters) */
  chaseTime = 0;
  /** total active time */
  runTime = 0;
  phaseTime = 0;
  /** the encounter in progress or coming next (null: none left) */
  encounter: Encounter | null = null;
  /** chases survived by reaching a checkpoint (Endless) */
  checkpointsReached = 0;
  private done = new Set<number>();
  private lookZ = -Infinity;

  constructor(readonly course: RunCourse = classicCourse()) {}

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

  /** Find the next encounter not yet completed at/after z. */
  private refreshEncounter(z: number) {
    if (this.encounter && !this.done.has(this.encounter.index) && z <= this.lookZ) return;
    this.lookZ = z + 500;
    const list = this.course.encounters(z - 10, z + 6000);
    this.encounter = list.find((e) => !this.done.has(e.index) && e.chaseEndZ > z) ?? null;
  }

  /** Update progress-driven phases. Returns true when the cave cinematic must start now. */
  progress(z: number, dt: number): boolean {
    this.phaseTime += dt;
    if (this.controllable) this.runTime += dt;
    if (this.phase === 'chase') this.chaseTime += dt;
    if (this.outcome !== 'none') return false;
    if (this.phase === 'chase' || this.phase === 'caveCinematic') return false;
    this.refreshEncounter(z);
    if (this.phase === 'learn' && z > this.course.tutorialEndZ) this.set('free');
    const e = this.encounter;
    if (!e) return false;
    if (this.phase === 'free' && z > e.foreshadowZ) this.set('foreshadow');
    // reliable: fires on progress regardless of lateral position, and can't be skipped by speed
    if ((this.phase === 'learn' || this.phase === 'free' || this.phase === 'foreshadow') && z >= e.triggerZ) {
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

  /**
   * Endless: the skier reached the refuge at the end of this chase. The Yeti gives up; the
   * run continues in free skiing towards the next encounter. Returns true when it happened.
   */
  reachCheckpoint(z: number): boolean {
    const e = this.encounter;
    if (this.outcome !== 'none' || this.phase !== 'chase' || !e || e.checkpointZ === null || z < e.chaseEndZ) return false;
    this.done.add(e.index);
    this.checkpointsReached++;
    this.yetiReleased = false;
    this.encounter = null;
    this.lookZ = -Infinity;
    this.set('free');
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

  /** Endless: end the run by choice, banking the score from the last refuge. */
  retire(): boolean {
    if (this.outcome !== 'none') return false;
    if (this.phase === 'intro' || this.phase === 'caveCinematic') return false;
    this.outcome = 'retired';
    this.set('results');
    return true;
  }

  showResults() {
    if (this.outcome !== 'none') this.set('results');
  }
}
