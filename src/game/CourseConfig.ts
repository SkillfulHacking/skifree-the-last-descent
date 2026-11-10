/**
 * Course selection: which mountain (Classic / Daily / Custom seed) and how long (Sprint … Endless).
 *
 * A CourseConfig is a small serializable value. Everything else about the course (segment plan,
 * route, biomes, cave and Yeti placement, checkpoints, finish) is derived deterministically from it
 * by the profile (src/world/profile.ts), so the same config always produces the same mountain.
 *
 * Daily: one mountain per UTC calendar day. The day rolls over at 00:00 UTC for every player
 * (explicitly not local midnight), so a shared daily code means the same course everywhere.
 * Records are local to this browser only — there is no online leaderboard.
 *
 * Location (biome, src/world/biome.ts): the default biome adds nothing to the course code, so codes
 * and record keys from before biomes existed are unchanged. Any other biome appends "@<CODE>"
 * (e.g. DAILY-2026-11-07-STD-H@DUNE) and mixes its id into the world seed, so the same code gives
 * a different mountain in every location.
 */
import { Mountain, SEED_DEFAULT } from '../world/course';
import { DEFAULT_BIOME, biomeByCode, getBiome, hasBiome, type BiomeId } from '../world/biome';

export type CourseMode = 'classic' | 'daily' | 'custom';
export type LengthMode = 'sprint' | 'standard' | 'endurance' | 'expedition' | 'endless';
/** Pursuit difficulty: scales the Yeti's speed in every encounter. */
export type Difficulty = 'relaxed' | 'normal' | 'hard';
export const DIFFICULTY: Record<Difficulty, { yetiSpeed: number; label: string; code: string }> = {
  relaxed: { yetiSpeed: 0.93, label: 'Relaxed', code: 'R' },
  normal: { yetiSpeed: 1, label: 'Normal', code: '' },
  hard: { yetiSpeed: 1.07, label: 'Hard', code: 'H' },
};

export const LENGTH_MODES: readonly LengthMode[] = ['sprint', 'standard', 'endurance', 'expedition', 'endless'];

export const LENGTH_INFO: Record<LengthMode, { metres: number; label: string; short: string; blurb: string }> = {
  sprint: { metres: 3000, label: 'Sprint · 3 km', short: 'SPR', blurb: 'A short, sharp descent' },
  standard: { metres: 10000, label: 'Standard · 10 km', short: 'STD', blurb: 'The full mountain' },
  endurance: { metres: 20000, label: 'Endurance · 20 km', short: 'END', blurb: 'Long run, more terrain' },
  expedition: { metres: 50000, label: 'Expedition · 50 km', short: 'EXP', blurb: 'An epic traverse' },
  endless: { metres: Infinity, label: 'Endless', short: 'INF', blurb: 'No finish. Bank at the lodges.' },
};

export interface CourseConfig {
  mode: CourseMode;
  length: LengthMode;
  seed: number;
  /** Daily only: the UTC date this course belongs to (YYYY-MM-DD) */
  date: string | null;
  /** Custom only: what the player typed */
  customText: string | null;
  difficulty: Difficulty;
  /** location (registered biome id); DEFAULT_BIOME ('alpine') for every pre-biome course */
  biome: BiomeId;
}

/** UTC calendar date (YYYY-MM-DD) for a timestamp. */
export function utcDate(now: number | Date = Date.now()): string {
  const d = typeof now === 'number' ? new Date(now) : now;
  return d.toISOString().slice(0, 10);
}

/** Milliseconds until the next daily rollover (00:00 UTC). */
export function msUntilRollover(now: number = Date.now()): number {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return next - now;
}

/** Shift a YYYY-MM-DD date by whole days. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return utcDate(new Date(Date.UTC(y, m - 1, d + days)));
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return utcDate(new Date(`${date}T00:00:00Z`)) === date;
}

/** 32-bit FNV-1a, then avalanche (stable across platforms and releases). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

export function dailySeed(date: string): number {
  return hashString(`skifree-tld/daily/${date}`);
}

/** Seed from free text: a plain number is used as-is, anything else is hashed. */
export function customSeed(text: string): number {
  const t = text.trim();
  // plain numbers within the 32-bit range are used as-is (no silent wrap-around, B10)
  if (/^\d{1,10}$/.test(t) && Number(t) <= 0xffffffff) return Number(t);
  return hashString(`skifree-tld/custom/${t.toUpperCase()}`);
}

