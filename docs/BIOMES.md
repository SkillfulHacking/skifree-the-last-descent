# Biomes (locations)

A **biome** is the location a course is skied in: the sky, light, fog, snow and rock colours, the
tree species and how dense the forest is, the obstacle mix, the terrain's character and the wind.
The course *structure* (segment plan, Yeti encounters, caves, refuges, finish) still comes from the
course profile and the `CourseConfig`; a biome re-skins it and re-shapes its terrain.

The game ships with one biome, **Alpine** (`alpine`), which is the original look. Alpine is the
default, and it is guaranteed to reproduce the pre-biome game exactly: same terrain heights, same
obstacles, same shader code, same course codes and record keys (the unit tests in
`tests/unit/biome.test.ts` check terrain heights against values captured before biomes existed).

Everything lives in [`src/world/biome.ts`](../src/world/biome.ts): the `Biome` interface, the
`ALPINE` definition (each value is commented with where it used to be hard-coded) and the registry
(`BIOMES`, `listBiomes`, `getBiome`, `hasBiome`, `biomeByCode`, `registerBiome`, `deriveBiome`,
`DEFAULT_BIOME`).

## How a biome reaches the game

```
Settings.biome ──► CourseConfig.biome ──► buildMountain(c) ──► Mountain.biome
                                                   │                 │
                                     worldSeed(c) ─┘                 ├─► TerrainRenderer → createSnowMaterial(quality, biome)
                                                                     ├─► ObstacleField / generateBand (tree/rock/log/stump mix, species)
                                                                     ├─► Vegetation (species geometry, foliage & rock materials, wall forests)
                                                                     └─► GeneratedProfile(seed, length, biome.terrain) (slope/width/swing, segment mix)
World.biome ──► Environment(scene, renderer, quality, biome) (sky, sun, hemi, IBL, fog, atmosphere, flakes, DistantRanges)
App.buildWorld ──► renderer.toneMappingExposure, AudioEngine.setAmbience(biome.audio)
```

No globals: the biome object is carried by the `Mountain` (which almost every world system already
receives) and passed explicitly to `Environment`.

## What is parameterised

