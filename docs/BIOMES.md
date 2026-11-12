# Biomes (locations): the implementer's guide

A **biome** is a location a course is skied in. It is made of two layers:

1. **Look and terrain data**, in the `Biome` object (`src/world/biome.ts`): sky, light, fog, snow
   and rock colours, tree species and density, obstacle mix, terrain knobs, and the wind bed's
   gain and pitch. This is pure data, covered in [Look and terrain data](#look-and-terrain-data).
2. **Capability modules**, in `Biome.capabilities` (`src/world/capabilities/`): surface physics,
   weather, hazards, the finish environment, refuges, cave dressing, ambience and the difficulty
   rating. Each module is optional. When a module is left out, the biome uses the Alpine default,
   which reproduces the original game exactly.

The course *structure* (segment plan, Yeti encounters, caves, refuges, finish) still comes from the
course profile (`src/world/profile.ts`) and the `CourseConfig`. Every location uses the same skier
physics, collision system, controls, course architecture, streaming and pursuit logic. A location
changes the numbers, not the engine.

The game ships two locations. **Fjord Coast** (`fjord`, code `FJORD`, 2/5 Scenic) is the first new
one and the *reference implementation* for the rest: every capability below is used by it, in
`src/world/biomes/fjord/` (see [Fjord Coast: the reference location](#fjord-coast-the-reference-location)).

**Alpine** (`alpine`) is the technical reference: its terrain
heights, obstacles, shaders, physics, course codes and record keys are bit-for-bit those of the
pre-biome game. The goldens in `tests/unit/biome.test.ts` and the identity tests in
`tests/unit/capabilities.test.ts` enforce this.

**Biome difficulty and game difficulty are separate.** The capability rating (1–5) describes the
environment. The Relaxed/Normal/Hard setting (`CourseConfig.difficulty`) scales the Yeti and
works the same in every location. Never make a location harder by speeding up the Yeti.

---

## Contents

- [Architecture at a glance](#architecture-at-a-glance)
- [Capability modules: what each must provide](#capability-modules-what-each-must-provide)
  - [surface](#surface--physics-modifiers) · [weather](#weather) · [hazards](#hazards) ·
    [finish](#finish--finish-environment--victory) · [refuge](#refuge) · [cave](#cave) ·
    [audio](#audio) · [rating](#rating)
- [Course rules (Sprint, Classic, codes, seeds)](#course-rules)
- [Gameplay events for achievements and stats](#gameplay-events)
- [Adding a location, step by step](#adding-a-location-step-by-step)
- [A hazard is complete when…](#a-hazard-is-complete-when)
- [Test expectations](#test-expectations)
- [Evidence capture checklist](#evidence-capture-checklist)
- [Look and terrain data](#look-and-terrain-data)
- [What is deliberately not parameterised](#what-is-deliberately-not-parameterised)

---

## Architecture at a glance

```
Biome (data)                                 src/world/biome.ts
 └─ capabilities?: Partial<BiomeCapabilities> src/world/capabilities/index.ts  ── capabilitiesOf(b) fills Alpine defaults
     ├─ surface : SurfaceModel      (pure)   capabilities/surface.ts   ┐
     ├─ weather : WeatherModel      (pure)   capabilities/weather.ts   ├─ BiomeEnvironment (pure)  capabilities/environment.ts
     ├─ hazards : { kinds, density }(pure)   hazards/hazard.ts, field.ts┘     │  = the ONE PhysicsEnvironment hook
     ├─ finish  : { id }  ──► FinishDefinition (three)  presentation/finish.ts  │    SkierPhysics(…, env)  physics/environment.ts
     ├─ refuge  : { id, name } ► RefugeDefinition       presentation/refuge.ts  │  + typed EnvironmentEvents (listen())
     ├─ cave    : { id }  ──► CavePresentation          presentation/cave.ts    │
     ├─ audio   : { ambience: ids }                                             │
     ├─ scenery?: { id } ──► SceneryDefinition (three, streamed) presentation/scenery.ts
     └─ rating  : { level 1..5, label }  ──► Location row in the menu (ui/location.ts)
Biome.terrain.coast?: CoastParams ──► Mountain.coast (pure, src/world/coast.ts): cliffs, sea levels, islands, harbour shore
                                                                                 │
World (per course)                                                               │
 ├─ environment = new BiomeEnvironment(mountain, seed)  ◄────────────────────────┘
 │    streamed with the obstacles: stream(z) / release(keep0, keep1)
 ├─ hazardViews = HazardLayer  (creates/disposes a view per hazard with its band)  presentation/hazardViews.ts
 ├─ finish      = finishDef.build(...)   (Alpine: Resort)      world.resort is an alias
 ├─ lodges      = refuge.build(...)      (Alpine: Checkpoint)
 ├─ cave slots  + cave.dress?(...)       (Alpine: none)
 └─ Environment.applyWeather(visibility, snowfall) + flake drift = weather.windX  (every frame)
GameSession: new SkierPhysics(world.mountain, world.obstacles, world.extraColliders, world.environment)
VictoryCinematic (shell) ─► world.finishDef.victory(stage, finish, director)  (Alpine: cinematic/victory/alpineResort.ts)
```

Rules that keep this testable:

- **Pure logic never imports three.js**: surface, weather, hazard kinds, the hazard field and
  `BiomeEnvironment`. They run in Node, in headless simulations (`src/game/simulate.ts` builds a
  `BiomeEnvironment` by default) and in unit tests.
- **Views are referenced by id** from the pure side and registered in `src/world/presentation/`.
  `validateBiomePresentation(biome)` checks that every id is registered. `World` throws on
  construction if one is missing.
- **Alpine is the identity.** Each module has an Alpine default that changes nothing. An
  identity-flagged surface model plus zero weather coupling plus no hazards makes
  `BiomeEnvironment.physicsIdentity` true, and then sampling is skipped entirely.

---

## Capability modules: what each must provide

All interfaces are in `src/world/capabilities/index.ts` and the modules it re-exports.

### surface — physics modifiers

```ts
interface SurfaceModel {
  id: string;
  identity?: boolean;                                   // true only if it always returns IDENTITY_SURFACE
  modifiers(q: SurfaceQuery, out: SurfaceModifiers): void;
}
interface SurfaceQuery { biomeId; x; z; kind: SurfaceType; weights(): { ice; powder; groomed } }  // weights() is lazy
interface SurfaceModifiers {
  grip;           // × lateral grip (edge hold)                 — ice < 1
  friction;       // × Coulomb snow friction                     — frozen lake < 1 (glide, but never accelerate on the flat)
  carveRadius;    // × turning radius (steering ÷ this)          — ice > 1
  brake;          // × pizza braking deceleration                — ice < 1 (longer stopping distance)
  driftThreshold; // × DRIFT_MIN_SPEED (9 m/s)                   — slippery < 1
  recovery;       // × rate control returns after getting up     — < 1 slower
  dragAdd;        // + quadratic drag (max-speed influence)      — deep snowdrift > 0
}
```

- **Hook**: `SkierPhysics.step()` calls `env.sample()` once per fixed step. `stepGrounded`
  multiplies grip, μ, turn rate (÷ carveRadius), brake and the drift threshold, and adds `dragAdd`
  to the drag. `recoverTime` decays at `dt × recovery`. These are the only places the modifiers
  are applied, so every location keeps the same controls.
- **Must**: write every field. Start from `resetSurface(out)` and use `combineSurface`. Be
  continuous across zone edges: `surfaceTable(id, perKind, base)` blends per-kind modifiers by the
  surface weights. Stay inside `SURFACE_LIMITS` (`validateSurfaceModifiers`). Be deterministic,
  with no `Math.random`.
- **Perceptible but fair**: the brief asks for ice handling that is "immediately perceptible".
  Prove it with a test (stopping distance, turn radius, slip), as `capabilities.test.ts` does for
  each modifier.
- Alpine: `ALPINE_SURFACE` (identity).

### weather

```ts
interface WeatherModel {
  id: string; static?: boolean;
  coupling: { airborne: number /* 1/s, ≤ 0.3 */; balance: number /* ≤ 1 */ };
  sample(x, z, t, seed, out: WeatherSample): WeatherSample;   // { windX, windZ (m/s), visibility (× fog), snowfall (× flakes), gust 0..1 }
}
```

- **Rendering**: `World.update` samples at the camera focus on the *physics clock*
  (`environment.clock`). It calls `Environment.applyWeather(visibility × hazard visibility,
  snowfall)` and drifts the flakes with `windX`.
- **Physics**: only through `coupling`. Airborne acceleration is `airborne × wind`. Grounded
  wobble is `≥ balance × gust`. Keep wind skill-based: gusts telegraphed by particles and audio,
  bounded, never strong enough to throw the skier off a kicker line unannounced.
- **Must**: be a pure function of `(x, z, t, seed)` and pass `validateWeather` (finite, visibility
  in (0, 12], snowfall in [0, 4], wind ≤ 40 m/s, coupling in range). Fjord-style light crosswinds
  and Whiteout fronts and fog banks are one call to `parametricWeather({...})`.
- Alpine: `ALPINE_WEATHER`. windX = 1 (the flake drift the renderer always used), visibility 1,
  snowfall 1, coupling 0.
- **Accessibility**: a future "reduce visibility effects" setting should scale `visibility`
  toward 1 *in the renderer only*. Never change the physics or the hazard placement.

### hazards

Hazard *kinds* are registered globally (`registerHazardKind`, `src/world/hazards/hazard.ts`). A
biome selects them by id: `capabilities.hazards = { kinds: ['steam-vent', …], density: 1 }`.
Register kinds **before** the biome that uses them; `registerBiome` validates the ids.

```ts
interface HazardKind<P> {
  id; label;
  severity: 'cosmetic' | 'slow' | 'knock' | 'crash';
  timing: { kind: 'static' } | { kind: 'periodic'; dormant; telegraph; active; recovery };  // seconds
  reach: number;                          // effect evaluated within r + reach (m)
  keepLaneClear?: boolean;                // default: true for knock/crash
  place(ctx: HazardPlacementContext): HazardSpot<P>[];          // pure, per 256 m band, ctx.rng is seeded
  effect(h, phase, contact): HazardEffect | null;               // pure
  audio?: { telegraph?; active?; hit?; ambient? };              // cue ids
  view?: string;                                                // view factory id (presentation/hazardViews.ts)
}
interface HazardEffect { surface?: Partial<SurfaceModifiers>; knock?: { keep; wobble }; crash?: { reason; intensity };
                         windX?; windZ?; visibility? }
```

- **Placement** is deterministic per (course seed, band, kind) and independent of the order bands
  are built in. `HazardField` drops any spot that is reserved: everything above z = 60 (summit,
  start, run-in), the finish approach and finish area, refuges, cave mouths and clearings, and,
  for `keepLaneClear` kinds, the primary route lane (`LANE_HALF` = 6 m). Footprint radius must be
  ≤ 60 m. `ctx.density` is the biome's hazard tuning; scale the count by it.
- **Timing**: periodic instances get a per-instance phase offset. Kinds that can knock or crash
  must telegraph for at least `MIN_TELEGRAPH_S` (0.8 s) and have a `telegraph` audio cue.
  Registration rejects anything else.
- **Effects** apply through the same physics hook. A knock or crash fires **once per contact**
  (re-armed when the skier leaves the footprint). Surface and wind effects apply every step while
  in reach. `visibility` feeds the renderer (steam, fog banks).
- **Streaming**: `World.stream` calls `environment.stream(z)` (ensure z−80…z+400) with the
  obstacles and `environment.release(...)` on the same window. `BiomeEnvironment.sample` also
  ensures the band under the skier, so headless simulations work without explicit streaming.
- **Views**: `registerHazardView(id, (h, ctx) => ({ object, update?(phase, t, dt), dispose }))`.
  `HazardLayer` creates one view per instance when its band is generated and disposes it when the
  band is released. It animates views on the **physics clock**, so the visual telegraph matches
  the physics exactly. Use instancing for numerous kinds: the factory can return a lightweight
  proxy that writes into a shared `InstancedMesh`.
- Alpine registers none (`kinds: []`, density 0).

### finish — finish environment + victory

```ts
interface FinishDefinition {
  id; label;
  build(ctx: { quality, mountain, biome, finishCenter, heightAt }): FinishEnvironment;
  victory(stage, finish, director: VictoryDirector): VictoryScript;   // { update(dt) }
}
interface FinishEnvironment {
  group; trophy; finishZ;
  update(dt, time, { cheer, lookAt, welcome });
  getStopPoint(v); getYetiStopPoint(v); getPodiumTop(v); getCelebrationFocus(v);
  colliders(): { x, z, r }[]; dispose();
}
interface VictoryDirector { tl: Timeline; stopPoint; autopilot; cheer; welcome; results() }
```

- `VictoryCinematic` (EndCinematics.ts) is a thin shell that GameSession drives. It fills
  `stopPoint` from the finish and hands its `Timeline` to the script. The script adds shots and
  beats, drives the Yeti's exit, sets `autopilot`, `cheer` and `welcome`, and calls
  `d.results()` exactly once at the end.
- **Trophy/celebration hook**: `TrophyHandoff` (`src/cinematic/victory/trophy.ts`) flies the
  finish's `trophy` into the skier's raised hand. The held part must be the trophy's **first
  child**; later children (plinth) stay behind. World returns the trophy to its home between runs.
- The finish must fit the profile's finish approach (`flatten` run-out, chute ±140 m clear of
  obstacles, hazards reserved within 160 m). It must also stand on terrain at every course length:
  test Sprint, Standard and Expedition finish heights.
- Alpine: `alpine-resort` = `Resort` + `AlpineResortVictory` (the original sequence, moved
  verbatim).

### refuge

```ts
capabilities.refuge = { id: 'ski-patrol-cabin', name: 'Ski patrol cabin' }
registerRefuge({ id, build({ mountain, z, index, quality, biome }): { group, gate, dispose } })
```

The refuge logic (where refuges are and when one is reached) stays in the profile and `RunState`.
Only the building is pluggable. Keep it light (a handful of meshes): refuges are built when near
and disposed after. Alpine: `ski-patrol-cabin` = `Checkpoint`.

### cave

```ts
registerCavePresentation({ id, dress?({ mountain, anchor, cave, quality, biome }): { group, update?(dt, t), dispose } | null })
```

**Geometry contract (unchanged, shared by every biome):** the terrain cut (`caveTerrain.ts`), the
rock shell, floor and clearance bake in `Cave.ts`, and its anchor points (`mouth`, `inside`,
`lipTop`, `deepStart`, `ledge`, `exitPath`, `floorHeightAt`, `clearanceAt`). Yeti grounding and
the cave cinematic depend on these. A presentation adds props and materials *around* the cave
(ice curtains, basalt columns, steam, rescue tape). It is created and disposed with the cave slot
and must not modify `cave.group` geometry. Alpine: `alpine-cave` (no dressing; the original
`StoryProps` stay).

### audio

`capabilities.audio = { ambience: ['wind'] }`: ids from `KNOWN_AMBIENCE`. Hazard cue ids live on
the hazard kinds. To add a bed, add the generator to `src/audio/ambience.ts`, add its id to
`KNOWN_AMBIENCE` and route it in `AudioEngine.setAmbience`. The existing `Biome.audio` fields
(`windGain` and `windPitch`) remain the wind bed's mix.

Since Fjord Coast the engine consumes both: `App.buildWorld` passes `capabilitiesOf(biome).audio
.ambience` to `AudioEngine.setAmbience(mix, beds)`, which creates the extra beds (`surf`, `gulls`:
`src/audio/coastal.ts`, level from `AudioFrameState.coast`). `GameSession` forwards the `cue` of
`hazard-telegraph` / `hazard-active` / `hazard-hit` events to `AudioEngine.playCue(id, pos)`; add a
new cue's synthesis to `coastCue` (or a sibling module) and its id to the hazard kind.

### rating

`capabilities.rating = { level: 1..5, label }`. Shown in the menu's Location row as pips + label
(`●●○○○ Scenic Exploration`), followed by the biome's one-line `description`, ellipsised to one
line. The ladder from the production brief: Alpine 1 Beginner · Fjord Coast 2 · Whiteout Ridge 3 ·
Frozen Frontier 4 · Volcanic Expanse 5.

---

### scenery (optional)

```ts
capabilities.scenery = { id: 'fjord-coast' }
registerScenery({ id, build(ctx: { mountain, quality, biome, terrain /* TerrainUniforms */, sunDir }): SceneryView })
interface SceneryView { group; stream(z); update(dt, time, { focus, camPos, origin }); menuCamera?(t, out): boolean; stats?(); dispose() }
```

Streamed set dressing that is neither terrain, obstacles, hazards, refuges, caves nor the finish:
World builds it once, calls `stream(z)` with the obstacle window (build near, dispose far: bounded on
Endless) and `update` every frame. `menuCamera` lets a location frame its own main-menu preview.
Fjord: water surfaces, sea mist, fishing hamlets, cairns, viewpoints, ferries.

### coast (terrain, optional)

`Biome.terrain.coast: CoastParams` turns the −X side of the valley into a sea coast
(`src/world/coast.ts`, pure). `Mountain.heightAt` = `coast.shape(x, z, landHeight, landAt)`; with no
coast the land height is returned untouched (Alpine is bit-identical). The model provides the
cliff rim (`rimX`, `beyondRim`, `guard` for the cornice), per-arm water levels (`reaches`,
`seaLevelAt`: a long course is a chain of fjord arms whose level edges are hidden under headland
ridges, so the walls stay 0.3–1.3 km high on a 50 km descent), the harbour shore (`shoreZ`, the
open sea beyond a finite course), strand-flat `hamlets` and optional `lookouts` (viewpoints).
Obstacles and vegetation keep off the rim, the cliffs, the water and the viewpoints.

## Course rules

- **Classic Sprint layout is Alpine-only.** `usesClassicLayout(c)` is true only for Classic +
  Sprint + Alpine (the hand-authored `ClassicProfile`, the legacy baseline). In any other location,
  Classic mode is that location's fixed "signature" mountain: `SEED_DEFAULT` mixed with the biome
  id. Its Sprint is **generated with the biome's terrain**, like every other length. The menu does
  not offer the Alpine layout elsewhere, so there is nothing to mislabel.
- **All lengths** (Sprint 3 km, Standard 10 km, Endurance 20 km, Expedition 50 km, Endless) work
  in every location through the same `GeneratedProfile`, streamed bands and refuge chain. Shape
  the location through `terrain` (scales, `segmentWeights`, amplitudes) and capabilities, not a
  separate engine.
- **Codes**: Alpine adds nothing (`CLASSIC-SPR`, `DAILY-2026-11-07-STD-H`: byte-identical to before
  biomes). Other locations append `@<CODE>` (`CLASSIC-SPR@FJORD`, `SEED-777-INF@FJORD`). Records are
  keyed by the code, so each location has its own. The `@` separator is final.
- **URLs**: nothing in the game puts codes in URLs today. When something does (share links, query
  params), use `courseCodeQuery(c)` and `courseFromQuery(search)` (`CourseConfig.ts`), which
  percent-encode `@` (`course=CLASSIC-SPR%40FJORD`).
- **Seeds**: `CourseConfig.seed` is the course's own seed (shown in `SEED-…` codes). `worldSeed(c)`
  mixes in the biome id for non-default biomes. Daily seeds are unchanged.
- Never change a shipped biome's `id` or `code`: settings and records depend on them.

---

## Gameplay events

`BiomeEnvironment.listen(fn)` delivers typed `EnvironmentEvent`s. An achievement or stats event
bus subscribes in `GameSession`, via `world.environment.listen(...)`, without the environment
knowing about it:

| Event | When | Suggested gameplay event |
|---|---|---|
| `surface-change {from, to}` | grounded surface changes (all biomes) | ice/powder time, "Ice Dancer" (drift while `to === 'ice'`) |
| `hazard-telegraph {cue}` | a periodic hazard ahead (≤ 150 m) starts warning | audio cue, HUD hint |
| `hazard-active {cue}` | it becomes dangerous | audio cue |
| `hazard-enter` / `hazard-exit` | skier enters/leaves a footprint | zone tracking ("Steam Runner") |
| `hazard-hit {effect: knock\|crash, cue}` | the hazard knocked/crashed the skier | ObstacleHit-style stats |
| `hazard-passed {hit, entered, closest}` | skier went past a hazard they came within 25 m of | **HazardSurvived** when `hit === false` |

Events carry the physics time `t` and the `HazardInstance` (stable id, kind, position). Hazard
crashes also surface as the usual `SkierEvent` `{ type: 'crash', reason }` from `SkierPhysics`.
`phys.envOut` exposes the modifiers applied on the current step (for telemetry and debug overlays).

---

## Adding a location, step by step

1. **Folder**: `src/world/biomes/<id>/` with `biome.ts` (pure data and pure capability modules),
   `hazards.ts` (pure kinds), and `views.ts` (three.js: finish, refuge, cave dressing, hazard
   views).
2. **Register pure parts first**: `registerHazardKind(...)` for each kind, then
   `registerBiome(deriveBiome(ALPINE, { id, code, name, description, …look…, capabilities: { … } }))`.
   `deriveBiome` deep-copies the data and shares capability models by reference.
3. **Register views**: `registerFinish`, `registerRefuge`, `registerCavePresentation`,
   `registerHazardView`, using the ids the capabilities name.
4. **Import** the folder's index from `src/world/biomes/index.ts`. It loads before settings are
   read. Never import biome modules from `biome.ts` (circular).
5. **Rating and description**: set `capabilities.rating`. Write a `description` that fits one
   menu line (about 60 characters).
6. Work through [A hazard is complete when…](#a-hazard-is-complete-when) for every hazard kind,
   [Test expectations](#test-expectations), and the [evidence checklist](#evidence-capture-checklist).

To try the multi-location menu without a real second location, open `/?debug&testbiome`. It
registers an internal "[debug] Test Range" location (`src/world/biomes/debugTestBiome.ts`), which
players never see.

---

## A hazard is complete when…

From the production brief (§4). Every new hazard kind must be:

1. **Visually recognizable**: a registered view whose silhouette and contrast read at speed, in
   the location's fog and weather, at every quality preset. It must be distinguishable from
   decoration.
2. **Mechanically functional**: placement, timing and effect are implemented and exercised by
   unit tests: deterministic placement, phase cycle, effect inside versus outside, and knock or
   crash once per contact.
3. **Properly animated where appropriate**: the view's `update(phase, t)` shows the telegraph
   (build-up) and the active and recovery phases on the physics clock.
4. **Supported by sound**: audio cue ids on the kind (registration requires one, and a
   `telegraph` cue for periodic knock/crash kinds), wired in the audio engine.
5. **Fairly balanced**: telegraph ≥ 0.8 s for knock/crash, the lane is kept clear for dangerous
   kinds, there are no invisible failure zones, and autopilot runs over representative seeds still
   finish at every difficulty (Relaxed approachable, Hard challenging).
6. **Automatically testable**: tests use `src/world/hazards/testkit.ts` (`collectPlacements`,
   `lifecycleCounter`, `timeOfPhase`, `probe`) plus a headless simulation. No manual 50 km run is
   needed.
7. **Independently reviewed**: covered by the per-biome review rounds (Reviewer B for mechanics
   and fairness, D for lifecycle, E for accessibility), with evidence stored under
   `docs/reviews/biomes/<biome-id>/`.

---

## Test expectations

Per location (copy the patterns in `tests/unit/capabilities.test.ts` and `tests/unit/biome.test.ts`):

- **Registration**: `registerBiome` accepts it; `validateCapabilities(b)` and
  `validateBiomePresentation(b)` are `[]`; `getBiome(id)` returns it; its rating shows in
  `locationNoteHtml`.
- **Codes**: `courseId` and `parseCourseId` round-trip for Classic, Daily and Custom at several
  lengths and difficulties. Alpine codes stay byte-identical. `courseCodeQuery` round-trips.
- **Course rules**: `buildMountain(makeCourse('classic','sprint',{biome}))` is a generated profile
  with the biome's terrain.
- **Alpine unchanged**: the golden heights in `biome.test.ts` and the bit-identical physics and
  simulation tests in `capabilities.test.ts` stay green with your biome registered.
- **Surface physics**: each non-identity modifier has a measurable test (stopping distance, turn
  radius, slip, glide, drift onset). Frozen-lake friction must not let the skier accelerate on the
  level.
- **Weather**: `validateWeather` passes; it is deterministic for equal inputs; any coupling
  produces bounded effects (airborne drift over a typical jump < 2 m).
- **Hazards**: deterministic and order-independent placement; reservations respected; streaming
  over Endless with bounded residency and `created === disposed` after `clear()`; HazardLayer view
  counts equal instance counts; telegraph, then active, then hit once, then recovery; `hazard-passed`
  with `hit` false and true.
- **Playability**: `simulateCourse` (autopilot `skilled` and `intermediate`) over at least 3 seeds
  × Sprint, Standard, Expedition (and Endless to a `maxZ`) × Relaxed, Normal, Hard. Skilled
  finishes or survives, careless is caught, and no seed has an impossible layout.
- **Terrain continuity**: there are no height discontinuities at segment and band boundaries, and
  the finish area is on terrain at every length.
- **Menu**: `tests/e2e/menu.spec.ts` with the location registered (no scrolling at 1366×768,
  1920×1080 and 2560×1440).
- Always run `npx tsc --noEmit` and `npx vitest run`. Run Playwright against `npm run build`.

---

## Evidence capture checklist

From the production brief (§9). For each location, capture these with the real renderer
(`tools/capture.mjs`, `tools/cinematic.mjs`, `tools/menushot.mjs`, `?debug` helpers such as
`__skifree.teleport(z)`, `toChase()` and `frames(n)`):

1. Main menu location preview (Location row selected).
2. Summit view.
3. Mid-mountain terrain.
4. Signature biome hazard (telegraph and active).
5. A close-up of the terrain material.
6. A long-distance environmental composition.
7. The Yeti cave.
8. The Yeti cinematic.
9. Pursuit gameplay (on Hard, with the snowball markers legible in the location's weather).
10. Finish environment.
11. Victory cinematic.

Capture at 1920×1080 (primary), and verify at 1366×768 and 2560×1440. Store the captures under
`docs/reviews/biomes/<biome-id>/{round-1,round-2,final}/` with the build SHA. Compare each against
the Alpine baseline. Never present generated concept art as a screenshot.

---

## Look and terrain data

| Section | Fields | Used by |
|---|---|---|
| identity | `id`, `code`, `name`, `description` | registry, course codes, menu |
| `sky` | three.js `Sky` turbidity / rayleigh / Mie, sun elevation + azimuth | `Environment` |
| `lighting` | sun colour + intensity, hemisphere sky/ground colours + intensity, IBL intensity, IBL ground bounce colour, tone-mapping exposure | `Environment`, `App` |
| `atmosphere` | fog colour, FogExp2 density, sun haze colour, linear extinction, haze falloff | `Environment` → `look/atmosphere.ts` uniforms (terrain, trees, rocks, ranges, particles, tracks all follow) |
| `weather` | falling-flake density multiplier, size, opacity, colour (the *look* of flakes; the weather *model* is a capability) | `Environment` |
| `terrainLook` | snow, wind slab, packed piste, powder, ice, 3 rock strata tones, shade tint, skylight tint | `snowMaterial.ts` |
| `ranges` | skyline sky colour, snow, stone dark/light, lowland | `look/ranges.ts` |
| `trees` | 3 species (shape + needle colour), optional species weights, bark, foliage tint range, branch snow colour, corridor tree density ×, wall-forest density × | `props.ts`, `obstacles.ts`, `Vegetation.ts` |
| `rocks` | bare rock albedo, per-instance cool/warm/dark tints, snow cap colour | `props.ts`, `Vegetation.ts` |
| `obstacles` | rock / log / stump placement multipliers | `obstacles.ts` |
| `terrain` | slope ×, width ×, centre-line swing × and segment-type weights (generated courses' regular segments); wall height, wall relief, far-range height, undulation, mid detail, moguls, drifts (+ powder extra), rollers (everywhere) | `profile.ts`, `course.ts` |
| `audio` | wind bed gain ×, pitch × | `audio/ambience.ts` via `AudioEngine.setAmbience` |
| `capabilities` | see above | `capabilitiesOf` |

How the data reaches the game:

```
Settings.biome ──► CourseConfig.biome ──► buildMountain(c) ──► Mountain.biome
                                                   │                 │
                                     worldSeed(c) ─┘                 ├─► TerrainRenderer → createSnowMaterial(quality, biome)
                                                                     ├─► ObstacleField / generateBand (tree/rock/log/stump mix, species)
                                                                     ├─► Vegetation (species geometry, foliage & rock materials, wall forests)
                                                                     └─► GeneratedProfile(seed, length, biome.terrain)
World.biome ──► Environment(scene, renderer, quality, biome); World.environment ──► BiomeEnvironment(capabilities)
App.buildWorld ──► renderer.toneMappingExposure, AudioEngine.setAmbience(biome.audio)
```

Tuning notes:

- Fog colour and sun haze should sit close to the sky colour at the horizon, or the distant ranges
  look cut out.
- Keep `slopeScale` within about 0.8–1.2 and `widthScale` within about 0.8–1.4. Outside those
  ranges, re-run the chase simulations.
- `trees.density: 0` and `decorDensity: 0` give a treeless location. `speciesWeights` can drop a
  species (`[1, 1, 0]`).
- Materials whose shader source depends on the biome append `biomeCacheSuffix(biome)` to
  `customProgramCacheKey`. Do the same for any new parameterised material. Add new art to
  `docs/ASSETS_AND_LICENSES.md`.

---

## Fjord Coast: the reference location

| Piece | Where |
|---|---|
| Biome data, surface (cornice guard), weather (onshore breeze, airborne-only coupling), coast params | `src/world/biomes/fjord/biome.ts` |
| Hazard kinds `sea-gust` and `scoured-rock`. Round 4: **wind gates** (a rib of two outcrops on the racing line, ≥ 3 per Sprint; the gust funnels through the *notch* on the sea side — onshore push, gust drag, a knock for a tucked skier — while the *lee* on the land side is sheltered but drift-loaded: notch in the lull, lee in a gust), squalls over jumps (airborne push toward a landing rock 4 m onshore), cycle 5.5 / 2.4 (windsock telegraph) / 6.0 / 1.0 s. Intensity by game difficulty: Relaxed 0.5 (rock 0.25), Normal 1, Hard 1.2 — the layout is the same on every difficulty | `src/world/biomes/fjord/hazards.ts` |
| Terrain: cliffs, fjord arms, islands (round 4b: whaleback / peak-island / skerry archetypes — `Coast.cluster`, `islandProfile`), harbour shore, viewpoints, hamlets | `src/world/coast.ts` |
| Sea-cliff kit (authored mesh over the hidden heightfield backing; buttresses, ribs, benches, notch) and its triplanar rock material (Poly Haven Rock Face 03 detail + Cliff Side macro, seepage streaks) | `src/world/art/{cliffModel,cliffKit,cliffStream,rockMaterial}.ts` |
| Water (per-arm level surfaces), sea mist, hamlets, cairns, viewpoints, ferries | `src/world/biomes/fjord/views/{water,mist,scenery,viewpoint,buildings}.ts` |
| Finish `fjord-harbour` + victory (trophy, cold plunge, sea-to-summit reveal) | `views/harbour.ts`, `views/harbourVictory.ts` |
| Refuge `coastal-shelter`, cave dressing `fjord-sea-cave`, hazard views | `views/shelter.ts`, `views/seaCave.ts`, `views/hazardViews.ts` |
| Surf / gulls beds and cues | `src/audio/coastal.ts` |
| Viewpoints → `ScenicLocationDiscovered`, hazards → `HazardSurvived` | `GameSession.checkLookouts`, `GameSession.listenEnvironment` |
| Tests | `tests/unit/fjord*.test.ts`, `tests/unit/round4_streaming.test.ts`; wind-decision and ladder harness `docs/reviews/biomes/fjord/round-4/harness/` (round 3: `tests/review/fjord_r3_balance.test.ts`) |
| Evidence | `tools/biome_evidence.mjs <biome> <mode:length> <outDir> [WxH]` |

## What is deliberately not parameterised

- **Course structure set pieces**: the summit run-in, the encounter shelf, refuges, the finish
  approach, chase scheduling, kickers and cliff bands are tuned for chase timing. Terrain scale
  knobs only touch *regular* segments. A new segment *type* is a profile change, not a biome
  change.
- **The Yeti, its AI and the cave geometry**: shared by every location (see the cave contract
  above). Location-specific cinematics go in the finish script and the cave dressing.
- **Controls and core physics constants** (`TUNING` in `SkierPhysics.ts`): locations change feel
  only through `SurfaceModifiers` and the weather coupling.
- **Tree species count**: exactly three slots (one instanced mesh per slot).
- **Rock shapes, distant ridge shapes, cloud shadows, ice glints, snow corduroy**: shared.
- **Music and sound effects** other than the wind bed (see the audio gap above).
