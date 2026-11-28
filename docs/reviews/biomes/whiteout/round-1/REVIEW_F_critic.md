# Whiteout Ridge, round 1: Reviewer F (Hostile Critic)

- **Role:** Reviewer F, hostile critic. Owns category 8 (overall player experience) and scores every other category.
- **Nature:** a model-based reviewer, **not a human playtester**. I did not play the game in real time. Feel, motion, frame pacing and what a listener actually hears are inferred from code, data and still frames.
- **Build:** `3f7bc45` (branch `pass5-whiteout`). `git diff 0f04659 3f7bc45 -- src` is empty. The evidence manifest records `6d0cdfa`, which has the same `src/`, so I accept it.
- **What I examined:**
  - Source: `src/world/biomes/whiteout/*` and `views/*`; the shared weather, fog, audio and HUD paths in `World.ts`, `Environment.ts`, `GameSession.ts`, `audio/ambience.ts`, `audio/logic.ts`, `CourseConfig.ts` and `progression/achievements.ts`.
  - Specs: `docs/BIOMES.md` (it has no dedicated Whiteout section, so I used the weather and hazards contracts) and `docs/PROGRESSION.md`.
  - Evidence: all 26 PNGs and `manifest.json`, `courses.json`, `audio.json`, `perf/*.json`, `e2e.txt`, the W-034 balance README, and its raw `.jsonl` (I recounted it myself).
  - Comparison: the Alpine baseline cave shots.

## Verdict: FAIL

My owned category (8) scores **5/10**, against a target of 9. Whiteout Ridge has a likeable finish (the rescue station and the lantern beat) and a clear HUD forecast. Underneath that, a player meets four problems:

- a "whiteout" that never whites out;
- a storm that hardly sounds louder than clear weather;
- weather "decisions" that the developers' own data shows make no difference;
- a large jump in difficulty over Fjord, on a frame budget roughly 19× Alpine's (CPU).

| # | Category | Score | One-line justification |
|---|---|---|---|
| 1 | Visual art direction (lc) | 6 | The station, Yeti and rime cave are good. The far ranges are flat cardboard cut-outs, there are hard-edged fog polygons, the drifts read as flat slabs, and the storm reads as an overcast day. |
| 2 | Environmental uniqueness (lc) | 5 | The cave is the Alpine cave re-tinted, the boulders are Fjord's three scans, and the piste corridor between two banks reads like Alpine in grey. The forecast HUD and rescue station are genuinely new. |
| 3 | Skiing and hazard mechanics (lc) | 5 | Reading the weather doesn't help (informed 14/24 vs blind 15/24). Drift avoidance makes things worse. Blizzard fog is capped to almost nothing inside a storm. Hard has weaker weather than Normal. |
| 4 | Difficulty and fairness (lc) | 5 | Normal Sprint 15/24 vs Fjord 23/24. The skilled autopilot is caught on the default course. The heaviest front of a run is scheduled for the first chase. |
| 5 | Cinematics (lc) | 6 | The lantern beat and station are strong. The leap shows the Yeti stuck to the cliff face, and several beats that the notes claim (searchlight, flinch, squall) are not visible in the frames. |
| 6 | Performance and stability (lc) | 5 | Median CPU frame 7.5 ms vs Alpine 0.4 ms. 1,220 of 37,270 frames exceed 16 ms. 7.8 M triangles. The cause is unattributed. No errors, and memory is flat. |
| 7 | Accessibility and controls (lc) | 6 | The STORM pill with an arrow and the captions are good, and fog has a ceiling. The wind direction is not in the audio, and there is no reduce-weather or particles option in a biome whose identity is visual noise. |
| **8** | **Overall player experience (owned)** | **5** | The core fantasy (blind, loud, decision-rich storms) is not delivered, the step up in difficulty comes from flat costs, and there are visible art seams in the first minute. |

## Findings

Verified means I checked it myself in code, data or images. Dev-reported means I took it from a developer document and checked only its numbers.

