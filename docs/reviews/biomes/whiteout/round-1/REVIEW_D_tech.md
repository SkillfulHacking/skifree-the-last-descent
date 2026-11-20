# Review D: Technical and Performance Engineer, Whiteout Ridge, round 1

- **Reviewer:** D (Technical and Performance). I am a model-based reviewer, not a human playtester. I did not play the game in real time.
- **Build:** `3f7bc45` (branch `pass5-whiteout`). Its `src/` is identical to `0f04659` and `6d0cdfa`; I checked with `git diff --stat … -- src`, which is empty.
- **Category owned:** 6, Performance and stability.
- **What I examined:**
  - `round-1/perf/`: README, the three `frames_*.json` raw step arrays (Alpine, Fjord, Whiteout), `endless_whiteout.json` and the logs.
  - The tools `tools/prod_frames.mjs` and `tools/endless_memory.mjs`.
  - The Whiteout runtime code: `src/world/biomes/whiteout/**`, `src/world/Environment.ts`, `src/game/World.ts`, `src/game/GameSession.ts`, `src/world/presentation/hazardViews.ts`, `src/world/look/atmosphere.ts`.
  - The retry and lifecycle evidence: `tests/e2e/whiteout_rerun.spec.ts`, `w031/README.md` and `round-1/e2e.txt`.
- **My own experiments:** Node/Vitest scripts under `/tmp/woperf`. They use the repo's `domStub` and `fakeRenderer`, run `World.update` at 20 m/s on `high`, and time each subsystem by wrapping its methods. Nothing in the repository was modified.
- **GPU timing is unavailable on this machine.** It renders with SwiftShader. I judge GPU risk from what the scene contains: triangles, draw objects, shadow casters and transparent layers.

## Verdict
**FAIL** for category 6: 6/10 against the 9/10 target.

Most of Whiteout's CPU regression (W-038) comes from one easily fixed loop: the spindrift plume update in the wind-drift hazard view. As shipped, it is a release-blocking Major.

There are also two lesser problems:
- The ridge rocks add a large GPU load that is never culled.
- The scenery streams synchronously and causes hitches.

Stability itself is good:
- No errors in any perf run.
- The W-031 retry regression passes.
- The Endless memory is flat.
- Disposal is clean apart from bounded module-level singletons.

## Scores

| # | Category | Score | One-line justification |
|---|---|---|---|
| 1 | Visual art direction (lc) | 7 | Not assessed beyond code. The weather layering is ambitious and coherent in code. Owned by A. |
| 2 | Environmental uniqueness (lc) | 8 | Not assessed. Fronts, the storm wall, the cornice and the rescue lamps are distinctive in code. Owned by A. |
| 3 | Skiing and hazard mechanics (lc) | 7 | Not assessed. Hazard physics is cheap (env.sample 0.05 ms per frame). Owned by B. |
| 4 | Difficulty and fairness (lc) | 7 | Not assessed. Owned by B. |
| 5 | Cinematics (lc) | 7 | Not assessed. The first storm dome is created mid-run (F-4), which may cause a first-front hitch. Owned by C. |
| **6** | **Performance and stability** | **6** | Median CPU step 7.5 ms vs Alpine 0.4 / Fjord 2.9; 3.3 % of frames over 16 ms. I traced about 4.8 ms of it to one time-invariant loop. The ridge rocks are an unculled GPU and shadow load. Stability and memory are good. |
| 7 | Accessibility and controls (lc) | 7 | Not assessed. Owned by E. |
| 8 | Overall player experience (lc) | 7 | Not assessed. On a mid-range laptop CPU, F-1 alone could cost the 60 fps target in Whiteout. Owned by F. |

The (lc) scores are placeholders from a code-only reading and should carry little weight.

## Measured evidence (developer data, re-analysed by me)

Source: `perf/frames_*.json`, 12 km of Endless each, `quality: 'high'`, Relaxed difficulty, production bundle in Chrome V8.

| | median ms | p95 | p99 | frames > 16 ms | frames > 33 ms | step floor |
|---|---|---|---|---|---|---|
| Alpine | 0.4 | 7.2 | 7.9 | 5 | 0 | 70 % of frames < 1 ms |
| Fjord | 2.9 | 9.0 | 10.7 | 17 | 1 | 47 % < 1 ms |
| Whiteout | 7.5 | 15.3 | 17.6 | 1220 | 11 | **0 frames < 1 ms; 59 frames < 2 ms** |

