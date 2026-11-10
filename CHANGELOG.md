# Changelog

## Unreleased — Pass 4 Stage 1: biome capability foundations
- **Biome capabilities** (`src/world/capabilities/`, `docs/BIOMES.md`): optional modules on a
  biome — surface physics modifiers, deterministic weather (wind/visibility/snowfall + physics
  coupling), hazards, finish environment, refuge, cave dressing, ambience ids and a 1–5
  environmental difficulty rating. Every module defaults to Alpine, which stays bit-for-bit
  unchanged (terrain goldens + new physics/simulation identity tests).
- **One physics hook**: `SkierPhysics` takes an optional `PhysicsEnvironment`
  (`src/physics/environment.ts`); `BiomeEnvironment` composes surface + weather + streamed hazards
  and reports typed gameplay events (`surface-change`, `hazard-telegraph/active/enter/exit/hit/passed`).
- **Hazard framework** (`src/world/hazards/`): registered kinds with pure placement/timing/effects,
  fairness validation (≥ 0.8 s telegraph for knock/crash, view + audio cues), per-band
  deterministic placement streamed with the obstacles, views created/disposed with their band
  (`HazardLayer`), and a test kit. No hazards on Alpine.
- **Finish/refuge/cave registries** (`src/world/presentation/`): the Resort is the
  `alpine-resort` finish; its victory sequence moved unchanged into
  `src/cinematic/victory/alpineResort.ts` behind a thin `VictoryCinematic` shell.
- **Course rules:** the hand-authored Classic Sprint layout is Alpine-only; other locations'
  Sprint is generated with their own terrain. Codes, seeds and records unchanged;
  `courseCodeQuery`/`courseFromQuery` percent-encode `@` for future URLs.
- **Menu:** the Location row (shown when more than one location exists) shows the name, rating
  pips + label and a one-line description. `?debug&testbiome` adds an internal test location.

## 0.4.0 — Long-course pacing, snowball fixes, biome support (2026-11-08)
- **~10 % free skiing on every length.** Endurance/Expedition are now a chain of chases
  (`longCoursePlan()` in `src/world/profile.ts`): first cave at 560 m, a refuge at the end of each
  ~6 km leg, ~600 m of reprieve before the next cave. Endurance: 3 chases / 2 refuges; Expedition:
  8 chases / 7 refuges. Endless: a refuge every 6 km (5.4 km chase + 0.6 km reprieve).
  Headless (normal difficulty, 3 seeds): skilled and intermediate win 20 km and 50 km, careless is
  caught on the first leg.
- **Snowballs (Hard):** the ball is dangerous for the last 0.45 s of its fall plus a 0.15 s splash,
  so crossing the marked circle as it lands is a hit. Each throw starts with a 0.42 s wind-up: the
  Yeti rears up out of its gallop and throws overarm with its right hand (layered over the gait,
  `applyThrow()`); the ball is held in the fist and leaves from the hand. Rate eased to every
  5.5–9 s; a direct hit keeps 55 % of your speed; near misses wobble less.
- **Fixed:** the menu's crane camera dipped up to 3 m into the hillside (the ground vanished); it
  and the run intro now stay above the snow. The snapped pine's fallen top vanished when seen from
  below or behind; it is now closed and two-sided.
- **Biomes:** groundwork for more locations (`src/world/biome.ts`, `docs/BIOMES.md`). Alpine is the
  only biome and is bit-for-bit unchanged; course codes for Alpine are unchanged.

## 0.3.0 — Hard-mode snowballs, one-time tutorial (2026-11-08)
- **Hard: the Yeti throws snowballs** during the chase (`src/yeti/Snowballs.ts`, shared by the game
  and the headless balance runs; rendering in `src/yeti/SnowballView.ts`).
  - Thrown at mid range (25–150 m behind you) every 4.5–7.5 s, after a 3.5 s grace period.
  - Aimed where you will be when it lands (your velocity × flight time, with spread), mostly a few
    metres ahead, kept on the piste.
  - The landing zone is marked at the throw: red ring and fill on the slope plus a light column,
    pulsing faster as impact nears (1.6–2.3 s flight). The column fades when the camera is on top of it.
  - Direct hit (< 2.2 m): 45 % of your speed kept, heavy wobble, combo reset ("SNOWBALLED!").
    Near miss (< 4 m): 97 % kept, light wobble. Never an outright crash.
- Balance (headless, Hard Sprint, skilled autopilot, 5 seeds): reading the marks, 4/5 wins and no
  direct hits; ignoring them, 2/5 wins. Normal and Relaxed are unchanged.
- **The tutorial is shown on the first playthrough only.** After a run that showed it (or once
  every lesson is done) Settings → Tutorial prompts switches off; turn it on to see it again.

## 0.2.1 — Early Yeti cave (2026-11-08)
- **The Yeti's cave is always in the first 10 % of the course,** with its trigger line before the
  10 % mark: Sprint (Classic and generated) at 260 m, Standard at 960 m, Endurance at 1.96 km,
  Expedition at 4.96 km, Endless at 960 m. The rule lives in `firstCaveZ()` in
  `src/world/profile.ts`.
