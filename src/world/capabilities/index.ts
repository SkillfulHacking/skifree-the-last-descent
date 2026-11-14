/**
 * Biome capabilities: the gameplay- and presentation-level modules a location can plug in, on top
 * of the look/terrain data in the Biome object (src/world/biome.ts).
 *
 * Every module is optional on a Biome (`biome.capabilities`) and falls back to the Alpine
 * default, which reproduces the original game exactly. Pure logic lives here (no three.js);
 * three.js presentation is referenced by id and resolved in src/world/presentation/.
 *
 *   surface  — SurfaceModel: physics modifiers by position/surface (pure)            → SkierPhysics
 *   weather  — WeatherModel: wind / visibility / snowfall by position+time+seed (pure) → Environment, SkierPhysics
 *   hazards  — kinds (ids) + density: placed per band, streamed, evaluated (pure)     → HazardField, BiomeEnvironment
 *   finish   — finish environment id (scene builder + victory script + trophy)        → presentation/finish.ts
 *   refuge   — refuge presentation id + display name                                 → presentation/refuge.ts
 *   cave     — cave presentation id (dressing around the shared cave geometry)       → presentation/cave.ts
 *   audio    — ambience profile ids                                                   → AudioEngine
 *   rating   — environmental difficulty 1..5 + label (menu)                           → Menu
 *
 * See docs/BIOMES.md for what each module must provide.
 */
import { ALPINE_SURFACE, type SurfaceModel } from './surface';
import { ALPINE_WEATHER, validateWeather, type WeatherModel } from './weather';
import { hasHazardKind } from '../hazards/hazard';

export interface HazardSetup {
  /** registered hazard kind ids (src/world/hazards), in placement order */
  readonly kinds: readonly string[];
  /** × every kind's default amount (biome hazard tuning; 0 = none) */
  readonly density: number;
  /**
   * × the strength of hazard effects by game difficulty (the layout is the same on every
   * difficulty, so a course code always describes the same course; only how hard a squall pushes or
   * rock drags changes). Omitted entries are 1. Lets a harder location stay approachable on Relaxed
   * without touching the Yeti (brief §2).
   */
  readonly intensity?: Readonly<Partial<Record<GameDifficulty, number>>>;
  /**
   * × intensity on long courses (finite ≥ 20 km, and Endless): the environment's cost accumulates
   * over a long run, so a location can ease it there to keep its place on the difficulty ladder.
   */
  readonly longCourse?: number;
}

/** The player's game difficulty setting (mirrors game/CourseConfig Difficulty; world code may not import game). */
export type GameDifficulty = 'relaxed' | 'normal' | 'hard';

export interface PresentationRef {
  /** id of a registered presentation (finish / refuge / cave registries) */
  readonly id: string;
}

export interface RefugeSetup extends PresentationRef {
  /** what the refuges are called in this location, e.g. "Ski patrol cabin" */
  readonly name: string;
}

export interface AudioProfile {
  /** ambience bed ids, mixed together (see KNOWN_AMBIENCE) */
  readonly ambience: readonly string[];
}

export interface DifficultyRating {
  /** environmental difficulty, 1 (easiest) … 5 (expert). Independent of the Yeti difficulty. */
  readonly level: 1 | 2 | 3 | 4 | 5;
  /** short label, e.g. "Beginner" */
  readonly label: string;
}

export interface BiomeCapabilities {
  readonly surface: SurfaceModel;
  readonly weather: WeatherModel;
  readonly hazards: HazardSetup;
  readonly finish: PresentationRef;
  readonly refuge: RefugeSetup;
  readonly cave: PresentationRef;
  readonly audio: AudioProfile;
  readonly rating: DifficultyRating;
  /**
   * Optional location scenery (three.js, presentation/scenery.ts): streamed set dressing that
   * follows the course — a coast's water surfaces, sea mist, hamlets, boats, viewpoints. Alpine: none.
   */
  readonly scenery?: PresentationRef;
}