### F1. Major (release-blocking for categories 3, 4 and 8): reading the weather is a non-decision, and the HUD tells players to do things that don't help
- **Evidence (verified):** I recounted `balance/w034/whiteout_sprint.s*.jsonl`. Normal Sprint wins by policy:

  | Policy | Wins |
  |---|---|
  | blind | 15/24 |
  | informed | 14/24 |
  | drifts only | **12/24** |
  | sheltered | 14/24 |
  | exposed | 14/24 |
  | blizzard only | 16/24 |
  | lines only | 17/24 |

  Relaxed is 24/24 blind but 22/24 informed. Hard is 6/24 blind and 4/24 informed. Over all difficulties, informed play wins 40/72 against blind play's 45/72.
- **Why the drift decision backfires:** 60% of drift rows cover the racing line (`hazards.ts:32`, `DRIFT.onLine`). Their gap is only ±4.8 m wide (`LANE_HALF*0.8`, `hazards.ts:101`) and sits 12–22 m off the line (`hazards.ts:98-99`). The rows span the whole piste.
- **What the player is told:** the HUD and captions coach the decisions explicitly:
  - `GameSession.ts:1182`: "take the sheltered line or check your speed" (seen in `04_build.png` and `05_storm.png`, caption bar at y≈560);
  - `02_wall_far.png`: "stand up out of the tuck".
- **Why it matters:** in the first storm, a player who obeys the game does no better, or slightly worse, than one who ignores it. Players who notice this stop trusting the HUD; players who don't notice it just find Whiteout harder and duller. The biome description (`biome.ts:10-15`) promises exactly these decisions.
- **Status:** the developers name this W-035 (major, in the balance README §2). `src/` has not changed since the measurement, so it is unresolved in the candidate.
- **Fix direction:**
  - Put drift gaps within reach (gap on the line or within one carve) and make ploughing through clearly costly.
  - Make the sheltered line pay off in a storm, for example by tying headwind and slip to stance and exposure rather than charging them flat.
  - Re-measure, and require informed play to beat blind play by a clear margin.

### F2. Major (category 4 and the first five minutes): a difficulty cliff, a default course the bot loses, and the heaviest storm timed for the first chase
- **Evidence (verified):**
  - **Win rates, same driver:**

    | | Normal Sprint | Normal Standard |
    |---|---|---|
    | Alpine | 24/24 | 12/12 |
    | Fjord | 23/24 | 12/12 |
    | Whiteout | 15/24 | 6/12 |

  - **Mean speed (m/s):** Whiteout 16.5, Fjord 18.3, Alpine 20.4 (raw data).
  - **Yeti gap at 10/20/30 s of chase (Normal, from the dev README):** Whiteout 75/77/84 m, Fjord 82/97/103 m.
  - **Default course:** `courses.json` gives the skilled autopilot's result on `CLASSIC-SPR@WHITE` (the course you get by picking Whiteout and pressing start; see `CourseConfig.ts:116` and `:251-258`): **caught at 84.9 s**. The matrix's default-seed Standard run is also caught. Across the seven Daily Sprints, the bot loses 2 of 7.
  - **Front timing:** the first front is always a "full" storm (`storm.ts:61`). It builds at 22 s on the physics clock and blows from 31 s (`storm.ts:23-25`). In the audio probe run the chase began at t≈8 s, z≈287 m, and the storm was full by t=37 s (`audio.json` rows, `tStorm`).

  So a new player's first Yeti pursuit coincides with the strongest storm of the run, while the Yeti gap is at its smallest.
- **Why it matters:** the rating ladder sells Whiteout as one step (3/5) above Fjord (2/5). In practice, the default first run on Normal is lost by a bot that never misreads the line. A first-time human, who also has to cope with fog, will mostly see the "caught" screen. That is punishing, and nothing teaches the player why.
- **Fix direction:**
  - Give the default course's first front a longer calm or a "graze" profile until the chase has settled.
  - Bring Normal to roughly 20/24 for the blind bot through the F1 levers, not through Yeti speed.
  - Put the default course in the screenshot and evidence set. Today it has none: every shot uses `SEED-3403625622`.

