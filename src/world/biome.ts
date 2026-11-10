/**
 * Biomes: the "location" a course is skied in — everything that defines a mountain's look and
 * feel and that a new location would change, gathered in one plain data object.
 *
 * The course *structure* (segment plan, encounters, caves, refuges, finish) comes from the profile
 * (profile.ts) and the CourseConfig; a biome only re-skins and re-shapes it:
 *  - sky, sun, ambient light, image-based light, exposure, fog/aerial perspective, falling snow;
 *  - terrain material colours (snow, packed piste, powder, wind slab, ice, rock strata, tints);
 *  - distant skyline colours;
 *  - tree species (shape + needle colour), species mix, bark, foliage tint/snow, tree densities;
 *  - rock colours and obstacle mix (rocks / logs / stumps);
 *  - terrain-generation knobs (slope/width/swing scales, segment-type mix, noise amplitudes);
 *  - ambient audio (wind level/pitch);
 *  - display name, short description and course-code tag.
 *
 * What is deliberately NOT a biome parameter (see docs/BIOMES.md): the Yeti, the cave and its
 * story props, the resort/lodges/start area/checkpoints, ski tracks and particles (they follow the
 * fog colour automatically), the classic hand-tuned Sprint profile's slope/width tracks, special
 * segments (summit, encounter shelf, refuges, finish), physics/surface grip, music, and the
 * fallen-tree/log/stump meshes.
 *
 * This module is pure data (no three.js import) so it can be used by settings, course codes and
 * unit tests in Node. Colours are linear RGB triples (exactly what `new THREE.Color(r, g, b)` takes).
 *
 * The built-in biome "alpine" reproduces the original game exactly: every value below is the
 * literal that used to be hard-coded at the place noted in its comment.
 *
 * Gameplay and presentation beyond look/terrain (surface physics, weather, hazards, finish, refuge,
 * cave dressing, ambience, difficulty rating) are optional *capability modules* in
 * `Biome.capabilities` (src/world/capabilities/index.ts); every module left out falls back to the
 * Alpine default. Read them with `capabilitiesOf(biome)`.
 */
import type { SegmentType } from './profile';
import type { CoastParams } from './coast';
import { validateCapabilities, type BiomeCapabilities } from './capabilities';

/** Linear RGB, 0..1 (values > 1 allowed for tints/multipliers). */
export type RGB = readonly [number, number, number];

export type BiomeId = string;

export interface BiomeSky {
  /** three.js `Sky` uniforms */
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  /** sun position, degrees */
  sunElevation: number;
  sunAzimuth: number;
}

export interface BiomeLighting {
  sunColor: RGB;
  sunIntensity: number;
  hemiSky: RGB;
  hemiGround: RGB;
  hemiIntensity: number;
  /** scene.environmentIntensity (IBL from the sky) */
  envIntensity: number;
  /** colour of the ground disc baked into the IBL (snow bounce), hex sRGB as MeshBasicMaterial takes it */
  envGround: number;
  /** renderer tone-mapping exposure while this biome is loaded */
  exposure: number;
}

export interface BiomeAtmosphere {
  fogColor: RGB;
  /** FogExp2 density */
  fogDensity: number;
  /** forward in-scattering colour towards the sun */
  sunHaze: RGB;
  /** linear extinction per metre */
  linear: number;
  /** 1 / haze scale height (m) */
  falloff: number;
}

export interface BiomeWeather {
  /** ambient falling flakes: multiplier on the per-quality flake count (0 = none) */
  flakeDensity: number;
  flakeSize: number;
  flakeOpacity: number;
  flakeColor: number;
}

/** Terrain shader palette (snowMaterial.ts). */
export interface BiomeTerrainLook {
  snow: RGB;
  windSlab: RGB;
  packed: RGB;
  powder: RGB;
  ice: RGB;
  /** rock strata tones: cool grey / warm grey-brown / dark */
  rockA: RGB;
  rockB: RGB;
  rockC: RGB;
  /** albedo tint on faces turned away from the sun */
  shadeTint: RGB;
  /** multiplier on indirect (sky) light on snow */
  skylightTint: RGB;
}

/** Distant skyline palette (look/ranges.ts). */
export interface BiomeRangesLook {
  skyColor: RGB;
  snow: RGB;
  stoneDark: RGB;
  stoneLight: RGB;
  lowland: RGB;
  /**
   * Optional open horizon (e.g. the sea): a sector of the skyline where the distant ridges sink to
   * `floor` × their height. `center` is the world direction angle atan2(z, x) in radians (+Z, the
   * way down the course, is π/2; −X is π); `halfWidth` in radians. Omitted: ridges all around.
   */
  openSector?: { center: number; halfWidth: number; floor: number };
}