My own analysis of the Whiteout step array:
- **There is a cost on every frame, not a streaming cost.** There is no idle floor, and the 1000-frame window medians stay between 3.1 and 11 ms for the whole run.
- **The cost comes in plateaus, not single spikes.** I count 135 runs of 10 or more consecutive frames above 12 ms (≈ 14 ms plateaus lasting 10–50 frames). That fits a constant per-frame cost (F-1) plus the 6 ms streaming budget (`World.ts:55`) whenever streaming work is pending: 1.5 + 6 + about 6 ≈ 14 ms.

The developer's README is right that this is "a constant cost, not streaming hitches". Its guess at the cause is wrong:
- It suspects "snowfall/blowing-snow particle updates and geometry rebuilds".
- The blowing snow is entirely GPU-side (`blowingSnow.ts:129-137` only sets uniforms).
- The real cause is the drift plumes (below).

## Findings

### F-1 (Major, release-blocking). Wind-drift plume animation costs about 4.8 ms of CPU per frame, recomputing time-invariant terrain heights
- **Where:** `src/world/biomes/whiteout/views/hazardViews.ts:158-174`, specifically line 170.
- **What it does:**
  - Every live drift view's `update` loops over its 70 plume grains.
  - For each grain it calls `m.heightAt(h.x + lx*c - crestZ*s, h.z + lx*s + crestZ*c)`.
  - That argument depends only on the grain's fixed `seedU[i]`, not on `t`. The result is the same every frame.
- **How many views:** `HazardLayer.update` (`hazardViews.ts:169-183` in the presentation layer) animates every view from 150 m behind out to the full streaming window, `HAZARD_VIEW_AHEAD = 1100` m (`World.ts:63`), with no distance limit ahead.
- **It also runs while the plume is hidden:** in calm windows `uDriftK` = 0 and `plume.visible` is false, but the loop still runs (`hazardViews.ts:160-173`).
- **Measured (my experiment, Whiteout Endless, `high`, 4000 frames at 20 m/s):**

| Subsystem | ms per frame |
|---|---|
| `hazardViews.update` | **4.88** (median 4.57, p95 8.54) |
| of which `view:wind-drift` | **4.79** |
| of which `view:blizzard` | 0.07 |
| `stepStreaming` | 1.69 (Fjord 2.11, Alpine 1.05) |
| `Environment.update` | 0.11 |
| `env.sample` (physics, ×2) | 0.05 |

  - About 40 drift views are live, and about 27 are animated per frame.
  - That makes **1865 `heightAt` calls per frame** from the drift views alone, at about 2.5 µs each, which equals the measured 4.7 ms.
  - The whole headless frame median is 5.4 ms (Alpine 0.12). So this one loop is most of the gap in W-038.
- **Why it matters:**
  - These numbers come from a fast server-class V8.
  - On a mid-range laptop or a Chromebook CPU (2–3× slower), this loop alone could take 10–15 ms per frame, before rendering.
  - With the streaming budget on top, Whiteout would routinely miss 16.7 ms frames, and 120 Hz is out of reach.
- **Fix direction:**
  - Precompute the 70 crest heights once per drift when the view is built; this takes the cost to about 0.
  - Skip the plume loop when `!plume.visible`.
  - Animate only the drifts within about 250 m (the storm visibility is about 80 m).
  - Add a CPU regression test, for example: per-frame `hazardViews.update` under 0.5 ms on a fixed 4000-frame walk.

### F-2 (Major). Ridge rocks: 140 instances × 5000-triangle scans, never frustum-culled, all casting shadows
- **Where:** `src/world/biomes/whiteout/views/ridgeRocks.ts:212-221`. These set `castShadow = true` and `frustumCulled = false` on every chunk's `InstancedMesh`.
- **Rock size:** the three `.skm` scans are 5000 triangles each. I read their headers: boulder_01 has 2502 vertices / 5000 triangles, and the namaqualand scans the same.
- **How many:** with the real placements over 6 chunks I count **140 rocks ≈ 700 k triangles**. They are drawn in the main pass and again in the shadow pass, whether or not they are in the camera or shadow frustum.
  - Many are flank buttresses 70–290 m beyond the rim (`ridgeRocks.ts:144-147`).
  - The sun's shadow frustum covers only about 110 m (`Environment.ts:83`), so most of these rocks are drawn into the shadow map for nothing.
- **Scene totals (my estimate, everything visible, no culling):**

