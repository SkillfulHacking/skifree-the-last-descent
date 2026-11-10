/**
 * Achievements: typed, data-driven definitions evaluated by pure functions over gameplay events
 * (src/game/events.ts) and persistent statistics.
 *
 * - `id` is stable forever (it is the save key). Never rename or reuse one.
 * - Adding an achievement needs no save-format change: the save stores earned ids → timestamps
 *   and a generic bag of counters/sets, so a new definition simply starts unearned (or, if its
 *   counter already exists, starts with the progress the player has already made).
 * - `unlock(e, ctx)` runs AFTER the statistics were updated with `e`, so progress achievements
 *   can compare a counter against their target.
 * - Achievements that need a location that doesn't exist yet are defined now with `requires`
 *   set: they are shown (locked) and unlock naturally once that biome emits its events.
 */
import type { GameEvent, RunContext } from '../game/events';

export type AchievementCategory = 'journey' | 'skill' | 'yeti' | 'exploration' | 'daily';

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  journey: 'Journey',
  skill: 'Skill',
  yeti: 'Yeti',
  exploration: 'Exploration',
  daily: 'Daily',
};

/**
 * Biome ids the location-specific achievements listen for. Must match the ids the biomes register
 * with (src/world/biome.ts); if a biome ships under another id, change it here (the achievement id
 * itself stays the same).
 */
export const BIOME_IDS = { fjord: 'fjord', whiteout: 'whiteout', frozen: 'frozen', volcanic: 'volcanic' } as const;
/** HazardSurvived kind the Volcanic biome reports for a geothermal vent zone. */
export const HAZARD_VENT_ZONE = 'vent-zone';

/** Persistent statistics: generic so new stats need no save-format change. */
export interface ProgressStats {
  counters: Record<string, number>;
  sets: Record<string, string[]>;
}

export interface EvalContext {
  stats: ProgressStats;
  /** the run in progress (from RunStarted), null outside a run */
  run: RunContext | null;
  /** wall-clock ms (injected: tests and evaluation stay deterministic) */
  now: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  /** icon id (rendered by ui/achievementsScreen.ts ICONS) */
  icon: string;
  /** shown as ??? until earned */
  hidden?: boolean;
  /** associated location (biome id) */
  biome?: string;
  /** cosmetic item id granted when earned (src/progression/cosmetics.ts) */
  reward?: string;
  /** content this needs that isn't in the game yet (shown on the locked card) */
  requires?: string;
  /** progress toward a numeric goal, read from persistent stats */
  progress?: { target: number; value: (s: ProgressStats) => number; unit?: string };
  /** pure: does this event (stats already updated) satisfy the criterion? */
  unlock: (e: GameEvent, ctx: EvalContext) => boolean;
}

// --- statistics -----------------------------------------------------------------------------
export const STAT = {
  runsStarted: 'runsStarted',
  runsFinished: 'runsFinished',
  wins: 'wins',
  metersSkied: 'metersSkied',
  pizzaMeters: 'pizzaMeters',
  jumpsLanded: 'jumpsLanded',
  longestJump: 'longestJumpAir',
  snowballsDodged: 'snowballsDodged',
  yetiEscapes: 'yetiEscapes',
  /** set: Daily course dates finished (reached the resort) on that same UTC day */
  dailyDays: 'dailyDays',
  biomesVisited: 'biomesVisited',
  /** set: "<biome>:<id>" */
  scenic: 'scenic',
} as const;

export const emptyStats = (): ProgressStats => ({ counters: {}, sets: {} });

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const counter = (s: ProgressStats, k: string) => s.counters[k] ?? 0;
const setSize = (s: ProgressStats, k: string) => s.sets[k]?.length ?? 0;
function add(s: ProgressStats, k: string, v: number) {
  s.counters[k] = counter(s, k) + v;
}
function addToSet(s: ProgressStats, k: string, v: string) {
  const a = (s.sets[k] ??= []);
  if (!a.includes(v)) a.push(v);
}