/** One conifer species (shape + needle colour). See props.ts pineGeometry. */
export interface TreeSpecies {
  name: string;
  height: number;
  /** fraction of the height that is bare trunk */
  crownBase: number;
  baseR: number;
  whorls: number;
  maxBranches: number;
  /** branch droop at the bottom / top of the crown */
  droop0: number;
  droop1: number;
  /** probability that a branch is missing */
  gap: number;
  needle: RGB;
  /** crooked / wind-bent leader */
  lean: number;
}

export interface BiomeTrees {
  /** exactly three species (the renderer keeps one instanced mesh per species slot) */
  species: readonly [TreeSpecies, TreeSpecies, TreeSpecies];
  /** relative frequency of each species; omit for an even mix (the original behaviour) */
  speciesWeights?: readonly [number, number, number];
  bark: RGB;
  /** per-instance needle tint range (foliage shader) */
  tintA: RGB;
  tintB: RGB;
  /** snow colour on branches */
  snow: RGB;
  /** multiplier on corridor (collidable) tree density */
  density: number;
  /** multiplier on decorative valley-wall forest density */
  decorDensity: number;
}

export interface BiomeRocks {
  /** bare-rock vertex albedo */
  base: RGB;
  /** per-instance tints (cool / warm / dark) */
  tintCool: RGB;
  tintWarm: RGB;
  tintDark: RGB;
  /** snow cap colour */
  snow: RGB;
}

/** Obstacle mix: multipliers on the base placement probabilities (1 = original). */
export interface BiomeObstacles {
  rocks: number;
  logs: number;
  stumps: number;
}

/**
 * Terrain-generation knobs. The scale factors apply to generated courses' regular segments only
 * (the classic Sprint profile and the summit/encounter/refuge/finish set pieces keep their
 * hand-tuned values, because gameplay timing depends on them). The amplitudes apply everywhere.
 */
export interface BiomeTerrain {
  /** × slope of regular segments */
  slopeScale: number;
  /** × piste half-width of regular segments */
  widthScale: number;
  /** × centre-line swing amplitude of regular segments */
  swingScale: number;
  /** relative weights of regular segment types; omit for the original uniform mix */
  segmentWeights?: Partial<Record<SegmentType, number>>;
  /** segment types that may get an alternate line; omit for the original set */
  altTypes?: readonly SegmentType[];
  /** floor (degrees) on regular segments' slope; omit for none (see profile.ts ProfileKnobs) */
  minSlope?: number;
  /** ridgeline spines with gap jumps; omit for none (see profile.ts ProfileKnobs) */
  spine?: { types: readonly SegmentType[]; bow: number; side: 1 | -1; gap: boolean };
  /** run-in slope at the start gate (degrees, default 6) */
  startSlope?: number;
  /** valley wall height (m) */
  wallHeight: number;
  /** ridged/fbm relief on the valley walls (m) */
  wallRelief: number;
  /** height of the far ranges rising beyond the walls (m) */
  rangeHeight: number;
  /** large-scale rolling undulation (m) */
  undulation: number;
  /** mid-scale variation (m) */
  detail: number;
  /** mogul amplitude (m) */
  moguls: number;
  /** wind drift amplitude off the groomed line (m), and its extra in powder zones */
  drifts: number;
  driftsPowder: number;
  /** roller amplitude (m) */
  rollers: number;
  /**
   * Optional sea coast on the −X side (cliffs, fjord arms, islands, harbour shore; see coast.ts).
   * Omitted (Alpine): an inland valley, heights unchanged.
   */
  coast?: CoastParams;
}

export interface BiomeAudio {
  /** ambience bed (only 'wind' exists so far) */
  ambience: 'wind';
  /** multiplier on wind gain */
  windGain: number;
  /** multiplier on wind filter frequencies */
  windPitch: number;
}