| Location | Visible triangles | Shadow-caster triangles | Draw objects |
|---|---|---|---|
| Whiteout | 3.09 M | 1.79 M | 808 |
| Fjord | 2.10 M | 0.99 M | 680 |
| Alpine | 2.12 M | 1.14 M | 602 |

  - `whiteout-scenery` alone is 715 k / 706 k shadow.
  - The developer's single-frame snapshot shows 7.8 M triangles vs 1.66 M for Fjord. I could not reproduce the exact counter value: it is one frame, and the draw calls (200) are oddly low. The direction agrees.
- **Quality tiers:** none apply. Ridge rocks get only a material flag (`hq`). The count, the shadows and the culling are the same on `low`, and shadows are always on (`App.ts:77`).
- **Why it matters:** the vertex and shadow cost is roughly 1.5 M extra triangles per frame, on every frame and every tier. That is the biggest GPU risk in the biome on integrated GPUs, which SwiftShader cannot measure.
- **Fix direction:**
  - Compute a bounding sphere per chunk and let the instanced meshes be culled.
  - Turn off `castShadow` for the flank and rim families (outside the shadow range by construction).
  - Use a decimated LOD scan (about 800 triangles) for anything beyond about 150 m.
  - Thin the counts on `low` and `medium`.

### F-3 (Minor). Whiteout scenery chunks are built synchronously, outside the 6 ms streaming budget
- **Where:**
  - `World.stream` calls `this.scenery?.stream(z)` directly (`World.ts:208`).
  - `WhiteoutScenery` has no `pending`/`pump`, so `stepStreaming` never time-slices it (`World.ts:493-494, 514-515`).
  - Each new 256 m chunk builds in one frame: marker spots, `corniceSamples` and `buildCorniceGeometry` (about 86 samples × 10 `heightAt`), wands, and `ridgeRockPlacements`. The placements call `corniceSamples` again (`ridgeRocks.ts:130`) and do 18 or more `heightAt` per rock.
  - `RidgeRocks.stream` also runs every frame from `scenery.update` (`scenery.ts:211`). When a scan arrives (`stale`), it drops and rebuilds every live chunk (`ridgeRocks.ts:187-198`), up to three times at startup.
- **Measured:** 13 chunk builds, **median 3.9 ms, max 26.2 ms** (Fjord: median 0.1, max 0.9 ms). This lands roughly every 12 s at 20 m/s, on top of the F-1 baseline. It plausibly accounts for part of the 1220 frames over 16 ms and the 11 frames over 33 ms.
- **Fix direction:**
  - Give `WhiteoutScenery` a `pending`/`pump` like Fjord's and build chunks on the frame budget.
  - Reuse one `corniceSamples` result per chunk.
  - When a scan arrives, rebuild only the chunks that lacked that scan.

### F-4 (Minor). The storm dome and storm wall are not shader-warmed; the first storm compiles a program mid-run
- **Storm dome:** `Environment.applyWeather` creates the dome `MeshBasicMaterial` (BackSide, transparent, fog off) lazily, on the first `storm > 0` (`Environment.ts:268-274`). That is the first front's build, about 22 s into every run.
- **Why warm-up misses it:** the load-time warm-up `renderer.compile(world.scene, …)` (`App.ts:222`) uses `traverseVisible`. I checked this in three's `WebGLRenderer.compile`.
  - The dome does not exist at that time.
  - The storm wall starts with `visible = false` (`sky.ts:336`). If it is not yet visible when the scene is compiled, its noise shader also compiles on first sight.
- **Why it matters:** on ANGLE/D3D a first-use compile can take tens of milliseconds. It lands exactly on the biome's signature moment, the first front rolling in, and on the cinematic owner's turf.
- **Fix direction:** create the dome (at opacity 0) and show the wall during `showAllForWarmup`. Or call `renderer.compile` on them explicitly.

### F-5 (Minor). GPU overdraw in storms from layered transparent surfaces, and the cloud deck still shaded when invisible
- **Layers in a storm** (from the code):
  - the storm dome (full-screen, opacity up to 0.97, `Environment.ts:276-280`);
  - the cloud deck (sky pixels, 8 value-noise lookups per pixel, `sky.ts:237-238`);
  - per blizzard cell, 4 curtains of 142 × 26 m with two noise lookups per pixel (`hazardViews.ts:207-214`);
  - 1400 point sprites of 0.55 m per cell, which are about 200 px across at 1 m on 720p (`hazardViews.ts:189, 202`);
  - blowing snow (6000 streak quads on `high`);
  - 3000 ambient flakes;
  - plumes and lamps.
  - Up to about 6 full-screen blended layers inside a blizzard during a front.
