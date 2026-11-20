# Review D: Technical and Performance Engineer, Whiteout Ridge, round 2

- **Reviewer:** D (Technical and Performance). I am a model-based reviewer, not a human playtester. I did not play the game in real time.
- **Build:** candidate `b70a793` (branch `pass5-whiteout`). The checkout is at `49bb459`, and `git diff b70a793 49bb459 -- src tests` is empty. Round 1 was `3f7bc45`. I read `git diff 3f7bc45 b70a793 -- src` in full for the files in my area.
- **Category owned:** 6, Performance and stability.
- **What I examined:**
  - `round-2/perf/`: the README, the raw `step` arrays in `frames_{alpine,fjord,whiteout}.json` and `frames_whiteout_w038.json`, `endless_whiteout.json`, and `audio.json`. I recomputed every statistic I use.
  - The tools `tools/prod_frames.mjs` and `scratch/census.mjs`.
  - Source:
    - `hazardViews.ts` (drift plume, gap markers, blizzard)
    - `ridgeRocks.ts`, `scenery.ts`, `sky.ts`, `blowingSnow.ts`, `stormCave.ts`, `storm.ts`
    - `World.ts`, `Environment.ts`, `Vegetation.ts`
    - `physics/obstacles.ts`, `hazards/field.ts`, `Hud.ts` (caption queue), `audio/logic.ts`, `GameSession.ts`
  - Screenshots 03 and 29.
- **My own experiments** were headless Vitest runs under `/tmp/woperf2`. They use the repo's `domStub` and `fakeRenderer`, and in one census a mocked `loadScan` that returns a 5,040-triangle unit mesh. Nothing in the repository was modified.
  - The machine was shared with other reviewers' jobs (load average about 4 on 2 CPUs). Absolute single-frame maxima from my runs are therefore noisy.
  - I rely on per-subsystem means, call counts (which are deterministic) and the developer's Chrome data for frame-time claims.
- **GPU timing is unavailable.** The machine renders with SwiftShader. Every GPU statement below is a judgement from scene composition (triangles, draws, shadow casters, transparent layers), not a measurement.

## Verdict

**FAIL** for category 6: **7/10** (round 1: 6) against the 9/10 target.

The round-1 blocker W-038 is genuinely fixed. I reproduced it: the steady-state CPU cost of the Whiteout simulation is now at Alpine and Fjord level. Memory and disposal remain clean.

Three things keep the score below 9:
1. **The round-2 cave architecture added a new worst-frame hitch.** It is a 53–67 ms single frame in Chrome every time a cave is dressed mid-run in Endless.
2. **The GPU load is about 5× the sibling locations.** I under-counted this in round 1. Whiteout draws roughly 9.8 M triangles per frame (main plus shadow pass) against about 2.0 M for Alpine, and about 6.8 M even on `low`. Almost all of it is 5,000-triangle scanned boulders. The W-052 ridge-rock culling removes only a small part of it.
3. **Most of the W-053 items are untouched.**

## Scores

| # | Category | R1 | R2 | One-line justification |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 7 | 7 | Not assessed beyond code (owned by A). |
| 2 | Environmental uniqueness (lc) | 8 | 8 | Not assessed (owned by A). The cave architecture is a real addition in code. |
| 3 | Skiing and hazard mechanics (lc) | 7 | 7 | Not assessed (owned by B). Hazard physics stays cheap (env.sample about 0.07 ms per frame). |
| 4 | Difficulty and fairness (lc) | 7 | 7 | Not assessed (owned by B). |
| 5 | Cinematics (lc) | 7 | 7 | Not assessed (owned by C). The first-front dome compile (round-1 F-4) is still there. |
| **6** | **Performance and stability** | **6** | **7** | CPU steady state is fixed: median 7.5 → 0.7 ms, frames over 16 ms 1220 → 18, no plateaus. New 53–67 ms cave-dressing hitch in Endless. GPU load is about 5× Alpine on every tier and largely unculled. Synchronous scenery and the storm compile are unchanged. Stability and memory are good. |
| 7 | Accessibility and controls (lc) | 7 | 7 | Not assessed (owned by E). |
| 8 | Overall player experience (lc) | 7 | 7 | Not assessed (owned by F). On integrated GPUs, finding N-1 is the likeliest thing a player would feel. |