export function makeCourse(mode: CourseMode, length: LengthMode, opts: { date?: string; customText?: string; now?: number; difficulty?: Difficulty; biome?: BiomeId } = {}): CourseConfig {
  const difficulty = opts.difficulty ?? 'normal';
  // unknown / unregistered locations fall back to the default
  const biome = hasBiome(opts.biome) ? opts.biome : DEFAULT_BIOME;
  if (mode === 'daily') {
    const date = opts.date && isValidDate(opts.date) ? opts.date : utcDate(opts.now ?? Date.now());
    return { mode, length, seed: dailySeed(date), date, customText: null, difficulty, biome };
  }
  if (mode === 'custom') {
    const text = (opts.customText ?? '').trim() || 'POWDER';
    return { mode, length, seed: customSeed(text), date: null, customText: text, difficulty, biome };
  }
  return { mode: 'classic', length, seed: SEED_DEFAULT, date: null, customText: null, difficulty, biome };
}

/**
 * Seed the world is generated from. `c.seed` is the course's own seed (shown in the code for
 * custom courses); for a non-default biome the biome id is mixed in, so every location has its
 * own mountain for the same code. The default biome uses `c.seed` unchanged.
 */
export function worldSeed(c: CourseConfig): number {
  const b = c.biome ?? DEFAULT_BIOME;
  return b === DEFAULT_BIOME ? c.seed : hashString(`skifree-tld/biome/${b}/${c.seed}`);
}

/**
 * Stable identity of a course, used as the records key and shown as the share code.
 * Examples: CLASSIC-STD, DAILY-2026-11-07-END, SEED-1234567-SPR.
 */
export function courseId(c: CourseConfig): string {
  const len = LENGTH_INFO[c.length].short + (DIFFICULTY[c.difficulty ?? 'normal'].code ? `-${DIFFICULTY[c.difficulty].code}` : '');
  const loc = c.biome && c.biome !== DEFAULT_BIOME ? `@${getBiome(c.biome).code}` : '';
  if (c.mode === 'daily') return `DAILY-${c.date}-${len}${loc}`;
  if (c.mode === 'custom') return `SEED-${c.seed}-${len}${loc}`;
  return `CLASSIC-${len}${loc}`;
}

/** Parse a share code back into a config (null if not recognised). */
export function parseCourseId(id: string): CourseConfig | null {
  const raw = id.trim().toUpperCase();
  // optional location suffix "@CODE" (must name a registered biome)
  const at = raw.indexOf('@');
  const s = at < 0 ? raw : raw.slice(0, at);
  const biome = at < 0 ? DEFAULT_BIOME : biomeByCode(raw.slice(at + 1))?.id;
  if (!biome) return null;
  const base = parseBaseCourseId(s);
  return base && biome !== DEFAULT_BIOME ? { ...base, biome } : base;
}

function parseBaseCourseId(s: string): CourseConfig | null {
  const len = (code: string) => LENGTH_MODES.find((l) => LENGTH_INFO[l].short === code) ?? null;
  const diff = (code: string | undefined): Difficulty | null => (!code ? 'normal' : code === 'R' ? 'relaxed' : code === 'H' ? 'hard' : null);
  let m = /^CLASSIC-([A-Z]{3})(?:-([RH]))?$/.exec(s);
  if (m) {
    const l = len(m[1]!);
    const d = diff(m[2]);
    return l && d ? makeCourse('classic', l, { difficulty: d }) : null;
  }
  m = /^DAILY-(\d{4}-\d{2}-\d{2})-([A-Z]{3})(?:-([RH]))?$/.exec(s);
  if (m) {
    const l = len(m[2]!);
    const d = diff(m[3]);
    // future days do not exist yet (B10)
    return l && d && isValidDate(m[1]!) && m[1]! <= utcDate() ? makeCourse('daily', l, { date: m[1]!, difficulty: d }) : null;
  }
  m = /^SEED-(\d{1,10})-([A-Z]{3})(?:-([RH]))?$/.exec(s);
  if (m) {
    const l = len(m[2]!);
    const d = diff(m[3]);
    return l && d && Number(m[1]) <= 0xffffffff ? makeCourse('custom', l, { customText: m[1]!, difficulty: d }) : null;
  }
  return null;
}

