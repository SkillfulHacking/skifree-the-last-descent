/**
 * Round 6 (owner ruling 3): an opt-in log for structured human playtests (docs/playtest/WHITEOUT_PLAYTEST.md).
 *  - Off unless the page is opened with `?playtest`, which the facilitator does only for a participant who
 *    agreed to it; a visible "Playtest log on" tag stays on screen while it records.
 *  - Records gameplay events and a 1 Hz sample of the run (phase, position along the course, speed, the
 *    Yeti's distance, crashes, settings at run start). No names, no input text, nothing about the machine
 *    beyond what the facilitator writes on the session sheet. Kept in memory only, never sent anywhere.
 *  - The facilitator downloads it with Ctrl+Shift+L (a JSON file); reloading the page discards it.
 */
import type { EventBus, GameEvent } from './events';

export interface PlaytestSample {
  phase: string;
  z: number;
  speed: number;
  yetiDistance: number;
  crashes: number;
  course?: string;
}

export type PlaytestEntry =
  | { t: number; kind: 'event'; event: GameEvent }
  | { t: number; kind: 'sample'; sample: PlaytestSample }
  | { t: number; kind: 'run'; course: string; settings: Record<string, unknown> }
  | { t: number; kind: 'note'; text: string };

export const PLAYTEST_SAMPLE_S = 1;
/** about 4 hours of 1 Hz samples plus events: plenty for one session, bounded */
export const PLAYTEST_MAX_ENTRIES = 20000;

export class PlaytestLog {
  readonly entries: PlaytestEntry[] = [];
  private t = 0;
  private sinceSample = Infinity;
  dropped = 0;

  constructor(readonly build: Record<string, unknown> = {}) {}

  private push(e: PlaytestEntry) {
    if (this.entries.length >= PLAYTEST_MAX_ENTRIES) {
      this.dropped++;
      return;
    }
    this.entries.push(e);
  }

  /** subscribe to a session's events; returns the detach function */
  attach(bus: EventBus): () => void {
    return bus.onAny((event) => this.push({ t: +this.t.toFixed(2), kind: 'event', event }));
  }

  runStarted(course: string, settings: Record<string, unknown>) {
    this.push({ t: +this.t.toFixed(2), kind: 'run', course, settings: { ...settings } });
    this.sinceSample = Infinity;
  }

  /** advance the clock; takes a sample once per PLAYTEST_SAMPLE_S while a run is going */
  tick(dt: number, sample: PlaytestSample | null) {
    this.t += dt;
    this.sinceSample += dt;
    if (!sample || this.sinceSample < PLAYTEST_SAMPLE_S) return;
    this.sinceSample = 0;
    const r = (v: number, d = 1) => (Number.isFinite(v) ? +v.toFixed(d) : null);
    this.push({ t: +this.t.toFixed(2), kind: 'sample', sample: { ...sample, z: r(sample.z) as number, speed: r(sample.speed) as number, yetiDistance: r(sample.yetiDistance) as number } });
  }

  toJSON() {
    return { format: 'skifree-playtest-log/1', build: this.build, seconds: +this.t.toFixed(1), dropped: this.dropped, entries: this.entries };
  }
}