export interface Biome {
  /** stable lowercase id, stored in settings */
  id: BiomeId;
  /** course-code tag (2–8 of A–Z/0–9), appended as "@CODE" for non-default biomes */
  code: string;
  name: string;
  description: string;
  sky: BiomeSky;
  lighting: BiomeLighting;
  atmosphere: BiomeAtmosphere;
  weather: BiomeWeather;
  terrainLook: BiomeTerrainLook;
  ranges: BiomeRangesLook;
  trees: BiomeTrees;
  rocks: BiomeRocks;
  obstacles: BiomeObstacles;
  terrain: BiomeTerrain;
  audio: BiomeAudio;
  /**
   * Optional capability modules (surface, weather, hazards, finish, refuge, cave, audio, rating).
   * Omitted modules use the Alpine defaults; resolve with `capabilitiesOf(biome)`.
   */
  capabilities?: Partial<BiomeCapabilities>;
}

// =============================================================================================
// Built-in: Alpine (the original look). Comments name where each value used to be hard-coded.
// =============================================================================================
export const ALPINE: Biome = {
  id: 'alpine',
  code: 'ALP',
  name: 'Alpine',
  description: 'Clear winter day on a high alpine valley: spruce forests, grey rock, deep snow.',
  // Environment.ts
  sky: { turbidity: 2.6, rayleigh: 1.5, mieCoefficient: 0.004, mieDirectionalG: 0.82, sunElevation: 24, sunAzimuth: 205 },
  lighting: {
    sunColor: [1.0, 0.86, 0.7],
    sunIntensity: 4.2,
    hemiSky: [0.42, 0.56, 0.95],
    hemiGround: [0.6, 0.64, 0.72],
    hemiIntensity: 0.25,
    envIntensity: 0.3,
    envGround: 0x8c96a6,
    exposure: 0.78, // App.ts
  },
  // Environment.ts + look/atmosphere.ts
  atmosphere: { fogColor: [0.72, 0.8, 0.9], fogDensity: 0.00036, sunHaze: [1.0, 0.92, 0.8], linear: 1 / 16000, falloff: 1 / 520 },
  weather: { flakeDensity: 1, flakeSize: 0.09, flakeOpacity: 0.75, flakeColor: 0xffffff },
  // snowMaterial.ts
  terrainLook: {
    snow: [0.9, 0.92, 0.95],
    windSlab: [0.84, 0.87, 0.92],
    packed: [0.8, 0.84, 0.9],
    powder: [0.91, 0.925, 0.95],
    ice: [0.62, 0.7, 0.78],
    rockA: [0.25, 0.245, 0.245],
    rockB: [0.34, 0.3, 0.26],
    rockC: [0.15, 0.15, 0.165],
    shadeTint: [0.9, 0.95, 1.05],
    skylightTint: [0.88, 0.97, 1.2],
  },
  // look/ranges.ts (skyColor was passed from Environment.ts)
  ranges: { skyColor: [0.5, 0.6, 0.8], snow: [0.92, 0.94, 0.98], stoneDark: [0.15, 0.15, 0.17], stoneLight: [0.32, 0.3, 0.29], lowland: [0.1, 0.13, 0.13] },
  // props.ts (SHAPES, BARK, foliage shader) + physics/obstacles.ts / Vegetation.ts densities
  trees: {
    species: [
      // Norway-spruce type: narrow spire, strongly drooping skirts
      { name: 'Norway spruce', height: 10.4, crownBase: 0.1, baseR: 2.2, whorls: 10, maxBranches: 6, droop0: 0.62, droop1: 0.12, gap: 0.06, needle: [0.035, 0.1, 0.065], lean: 0.05 },
      // fir type: fuller, flatter tiers, bluer needles
      { name: 'Fir', height: 9.6, crownBase: 0.13, baseR: 2.5, whorls: 9, maxBranches: 6, droop0: 0.34, droop1: 0.06, gap: 0.04, needle: [0.03, 0.095, 0.08], lean: 0.03 },
      // old, tall, wind-thinned spruce: long bare trunk, ragged gaps, crooked top
      { name: 'Old spruce', height: 12.0, crownBase: 0.24, baseR: 2.25, whorls: 9, maxBranches: 5, droop0: 0.55, droop1: 0.1, gap: 0.2, needle: [0.04, 0.095, 0.06], lean: 0.12 },
    ],
    bark: [0.17, 0.12, 0.09],
    tintA: [0.82, 1.0, 1.08],
    tintB: [1.18, 1.06, 0.82],
    snow: [0.86, 0.89, 0.94],
    density: 1,
    decorDensity: 1,
  },
  // props.ts rockGeometry / createRockMaterial
  rocks: { base: [0.27, 0.26, 0.25], tintCool: [0.95, 0.97, 1.02], tintWarm: [1.18, 1.06, 0.92], tintDark: [0.62, 0.62, 0.66], snow: [0.88, 0.9, 0.94] },
  obstacles: { rocks: 1, logs: 1, stumps: 1 },
  // profile.ts GeneratedProfile (scales) + course.ts Mountain.heightAt (amplitudes)
  terrain: { slopeScale: 1, widthScale: 1, swingScale: 1, wallHeight: 330, wallRelief: 64, rangeHeight: 900, undulation: 7, detail: 1.4, moguls: 0.42, drifts: 0.9, driftsPowder: 0.6, rollers: 0.6 },
  audio: { ambience: 'wind', windGain: 1, windPitch: 1 },
};

