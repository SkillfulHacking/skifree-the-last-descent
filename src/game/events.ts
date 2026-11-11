/**
 * Gameplay events: a typed, synchronous, framework-free event bus with a discriminated-union
 * schema. GameSession emits these from *validated gameplay state* (physics results, phase
 * transitions, Yeti AI outcomes) — never from HUD animations or cinematics. Consumers
 * (achievements, future statistics, analytics-free local progression) subscribe to the bus; no
 * rendering module needs to know they exist.
 *
 * Rules for every event:
 *  - plain JSON-compatible data (no three.js objects), so events can be logged, replayed in tests
 *    and stored if a future feature needs that;
 *  - distances in metres, times in seconds, speeds in m/s;
 *  - adding a field is backward compatible; renaming/removing one is not (consumers are pure
 *    functions over these shapes — see src/progression/achievements.ts).
 *
 * Biome hazards (Whiteout wind, Frozen ice, Volcanic vents, Fjord viewpoints …) report through
 * GameSession.reportHazardSurvived() / reportScenicDiscovered(), which stamp the current biome
 * and emit HazardSurvived / ScenicLocationDiscovered. See docs/PROGRESSION.md §"Emitting events
 * from biome code".
 */
import type { SurfaceType, ImpactKind } from '../core/types';

export type RunOutcome = 'victory' | 'caught' | 'retired';

/** Identity of the course a run is played on (repeated on run-level events). */
export interface RunContext {
  /** course code, e.g. CLASSIC-SPR, DAILY-2026-11-09-STD, SEED-1234-END-H */
  courseId: string;
  mode: 'classic' | 'daily' | 'custom';
  length: 'sprint' | 'standard' | 'endurance' | 'expedition' | 'endless';
  biome: string;
  difficulty: 'relaxed' | 'normal' | 'hard';
  /** Daily: the course's UTC date (YYYY-MM-DD); null otherwise */
  date: string | null;
}

export type GameEvent =
  /** the player gained control at the top of the course (after the intro) */
  | ({ type: 'RunStarted' } & RunContext)
  /** the run's outcome became final (finish crossed / caught / Endless retire) */
  | ({ type: 'RunFinished'; outcome: RunOutcome; distance: number; time: number; refuges: number; crashes: number; score: number } & RunContext)
  /** whole-kilometre milestones of distance down the course (1000, 2000, …) */
  | { type: 'DistanceReached'; meters: number }
  /** a jump ended (airtime > 0.12 s). landed=false: the landing was a crash */
  | { type: 'JumpLanded'; airtime: number; distance: number; clean: boolean; landed: boolean }
  /** a drift ended. surface = where most of it happened, surfaces = seconds per surface; controlled=false when it ended in a crash */
  | { type: 'DriftCompleted'; duration: number; distance: number; surface: SurfaceType; surfaces: Partial<Record<SurfaceType, number>>; controlled: boolean }
  /** controlled pizza (snowplough) braking, emitted in chunks of PIZZA_CHUNK metres (plus a final flush) */
  | { type: 'PizzaBraking'; distance: number }
  /** contact with an obstacle (tree, rock, log …) */
  | { type: 'ObstacleHit'; kind: ImpactKind; intensity: number }
  /** a wipe-out */
  | { type: 'Crashed'; reason: string }
  | { type: 'SnowballThrown' }
  /** a snowball landed and the skier was outside its marked zone */
  | { type: 'SnowballDodged'; distance: number }
  | { type: 'SnowballHit'; direct: boolean; distance: number }
  /** a chase began (the cave cinematic ended) */
  | { type: 'YetiEncountered'; encounter: number; difficulty: RunContext['difficulty'] }
  /** a chase ended in the skier's favour; closestGap = nearest the Yeti got in that chase (m) */
  | { type: 'YetiEscaped'; encounter: number; via: 'refuge' | 'finish'; chaseTime: number; closestGap: number }
  | { type: 'RefugeReached'; index: number }
  /** emitted once per run, right after RunStarted */
  | { type: 'BiomeVisited'; biome: string }
  /** a biome-designated scenic location was discovered (id is stable per biome) */
  | { type: 'ScenicLocationDiscovered'; biome: string; id: string }
  /** a biome hazard was passed without crashing (kind is biome-defined, e.g. 'steam-vent') */
  | { type: 'HazardSurvived'; biome: string; kind: string };

export type GameEventType = GameEvent['type'];
export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
export type Listener<T extends GameEventType> = (e: EventOf<T>) => void;

/** Size of a PizzaBraking chunk (m). */
export const PIZZA_CHUNK = 25;

/**
 * Synchronous typed event bus. Listeners run in subscription order, immediately on emit. A
 * listener that throws is reported once to the console and never breaks gameplay or the other
 * listeners. Events emitted from inside a listener are queued and delivered after the current
 * event (so every listener sees events in the same order).
 */
export class EventBus {
  private typed = new Map<GameEventType, Set<(e: GameEvent) => void>>();
  private any = new Set<(e: GameEvent) => void>();
  private queue: GameEvent[] = [];
  private delivering = false;
  /** events emitted so far (debug/tests); bounded */
  readonly history: GameEvent[] = [];
  historyLimit = 200;

  on<T extends GameEventType>(type: T, fn: Listener<T>): () => void {
    let set = this.typed.get(type);
    if (!set) this.typed.set(type, (set = new Set()));
    const f = fn as (e: GameEvent) => void;
    set.add(f);
    return () => set.delete(f);
  }

  onAny(fn: (e: GameEvent) => void): () => void {
    this.any.add(fn);
    return () => this.any.delete(fn);
  }

  emit(e: GameEvent): void {
    this.queue.push(e);
    if (this.delivering) return;
    this.delivering = true;
    try {
      while (this.queue.length) {
        const ev = this.queue.shift()!;
        this.history.push(ev);
        if (this.history.length > this.historyLimit) this.history.shift();
        for (const f of [...(this.typed.get(ev.type) ?? [])]) this.call(f, ev);
        for (const f of [...this.any]) this.call(f, ev);
      }
    } finally {
      this.delivering = false;
    }
  }

  clear(): void {
    this.typed.clear();
    this.any.clear();
  }

  private call(f: (e: GameEvent) => void, e: GameEvent) {
    try {
      f(e);
    } catch (err) {
      console.error('[events] listener failed on', e.type, err);
    }
  }
}