### F3. Major (categories 7 and 8): the storm barely sounds like a storm, and the audio carries no wind direction
- **Evidence (verified):**
  - The continuous wind bed is set only from skier speed and a global time-based gust: `ambience.ts:191` calls `windTargets(s.speed, s.eerie, gustValue(this.time))`. Neither the WeatherModel's `storm`, its wind speed nor `front.dir` reaches it (grep of `src/audio`: no weather input).
  - Stereo pan is `(gust-0.5)*0.6` (`logic.ts:259`), which is unrelated to which side the front blows from.
  - The only storm-specific sound is a one-shot `blizzard-build` cue when the build phase starts (`GameSession.ts:1181`), plus the blizzard-cell cues.
  - Measured result (`audio.json`): storm RMS 0.1014 vs clear 0.0895, i.e. **+1.09 dB**, about one just-noticeable difference.
- **Why it matters:** a storm of 38–58 s at the strongest wind in the game sounds like skiing. Both `biome.ts:10` and the weather contract in `docs/BIOMES.md` ("gusts telegraphed by particles and audio") promise audio telegraphing that doesn't exist. Players who rely on sound cannot tell which way the wind will push.
- **Fix direction:**
  - Drive the wind bed's gain, low cut and whistle from `weather.storm` and the wind speed, aiming for at least 6–9 dB between clear and storm.
  - Pan the bed toward `front.dir`.
  - Add a sustained storm layer (roar plus hiss).

### F4. Major (categories 1, 2 and 8): the "whiteout" never whites out, and blizzard fog is capped to nothing inside a storm
- **Evidence (verified):**
  - **Storm density:** base fog density 0.00085 × `STORM_FOG.storm` 11 = 0.00935 (`biome.ts:73`, `storm.ts:31`).
  - **The cap:** the accessibility ceiling `maxFogDensity` is 0.0105 (`Environment.ts:244-247`). A blizzard's ×4.2 fog (`hazards.ts:56`) inside a storm therefore raises density by only about 12%. That contradicts `hazards.ts:10-11`: "the visibility collapses inside it".
  - **Blizzard in clear weather:** 0.00085 × 0.65 × 4.2 ≈ 0.0023. With exp2 fog, an object is half-hidden only at around 360 m.
  - **What the frames show:**
    - `05_storm.png` (s=0.82): the right-hand bank (x 900–1280, y 90–400) and the trail lamps well past 150 m are plainly visible.
    - `19_station_approach.png`: the station is clearly visible about 125 m out (z 2,880 → ~3,005).
    - `18_hard_snowball_fog.png`: tree lines are visible on both banks.
- **Why it matters:** the biome's name and promise is losing your sight. As shipped, a storm is a grey overcast day with some flakes. The cap is the right fairness instinct, but it leaves no room for the "blind" moments that make the wider design (trail lamps, HUD over the fog) mean anything.
- **Fix direction:**
  - Spend the visibility budget locally and briefly: short blizzard white-outs well under 80 m, with the lamps and HUD carrying the player through, rather than a flat ceiling.
  - Add screen-space blowing snow and contrast loss, not only fog density.

### F5. Major (evidence integrity, category 5/8 judgement): screenshot notes claim content the images don't show, including a storm that isn't there in the storm-chase shots
These are verified against the PNGs and manifest fields:

- **`16_storm_chase` and `17_yeti_silhouette`.** The manifest gives `phase: storm, s: 0.84`.
  - Both images show blue sky with pink clouds (`16` top-left x 0–450, y 60–160; `17` top-left x 0–320, y 0–120) and long clear views.
  - `16`'s HUD says `STORM ←` while the world is clear, so the HUD contradicts the world in the first seconds of the chase.
  - `17` is described as "the Yeti silhouette in the snow". It actually shows the Yeti pressed flat against the cave cliff face above the mouth (x 615–675, y 325–395), in clear weather.
  - Either the storm look fails after the cave (`World.releaseWeather` fade, `World.ts:429-433`, `:586-596`), or the shot was staged wrongly. Either way, a storm chase is not evidenced.