The (lc) scores are unchanged placeholders and should carry little weight.

## Measured evidence (developer Chrome data, recomputed by me)

These are the raw `step` arrays from 12 km of Endless at `high`, Relaxed, production bundle. They measure CPU simulation only; render submission is excluded.

| | median ms | mean | p95 | p99 | p99.9 | max | > 16 ms | > 33 ms | frames < 1 ms | runs of ≥ 10 frames > 12 ms | 1000-frame window medians |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Whiteout R1 | 7.5 | 8.28 | 15.3 | 17.6 | 23.7 | 55.7 | 1220 | 11 | 0 % | 135 | 3.3–11.0 |
| Whiteout W-038 build (`bb3d566`) | 0.8 | 2.88 | 8.2 | 9.4 | 14.8 | 35.6 | 24 | 1 | 56.5 % | 0 | 0.5–1.85 |
| **Whiteout R2** | **0.7** | **2.63** | **8.0** | **8.7** | **13.5** | **67.4** | **18** | **2** | **62.6 %** | **0** | **0.5–1.0** |
| Fjord R2 | 2.9 | 3.60 | 8.9 | 10.6 | 14.2 | 25.2 | 19 | 0 | 47.1 % | 0 | 0.2–6.6 |
| Alpine R2 | 0.4 | 1.95 | 7.1 | 7.5 | 9.3 | 16.8 | 2 | 0 | 71.6 % | 0 | 0.3–0.4 |

The README's table matches the raw data. Its claim "the same level as Fjord (19)" for frames over 16 ms is correct. **It does not explain the 67.4 ms maximum, the worst frame of any run in either round.** I traced it (N-2).

## Round 1 → round 2

### F-1 / W-038 (Major, blocking): drift-plume CPU cost. **Fixed (verified).**

**Code** (`hazardViews.ts:151-167, 190-205`):
- Each grain's ground height is sampled once, at K = 5 points along its crest track, when the view is built. It is then linearly interpolated by `life`.
- The update returns early while `!plume.visible`.
- One correction to my round-1 wording: the old query was not strictly time-invariant. The grain slides `jit·1.8` m (at most 3.6 m) along the crest over its life. The 5-point track handles that correctly.

**My headless attribution** (same harness as round 1, 4000 frames at 20 m/s, Endless, `high`):

| | R1 | R2 |
|---|---|---|
| `hazardViews.update` ms per frame | 4.71 | **0.25** |
| `view:wind-drift` ms per frame | 4.62 | **0.142** |
| `heightAt` calls per frame from drift views | 1865 | **0** |
| Whole-frame median (same run; Fjord 0.16) | 5.35 | 0.40 |

**Repo test:** I ran `whiteout_drift_plume.test.ts` from `/tmp` and it passes. 120 frames × 6 drifts × 70 grains = 50,400 calls, matching the claim. Heights are within 5 cm of the replaced formula.

