/**
 * ProgressTracker: the one place achievements are evaluated. Subscribes to a run's EventBus,
 * folds events into a *working copy* of the save, and commits that copy to the persistent save
 * only when the run's persist policy allows it.
 *
 * Persist policy (explicit, per attached run):
 *  - `persist()` is asked at every commit point (an unlock, RunFinished, detach). The App passes
 *    `() => !debugHarness && !session.debugUsed`, so automated `?debug` runs (autopilot,
 *    teleports, fast-forward, forced chases, frame stepping) never write progress.
 *  - Once `persist()` has returned false for a run, the run is tainted for good: nothing from it
 *    is ever committed, even if a later check would pass.
 *  - Headless simulations (src/game/simulate.ts) never construct a tracker or touch storage.
 *  - A tracker built with `store: null` (or over a read-only save from a newer build) never
 *    writes either.
 * Unlocks during a non-persisting run are still reported (onUnlock(def, false)) so a debug run
 * can show the toast, marked as not saved.
 */
import type { EventBus, GameEvent, RunContext } from '../game/events';
import { ACHIEVEMENTS, evaluateEvent, type AchievementDef } from './achievements';
import { type ProgressSave } from './save';

export interface ProgressStoreLike {
  write(s: ProgressSave): void;
}

export class ProgressTracker {
  /** the committed (persistent) state: what the Achievements screen shows */
  saved: ProgressSave;
  onUnlock: ((def: AchievementDef, persisted: boolean) => void) | null = null;
  /** called after every successful commit (e.g. to grant cosmetics, refresh menus) */
  onCommit: ((s: ProgressSave) => void) | null = null;
  private working: ProgressSave | null = null;
  private run: RunContext | null = null;
  private tainted = false;
  private persist: () => boolean = () => false;

  constructor(
    saved: ProgressSave,
    private store: ProgressStoreLike | null,
    readonly defs: readonly AchievementDef[] = ACHIEVEMENTS,
    private clock: () => number = () => Date.now(),
    /** hook applied to the working copy after achievements were earned (cosmetic grants) */
    private onEarned: ((s: ProgressSave, defs: AchievementDef[], now: number) => void) | null = null,
  ) {
    this.saved = saved;
  }

  get attached(): boolean {
    return this.working !== null;
  }

  /** Start tracking a run. Returns the detach function (commits if allowed). */
  attach(bus: EventBus, persist: () => boolean): () => void {
    if (this.working) this.detach();
    this.working = structuredClone(this.saved);
    this.run = null;
    this.tainted = false;
    this.persist = persist;
    const off = bus.onAny((e) => this.handle(e));
    return () => {
      off();
      this.detach();
    };
  }

  private detach() {
    if (!this.working) return;
    this.commit();
    this.working = null;
    this.run = null;
  }

  /** Feed one event (also used directly by tests). */
  handle(e: GameEvent) {
    const w = this.working;
    if (!w) return;
    if (e.type === 'RunStarted') {
      const { type: _t, ...ctx } = e;
      void _t;
      this.run = ctx;
    }
    const now = this.clock();
    const earned = evaluateEvent(w.stats, w.achievements, e, { run: this.run, now }, this.defs);
    if (earned.length) this.onEarned?.(w, earned, now);
    const persisted = earned.length || e.type === 'RunFinished' ? this.commit() : false;
    for (const d of earned) this.onUnlock?.(d, persisted);
  }

  /** Copy the working state into the persistent save if the policy allows. */
  private commit(): boolean {
    if (!this.working) return false;
    if (this.tainted || !this.store || !this.persist()) {
      this.tainted = true;
      return false;
    }
    this.saved = structuredClone(this.working);
    this.store.write(this.saved);
    this.onCommit?.(this.saved);
    return true;
  }

  /**
   * An explicit player choice outside the award flow (equipping a cosmetic): applied to the saved
   * state (and the working copy of a tracked run) and written straight away. Not subject to the
   * run persist policy, which only governs what gameplay *awards*.
   */
  updateSaved(fn: (s: ProgressSave) => void): void {
    fn(this.saved);
    if (this.working) fn(this.working);
    this.store?.write(this.saved);
  }

  /** Is the run being tracked still allowed to persist? */
  get persisting(): boolean {
    return !!this.working && !this.tainted && !!this.store && this.persist();
  }
}