| Section | Fields | Used by |
|---|---|---|
| identity | `id`, `code`, `name`, `description` | registry, course codes, menu |
| `sky` | three.js `Sky` turbidity / rayleigh / Mie, sun elevation + azimuth | `Environment` |
| `lighting` | sun colour + intensity, hemisphere sky/ground colours + intensity, IBL intensity, IBL ground bounce colour, tone-mapping exposure | `Environment`, `App` |
| `atmosphere` | fog colour, FogExp2 density, sun haze colour, linear extinction, haze falloff | `Environment` → `look/atmosphere.ts` uniforms (terrain, trees, rocks, ranges, particles, tracks all follow) |
| `weather` | falling-flake density multiplier, size, opacity, colour | `Environment` |
| `terrainLook` | snow, wind slab, packed piste, powder, ice, 3 rock strata tones, shade tint, skylight tint | `snowMaterial.ts` |
| `ranges` | skyline sky colour, snow, stone dark/light, lowland | `look/ranges.ts` |
| `trees` | 3 species (shape + needle colour), optional species weights, bark, foliage tint range, branch snow colour, corridor tree density ×, wall-forest density × | `props.ts`, `obstacles.ts`, `Vegetation.ts` |
| `rocks` | bare rock albedo, per-instance cool/warm/dark tints, snow cap colour | `props.ts`, `Vegetation.ts` |
| `obstacles` | rock / log / stump placement multipliers | `obstacles.ts` |
| `terrain` | slope ×, width ×, centre-line swing × and segment-type weights (generated courses' regular segments); wall height, wall relief, far-range height, undulation, mid detail, moguls, drifts (+ powder extra), rollers (everywhere) | `profile.ts`, `course.ts` |
| `audio` | ambience bed (only `'wind'` exists), wind gain ×, wind pitch × | `audio/ambience.ts` via `AudioEngine.setAmbience` |

## What is deliberately not parameterised (yet)

- **Course structure and gameplay set pieces**: summit/start run-in, the encounter shelf at each
  cave, refuges, the finish approach, encounter/chase scheduling, kickers and cliff bands. Their
  geometry is tuned for chase timing. Terrain scale knobs only touch *regular* segments.
- **The classic Sprint profile's tracks** (`ClassicProfile`): its slope, width and centre line are
  hand-authored. In another biome, Classic Sprint keeps that layout but gets the biome's amplitudes,
  palette and its own seed (noise, kickers, obstacles).
- **Segment type specs** (`TYPES` in `profile.ts`: per-type slope/width/feature ranges). Use
  `segmentWeights` and the scale factors instead. A new segment *type* is a profile change, not a
  biome.
- **Surface physics**: grip, drag and the ice/powder/groomed zone thresholds (`Mountain.surfaceWeights`,
  `SkierPhysics`).
- **Man-made and story art**: the resort, lodges/checkpoints, start area, trail markers, the Yeti,
  the cave and its story props, fallen trees, logs, stumps and the broken-tree prop.
- **Music** and every sound effect except the wind bed.
- **Tree species count**: exactly three slots, because the renderer keeps one instanced mesh per
  slot. Use `speciesWeights` to drop a species (`[1, 1, 0]`) or favour one.
- **Rock shapes**: the six rock geometry variants are shared; only colours change.
- **Distant ridge shapes, cloud shadows, ice glints, snow corduroy**: shared.

## Adding a biome, step by step

### 1. Define it

The easiest start is to derive from Alpine and override only what changes. Put each new biome in its
own module, e.g. `src/world/biomes/dusk.ts`:

```ts
import { ALPINE, deriveBiome, registerBiome } from '../biome';

export const DUSK = registerBiome(
  deriveBiome(ALPINE, {
    id: 'dusk',               // lowercase [a-z0-9-], stored in settings — never change it once shipped
    code: 'DUSK',             // 2–8 of [A-Z0-9], appears in course codes — never change it once shipped
    name: 'Dusk Ridge',       // menu label
    description: 'Last light over a wind-scoured ridge.',
    sky: { sunElevation: 6, turbidity: 6 },
    lighting: { sunColor: [1.0, 0.6, 0.38], sunIntensity: 2.6, hemiIntensity: 0.18, exposure: 0.85 },
    atmosphere: { fogColor: [0.62, 0.58, 0.66], sunHaze: [1.0, 0.7, 0.5] },
    trees: { density: 0.6, speciesWeights: [1, 0, 2] },
    terrain: { wallRelief: 90, slopeScale: 1.1 },
    audio: { windGain: 1.3, windPitch: 0.9 },
  }),
);
```

`deriveBiome` deep-copies the base and shallow-merges each section, so `lighting: { sunIntensity }`
keeps the other lighting fields. Replace whole tuples (colours, `species`, `speciesWeights`).
If you need everything from scratch, write a full `Biome` object literal; the type checker lists
every required field.

Fill in, in roughly this order:
1. `sky` + `lighting` + `atmosphere`: they set the mood. Fog colour and sun haze colour should sit
   close to the sky colour at the horizon, or the distant ranges will look cut out.
2. `terrainLook` + `ranges` + `rocks`: the ground. Keep the snow tones and the ranges' snow close.
3. `trees`: species shapes (see `TreeSpecies` in `biome.ts` for what each number does), needle
   colours, densities. Set `density: 0` and `decorDensity: 0` for a treeless location.
4. `obstacles` and `terrain`: gameplay feel. Keep `slopeScale` within about 0.8–1.2 and
   `widthScale` within about 0.8–1.4. Outside those ranges, check that Yeti chases are still
   winnable (see step 5).
5. `weather`, `audio`.

### 2. Register it

`registerBiome` must run at module load, **before settings are read**. Otherwise a stored
selection of the new biome falls back to Alpine. Import the module once for its side effect from
[`src/world/biomes/index.ts`](../src/world/biomes/index.ts):

```ts
import './dusk';
```

`src/main.ts` imports that index before it constructs the `App`. Do not import biome modules from
`biome.ts` itself: that creates a circular import, and `ALPINE` is not yet defined while the derived
biome evaluates. Registration order is menu order. The default (`alpine`) always stays first and
cannot be replaced or removed.

### 3. Assets

There are no binary assets. Everything is procedural, so a biome is pure data. If a location needs
new *art* (a different tree family, cacti, a new sky model or a new ambience bed), add the generator
next to the existing one (`props.ts`, `Environment.ts`, `audio/ambience.ts`), add a field to the
`Biome` interface for choosing it, and give Alpine the value that selects the current behaviour.
Shader colours are injected as GLSL literals. Materials whose source depends on the biome append
`biomeCacheSuffix(biome)` to their `customProgramCacheKey`, so two biomes never share a compiled
program. Do the same for any new material you parameterise. Add any new art to
`docs/ASSETS_AND_LICENSES.md`.

### 4. Menu and course codes

- **Menu:** the main menu shows a **Location** row automatically once more than one biome is
  registered, and hides it while Alpine is the only one, which keeps the no-scroll layout. The
  choice persists as `Settings.biome`, and unknown ids are repaired to Alpine on load. With the row
  visible the main menu has one more item, so re-check the layout at 1366×768 (`tools/menushot.mjs`).
- **Course codes:** Alpine adds nothing, so `DAILY-2026-11-07-STD-H` and `CLASSIC-SPR` are exactly
  as before. Other biomes append `@<code>`: `DAILY-2026-11-07-STD-H@DUSK`, `CLASSIC-SPR@DUSK`,
  `SEED-777-INF@DUSK`. An unknown `@` tag makes the code invalid, so it is rejected with the usual
  error. Records are keyed by the code, so each location has its own records.
- **Seeds:** `CourseConfig.seed` stays the course's own seed (it is what `SEED-…` codes show).
  `worldSeed(c)` mixes in the biome id for non-default biomes, so the same code gives a different
  mountain in every location. Alpine uses the seed unchanged.

### 5. Tests

Add to `tests/unit/biome.test.ts` (or a new file):
- the biome registers without throwing and `getBiome('<id>')` returns it;
- `courseId`/`parseCourseId` round-trip a few configs with the new biome;
- if you changed `terrain` scales, a generated course in the new biome stays playable, by running
  the autopilot simulation (see `tests/unit/game.test.ts` and `src/game/simulate.ts`) over a Standard
  course and checking that it reaches the finish and survives the chase;
- the existing alpine golden-height test must keep passing unchanged. If it fails, the change has
  altered the original game.

Run `npx tsc --noEmit` and `npx vitest run`. Then look at the location in the browser
(`npm run dev`, pick it under Location) at every quality preset, including the cave cinematic,
which dims the sun and ambient light relative to the biome's values.