- **The deck:** inside a storm its alpha is `uFade` = 0 (`sky.ts:369`), but `deck.visible` is never set false. The noise shader runs over the sky for no visible output.
- **Tiering:** blizzard flakes (1400) and plume grains (70) are not tiered. Only blowing snow and snowfall scale with quality.
- **Fix direction:**
  - Set `deck.visible = uFade > 0.01`.
  - Tier the blizzard flake counts and curtain counts by quality.
  - Cap the point-sprite size near the camera.

### F-6 (Minor, evidence process). The perf evidence does not fully cover the shipped risk
- `prod_frames.mjs` measures only the simulation step. Render submission and uploads are excluded, and the tool says so.
- It runs only on `high` and Relaxed.
- No log records a SHA. The candidate and the evidence agree only because `src` is unchanged.
- `endless_memory.mjs` runs on `medium`, teleporting 1 km at a time with 12 frames per stop. It shows that resource counts are bounded (478–589 geometries, heap 62–94 MB, no trend), which I accept. It does not exercise per-frame weather or retries.
- The developer's README says the CPU profile was "not yet attributed". The headless approach used here attributes it in under a minute.
- **Fix direction:**
  - Record the SHA and quality in each log.
  - Add a `low`/Normal run.
  - Add the subsystem breakdown (as above) to the perf tool.

## Stability and lifecycle: what I verified
- **Retry (W-031):** `whiteout_rerun.spec.ts` asserts on run 2 that the environment bases equal the look, that the flake size stays in range, and that the cave-leap luminance σ > 25. It passes in `e2e.txt`, as do the Alpine and Fjord sun-on-retry cases.
  - In code, the bases now come from the location's look.
  - `GameSession.dispose` resets the ambient and sun scales (`GameSession.ts:1377-1378`).
  - `resetTrophy` clears `weatherOverride` and `weatherFade` (`World.ts:437-439`).
  - `StormSky` survives a retry safely: the clock step is clamped to [0, 0.1] (`sky.ts:351`).
- **Disposal:** a headless sprint and Endless world, streamed 3–4 km then `dispose()`d.
  - About 2,100–2,400 geometries were created; only 4 geometries, 2 materials and 3–4 textures were left.
  - All of them are module-level singletons (the wand cylinder, the plume `PointsMaterial`, the cornice material, the flake and lamp canvas textures, and my own fake scan geometry). They are bounded and do not grow per run.
  - Chunk drops dispose the per-chunk lamp material, the geometry and the instanced meshes (`scenery.ts:197-205`).
- **Lights:** 5 lights on sprint at start and end (sun, hemisphere, and three at the rescue station), 2 on Endless. No light is added mid-run, so there is no lighting-program recompile.
  - The rescue station's two point lights and one spot light (`rescue.ts:370, 442, 520`) are always on, so every lit fragment on the course evaluates them. This is the same pattern as Alpine's Resort; noted only.
- **Errors:** none in any of the three perf runs, the Endless run or the Whiteout e2e specs.
- **Allocation:** the per-frame Whiteout code is essentially free of allocation: uniform writes, preallocated typed arrays, and a `forEach` closure in the blizzard view. Heap stays flat.

## What is good
- The weather model is pure and deterministic, keyed to the physics clock. Blowing snow is fully GPU-animated with tiered counts.
- The streaming budget and starvation guard are sound. Endless memory is bounded. The retry lifecycle was fixed properly rather than patched.
- Disposal paths are complete.

## What would raise Performance and stability to 9
1. **F-1:** precompute the plume heights, skip hidden or distant plumes, and add a CPU guard test. Expected: Whiteout's median CPU step drops to about Fjord's (around 3 ms), and the 14 ms plateaus become rare.
2. **F-2:** cull the ridge rocks per chunk, drop shadows on the flank and rim rocks, add an LOD scan, and tier the counts.
3. **F-3:** budget the scenery chunk builds.
4. **F-4:** pre-warm the storm dome and wall.
5. **F-6:** re-measure on the fixed build at `high` and `low`, with the SHA recorded. Targets: median under 3 ms, fewer than 0.2 % of frames over 16 ms, no frames over 33 ms outside cinematics. Then repeat the scene-composition count.