- **`15_cave_leap`:** the Yeti again appears glued to the rock face (x 610–660, y 310–380). There is no arc, shadow or motion cue, and the skier's head is cropped at the bottom edge.
- **`02_wall_far`:** "the storm wall on the windward horizon". No wall is visible, and the blizzard announced in the caption isn't visible either.
- **`07_clearing`:** "~2 s after the storm". The ease phase ended at t≈86.6 s (`06`: time 85.25 + 1.33 s left) and the frame is at t=94.25 s, so about 7.7 s after. The "cloud shadows" are not visible.
- **`09_valley_view`:** "flank falling ~500 m, far ranges". It shows a milky haze with visible translucent quad seams and a grey smear (x 0–800, y 140–320; vertical seams near x 560–660). There is no valley and no ranges.
- **`10_crest`:** "rocky crest and its tors". It shows a smooth snow slope with scattered pebble-sized rocks and no tors.
- **Victory frames:**
  - `20_v_arrive`: "searchlight beam, rescuers waving". No beam; the rescuers stand stiffly.
  - `22_v_lantern`: "lantern raised in the doorway". The lantern is in the foreground at the skier's hand (x 555–625, y 300–430), not in the doorway.
  - `23_v_yeti_light`: "searchlight on him". Flat daylight with no light pool or edge.
  - `24_v_yeti_flinch`: shows only the Yeti's back.
- **Why it matters:** other reviewers and the developers will score cinematics and art from these notes. The images support a much weaker experience than the notes describe.
- **Fix direction:**
  - Re-capture the chase in a real storm on the default course.
  - Fix or explain the clear sky after the cave.
  - Rewrite the notes to describe what each frame shows.

### F6. Major (category 6; owned by D, flagged for experience): Whiteout is far more expensive per frame
- **Evidence (verified in `perf/frames_*.json`):**

  | | Median CPU (ms) | p95 (ms) | Frames > 16 ms | Triangles |
  |---|---|---|---|---|
  | Alpine | 0.4 | — | 5 | 1.8 M |
  | Fjord | 2.9 | 9 | 17 | 1.7 M |
  | Whiteout | 7.5 | 15.3 | 1,220 | 7.8 M |

  The developers call this W-038 and have not attributed it.
- **Mitigating:** heap is flat over 40 km (62–94 MB), and there are no errors.
- **Possible suspects:**
  - The blowing-snow system uses up to 6,000–9,000 instanced quads on high and ultra (`blowingSnow.ts:16`).
  - Hazard views rewrite position buffers every frame (`hazardViews.ts:173`, `:239`).
- **Why it matters:** the storms, the moments that most need smooth input, are where the per-frame cost peaks. On mid-range laptops this risks stutter exactly when the wind is pushing the player. GPU cost is unmeasured.
- **Fix direction:**
  - Profile a dev build.
  - Move the particle updates to the GPU.
  - Find the source of the 7.8 M triangles (the terrain or ridge-rock LOD on a wide ridge is a likely candidate).

### F7. Minor: Hard has weaker weather than Normal
`biome.ts:147` sets the hazard `intensity: { relaxed: 0.5, normal: 0.8, hard: 0.65 }`. Headwind is identical on Normal and Hard (`storm.ts:179`). By contrast, Fjord uses `normal: 1, hard: 1` (`fjord/biome.ts:234`). A player choosing Hard to earn "Whiteout Survivor" gets gentler drifts and blizzards; Hard is harder only through the snowballs. This is undocumented and counter-intuitive. **Fix:** make the ladder monotonic, or document the choice in the menu or difficulty text.

### F8. Minor (first five minutes): the Achievements screen still says Whiteout is "coming soon"
`achievements.ts:242` still sets `requires: 'Whiteout Ridge location'`, and `achievementsView.ts:28` renders that as "Needs the Whiteout Ridge location (coming soon)" on a build where the location is playable. `docs/PROGRESSION.md:129` says the same. Fjord's card had this removed. The e2e menu test only covers "Location row (Alpine, Fjord Coast)" (`e2e.txt` test 11), so Whiteout's menu row is not checked for fit either. **Fix:** remove `requires`, update the doc, and add Whiteout to the menu test.