/** Pure statistics reducer (mutates `s`). Runs before achievements are checked. */
export function accumulateStats(s: ProgressStats, e: GameEvent, now: number): void {
  switch (e.type) {
    case 'RunStarted':
      add(s, STAT.runsStarted, 1);
      break;
    case 'RunFinished':
      add(s, STAT.runsFinished, 1);
      add(s, STAT.metersSkied, Math.max(0, Math.round(e.distance)));
      if (e.outcome === 'victory') {
        add(s, STAT.wins, 1);
        // Daily Ritual: only the day's own mountain, finished on that UTC day
        if (e.mode === 'daily' && e.date && e.date === utcDay(now)) addToSet(s, STAT.dailyDays, e.date);
      }
      break;
    case 'PizzaBraking':
      if (e.distance > 0 && Number.isFinite(e.distance)) add(s, STAT.pizzaMeters, e.distance);
      break;
    case 'JumpLanded':
      if (e.landed) {
        add(s, STAT.jumpsLanded, 1);
        s.counters[STAT.longestJump] = Math.max(counter(s, STAT.longestJump), e.airtime);
      }
      break;
    case 'SnowballDodged':
      add(s, STAT.snowballsDodged, 1);
      break;
    case 'YetiEscaped':
      add(s, STAT.yetiEscapes, 1);
      break;
    case 'BiomeVisited':
      addToSet(s, STAT.biomesVisited, e.biome);
      break;
    case 'ScenicLocationDiscovered':
      addToSet(s, STAT.scenic, `${e.biome}:${e.id}`);
      break;
    case 'HazardSurvived':
      add(s, `hazard:${e.biome}:${e.kind}`, 1);
      break;
    default:
      break;
  }
}

// --- definitions ----------------------------------------------------------------------------
/** Airtime (s) of a BIG AIR in the physics' trick scoring (SkierPhysics.land: air > 1.6 → 'BIG AIR'). */
export const AIRBORNE_MIN_AIR = 1.6;
export const PIZZA_PARTY_METERS = 1000;
export const DAILY_RITUAL_DAYS = 3;
export const ICE_DANCER_SECONDS = 3;
export const DODGEBALL_COUNT = 10;
export const CLOSE_SHAVE_GAP = 6;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first-descent',
    name: 'First Descent',
    description: 'Reach the resort at the bottom of any course.',
    category: 'journey',
    icon: 'flag',
    unlock: (e) => e.type === 'RunFinished' && e.outcome === 'victory',
  },
  {
    id: 'not-today-yeti',
    name: 'Not Today, Yeti',
    description: 'Escape a Yeti chase: reach a refuge or the resort with the Yeti on your tail.',
    category: 'yeti',
    icon: 'yeti',
    reward: 'jacket.glacier-blue',
    unlock: (e) => e.type === 'YetiEscaped',
  },
  {
    id: 'pizza-party',
    name: 'Pizza Party',
    description: 'Brake in a controlled pizza (snowplough) for 1,000 m in total, across all runs.',
    category: 'skill',
    icon: 'pizza',
    reward: 'jacket.pesto-green',
    progress: { target: PIZZA_PARTY_METERS, value: (s) => counter(s, STAT.pizzaMeters), unit: 'm' },
    unlock: (e, c) => e.type === 'PizzaBraking' && counter(c.stats, STAT.pizzaMeters) >= PIZZA_PARTY_METERS,
  },
  {
    id: 'airborne',
    name: 'Airborne',
    description: `Land a jump with at least ${AIRBORNE_MIN_AIR} s of airtime (a BIG AIR) without crashing.`,
    category: 'skill',
    icon: 'jump',
    unlock: (e) => e.type === 'JumpLanded' && e.landed && e.airtime >= AIRBORNE_MIN_AIR,
  },
  {
    id: 'long-haul',
    name: 'Long Haul',
    description: 'Reach the resort on an Expedition (50 km) course.',
    category: 'journey',
    icon: 'mountain',
    unlock: (e) => e.type === 'RunFinished' && e.outcome === 'victory' && e.length === 'expedition',
  },
  {
    id: 'daily-ritual',
    name: 'Daily Ritual',
    description: `Reach the resort on the Daily Mountain on ${DAILY_RITUAL_DAYS} different days, each on its own UTC day (replaying a past day doesn't count).`,
    category: 'daily',
    icon: 'calendar',
    progress: { target: DAILY_RITUAL_DAYS, value: (s) => setSize(s, STAT.dailyDays), unit: 'days' },
    unlock: (e, c) => e.type === 'RunFinished' && setSize(c.stats, STAT.dailyDays) >= DAILY_RITUAL_DAYS,
  },
  {
    id: 'dodgeball',
    name: 'Dodgeball',
    description: `Dodge ${DODGEBALL_COUNT} Yeti snowballs (Hard) by getting out of their marked landing zones.`,
    category: 'yeti',
    icon: 'snowball',
    progress: { target: DODGEBALL_COUNT, value: (s) => counter(s, STAT.snowballsDodged) },
    unlock: (e, c) => e.type === 'SnowballDodged' && counter(c.stats, STAT.snowballsDodged) >= DODGEBALL_COUNT,
  },
  {
    id: 'close-shave',
    name: 'Close Shave',
    description: `Escape a Yeti chase after the Yeti got within ${CLOSE_SHAVE_GAP} m of you.`,
    category: 'yeti',
    icon: 'claw',
    hidden: true,
    unlock: (e) => e.type === 'YetiEscaped' && e.closestGap < CLOSE_SHAVE_GAP,
  },
  // --- locations still in development: defined now, earned once those biomes emit their events ---
  {
    id: 'scenic-route',
    name: 'Scenic Route',
    description: 'Discover a designated viewpoint on the Fjord Coast.',
    category: 'exploration',
    icon: 'viewpoint',
    biome: BIOME_IDS.fjord,
    requires: 'Fjord Coast location',
    unlock: (e) => e.type === 'ScenicLocationDiscovered' && e.biome === BIOME_IDS.fjord,
  },
  {
    id: 'whiteout-survivor',
    name: 'Whiteout Survivor',
    description: 'Reach the resort at Whiteout Ridge on Normal or Hard.',
    category: 'exploration',
    icon: 'storm',
    biome: BIOME_IDS.whiteout,
    requires: 'Whiteout Ridge location',
    unlock: (e) => e.type === 'RunFinished' && e.outcome === 'victory' && e.biome === BIOME_IDS.whiteout && (e.difficulty === 'normal' || e.difficulty === 'hard'),
  },
  {
    id: 'ice-dancer',
    name: 'Ice Dancer',
    description: `Hold a controlled drift on ice for ${ICE_DANCER_SECONDS} s in the Frozen Frontier (no crash at the end).`,
    category: 'exploration',
    icon: 'ice',
    biome: BIOME_IDS.frozen,
    requires: 'Frozen Frontier location',
    unlock: (e, c) => e.type === 'DriftCompleted' && e.controlled && (e.surfaces.ice ?? 0) >= ICE_DANCER_SECONDS && c.run?.biome === BIOME_IDS.frozen,
  },
  {
    id: 'steam-runner',
    name: 'Steam Runner',
    description: 'Ski through a geothermal vent zone in the Volcanic Expanse without crashing.',
    category: 'exploration',
    icon: 'steam',
    biome: BIOME_IDS.volcanic,
    requires: 'Volcanic Expanse location',
    unlock: (e) => e.type === 'HazardSurvived' && e.biome === BIOME_IDS.volcanic && e.kind === HAZARD_VENT_ZONE,
  },
];