**Plume behaviour** (my experiment: 187 drifts on 4 seeds, 240 frames each, compared against terrain plus the drift's own `driftProfile`):
- **Not static.** The position buffer changed on 44,693 of 44,693 frames.
- **Not mis-grounded relative to round 1.** It reproduces the old heights.
- **Inherited trajectory issue (Minor, not a W-038 regression).** The height is the ground under the crest line. The grain, however, travels up to 6 + 1.6 m into the lee (which is downhill) and 2.5 m along world +x. Clearance above the snow under the grain:

| life | median clearance | p95 clearance | max | share > 3 m |
|---|---|---|---|---|
| 0.0–0.1 | 0.44 m | — | — | — |
| 0.5–0.6 | 2.51 m | 3.90 m | — | — |
| 0.9–1.0 | 2.96 m | 4.54 m | 7.4 m | 48.6 % |

  - The arc formula (`+1.4·life − 1.6·life²`) was meant to fall back to the snow; on a slope it ends about 3 m up.
  - The material has no per-grain fade, so grains vanish at that height and respawn at the crest.
  - 12.7 % of grains are born inside the mound.
  - The x drift is +x regardless of the front's `dir` (`windX = f.dir·speed`, `storm.ts:282`).
- **Screenshots:** the README says "no floating grains were seen". At 720p, frames 03 and 29 do not resolve the plumes at all, so the stills can neither confirm nor refute that.

### F-2 / W-052 (I rated Major; consolidated as minor): ridge rocks. **Partly fixed.**

**Code:** `im.computeBoundingSphere(); im.frustumCulled = true` (`ridgeRocks.ts:221-224`). Nothing else changed:
- every rock still has `castShadow = true`;
- there is no LOD;
- there is no tiering (`low` has identical counts).

**My measurement** (40 poses down Endless, gameplay-like camera with fov 60 and 16:9, and the real sun shadow camera):
- **Main pass:** 131 live instances (662 k triangles). Three still draws **582 k triangles (−12 %)**. The rocks actually inside the view number 89 (450 k), so culling could not do much better here; only an LOD helps.
- **Shadow pass:** three draws **≈ 390 k triangles (−41 %)**. Only 14.4 instances (73 k) are actually inside the 110 m shadow frustum on `high`, and 9.6 (48 k) on `low`.
- **Why so coarse:** each mesh spans a 256 m chunk from the crest tors to the flank buttresses 70–290 m out. Bounding-sphere radii have a **median of 222 m and a maximum of 402 m**, so the culling works at chunk level only.

The README's "Scenery meshes with culling disabled 25 → 7" is consistent with the 18 ridge meshes (6 chunks × 3 scans) now being cullable. It does not mean they are culled effectively.

### F-3 / W-053a: synchronous scenery chunks. **Not fixed.**

`WhiteoutScenery.stream` still builds whole chunks inline (`scenery.ts:131-138`), with no `pending`/`pump`, and `RidgeRocks.stream` still rebuilds every live chunk when a scan arrives. I measured 13 builds: median 5.0 ms, max 44 ms (round 1: 3.9 / 26.2 on a quieter machine; the code is unchanged).

### F-4 / W-053b: storm dome and wall not shader-warmed. **Not fixed.**

- The dome is still created lazily on the first `storm > 0` (`Environment.ts:273-279`).
- `showAllForWarmup` (`World.ts:475-479`) still covers only vegetation and hazard views.
- The wall is now shown only beyond 300 m (`sky.ts:234`), so it is also off at load unless a front is already far out.
- The new materials are partly covered:
  - The gap-marker material is compiled with the warm-up drift view in practice: the first drift was a lead on all 5 seeds I checked.
  - The cave-architecture materials are built at load in Sprint but mid-run in Endless.

### F-5 / W-053c: layered transparency and the deck shaded while invisible. **Not fixed.**

- `deck.visible` is still never cleared (`sky.ts:166-169`).
- Blizzard flakes (1400 per cell) and curtains are still untiered.
- The blowing-snow box is smaller (half-width 34 → 24, up 22 → 14, `blowingSnow.ts`), which reduces its overdraw volume.
- Storms are now much denser fog (`STORM_FOG.storm` 11 → 21). That hides most of the scene beyond about 120 m but culls none of it.

### F-6 / W-053d: perf evidence process. **Partly fixed.**

- The README names the candidate, and the W-038 file is labelled.
- Still missing:
  - The JSON summaries carry no SHA or preset.
  - There is still only a `high`/Relaxed run, no `low` run.
  - There is no subsystem breakdown in `prod_frames.mjs`.
- **`round-2/e2e.txt` does not exist**, although `round-2/README.md` lists it ("Browser suite | `e2e.txt`"). The evidence commit says "Browser suite results follow". So the W-031 retry regression has **no browser evidence on the candidate**.

### Stability items from round 1. **Still good (re-verified).**

- **Disposal:** a headless sprint and Endless world, streamed then disposed, leaves 5 geometries, 3 materials and 3–4 textures. All are bounded module singletons. The new ones are the gap-marker geometry and material.
- **Lights:** 5 at start and end on Sprint, 2 on Endless.
- **Endless memory, 40 km:** heap 62.7–84.1 MB, geometries 482–583, no trend, no errors (round 1: 62–94 MB, 478–589).
- **Retry code paths** are unchanged from round 1, apart from the new `weatherFx.scale`. That is set from the settings at app start and on settings change, so it does not leak across runs.

## New findings

### N-1 (Major, release-blocking for category 6). Whiteout's scanned obstacle boulders put about 5× Alpine's triangle load on the GPU, on every tier

This is pre-existing but newly identified. I missed it in round 1 because my headless census had no scans loaded for `Vegetation`. My round-1 figure of "3.09 M" was wrong for the shipped scene.

**Where:**
- `whiteout/biome.ts:108` sets `rocks.scan` (the only location that does), with `obstacles.rocks: 1.5`.
- `Vegetation.ts:106-121` replaces every near-LOD obstacle rock with a 5,000-triangle scan.
- The near ring is 185 m on `high` and 100 m on `low` (`Vegetation.ts:85`). There is no intermediate LOD inside it.
- Rocks cast shadows out to `shadowDist` (120 m on `high`).

**Measured** (my census with a 5,040-triangle mocked scan, 12 poses, Endless; "main + shadow" counts what three would submit, using per-mesh bounding spheres):

| | visible-flag triangles | after view frustum | shadow casters in shadow frustum | **main + shadow** |
|---|---|---|---|---|
| Whiteout `high` | 8.42 M | 4.78 M (465 draws) | 5.02 M | **≈ 9.8 M** |
| Alpine `high` | 2.05 M | 1.09 M (349 draws) | 0.88 M | ≈ 2.0 M |
| Whiteout `low` | 5.68 M | 3.52 M | 3.26 M | **≈ 6.8 M** |
| Alpine `low` | 1.40 M | 0.75 M | 0.53 M | ≈ 1.3 M |

- **Scan instances alone:** 6.9 M visible, 4.0 M in view, **4.6 M in the shadow pass** (the per-cell spheres are coarse against a 110 m shadow box).
- **Independent agreement:**
  - The developer's own census (`perf/README.md`) shows 6.75 M for props plus 1.02 M terrain plus 0.63 M scenery, about 8.4 M, which matches my 8.42 M.
  - Their last-frame renderer counter is **13.9 M triangles** for Whiteout against 1.66 M for Fjord and 1.82 M for Alpine.
- **Screenshot 03** shows hundreds of boulders on the right-hand slope.

**Player impact:**
- I cannot measure GPU time here.
- About 10 M triangles per frame at 60 fps is about 600 M triangles per second, before fragment cost. Fragment cost in a storm is up to about 6 blended full-screen layers (F-5).
- That is well beyond what integrated laptop GPUs sustain. Whiteout is likely to be GPU-bound well under 60 fps exactly where Alpine and Fjord are not, and `low` does not bring it into line.
- In a storm almost all of these rocks are invisible in the fog and still drawn.

**Fix direction:**
- A decimated scan LOD (about 500–800 triangles) beyond about 40–60 m inside the near ring.
- Procedural rocks, or a much smaller near ring for scans, on `low` and `medium`.
- Scan shadows only within about 50 m, or per-instance shadow culling.
- Tighter per-cell bounding spheres.
- Optionally, a storm-time LOD or draw-distance reduction tied to `visibility`.
- Then measure on one real integrated GPU (an Intel or AMD iGPU laptop) at `low` and `high`.

### N-2 (Major). The round-2 cave architecture costs a 53–67 ms single-frame hitch each time a cave is dressed mid-run (Endless)

**Where:** `stormCave.ts:233-246` (`buildStormArchitecture`):
- 29 `Raycaster.intersectObject(rock)` calls against the 41,542-triangle `cave-rock` mesh, with no BVH, to root the cornice columns.
- The Whiteout cave presentation has `dress` but no `dressSteps` (`World.ts:281-288`), so the whole dressing is built in one slice.

**Measured (mine):**
- The round-2 dressing build takes **75–120 ms** (outliers of 280–620 ms on the loaded machine), of which the 29 raycasts take 74.8–119 ms.
- The round-1 dressing (`git show 3f7bc45:…/stormCave.ts`, same context) takes **0.3–1.3 ms**.
- Its per-frame update afterwards is cheap (0.02–0.05 ms) and its disposal is complete (0 undisposed).

**Where it lands:**
- **Sprint:** the cave (anchor z 260) is built and dressed at load on all 3 seeds I tried, so there is no in-run hitch, only about 0.1 s more loading.
- **Endless:** the dressing is built while the skier is at z 5270 and z 11246.

**Corroboration (developer Chrome data):**
- The only two frames over 33 ms in `frames_whiteout.json` are 67.4 ms (frame 16168, 42.9 % of the run) and 53.1 ms (frame 35223, 93.5 %). These are about 5.1 and 11.2 km.
- Both are preceded by 13–16 ms cave-mesh slices: `[… 13.1, 16.2, 0.5, 67.4 …]`.
- The W-038 build, made before the cave architecture landed (`bb3d566` < `5dc2435`), had a maximum of 35.6 ms.

**Player impact:**
- On a fast desktop V8, a visible 4-frame freeze every 6 km in Endless, mid-chase.
- On a 2–3× slower laptop CPU, about 150–200 ms.
- It is now the worst frame in the build.

**Fix direction:**
- Root the cornice from the cave's analytic anchors or a low-poly proxy, or bake the root offsets.
- Alternatively, give the presentation `dressSteps` and do one ray per slice, or use a BVH.
- Add a guard test: a dressing build under 5 ms headless.

### N-3 (Minor). Obstacle clear zones put an unbudgeted 3–24 ms step at the start of every obstacle band

**Where:**
- `obstacles.ts:279` calls `clearings(m, seed, zA-60, zB+60)` before the generator's first `yield`.
- `hazardClearZones` caches the hazard bands but recomputes `WHITEOUT_WEATHER.clearZones` uncached on every call (`field.ts:207`).
- That function is `leeLaneAt` every 16 m on both sides, and `skiableAcross` does about 46 `heightAt` calls per side.

**Measured (mine, 40 bands):**
- First slice: median **0.45 → 3.50 ms**, p90 3.1 → 11.9 ms, max 5.7 → 23.8 ms. This is noisy, but the median shift is solid.
- The weather zones alone cost about 1,634 `heightAt` per band (median 3.0 ms).
- The per-cell `inZone` test (about 39 zones) is negligible.

**Impact:** this is a single slice that can exceed the 6 ms streaming budget (`World.ts:55`) on slower CPUs. It adds to the streaming hitches without being a constant cost.

**Fix:** cache the lee zones per band, as the hazard zones already are, or compute them in a later slice.

### N-4 (Minor). Small allocation and lifecycle items in new round-2 code

- **Per-frame allocation:** `Grains.update` (`stormCave.ts:84-85`) allocates a 3-element array per grain per frame via `pos.set([...])`. That is 720 grains in round 2 (it was 480), and it runs for every live cave dressing every frame, not only during the cinematic.
- **Rime InstancedMesh:** the rime `InstancedMesh` (`stormCave.ts:286`) is never `.dispose()`d. Its feather geometry is disposed, but its `instanceMatrix` GPU buffer (about 3 KB per dressing) is not released.
- **Caption queue:** `Hud.tickCaptions` creates a filtered array every frame while the soft line is free. This is trivial.
- **Audio:** `audio.json` shows source starts at about 22 per second (800 in 33 s, against 705 in round 1). These are one-shots with no live-node growth. The storm is +4.6 dB with peak 0.60, no clipping and no NaN.

### N-5 (Minor, evidence). Developer perf claims I could not fully verify

- The census in the README is in `scratch/census.mjs` and is not committed. Its key claim (about 8.4 M) agrees with my reproduction.
- The README presents the census as reassurance ("new round-2 objects are small"), but the census itself shows the dominant GPU risk (N-1).
- `e2e.txt` is missing (see F-6).

## What would raise Performance and stability to 9

1. **N-1:** bring Whiteout's main plus shadow triangle count to within about 1.5× of Alpine on each tier, with a scan LOD, a smaller scan shadow range and procedural rocks on `low`. Then get one real integrated-GPU frame-time measurement at `low` and `high`. This is the item that matters most.
2. **N-2:** take the raycasts out of the cave dressing, or slice them, and add a build-time guard. Target: no frame over 33 ms outside cinematics in the 12 km Endless run.
3. **W-052 remainder:** split ridge-rock meshes by family or sub-chunk so the bounding spheres are under about 60 m, drop shadows on the flank and rim families, and tier the counts.
4. **F-3 / F-4:** budget the scenery chunk builds, cache `corniceSamples`, and pre-warm the storm dome and wall (and the Endless cave-architecture materials).
5. **N-3:** cache the lee clear zones.
6. **Evidence:** commit the round-2 `e2e.txt` (W-031 rerun), record the SHA and preset in each perf JSON, and add a `low`/Normal frames run.

The CPU side already meets the bar I set in round 1: median under 3 ms, about 0.05 % of frames over 16 ms, and no plateaus. What is left is one hitch and the GPU budget.
