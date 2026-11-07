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
 */
import { Mountain, SEED_DEFAULT } from '../world/course';

export type CourseMode = 'classic' | 'daily' | 'custom';
export type LengthMode = 'sprint' | 'standard' | 'endurance' | 'expedition' | 'endless';

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
  if (/^\d{1,10}$/.test(t)) return Number(t) >>> 0;
  return hashString(`skifree-tld/custom/${t.toUpperCase()}`);
}

export function makeCourse(mode: CourseMode, length: LengthMode, opts: { date?: string; customText?: string; now?: number } = {}): CourseConfig {
  if (mode === 'daily') {
    const date = opts.date && isValidDate(opts.date) ? opts.date : utcDate(opts.now ?? Date.now());
    return { mode, length, seed: dailySeed(date), date, customText: null };
  }
  if (mode === 'custom') {
    const text = (opts.customText ?? '').trim() || 'POWDER';
    return { mode, length, seed: customSeed(text), date: null, customText: text };
  }
  return { mode: 'classic', length, seed: SEED_DEFAULT, date: null, customText: null };
}

/**
 * Stable identity of a course, used as the records key and shown as the share code.
 * Examples: CLASSIC-STD, DAILY-2026-11-07-END, SEED-1234567-SPR.
 */
export function courseId(c: CourseConfig): string {
  const len = LENGTH_INFO[c.length].short;
  if (c.mode === 'daily') return `DAILY-${c.date}-${len}`;
  if (c.mode === 'custom') return `SEED-${c.seed}-${len}`;
  return `CLASSIC-${len}`;
}

/** Parse a share code back into a config (null if not recognised). */
export function parseCourseId(id: string): CourseConfig | null {
  const s = id.trim().toUpperCase();
  const len = (code: string) => LENGTH_MODES.find((l) => LENGTH_INFO[l].short === code) ?? null;
  let m = /^CLASSIC-([A-Z]{3})$/.exec(s);
  if (m) {
    const l = len(m[1]!);
    return l ? makeCourse('classic', l) : null;
  }
  m = /^DAILY-(\d{4}-\d{2}-\d{2})-([A-Z]{3})$/.exec(s);
  if (m) {
    const l = len(m[2]!);
    return l && isValidDate(m[1]!) ? makeCourse('daily', l, { date: m[1]! }) : null;
  }
  m = /^SEED-(\d{1,10})-([A-Z]{3})$/.exec(s);
  if (m) {
    const l = len(m[2]!);
    return l ? makeCourse('custom', l, { customText: m[1]! }) : null;
  }
  return null;
}

export function courseLabel(c: CourseConfig): string {
  const name = c.mode === 'daily' ? `Daily Mountain · ${c.date} (UTC)` : c.mode === 'custom' ? `Custom seed “${c.customText}”` : 'The Last Descent';
  return `${name} · ${LENGTH_INFO[c.length].label}`;
}

export function sameCourse(a: CourseConfig, b: CourseConfig): boolean {
  return courseId(a) === courseId(b);
}

/**
 * Build the mountain for a config. Classic Sprint is the original hand-tuned 3 km course
 * (ClassicProfile, unchanged); every other combination is a generated course.
 */
export function buildMountain(c: CourseConfig): Mountain {
  if (c.mode === 'classic' && c.length === 'sprint') return new Mountain(SEED_DEFAULT);
  return Mountain.generated(c.seed, LENGTH_INFO[c.length].metres);
}