- Sprint and Standard: that encounter is chased to the finish. Endurance and Expedition: the early
  chase ends at a refuge, then the later skirmishes and the final confrontation follow as before.
- With the cave this close to the start, the tutorial, its kicker and the foreshadowing now fit in
  front of it (the Sprint tutorial ends at 150 m, the kicker sits at 105 m).
- The hand-tuned Classic Sprint slope was re-keyed: the cave shelf moved from 1.3 km to 260 m.
- Tests: new unit tests lock the rule for every length; headless runs on 3, 10 and 20 km (3 seeds,
  3 skier styles) still give skilled and intermediate wins and careless losses.

## 0.2.0 — Production improvement pass 2 (2026-11-07, branch `pass2`)

### User-reported defects
- **Menu (U1, U2):** the hero title now sits outside the panel and the menu was re-laid-out. It fits
  without scrolling at 1366×768, 1920×900, 1920×1080 and 2560×1440, the title is not clipped and
  there is no horizontal overflow. This is checked by measured metrics and by Playwright tests
  (`tests/e2e/menu.spec.ts`), including 125 % zoom and a 150 % UI scale.
- **Cave (U3):** rebuilt as one continuous rock mass: an SDF with strata and fractures, meshed with
  surface nets. It has:
  - a dark interior and a rubble floor that blends into the snow;
  - snow on ledges and icicles under the brow;
  - one terrain cut shared with the heightfield, so there is no seam.
  It is built in time slices so later caves can stream in.
- **Yeti grounding (U4):** a single ground contract. Feet are locked and the soles are probed
  against the surface the Yeti stands on, and the pelvis and hands adapt to the terrain. The
  cinematic walks the Yeti along the cave's own exit path on the exact visible floor:
  - it crawls up from the deep chamber, plants on the threshold, steps out, stands, roars and leaps;
  - measured sole penetration was 0 cm across every visible frame of the sequence
    (`tools/cinematic.mjs`, `docs/reviews/pass2/cinematic/grounding_report.json`).
- **Course length (U5, U6):** Sprint 3 km, Standard 10 km (default), Endurance 20 km, Expedition
  50 km and Endless, saved in settings.
- **Daily (U7):** the daily seed now drives the whole generated course: segment plan, route, slopes,
  caves and finish. It rolls over explicitly at UTC midnight and you can replay past days. There are
  course codes, custom seeds, Relaxed/Normal/Hard difficulty, and records kept separately per
  course code (old records are migrated to `CLASSIC-SPR`).
- **Visuals (U8):** a dedicated visual pass covering conifers, terrain shading, atmosphere and the
  distant skyline. Before/after pairs are in `docs/reviews/pass2/visual/`.

### Systems
- `CourseProfile`:
  - `ClassicProfile` is the original course, unchanged;
  - `GeneratedProfile` builds a deterministic, lazy segment plan with encounters, refuges, sightings
    and alternate lines;
  - `courseSpec()` exports a course as JSON.
- Streaming world:
  - obstacle bands (256 m), vegetation, terrain chunks and far tiles, caves (one per encounter) and
    refuges exist only in a window around the player;
  - a render-time floating origin keeps GPU maths precise 50 km and more down the mountain.
- The run state is generalised to several encounters: skirmishes ending at refuges on long courses,
  escalating Endless cycles, and retire-and-bank on Endless.
- Endings can be skipped. D-pad auto-repeats in menus. The rear-view window is correct under the
  floating origin.
- Tests: 107 unit tests, including headless completion of 3/10/20/50 km courses, wins and losses,
  Endless crossing segments and refuges with bounded resident data, and Daily determinism and
  rollover.

### Reviews
- Internal reviewers (other model instances, not external humans) under `docs/reviews/pass2/`,
  with the consolidated tracker in `DEFECTS.md`.

## 0.1.0 — first complete build (2026-11-06)

### Milestone 1 — Foundation
- Vite + strict TypeScript + Three.js 0.187 project, with Vitest and Playwright.
- Seeded RNG and noise, settings and save data, and the shared module contracts (`src/core/types.ts`).
- A fixed-timestep loop (120 Hz physics, interpolated rendering) and a unified keyboard/gamepad input layer.

### Milestone 2 — Skiing vertical slice
- Deterministic 3 km mountain heightfield, with a slope profile, a valley cross-section, moguls, rollers, kickers, cliff bands and surface types.
- Skier physics: tangent-plane gravity, grip/edge model, pizza, tuck, drift, takeoff from terrain, landing evaluation and collision classes.
- Fixed during development:
  - Lateral grip had been injecting energy, so skiers could coast uphill on their edges. Grip now rotates velocity onto the skis without adding speed.
  - Takeoffs at crests were robbed of their launch because the normal was sampled across the lip. Takeoff now uses the path slope from the previous step.