/** Ambience beds the audio engine can play (src/audio/ambience.ts). */
export const KNOWN_AMBIENCE: readonly string[] = ['wind', 'surf', 'gulls'];

/** Alpine: the original game, module by module. */
export const ALPINE_CAPABILITIES: BiomeCapabilities = Object.freeze({
  surface: ALPINE_SURFACE,
  weather: ALPINE_WEATHER,
  hazards: Object.freeze({ kinds: Object.freeze([]) as readonly string[], density: 0 }),
  finish: Object.freeze({ id: 'alpine-resort' }),
  refuge: Object.freeze({ id: 'ski-patrol-cabin', name: 'Ski patrol cabin' }),
  cave: Object.freeze({ id: 'alpine-cave' }),
  audio: Object.freeze({ ambience: Object.freeze(['wind']) as readonly string[] }),
  rating: Object.freeze({ level: 1, label: 'Beginner' } as const),
});

/** Anything carrying optional capabilities (a Biome). Structural to avoid an import cycle. */
export interface HasCapabilities {
  readonly id: string;
  readonly capabilities?: Partial<BiomeCapabilities>;
}

const resolved = new WeakMap<object, BiomeCapabilities>();

/** The full capability set of a biome (missing modules = Alpine defaults). Cached per object. */
export function capabilitiesOf(b: HasCapabilities): BiomeCapabilities {
  let c = resolved.get(b);
  if (!c) {
    c = Object.freeze({ ...ALPINE_CAPABILITIES, ...(b.capabilities ?? {}) });
    resolved.set(b, c);
  }
  return c;
}

/**
 * Problems with a biome's capabilities that can be checked without three.js (empty = fine).
 * Presentation ids (finish / refuge / cave / hazard views) are checked by
 * validateBiomePresentation in src/world/presentation/index.ts.
 */
export function validateCapabilities(b: HasCapabilities): string[] {
  const c = capabilitiesOf(b);
  const out: string[] = [];
  const r = c.rating;
  if (![1, 2, 3, 4, 5].includes(r.level)) out.push(`rating.level ${String(r.level)} must be 1..5`);
  if (!r.label || r.label.length > 24) out.push('rating.label must be 1–24 characters');
  if (!(c.hazards.density >= 0 && c.hazards.density <= 4)) out.push(`hazards.density ${c.hazards.density} outside [0, 4]`);
  for (const k of c.hazards.kinds) if (!hasHazardKind(k)) out.push(`hazard kind "${k}" is not registered (register it before the biome)`);
  if (new Set(c.hazards.kinds).size !== c.hazards.kinds.length) out.push('hazard kinds must be unique');
  for (const a of c.audio.ambience) if (!KNOWN_AMBIENCE.includes(a)) out.push(`unknown ambience "${a}"`);
  if (!c.audio.ambience.length) out.push('audio.ambience needs at least one bed');
  for (const [k, ref] of [['finish', c.finish], ['refuge', c.refuge], ['cave', c.cave], ...(c.scenery ? [['scenery', c.scenery] as const] : [])] as const) if (!ref.id || !/^[a-z0-9][a-z0-9-]*$/.test(ref.id)) out.push(`${k}.id "${ref.id}" must be lowercase [a-z0-9-]`);
  if (!c.refuge.name) out.push('refuge.name is required');
  if (!c.surface.id || typeof c.surface.modifiers !== 'function') out.push('surface model needs an id and modifiers()');
  if (!c.weather.id || typeof c.weather.sample !== 'function') out.push('weather model needs an id and sample()');
  else out.push(...validateWeather(c.weather).map((e) => `weather: ${e}`));
  return out;
}

export { ALPINE_SURFACE, IDENTITY_SURFACE, combineSurface, resetSurface, surfaceTable, validateSurfaceModifiers, type SurfaceModel, type SurfaceModifiers, type SurfaceQuery, type SurfaceWeights } from './surface';
export { ALPINE_WEATHER, CALM, makeWeatherSample, parametricWeather, validateWeather, type WeatherCoupling, type WeatherModel, type WeatherSample } from './weather';