// =============================================================================================
// Registry
// =============================================================================================
export const DEFAULT_BIOME: BiomeId = 'alpine';

const registry = new Map<BiomeId, Biome>([[ALPINE.id, ALPINE]]);

/** Registered biomes in registration order (live view: reflects later registrations). */
export const BIOMES: ReadonlyMap<BiomeId, Biome> = registry;

/** All registered biomes, in registration order (the default first). */
export function listBiomes(): Biome[] {
  return [...registry.values()];
}

export function hasBiome(id: unknown): id is BiomeId {
  return typeof id === 'string' && registry.has(id);
}

/** The biome with this id; unknown ids fall back to the default biome. */
export function getBiome(id: BiomeId | null | undefined = DEFAULT_BIOME): Biome {
  return (id != null ? registry.get(id) : undefined) ?? registry.get(DEFAULT_BIOME)!;
}

/** The biome with this course-code tag (case-insensitive), or null. */
export function biomeByCode(code: string): Biome | null {
  const c = code.toUpperCase();
  for (const b of registry.values()) if (b.code === c) return b;
  return null;
}

/**
 * Register a biome (call at module load, before settings are read). Ids must be lowercase
 * [a-z0-9-], codes 2–8 of [A-Z0-9]; both must be unique. Re-registering the same id replaces it
 * (handy for tests / hot reload), except that the default biome cannot be replaced.
 */
export function registerBiome(b: Biome): Biome {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(b.id)) throw new Error(`biome id "${b.id}" must be lowercase [a-z0-9-]`);
  if (!/^[A-Z0-9]{2,8}$/.test(b.code)) throw new Error(`biome code "${b.code}" must be 2–8 of [A-Z0-9]`);
  if (b.id === DEFAULT_BIOME && registry.get(DEFAULT_BIOME) !== b) throw new Error('the default biome cannot be replaced');
  for (const o of registry.values()) if (o.id !== b.id && o.code === b.code) throw new Error(`biome code "${b.code}" is already used by "${o.id}"`);
  if (b.trees.species.length !== 3) throw new Error('a biome needs exactly three tree species');
  const capErrors = validateCapabilities(b);
  if (capErrors.length) throw new Error(`biome "${b.id}": ${capErrors.join('; ')}`);
  registry.set(b.id, b);
  return b;
}

/** Remove a registered biome (tests). The default biome cannot be removed. */
export function unregisterBiome(id: BiomeId): void {
  if (id !== DEFAULT_BIOME) registry.delete(id);
}

/**
 * Start a new biome from an existing one (deep copy) with overrides per section:
 * `deriveBiome(ALPINE, { id: 'dusk', code: 'DUSK', name: 'Dusk', lighting: { sunIntensity: 2 } })`.
 */
export function deriveBiome(base: Biome, over: { id: BiomeId; code: string; name: string; description?: string } & { [K in Exclude<keyof Biome, 'id' | 'code' | 'name' | 'description'>]?: Partial<Biome[K]> }): Biome {
  // capability modules hold functions (models): they are shared by reference, never cloned
  const { capabilities: baseCaps, ...data } = base;
  const b = structuredClone(data) as Biome;
  if (baseCaps) b.capabilities = { ...baseCaps };
  const mut = b as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(over)) {
    if (k === 'capabilities') b.capabilities = { ...(b.capabilities ?? {}), ...(v as Partial<BiomeCapabilities>) };
    else if (v && typeof v === 'object' && !Array.isArray(v)) mut[k] = { ...(mut[k] as object), ...structuredClone(v) };
    else mut[k] = v;
  }
  return b;
}

/** GLSL vec3 literal for an RGB triple (always with a decimal point). */
export function glslVec3(c: RGB): string {
  const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
  return `vec3(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;
}

/** Suffix for shader program cache keys: empty for the default biome (keys unchanged). */
export function biomeCacheSuffix(b: Biome): string {
  return b.id === DEFAULT_BIOME ? '' : `:${b.id}`;
}
