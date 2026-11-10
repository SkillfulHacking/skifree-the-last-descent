# Fjord Coast, round 2: gameplay, physics, tech and QA remediation

- **Scope:** the round-1 findings of reviewers B (physics/gameplay), D (tech/performance), E (QA/accessibility) and the mechanics findings of F (critic). Art, cinematics and the art-owned view files are handled separately on `pass4-fjord-art`.
- **Branch:** `pass4-fjord`, from `bca5b14`. Commits: `4af9438`, `4f2b968`, `87c4a7b`, `1ab5aa6`, `c5ce2c1`, `0e396ac`, `726baf2`, and this document.
- **Alpine:** physics and terrain are unchanged. Every new knob is optional and defaults to the original code path. The golden-height tests in `biome.test.ts` pass, and Alpine's rows in the balance table match round 1.
- **Checks:** `npx tsc --noEmit` is clean. `npx vitest run` passes 15 files and 252 tests. The menu e2e result is in §6.
- **How things were measured:** everything below is headless (Node and Vitest), using the reviewers' own scratch scripts where they exist (`scratch/review-{b,d,e,f}`, unchanged). The new committed harnesses are:
  - `tests/review/fjord_r2_balance.test.ts` with `fjord_r2_table.mjs` (balance table; raw runs in `balance_r2.jsonl`);
  - `tests/unit/fjord_gameplay.test.ts`;
  - `tests/unit/fjord_streaming.test.ts`;
  - `tests/sim/readerDriver.ts`.
- **Timing caveat:** all timings are main-thread JavaScript in Node on a shared 2-CPU machine with a load of about 3. They are not browser frame times.

## 1. What the Fjord now asks of the player (B4, F1, F2)

Each signature mechanic now creates a decision the player can read in advance. None of them can knock you down or push you toward the sea.

| Mechanic | What it does | Skilled play | Careless play |
|---|---|---|---|
| **Squall lanes** (new; `hazards.ts` `squallLanes`) | On exposed stretches of the racing line (ridgeline 0.85 per 256 m band ×1.3, cliffside 0.7, highspeed 0.55 … forest 0.12), the gust telegraphs for 1.3 s (windsock, spindrift, `gust-build` sound, and now a caption). It then blows a **grounded** skier onshore (+X, away from the cliff) with up to 3 m/s of side-slip. The slip moves the skier without changing their speed (`EnvSample.groundSlip*`). How much of it takes hold depends on the edge (`SLIP_EDGE`): ×1.6 in a tuck, ×0.55 under pizza braking. Scoured rock lies downwind of every lane. | Hold about 2.5 m upwind (sea side) before it blows. The gust carries you back over the line and you stay off the rock (unit test). | A reactive line-follower is carried 1.5–3 m further onshore and onto the lee rock (unit test). |
| **Scoured rock on the line** (new) | About one patch per 256 m band in two (always one on a ridgeline that has a spine). The racing line crosses its rough core. A way round on the other side always stays inside the obstacle-free lane, at least 2.5 m clear (unit test). | A few metres round it costs < 0.4 m/s (unit test). | Through the core costs **2.0–2.6 m/s** at 20 m/s (was ≤ 0.9 m/s, B: median 0.19). It never knocks or crashes anyone. |
| **Ridgeline spines with gap jumps** (new; `profile.ts` `spine`, `coast.ts` `gapDepth`) | Every ridgeline gets a separate crest line (bowed 0.25 × half-width toward the sea) on wind-packed fast snow (`SPINE_SNOW`). Halfway along there is a take-off kicker and a 1.7–2.0 m deep, 6.5–7.5 m meltwater gully, at least 12 m from the racing line. Cliff drops no longer cross a spine, and the piste beside it is scoured to rock. | Saves time: **+1.03 s mean, up to +1.97 s** per ridgeline against a skier on the route (10 spines, 6 Standard seeds; +0.73 s against a rock-reading skier on the route). The gap is cleared at 15–27 m/s with **0 crashes** in 36 approaches (6 seeds). | A slow skier who drops into the gully lands hard on its ramped far side and skis out. No soft-lock (unit test). |
| **Squalls over jumps** (kept) | Airborne crosswind: wait for the lull or take off upwind. The windsock pole is now placed at least 4.5 m off the route and the alternate lines (B6). | | |