### F9. Minor (category 2): content reused from Alpine and Fjord
- **Cave:** `stormCave.ts:4-5` says "the shared cave geometry, grounding and cinematic are untouched". Compare `12_cave_mouth.png` with `alpine-baseline/07_yeti_cave.png`: the mouth outline, the claw-mark slashes right of the mouth and the icicle layout are the same, re-tinted dark.
- **Boulders:** the near-LOD boulders are the same three CC0 scans used by Fjord's sea cave (`biome.ts:106`, `ridgeRocks.ts:28`, `fjord/views/seaCave.ts:389`).
- **Trees:** generated by the Alpine generator.
- **Obstacles:** logs and stumps are still spawned (`biome.ts:107`, logs 0.1, stumps 0.25) on a "high, bare ridge above the treeline".
- **Terrain:** in `01`, `03`, `06` and `07` the piste runs in a trough between two banks, which reads as a valley, not "the top of a broad ridge, sky and storms on both sides" (`biome.ts:123-126`).

**Fix:** give the cave a Whiteout-specific silhouette (for example a wind-scoured snow cave), drop logs and stumps, and frame the drop side in normal play.

### F10. Minor (category 1): visible art defects in normal gameplay frames
- `04_build.png`: a large hard-edged grey trapezoid in the sky (x 680–1080, y 100–390), presumably the storm wall's geometry edge.
- `03_wall_near.png`: the dark cloud's underside is a straight cardboard edge (x 860–1280, y 150–240).
- Far ranges are flat-filled jagged cut-outs with no aerial shading: `06` (x 0–470, y 90–300 and x 730–1280, y 110–210), `26` (x 530–1280, y 70–265).
- Drifts read as flat white plates, not mounds: `02` (x 960–1180, y 435–465), `03` (x 790–1000, y 420–465).
- The cornice in `08` is an extruded slab with a dark vertical side face (x 600–1280, y 420–640).
- The cave rock in `12` shows horizontal texture banding (y ≈ 385 and 490).
- The falling snow in `13` reads as large round bokeh dots.

### F11. Minor: a knock hazard sits on the racing line, and the comments contradict themselves
The blizzard is `severity: 'knock'` with `keepLaneClear: false`, and it is placed exactly at `routeX` (`hazards.ts:127-140`). The spec's default is to keep the lane clear for knock hazards (`BIOMES.md` hazards section). The file header says it "never knocks or crashes by itself" (`hazards.ts:13`), but `hazards.ts:126` and `:156` make it knock away 42% of speed (keep 0.58) when the player is tucked above 17 m/s. The gating and the 5 s telegraph make this fair enough, but the code and docs should agree.

### F12. Minor (category 7): no option to reduce weather effects
I searched `src` and found no setting to reduce visibility, particles or motion. The spec defers it ("a future … setting"). In the location built around heavy particles and screen-wide snow streaks, this matters more than anywhere else.

## What is good
- **The forecast HUD:** `STORM IN 3 s ←`, `STORM ←` and `CLEARING`, with captions (`04`, `05`, `06`). It is clear and readable, and the arrow agrees with the code's sign convention.
- **The rescue station finish:** `20`–`22` have charm and a real sense of place (the sign "RIDGE STATION · 2,412 m", windsock mast, porch light).
- **The Yeti fur render** (`14`).
- **Fronts:** they are deterministic and seeded, with varied types (`storm.ts:51-64`). Endless memory is flat, and e2e passes, including the Whiteout specs.
- **Honesty:** the developers' own balance README states W-035 and W-038 frankly.

## What would raise category 8 to 9
1. Fix F1: weather reading must clearly win (informed beating blind by at least 4/24 on Normal Sprint), with drift gaps that are worth taking.
2. Fix F2: Normal Sprint at roughly 20/24 or better for the blind bot, the default course winnable, and the first full front not stacked onto the first chase.
3. Fix F3: a storm at least 6 dB louder than clear, with wind direction in the stereo field.
4. Fix F4 and F5: real, short white-outs inside storms, and a re-captured storm chase on `CLASSIC-SPR@WHITE` with notes that match the frames.
5. Cut the per-frame cost to at most 2× Fjord, with p99 under 16 ms (F6).
6. Clear the first-five-minutes papercuts: the "coming soon" card, the cardboard ranges and the storm-wall polygon.