export function getAchievement(id: string, defs: readonly AchievementDef[] = ACHIEVEMENTS): AchievementDef | undefined {
  return defs.find((d) => d.id === id);
}

/** Earned achievements (any id, including ids this build doesn't know). */
export type EarnedMap = Record<string, { earnedAt: number }>;

/**
 * The evaluator: fold one event into the statistics, then return the definitions newly earned by
 * it (and record them in `earned`). Pure apart from mutating the passed state.
 */
export function evaluateEvent(stats: ProgressStats, earned: EarnedMap, e: GameEvent, ctx: Omit<EvalContext, 'stats'>, defs: readonly AchievementDef[] = ACHIEVEMENTS): AchievementDef[] {
  accumulateStats(stats, e, ctx.now);
  const full: EvalContext = { ...ctx, stats };
  const out: AchievementDef[] = [];
  for (const d of defs) {
    if (earned[d.id]) continue;
    let ok = false;
    try {
      ok = d.unlock(e, full);
    } catch {
      ok = false;
    }
    if (ok) {
      earned[d.id] = { earnedAt: ctx.now };
      out.push(d);
    }
  }
  return out;
}

export interface AchievementView {
  def: AchievementDef;
  earned: boolean;
  earnedAt: number | null;
  /** hidden and not earned: show as ??? */
  secret: boolean;
  progress: { value: number; target: number; unit?: string } | null;
}

/** What the Achievements screen shows. */
export function viewAchievements(stats: ProgressStats, earned: EarnedMap, defs: readonly AchievementDef[] = ACHIEVEMENTS): AchievementView[] {
  return defs.map((def) => {
    const e = earned[def.id];
    const p = def.progress;
    return {
      def,
      earned: !!e,
      earnedAt: e?.earnedAt ?? null,
      secret: !!def.hidden && !e,
      progress: p && !(def.hidden && !e) ? { value: e ? p.target : Math.min(p.target, p.value(stats)), target: p.target, unit: p.unit } : null,
    };
  });
}

/**
 * Earn progress achievements whose goal the stored statistics already meet (an achievement added
 * in an update, or a target lowered): returns the newly earned definitions.
 */
export function reconcileProgress(stats: ProgressStats, earned: EarnedMap, now: number, defs: readonly AchievementDef[] = ACHIEVEMENTS): AchievementDef[] {
  const out: AchievementDef[] = [];
  for (const d of defs) {
    if (earned[d.id] || !d.progress) continue;
    if (d.progress.value(stats) >= d.progress.target) {
      earned[d.id] = { earnedAt: now };
      out.push(d);
    }
  }
  return out;
}