**Environment on/off, as F measured it** (`fjord_r2_balance.test.ts`, the same seeds and difficulties with `environment: null`):

| | Round 1 (F) | Round 2: Sprint, 5 seeds × R/N | Round 2: Standard, 3 seeds × R/N |
|---|---|---|---|
| Hazard reader (`tests/sim/readerDriver.ts`) | – | +0.11 s (max 1.07) | +0.95 s (max 2.32) |
| Skilled, hazard-blind | 0.0–0.9 s, no outcome changes | **+2.67 s** (max 4.29) | **+10.75 s** (max 11.16) |
| Intermediate | 0.0–0.9 s | **+2.52 s** | **+10.03 s** |
| Average | no outcome changes | +2.28 s; **2 escapes become catches** (RB1 Relaxed, RB4 Normal) | +11.40 s |
| Cautious | – | **1 escape becomes a catch** (RB4 Relaxed) | – |
| Reader vs blind skilled, environment on | – | **5.2 s faster** (145.3 vs 150.5 s) | **14.1 s faster** (450.3 vs 464.4 s) |

The environment now changes times and outcomes. It costs the hazard-blind several seconds and occasionally the run. It costs a player who reads it almost nothing, and that player is faster than in Alpine. So it is not unavoidable punishment.

The reader uses only what the game shows: hazard positions, and the windsock's phase.

## 2. Balance: Alpine vs Fjord (B3, E6)

**Terrain changes (`biome.ts` gameplay fields):**
- Segment mix: fewer basins, powder and beginner segments; more highspeed and ridgeline.
- New profile knob `minSlope: 14`: no regular segment is flatter than 14°.
- New knob `startSlope: 9.5`: the run-in at the start gate.

**Measured terrain (`scratch/review-b/slope.test.ts`, 5 seeds):**