export function courseLabel(c: CourseConfig): string {
  const name = c.mode === 'daily' ? `Daily Mountain · ${c.date} (UTC)` : c.mode === 'custom' ? `Custom seed “${c.customText}”` : 'The Last Descent';
  const d = c.difficulty && c.difficulty !== 'normal' ? ` · ${DIFFICULTY[c.difficulty].label}` : '';
  const loc = c.biome && c.biome !== DEFAULT_BIOME ? ` · ${getBiome(c.biome).name}` : '';
  return `${name}${loc} · ${LENGTH_INFO[c.length].label}${d}`;
}

/**
 * The full, serialisable description of a course: the config plus everything derived from it
 * (segment plan, guaranteed route samples, encounters, refuges, alternate lines, finish).
 * Endless courses are described up to `upToZ`.
 */
export function courseSpec(c: CourseConfig, upToZ = 60000) {
  const m = buildMountain(c);
  const P = m.profile;
  const end = Number.isFinite(m.finishZ) ? m.finishZ + 400 : upToZ;
  P.ensure(end);
  const segs = (P as unknown as { segmentList?: ReadonlyArray<{ type: string; z0: number; z1: number }> }).segmentList ?? [{ type: 'classic', z0: -400, z1: m.finishZ }];
  const route: Array<[number, number, number, number]> = [];
  for (let z = 0; z <= Math.min(end, m.finishZ); z += 100) route.push([z, +m.routeX(z).toFixed(2), +m.heightAt(m.routeX(z), z).toFixed(2), +m.halfWidth(z).toFixed(1)]);
  return {
    version: 1,
    id: courseId(c),
    config: c,
    profile: P.kind,
    finishZ: Number.isFinite(m.finishZ) ? m.finishZ : null,
    difficulty: { name: c.difficulty, yetiSpeed: DIFFICULTY[c.difficulty].yetiSpeed },
    segments: segs.filter((s) => s.z0 < end).map((s) => ({ type: s.type, z0: Math.round(s.z0), z1: Number.isFinite(s.z1) ? Math.round(s.z1) : null })),
    encounters: P.encounters(-Infinity, end).map((e) => ({ index: e.index, caveZ: e.caveZ, side: e.anchor.side, chaseEndZ: e.chaseEndZ, refugeZ: e.checkpointZ, yetiSpeed: +(e.speedMul * DIFFICULTY[c.difficulty].yetiSpeed).toFixed(3) })),
    refuges: P.checkpoints(-Infinity, end),
    alternateLines: P.altRoutes(-Infinity, end).map((a) => ({ type: a.type, z0: Math.round(a.z0), z1: Math.round(a.z1) })),
    route,
  };
}

export function sameCourse(a: CourseConfig, b: CourseConfig): boolean {
  return courseId(a) === courseId(b);
}

/**
 * True only for the original hand-authored 3 km layout (ClassicProfile): Classic mode, Sprint
 * length, in the default (Alpine) location. It is the legacy baseline and stays Alpine-only.
 *
 * Decision (Pass 4, brief §1): in any other location, Classic mode means that location's fixed
 * "signature" mountain (seed SEED_DEFAULT mixed with the biome id, see worldSeed), and its Sprint
 * is GENERATED with the biome's own terrain like every other length. The Alpine classic layout is
 * deliberately not offered outside Alpine, so a location's Sprint is never "Alpine with different
 * colours". Course codes are unaffected (CLASSIC-SPR@CODE names that generated Sprint).
 */
export function usesClassicLayout(c: CourseConfig): boolean {
  return c.mode === 'classic' && c.length === 'sprint' && (c.biome ?? DEFAULT_BIOME) === DEFAULT_BIOME;
}

/**
 * Build the mountain for a config. Alpine Classic Sprint is the original hand-tuned 3 km course
 * (ClassicProfile, unchanged); every other combination — including Sprint in every other
 * location — is a generated course. The biome skins the mountain and scales its generated
 * terrain; see worldSeed for the seed and usesClassicLayout for the rule.
 */
export function buildMountain(c: CourseConfig): Mountain {
  const biome = getBiome(c.biome);
  if (usesClassicLayout(c)) return Mountain.classic(worldSeed(c), biome);
  return Mountain.generated(worldSeed(c), LENGTH_INFO[c.length].metres, biome);
}