### Milestone 3 — Visual production
- Terrain streaming with chunk LOD, skirts and time-sliced builds.
- Procedural PBR snow, ice and rock shader: micro-relief, corduroy grooming, cloud shadows, and rock projected onto vertical planes on steep faces.
- Instanced, snow-laden pines and rocks in 2D cells, with near/far LOD and shadows only from nearby cells.
- Sky with image-based lighting, fog, world-locked snowfall, particles and ski tracks.
- Procedural rigged skier, built by a parallel agent.

### Milestone 4 — Yeti & cinematic
- Skinned Yeti with instanced shell fur and hair cards, and procedural animation for 13 modes (parallel agent).
- Cave tunnel with a boulder hood, icicles and claw marks; a terrain notch pinned to full detail; foreshadowing props (footprint trails, snapped trees, warning sign, growls).
- 12-beat cave cinematic. The simulation is frozen while it plays, it can be skipped after the first viewing, and the light drops for the reveal.
- Pursuit AI: terrain-aware speed model, pressure, lunge, real proximity capture, and obstacle avoidance so it never gets stuck.

### Milestone 5 — Complete loop
- Resort finish area with lodge, hot tub, podium, trophy and animated après-ski guests (parallel agent).
- Victory sequence (hockey stop, the Yeti's disgusted retreat, trophy, crane shot) and defeat sequence (a comedic, gore-free capture).
- Scoring, style multiplier, personal bests, and retry without reloading.

### Milestone 6 — Polish
- Synthesized adaptive music and sound effects (parallel agent).
- Menus, HUD, settings, key remapping, a controller tester, and accessibility options.

### Milestone 7 — Adversarial verification (round 1)
- Reviewer B (gameplay/physics) and Reviewer D (technical) reported FAIL. Fixes applied:
  - **Tree contact:** the skier could be pinned against a trunk. Light contacts now remove only the inward velocity, impact events are throttled, and getting up turns you away from the obstacle.
  - **Drift:** retuned to be a real tool (turns about 65% faster at ~72% of the speed). Pizza now stops you on the main pitches.
  - **Terrain and input feel:** compressions cost a little speed and load the legs; keyboard steering responds faster.
  - **Camera:** it now springs its offset from the skier, so it no longer drifts further behind as speed rises.
  - **Yeti:** stronger pressure and a range cap, so it stays within reach; capped speed on gentle ground; the final section was steepened.
  - **Bot behaviour:** the autopilot no longer gets up instantly. Regression simulations were added for one or two mid-chase crashes.
  - **GPU resources:** fixed a shadow-map leak when the world is rebuilt; terrain LOD now has hysteresis; the Yeti's fur uses distance LOD.
  - **Hitches and CPU:** fuller shader warm-up; the resort only animates when the camera is near; fewer per-step and per-frame allocations.
  - **Robustness:** footprints and timers are cleaned up per run; repeated loop errors are throttled; preview pages are excluded from production builds.

### Milestone 7 — Adversarial verification (rounds 1b and 2)
- **Reviewers A (visual), C (cinematic) and E (QA) reported FAIL.** Fixes applied:
  - **Chase visibility:**
    - a rear-view "BEHIND YOU" window;
    - a hold-to-look-back control;
    - the camera keeps out of the Yeti when it is close;
    - the Yeti carries a rim light.
  - **Lighting and materials:**
    - more lighting contrast, blue-shifted shadow sides and sun glints;
    - each side of the valley has its own character, with avalanche paths;
    - rock is projected onto vertical planes, appears in patches and is warmer;
    - cave boulders are sunk into the cliff.
  - **Cave cinematic:**
    - a true hand insert and a light drop inside the cave;
    - closer emergence and roar framing, with silence before the roar;
    - the leap is filmed on screen (beat 10b), and skipping is silent.
  - **Victory:**
    - the joke is timed on cue, with a close shot;
    - a real hockey stop;
    - letterbox bars, and a crane up over the lodge.
  - **Defeat:** framing follows the hand-to-mouth arc, and the title moved to the lower third.
  - **Bugs found by QA:**
    - Restart from pause left the next run muted;
    - the key-remap prompt trapped controller users;
    - corrupt settings could crash the game (settings are now sanitised);
    - a non-standard gamepad spun the camera;
    - remapping could create duplicate keys and lose Escape;
    - the Yeti gave up on a skier who ended up uphill of it;
    - pause rules contradicted each other during the cave cinematic;
    - A/B on a controller could skip cinematics by accident.
  - **Accessibility:** interface text size, a stricter reduce-motion option, `prefers-reduced-motion`,
    and an audio-unlock hint for gamepad players.
  - **Finish chute:** found by tracing a browser run. The route clipped the start of the finish-chute
    fence and the skier got pinned there. The route now enters the chute straight and centred (with a
    regression test), and getting up turns away from resort colliders too.
- **Reviewer F (hostile critic) scored 5.5 and reported FAIL.** Fixes applied:
  - the rear view is framed on the Yeti and appears from 110 m;
  - the far-behind pressure is tighter (maximum gap about 170 m, down from about 208 m);
  - a Daily course option (a new seed each day, balance checked);
  - sound captions;
  - a less obstructive "RUN." title;
  - `DESIGN.md` updated to the current tuning.