| | Fjord before | Fjord after | Alpine |
|---|---|---|---|
| Sprint route gradient: mean | 14.5° | **16.0°** | 16.4° |
| Sprint route gradient: share under 12° | 30% | **18%** | 20% |
| Standard route gradient: mean | – | **17.4°** | 16.6° |
| Start stalls with no input (E's `start.test.ts`, 30 seeds) | **4/30** | **0/30** | 2/30 |

**Chase outcomes** (wins/runs and mean winning time; Custom seeds RB1–RB5 for Sprint and RB1–RB3 for Standard; snowballs on Hard with skilled and reader dodging; the Yeti is unchanged):

### Sprint

| location | difficulty | env | reader | skilled | intermediate | average | cautious | careless |
|---|---|---|---|---|---|---|---|---|
| alpine | relaxed | on | 5/5 (148.7 s) | 5/5 (150.2 s) | 5/5 (152.1 s) | 4/5 (212.7 s) | 2/5 (223.1 s) | 0/5 |
| alpine | normal | on | 5/5 (148.7 s) | 5/5 (150.2 s) | 5/5 (152.1 s) | 2/5 (207.7 s) | 0/5 | 0/5 |
| alpine | hard | on | 5/5 (155.8 s) | 5/5 (155.9 s) | 4/5 (168.9 s) | 0/5 | 0/5 | 0/5 |
| fjord | relaxed | on | 5/5 (145.3 s) | 5/5 (150.5 s) | 5/5 (151.0 s) | **3/5** (207.7 s) | 0/5 | 0/5 |
| fjord | relaxed | off | 5/5 (145.1 s) | 5/5 (147.8 s) | 5/5 (148.5 s) | 4/5 (205.4 s) | 1/5 (214.6 s) | 0/5 |
| fjord | normal | on | 5/5 (145.3 s) | 5/5 (150.5 s) | 5/5 (151.0 s) | 0/5 | 0/5 | 0/5 |
| fjord | normal | off | 5/5 (145.1 s) | 5/5 (147.8 s) | 5/5 (148.5 s) | 1/5 (199.2 s) | 0/5 | 0/5 |
| fjord | hard | on | 5/5 (152.5 s) | 5/5 (157.7 s) | 3/5 (169.9 s) | 0/5 | 0/5 | 0/5 |

### Standard

| location | difficulty | env | reader | skilled | intermediate | average | cautious | careless |
|---|---|---|---|---|---|---|---|---|
| alpine | relaxed | on | 3/3 (467.6 s) | 3/3 (474.7 s) | 3/3 (479.1 s) | 1/3 (643.7 s) | 0/3 | 0/3 |
| alpine | normal | on | 3/3 (467.6 s) | 3/3 (474.7 s) | 3/3 (479.1 s) | 0/3 | 0/3 | 0/3 |
| alpine | hard | on | 3/3 (495.2 s) | 3/3 (503.3 s) | 1/3 (530.4 s) | 0/3 | 0/3 | 0/3 |
| fjord | relaxed | on | 3/3 (450.3 s) | 3/3 (464.4 s) | 3/3 (469.3 s) | 1/3 (650.6 s) | 0/3 | 0/3 |
| fjord | relaxed | off | 3/3 (449.4 s) | 3/3 (453.6 s) | 3/3 (459.3 s) | 1/3 (639.2 s) | 0/3 | 0/3 |
| fjord | normal | on | 3/3 (450.3 s) | 3/3 (464.4 s) | 3/3 (469.3 s) | 0/3 | 0/3 | 0/3 |
| fjord | normal | off | 3/3 (449.4 s) | 3/3 (453.6 s) | 3/3 (459.3 s) | 0/3 | 0/3 | 0/3 |
| fjord | hard | on | 3/3 (469.7 s) | 3/3 (486.3 s) | 1/3 (538.0 s) | 0/3 | 0/3 | 0/3 |

**Before (round 1, reviewer B):**

| | Fjord, round 1 | Alpine |
|---|---|---|
| Relaxed Sprint, average | **0/5** | 4/5 |
| Relaxed Sprint, cautious | **0/5** | 2/5 |
| Hard Sprint, intermediate | **0/5** | 4/5 |
| Environment off | the same outcomes as on | |

**Reading the tables:**
- Relaxed is approachable again: a skier who never tucks escapes 3/5 Sprints (Alpine 4/5).
- Fjord is slightly harder than Alpine through the environment. With it switched off, Fjord average Relaxed is 4/5, like Alpine, and the hazard-blind experts lose 2.7 s (Sprint) and 10 s (Standard) to it.
- Experts who read the Fjord are faster than in Alpine (spines, alternate lines).
- Hard intermediate is 3/5 (Alpine 4/5); B8's flat-stretch near-miss bleed is gone with the gradient (Hard skilled 5/5).

The "cautious" driver brakes at anything over 16 m/s. It is the one style that does worse than in Alpine on Relaxed: 0/5 against Alpine's 2/5, or 1/5 with the environment off. I left this as it is (see §5): making the cautious bot win would mean making the location flatter or the hazards weaker for everyone.

## 3. Findings, changes and numbers

### Reviewer B

| # | Finding | Change (commit) | Before → after |
|---|---|---|---|
| B1 | Cornice jump soft-lock | **Airborne rim updraft**: up to 30 m/s² onshore over the last 16 m before the crest (`RIM_GUARD`, `capabilities/environment.ts`). **Out-of-bounds recovery**: a skier more than 1.5 m past the crest (grounded, or 10 m below it) is put back on the route 6 m upslope, crashed, with a `relocate` event. The player gets the title "BACK ON THE PISTE" and the caption "[you tumble over the cornice — back on the piste]", and the camera snaps (`SkierPhysics.relocate`, `GameSession`). The 9.6 s fall that scored as BIG AIR can no longer happen. Unit test in `fjord_gameplay.test.ts`. (4f2b968) | B's own probe (`cliff.test.ts`, 675 pops): **8 went over** (up to 91.8 m past the rim, stranded 85–400 m below) → **2 went 1.5 m over and were returned to the piste; 0 stranded.** |
| B2 | Viewpoints all inside chases | Viewpoints are now placed only in **free stretches**: the run-in before the first trigger, and the reprieve after each refuge before the next cave (`Coast.lookouts`). At least one per stretch. The climb from the line must be under 9 m (was 14). Reward is 500 points (was 250). (4f2b968) | In chase: **114/114** (B), 14/14, 55/56, 112/112, 161/162 (E) → **0** at every length (unit test). E's `detour.test.ts`, skilled detour to the first Sprint viewpoint, 8 seeds: caught **3/8 Relaxed, 4/8 Normal, 4/8 Hard → 24/24 reached and won.** |
| B3 | Fjord harder than Alpine for non-experts; terrain-driven | §2. (4af9438, 1ab5aa6) | See §2. |
| B4 | Mechanics have no effect | §1. (4af9438, c5ce2c1) | Rock crossing 0.19 → 2.0–2.6 m/s. Environment on/off 0.0–0.9 s → +2.7 s / +10.8 s for the hazard-blind, and outcome changes. |
| B5 | Ridgeline shortcuts are the generic chord (1 of 8, saves 0.02 s); no Fjord gaps | Every ridgeline has a spine; gap jump gullies. (4af9438, c5ce2c1, 726baf2) | Ridgelines with a line: 1/8 → **all** (15 spines over 6 Standard seeds, 10 at the final bow). Saving: 0.02 s → **+1.03 s mean (max +1.97 s)**. Gap jumps: 0 → **1–3 per Standard**, 0 crashes at 15–27 m/s. **Short of B's 2–4 s target** (see §5). |
| B6 | Windsock pole near the line (1/44) | The placement rejects any squall whose pole (h.x − 0.6r − 1.5) would be within 4.5 m of the route or 7.5 m of an alternate line (`poleClear`). (4af9438) | 1/44 → 0 by construction. |
| B7 | Viewpoint ids `lookout-<n>` | ids are `vp-<world seed base36>-<length>-<z>`, unique per course and location (unit test). (4f2b968) | |
| B8 | Hard near-miss bleed on flat stretches | Follows from B3's gradient. | Hard skilled Sprint 4/5 → **5/5**. |

### Reviewer D

| # | Finding | Change (commit) | Before → after |
|---|---|---|---|
| D1 | Scenery chunks built synchronously | `SceneryView.pump(ms)`/`flush()` (`presentation/scenery.ts`). `World` pumps every frame (`SCENERY_BUDGET_MS = 3`) and flushes when loading. Fjord chunks are built by a generator, `chunkSteps`, that yields after cairns, each viewpoint, the strand search and each house. The strand-flat and boathouse searches stride 8 steps before stepping singly (`marchOut`: the same result on falling ground, about 8× fewer `heightAt`). (87c4a7b) | Same process, 60 km of Endless at 25 m per frame (D's per-call `scenery.stream` was p95 42.6, max 302 ms). Unsliced chunk build: p50 24, max 235 ms. Sliced per frame: **p50 0.00, p99 9.5, p99.9 21 ms; 39 of 2400 frames over 8 ms**. The remaining long slices are single house builds (art-owned `house()`, see §5). |
| D2 | Streamed shelter `PointLight` recompiles every lit material | Light removed. The lamp glows by its emissive material (intensity 1.8 → 2.6). (87c4a7b) | Light-count changes: 0/1 every 6 km → **0 lights in 20 shelters over 120 km** (unit test). |
| D3 | No water on far arms (Expedition/Endless) | `waterReaches()` takes the arm under the camera and the arms ahead first, then the ones behind. `SEA_SLOTS` raised from 4 to 6 (`snowMaterial.ts`). (87c4a7b) | Water missing within 12 km: Expedition **81% → 0%**, Endless **99% → 0%**. Nearest undrawn arm 4.3 km → none (3 seeds each; also asserted every 64 m over 120 km in the unit test). |
| D5 | Water drawn first, full-screen quads with `discard` | `renderOrder` −1 → 1 (after the opaque terrain), and each quad is clipped geometrically to its arm's [z0, z1). (87c4a7b) | Not GPU-measured (no GPU here). |
| D6 | Gust streamers: 120 `heightAt` per frame | Ground sampled once on a 10×6 grid with bilinear lookup. `HazardLayer.update(dt, focusZ)` hides views more than 150 m behind and stops animating them. (87c4a7b) | **0.67 → 0.015 ms** per active gust update (D's `gust.test.ts`). |
| D7 | Low preset ignored by scenery | Low keeps 5 chunks ahead (2.5 km) instead of 8. (87c4a7b) | Mist count and house detail are art-owned (see §5). |
| D8 | Hazard view materials not compiled at load | `HazardLayer.warmup()` from `World.showAllForWarmup()` puts one view of every kind into the scene in its active phase for `renderer.compile`; it is disposed on the next update. `HazardField.peek` finds an instance without streaming. (87c4a7b) | |
| D9 | Hazard views pop in 400–656 m ahead | World streams hazard bands, and so their views, one band per frame out to 1.1 km (`HAZARD_VIEW_AHEAD`). (87c4a7b) | 400–656 m → 1.1–1.36 km. |
| D11 | Module singletons never disposed | Not changed; bounded by design. Disposing shared materials would force a recompile the next time they are used. The streaming test pins it at **4 materials and 2 textures**. | |
| — | Endless disposal test (§10) | New `tests/unit/fjord_streaming.test.ts`: 120 km of Endless with the real views. (87c4a7b) | 3436 geometries, all disposed. 905 hazard views created and the same number disposed. Peak 12 chunks, 10 pending, 29 views, 1 shelter. Runs in about 8 s. |

D4, D10 and D12 are not in my scope; see §5.

### Reviewer E

| # | Finding | Change (commit) | Before → after |
|---|---|---|---|
| E1 | Viewpoint detours punished | = B2. | Caught 3/8, 4/8, 4/8 → 0/24. |
| E2 | No captions for the Fjord cues | Captions use the existing Hud caption system, with a new `soft` priority: a location caption never replaces one on screen (the Yeti's cues come first), and at most one every 3 s. (4f2b968) The captions are:<br>- squall over a lane: "[a squall builds off the sea — it will push you left]"<br>- squall over a jump: "[a squall gusts across the jump ahead]"<br>- rock: "[skis scrape over bare rock]"<br>- surf, once per run: "[surf booms against the cliffs far below]"<br>- viewpoint: "[gulls cry over open water — a viewpoint]"<br>- cornice recovery (B1) | |
| E3 | "resort / lodges" wording | Results show "Reached the ${finishDef.goal}" (the harbour). The refuge title names the location's refuge ("Coastal shelter reached…") and its goal. Achievement descriptions are location-neutral ("Reach the finish…"). The Endless blurb reads "Bank your run at the refuges." (4f2b968) | |
| E4 | Low-contrast HUD over a bright backdrop | A soft dark scrim behind the HUD corner clusters and the Yeti meter. Small labels are at least 12 px and heavier. Stronger shadow on the skip hint and the rear-view label. Location note 11 → 12 px. (0e396ac) | Not re-captured in this pass. Menu scaling at 1440p+ was left as it is, to keep the menu-fit e2e stable. |
| E5 | Course codes | `parseCourseId` decodes `%40` and drops whitespace. The error text gives an `@FJORD` example (`exampleCodes`). Unit test. (4f2b968) | |
| E6 | Flat run-in | `startSlope` 9.5. (1ab5aa6) | 4/30 → **0/30** stalls. |
| E7 | Unstable viewpoint ids | = B7. | |
| E8 | Howl side inverted; a sighting could come from the sea | Caption mapping fixed (+X is the skier's left). On a coast, sightings always come from the land side. The coast and weather comments now say the sea is on the skier's right. (4f2b968) | |

## 4. Tests added or changed

- `tests/unit/fjord_gameplay.test.ts` (10 tests): squall lanes; reactive vs upwind; rock on the line (cost, the way round, clearance); spines and gaps (depth, separation, no crash at speed, no soft-lock); cornice pops (54 runs); viewpoints never in a chase, ids unique; Relaxed average wins ≥ 3/5; environment costs the blind more than the reader; course codes.
- `tests/unit/fjord_streaming.test.ts`: Endless 120 km.
- `tests/unit/fjord.test.ts`: updated to the new design (lanes, rock on the line, viewpoint counts).
- `tests/e2e/menu.spec.ts`: "keyboard, mouse and gamepad…" now finds the Length row by its label.
- `tests/review/fjord_r2_balance.test.ts` and `fjord_r2_table.mjs`: the §1 and §2 tables.

## 5. Not fixed or handed over

- **B5 shortcut size.** Spines save about 1 s per ridgeline, not B's 2–4 s. With identical start and end heights, and drag dominating at racing speed, only a meaningfully shorter path saves more. The remaining lever is a larger route detour around the crest, which is a course-shape change I did not make this round.
- **Cautious on Relaxed** is 0/5 (Alpine 2/5). §2 explains why I left it.
- **D1 residual.** Single `house()` builds (art-owned `buildings.ts`) take 6–18 ms under load. Slicing inside a house, or caching house kits, belongs to the art side.
- **Art-owned items:**
  - **D4**, the sky rectangle in `DistantRanges`/`openSector`.
  - **D12**, the sea-cave net (`seaCave.ts:102`): its geometry leaks and it keeps animating when it is not placed.
  - **D7 remainder**: fewer mist banks and less house detail on Low.
  - **Visual follow-ups** for the art developer:
    - telegraphed take-off markers for the gap kickers (data in `profile.gapsNear`);
    - a glow sprite or decal under the shelter lamp now that the light is gone;
    - optional windsock styling for squall lanes;
    - the gully's look (it is plain terrain, so it renders automatically).
- **D10**, float precision of absolute-coordinate geometry. Engine-wide; not changed.
- **Files outside my nominal ownership**, touched minimally, for merge awareness:
  - `src/world/snowMaterial.ts`: `SEA_SLOTS` 4 → 6 only.
  - `src/world/biome.ts`: three optional `BiomeTerrain` fields (`minSlope`, `spine`, `startSlope`).
  - `src/world/biomes/fjord/views/scenery.ts`: `stream`/`pump`/`flush`, `chunkSteps`, `hamlet` turned into a generator, and `marchOut`. The hamlet's content is unchanged.
  - `src/world/presentation/hazardViews.ts`: `HazardLayer` warm-up and skipping views behind the skier.
  - `src/progression/achievements.ts`: description strings only.
- **Fjord records.** Fjord courses are new in this pass, so changing their terrain and hazards breaks no released code or record. Alpine codes, daily seeds and records are unchanged.

## 6. Test record

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 15 files, 252 tests, all pass.
- Playwright `tests/e2e/menu.spec.ts` on `PW_PORT=4472`: see the TEST RESULT line below, filled in from the run log.
