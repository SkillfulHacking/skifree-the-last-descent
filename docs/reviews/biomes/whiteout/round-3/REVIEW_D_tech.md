# Review D: Technical Quality, Performance and Stability, Whiteout Ridge, round 3

- **Reviewer:** D (technical quality, performance, stability). I am a model reviewer, not a human playtester, and I did not play in real time.
- **Build:** frozen candidate `46ed200` (branch `pass5-whiteout`, draft PR #9; the PR head on GitHub is `46ed200`). The checkout is at `2630fe6`, and `git diff 46ed200 HEAD -- src tests` is empty.
  - I rebuilt the production bundle into `/tmp` from this tree. Its `main-DMczoBWu.js` is byte-identical to `dist/` (`cmp`), so the committed evidence and my runs used the same bundle.
  - Round 2 was `b70a793`. I read `git diff b70a793 46ed200 -- src` for every file in my area. That covers 47 commits and 72 files.
- **Category owned:** 6, Performance and stability.
- **GPU timing is unavailable.** The machine renders with SwiftShader, a software rasteriser. Every GPU statement below rests on what is submitted (triangles and draw calls counted at the WebGL call), not on GPU time.
- **Machine:** 2 CPUs. I ran browsers one at a time, with no other jobs running (load average about 1 during the timed runs).

## Verdict

**Category 6: 8/10** (round 1: 6, round 2: 7). That is **one point below the 9/10 target, so FAIL by a narrow margin.**

The two round-2 Majors I raised are largely fixed, and I re-measured both:

- **W-069, scanned boulders.** Whiteout's submitted triangles (main pass plus shadow pass) fall from **9.12 M to 3.86 M per frame** on `high` (−58 %), and from **6.27 M to 1.84 M** on `low` (−71 %). Against Alpine that is **2.0×** on `high` (was 4.7×) and **1.6×** on `low` (was 5.5×).
- **W-070, cave-dressing hitch.** The Endless dressing frame falls from **67.4 / 53.1 ms to 22.8 / 21.3 ms**. No frame in 12 km of any location exceeds 33 ms.

Three things still keep the category below 9. None of them is a blocker on its own:

1. **The dressing is still one ~22 ms slice** (D3-1). It is the worst or second-worst frame of the Whiteout run, and about 3.5× the 6 ms streaming budget.
2. **The shadow pass is still 2× Alpine** (D3-2). The ridge rocks and the new rim spires are full 5,000-triangle scans with no LOD, and all of them cast shadows. The obstacle-boulder LOD is one level per preset, not a distance LOD. `ultra` keeps the full scans.
3. **Shader programs still compile mid-run** (D3-3). I counted 13 program links in 12 km of Whiteout. They include the cave-dressing materials at the first cave and storm materials as late as 10 km. This is W-053b, which has been open since round 1.

Stability is good:

- no page errors in any of my runs;
- deterministic frame counts (my rerun matched the developer's run frame for frame: 36,516 frames);
- disposal fixes landed (W-071);
- 40 km of Endless Whiteout: heap 67–90 MB and geometries 478–572 with no trend, no errors (section C).

## (a) Scores

| # | Category | R2 | **R3** | Justification |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 7 | 6.5 | Not assessed. The other reviewers give 6–7; A, who owns it, gives 6. |
| 2 | Environmental uniqueness (lc) | 8 | 7 | Not assessed. The cloud deck and the spires are real additions in code. |
| 3 | Skiing and hazard mechanics (lc) | 7 | 7 | Not assessed (B owns it). Hazard and weather simulation stay cheap: median frame 0.6 ms. |
| 4 | Difficulty and fairness (lc) | 7 | 7 | Not assessed (B owns it). |
| 5 | Cinematics (lc) | 7 | 7 | Not assessed (C owns it). The orbit and the hand-off allocate nothing that matters. The first cave's dressing materials still compile on first sight (D3-3). |
| **6** | **Performance and stability** | **7** | **8** | W-069: 9.1 → 3.9 M triangles on `high` (2.0× Alpine), 6.3 → 1.8 M on `low` (1.6×). W-070: 67 → 22 ms. W-071 done. The CPU steady state is the best of the three locations after Alpine. Remaining: a 22 ms dressing slice, a shadow pass 2× Alpine, mid-run shader compiles, and a failing SonarCloud gate (from a dev tool). |
| 7 | Accessibility and controls (lc) | 7 | 7.5 | Not assessed (E owns it). |
| 8 | Overall player experience (lc) | 7 | 7 | Not assessed (F owns it). On an integrated GPU, D3-2 is now the main thing a player could feel. |

## (b) Findings

### Round-2 items, re-verified

#### W-069 (round-2 N-1, Major): scanned-boulder triangle load. **Largely fixed; residual Minor in D3-2.**

**The change** (`src/world/art/scanModels.ts:43-99`, `src/world/Vegetation.ts:106-128`):
- Vertex-clustering decimation of the three obstacle scans, at one LOD level per preset.
- `low` uses the procedural rock; `ultra` uses the full scan (`SCAN_GRID`, `SCAN_ON`).
- Shadows and the near-ring radius are unchanged.

**Triangle counts per rock, measured** (my Vitest script against the shipped `.skm` files):

| Scan | full | `high` | `medium` |
|---|---|---|---|
| boulder_01 | 5,000 | 1,028 | 762 |
| namaqualand_boulder_02 | 5,000 | 1,460 | 1,030 |
| namaqualand_boulder_06 | 5,000 | 1,191 | 834 |

Alpine's procedural near rock has 320 triangles.

**Scene census, measured.** I hooked WebGL2 `draw*` calls in the production bundle and counted per frame, separately for the main canvas and offscreen targets (shadow maps).
- Setup: 8 poses from 700 m to 8,750 m of Endless, Relaxed, 3 rendered frames each.
- Round 2 was measured the same way on a `b70a793` build.

| Build / preset | main tris (mean) | shadow tris (mean) | **total / frame** | main draws (median) | shadow draws | × Alpine |
|---|---|---|---|---|---|---|
| Whiteout R2 `high` | 4.10 M | 5.02 M | **9.12 M** | 513 | 94 | 4.7× |
| **Whiteout R3 `high`** | 2.00 M | 1.87 M | **3.86 M** | 518 | 96 | **2.0×** |
| Whiteout R3 `medium` | 1.50 M | 1.32 M | 2.82 M | 453 | 84 | — |
| Whiteout R2 `low` | 2.75 M | 3.52 M | **6.27 M** | 378 | 75 | 5.5× |
| **Whiteout R3 `low`** | 1.08 M | 0.76 M | **1.84 M** | 385 | 77 | **1.6×** |
| Alpine R3 `high` | 1.03 M | 0.91 M | 1.94 M | 402 | 91 | 1 |
| Alpine R3 `low` | 0.61 M | 0.53 M | 1.14 M | 287 | 72 | 1 |

- The R2 `high` figure (9.1 M) agrees with my round-2 bounding-sphere estimate (about 9.8 M), so the two methods line up.
- The worst Whiteout `high` pose is 6.1 M (main 3.59 M plus shadow 2.50 M). Alpine's worst is 2.5 M.

**Player impact:** a 2.4× cut in what Whiteout asks of the GPU on the default preset. I cannot say whether an integrated GPU now holds 60 fps.

**Verdict:** the round-2 bar I set (within about 1.5× of Alpine on each tier) is met on `low` (1.6×, close enough) but **not on `high`** (2.0×). The shadow pass carries the excess (D3-2).

#### W-070 (round-2 N-2, Major): cave-dressing hitch. **3× better; residual Minor in D3-1.**

**The change** (`stormCave.ts:244-334`):
- `browTriangles` gathers the brow-band triangles once.
- `rayTris` intersects each column's ray against those triangles only.
- `corniceRoots` keeps missed columns in place (the Gitar fix).

**My measurement** (`/tmp/revD3/tools/frames_caves.mjs`, which is `prod_frames.mjs` plus the session's cave count per step, 12 km at `high`):
- The dressing slice lands 2 frames after each cave install, after a 0.8–0.9 ms frame:

| Location | Frames around the dressing (ms) |
|---|---|
| z 5,237 | `[7.1, 9.2, 0.8, **22.8**, 0.7]` |
| z 11,202 | `[9.8, 13.2, 0.9, **21.3**, 0.8]` |

- In round 2 these frames were 67.4 and 53.1 ms. The developer's run shows the same pattern (`[15.3, 0.6, **20.1**, 0.7]` at 93 %).

**Frame-cost table** (my rerun reproduces the developer's run):

| Whiteout 12 km `high` | median | p95 | p99 | p99.9 | max | > 16 ms | > 33 ms | 1000-frame window medians |
|---|---|---|---|---|---|---|---|---|
| R2 (dev) | 0.7 | 8.0 | 8.7 | 13.5 | 67.4 | 18 | 2 | 0.5–1.0 |
| R3 (dev) | 0.6 | 7.7 | 8.4 | 11.5 | 21.4 | 10 | 0 | 0.5–0.8 |
| R3 (mine) | 0.6 | 7.8 | 8.5 | 11.6 | 23.2 | 9 | 0 | 0.5–0.8 |

**The other locations on the same build** (developer data; I recomputed the statistics):

| Location | median | p99 | max | > 16 ms | > 33 ms |
|---|---|---|---|---|---|
| Fjord | 2.1 | 10.2 | 28.4 | 10 | 0 |
| Alpine | 0.4 | 7.5 | 19.0 | 3 | 0 |

**The test:** the guard (`tests/unit/cornice_roots.test.ts:37`) only asserts `gather + rays < Raycaster`. That is a relative timing on a synthetic sphere: it would pass a 50 ms dressing, and it can flake under load. Its own log shows `gather 18.6 ms (rays 10.37 ms) vs Raycaster 108.1 ms`.

#### W-071 (round-2 N-3/N-4, minor): perf minors. **Fixed (verified in code).**

- **Clear zones** are cached per band (`field.ts:213-230`).
  - The lee clear-zone grid (16 m steps from z = 0) divides `BAND` (256), so the band split samples the same points.
  - The overlap filter returns a small superset at band edges. That is harmless.
  - The cache is never evicted within a mountain. It holds about 4 bands per km of small arrays: unbounded in principle, but no growth shows over 40 km (section C).
- **Per-grain allocation:** `Grains.update` now writes the buffer in place (`stormCave.ts:88-98`).
- **Rime instances** are disposed: `fm` is pushed to `disposables` (`stormCave.ts:448`).

#### W-052 remainder (ridge rocks) and W-053 (misc perf). **Not addressed this round.**

- **Scenery chunks:** still built synchronously (`scenery.ts:136-143`).
- **`showAllForWarmup`:** still covers only vegetation and hazard views (`World.ts:475-479`).
- **Ridge-rock bounding spheres:** still chunk-wide.
- **Tracker:** W-053 is still `OPEN`, which is honest.

### New findings

#### D3-1 (Minor). The storm-cave dressing is still built in one ~22 ms slice

**Where:** `src/world/biomes/whiteout/views/index.ts:25` registers the storm cave with `dress` only, no `dressSteps`. `World.installCave` (`src/game/World.ts:279-291`) therefore runs the whole `dressStormCave` in a single generator step.

**Profile:** a CDP CPU profile of the dressing frame at z 11,243 (`/tmp/revD3/caveprof.json`) gives a 25.5 ms frame (with profiler overhead):

| Function | ms |
|---|---|
| `stepDressing` | 18.0 |
| `buildStormArchitecture` (inclusive) | 16.8 |
| `browTriangles` | 7.8 |
| `rayTris` + `corniceRoots` | under 1.5 |

- The rest is geometry, material and canvas setup.
- `browTriangles` walks every vertex and every triangle of the 41.5k-triangle rock, even though it keeps only about 1,100.
- **New in round 3:** the 256×256 spindrift canvas. It draws 140 wisps × 9 tile copies = 1,260 gradient strokes. Rasterising it alone takes 3–7 ms in Chrome (my microbenchmark).

**Player impact:**
- **Endless:** about a 22 ms frame every ~6 km, mid-chase, on a fast desktop V8. That is a dropped frame at 60 Hz, and roughly 45–65 ms on a laptop CPU 2–3× slower.
- **Sprint:** the cave is dressed at load, so there is no in-run cost.

**Fix:**
1. Give the storm cave a `dressSteps` generator, as `FJORD_SEA_CAVE` has (`fjord/views/index.ts:26`), using `dressingTicker(4)`. Yield after `browTriangles`, after the roots, after the sheet textures and after the feathers.
2. Make the spindrift texture a module singleton. It is the same every time; `lampTexture()` already works this way.
3. Make the guard test absolute: a dressing build under 8 ms in any one slice, measured by slice.

#### D3-2 (Minor; residual of W-069 and W-052). Whiteout's shadow pass is 2.05× Alpine's, and `ultra` keeps the full scans

**Measured** (census above):
- **Shadow pass:** 1.87 M triangles (Whiteout `high`) against 0.91 M (Alpine `high`).
- **Main pass:** 2.00 M against 1.03 M.

**Contributors in code** (I did not attribute per mesh):
- **Ridge rocks** (tors, rim, flank) and the **round-3 rim spires** (`ridgeRocks.ts:151-193, 266-287`):
  - all use the full 5,000-triangle scans;
  - all have `castShadow = true`;
  - none has an LOD;
  - none is tiered by preset.
- **The spires** add about 1–2 instances per 100 m. They are huge (tens of metres tall) and cast long shadows. They now get their own `InstancedMesh` per chunk, which is good for culling.
- **Ridge-rock bounding spheres** remain chunk-wide (round 2: median 222 m), so their shadow culling is coarse.
- **The obstacle boulders** are one LOD per preset: about 1,200 triangles on `high`, everywhere inside the 185 m near ring. They still cast shadows to 120 m.
- **`ultra`** is a selectable preset (`App.ts:637`). There `SCAN_GRID.ultra = 0` gives full 5,000-triangle scans in a 280 m near ring with shadows to 160 m. That is the round-2 load, or more, for anyone who picks Ultra.

**Player impact:**
- On the default `high`, Whiteout asks about 2× Alpine's geometry work, and the excess is mostly shadow-map work.
- I cannot say whether that crosses 16.7 ms on an integrated GPU.
- On `ultra`, a mid-range discrete GPU may struggle in Whiteout where it does not in Alpine.

**Fix:**
- A second, coarse scan LOD (about 300–400 triangles) for the ridge and spire families and for obstacle boulders beyond about 60 m. The decimator already exists: use grid 6–8.
- `castShadow = false` on the flank and rim families, or a shadow-only proxy.
- Cap `ultra` at the `high` LOD for scans, or at least the near-ring distance.
- Then one real integrated-GPU frame-time capture on `low` and `high`.

#### D3-3 (Minor; W-053b quantified). Shader programs compile mid-run: 13 program links in 12 km of Whiteout `high`

**Measured** (`/tmp/revD3/tools/progs.mjs`):
- Method: hook `linkProgram` after `startRun`, then walk Endless in 150 m teleports with 40 simulated frames and 2 rendered frames at each step.
- Program links counted, by distance:

| z (m) | Programs linked |
|---|---|
| 250 | 1 MeshStandard |
| 400 | 1 Points |
| 550 | 1 ShaderMaterial, 1 Points |
| 1,000 | 3 MeshStandard + 1 MeshBasic (the first cave's dressing: cornice, rime, bank, sheet) |
| 1,450 | 1 MeshDepth (a shadow variant) |
| 1,600 | 1 ShaderMaterial |
| 6,400 | 1 Points |
| 7,450 | 1 ShaderMaterial |
| 10,000 | 1 ShaderMaterial |

- In the CPU profile above, a render frame right after a dressing spent **81.6 ms in `getProgramInfoLog`**, a synchronous wait on a program link. That is SwiftShader; a real driver is faster but still typically tens of ms.
- **Contributing factors:**
  - three's `renderer.debug.checkShaderErrors` is left at its default (`true`), and nothing in `src` sets it. That forces the synchronous status query.
  - The ridge and spire rock materials can only compile after their scans load asynchronously. SonarCloud flags this pattern as "async operation in constructor" at `ridgeRocks.ts:237` and `Vegetation.ts:111`.
- **Caveat:** teleport walking is not identical to play. The count could differ somewhat in a real run.

**Player impact:** a handful of one-off hitches in the first 1–2 km, plus storm and cave first sights in Endless. Each costs tens of ms on real GPUs (unmeasurable here).

**Fix:**
- Extend `World.showAllForWarmup` to the storm dome and wall, the cloud deck, the blowing snow and a dummy cave dressing (or build one dressing at load and dispose it).
- Await the scan loads before the `renderer.compile` warm-up.
- Set `renderer.debug.checkShaderErrors = false` in production builds.
- Optionally use `compileAsync` (`KHR_parallel_shader_compile`).

#### D3-4 (Minor). The new round-3 objects are cheap, with two small notes

- **ValleyCloudSea** (`cloudSea.ts`):
  - Cost: 2 triangles, one draw, `frustumCulled = false`. The fragment shader runs 8 value-noise octaves and is depth-tested behind the opaque terrain.
  - It is hidden when `uOpacity ≤ 0.01`, that is in storms, so unlike the round-2 deck it does not shade while invisible.
  - Per frame: two terrain queries, no allocation. It is disposed.
  - Note: the plane spans 16 × 16 km in render space, and it is never compiled at load if the run starts in a storm (D3-3).
- **Rim spires:** see D3-2.
  - Building them adds up to 5 `seat()` iterations per spire to the synchronous chunk build (W-053a).
  - The new `for (const spire of …)` body is not re-indented (`ridgeRocks.ts:268-287`). That is a lint and readability issue.
- **Bank roll-down** (`course.ts:289-290, 340-344`): a constant-time branch in `heightAt`, with no measurable cost. Steady-state medians are unchanged.
- **valleyShade** (`snowMaterial.ts:401-409`): 2 smoothsteps and a length in the terrain fragment shader. That is negligible.
- **Presence cues** (`presence.ts`):
  - Per frame: a `{t, gap}` push and a 2 s window with `shift()`, which stays bounded at about 120 entries. There is also one result object per frame.
  - That is trivial GC churn with no GPU resources and nothing to dispose.
- **Orbit camera** (`orbit.ts`): `Timeline.ts:110` calls `orbitPose` without `out`, so it allocates one pose (2 vectors) per cinematic frame. That is trivial and only happens during cinematics.
- **Scan decimation at load:** `Vegetation.ts:113-117` decimates per variant (6 calls), but only 3 scans are distinct, so half the work (about 2–8 ms each) and half the geometries are duplicates. Cache by scan id.

#### D3-5 (Minor, CI). The SonarCloud gate fails on one Python dev tool, which is not the cause round 3 guessed

The GitHub check-run annotations API is readable from here, even though sonarcloud.io is not:

```
gh api repos/SkillfulHacking/skifree-the-last-descent/commits/46ed200…/check-runs
gh api …/check-runs/137341376114/annotations
```

They show:

- **The gate's failing condition is "C Security Rating on New Code (required ≥ A)".** It is C now, not the D that `CANDIDATE.md` states.
  - The one vulnerability is **"Path Traversal via command-line argument in `tension_summary.load()`" at `tools/tension_summary.py:12`**.
  - It was raised again after `15d9628`: Sonar does not treat the `realpath` + `commonpath` check as a sanitiser.
  - The `/tmp` changes in `15d9628` addressed hotspots, not the rating.
- **The other 22 annotations do not affect the rating:**
  - 7 × "Add at least one assertion" on `*.measure.test.ts`;
  - 2 × "async operation in constructor" (`Vegetation.ts:111`, `ridgeRocks.ts:237`), which relates to D3-3;
  - 6 × PATH-variable hotspots in tools;
  - 8 × `Number.NaN` / `Number.isNaN` style items.
- **Player impact:** none. It is a developer-only CLI that reads local files.
- **Fix:**
  - Exclude `tools/**` (and probably `tests/sim/**`) from Sonar analysis with a `sonar-project.properties` (`sonar.exclusions`), or mark the issue Safe in SonarCloud.
  - Or change the tool to accept a bare file name resolved under a fixed directory (`os.path.basename` + a constant root). Sonar recognises that pattern.
  - Correct `CANDIDATE.md` (D → C, and name the issue).

#### D3-6 (Minor, evidence). The perf evidence is better but still incomplete

**Good:**
- All three locations were run on the frozen SHA, at 12 km each, with no errors and zero restarts.
- `CANDIDATE.md` names the tool.
- My rerun reproduces the Whiteout run (same 36,516 frames; median, p99 and > 16 ms all within 0.1 ms or 1 frame).

**Still missing (round-2 F-6):**
- **No SHA or preset** inside `frames_*.json` or `.log`.
- **No `low` run.**
- **No README** in `candidate/perf/`, so there is no reading of the numbers.
- **The `renderer` block is a one-frame counter** (Whiteout 215 calls / 3.21 M triangles against Alpine 510 / 1.82 M). It is easy to misread as representative. My 8-pose census gives 518 / 3.86 M.
  - Also, `perf().triangles` reports only the last `render()` call. When the rear-view inset is up, that is the inset pass, without the main view.

**Tracker hygiene:**
- W-069, W-070 and W-071 say "CLAIMED (not yet reviewed)". That is correct pending this report.
- W-038 still reads "CLAIMED — awaiting reviewer D", although I verified it in round 2.
- W-017 (perf measurement) and W-016 (Endless memory) are still `OPEN`, although the evidence exists.

#### D3-7 (Minor, tests). `game.spec` flake and timing-relative guards

- **`game.spec`'s first run failed** at `game.spec.ts:85`: `intro` was still `true` after a Space press under CPU load. It passed when rerun alone. Keyboard presses are latched (`pressedQ`), so a lost press would mean the live loop consumed it. This looks like a harness race between the rAF loop and `frames()`, not a product bug. It has now happened in a candidate run, so pin it, for example with `hold(true)` around the press. (E owns this.)
- **Perf guards are relative or absent:**
  - `cornice_roots` compares against `Raycaster` (D3-1).
  - `scan_lod` asserts triangle ceilings per scan, which is good, but there is no scene-level triangle budget test.
  - There is no frame-budget test of `dress`.
  - A headless census test is the right fix. The round-2 `scratch/census.mjs` is still uncommitted.

### Code quality of the round-3 diff (summary)

**Good:**
- Comments are clear and cite the defects they fix.
- The pure helpers (`browTriangles`, `rayTris`, `corniceRoots`, `decimateUnit`, `orbitPose`, `ChasePresence`) have unit tests.
- Every new GPU object has a matching `dispose`: cloud sea, spire material, rime, sheet `alphaMap`, cornice material.
- `tsc` passes and the build is clean apart from the 1.5 MB chunk-size warning (`build.txt`).

**Weak spots:**
- `generateHazardBand`'s new `neighbours` recursion (`field.ts:67-72`) regenerates three neighbouring drift bands for every blizzard band, with no memo. It is cheap in the measured frame data (p99.9 11.5 ms), but it is quadratic-ish if more kinds start using it.
- The unindented block in `ridgeRocks.ts` (D3-4).
- Duplicate decimation (D3-4).
- Timing-relative test assertions (D3-7).

## (c) What I measured and how

All measurements were on the production bundle rebuilt from this tree into `/tmp/revD3/dist` (byte-identical to `dist/`), served by `vite preview :4471`. Chrome used SwiftShader, and I ran one browser at a time.

1. **Statistics recomputed from raw `step` arrays** (`/tmp/revD3/stats.py`), for round 3 and round 2, all three locations: median, mean, p95, p99, p99.9, max, frames over 16 and 33 ms, runs of 12 ms or more, window medians, and the worst frames with their context.
2. **Whiteout 12 km rerun with cave counts** (`frames_caves.mjs`, 1,162 s): this located the dressing slices (D3-1, W-070).
3. **CDP CPU profile** of two cave installs (`caveprof.mjs`), with self and inclusive time mapped to bundle offsets, which I checked against the minified source.
4. **Chrome microbenchmark** of the spindrift-canvas rasterisation and a `browTriangles`-shaped loop (`microbench.mjs`).
5. **GL-level triangle and draw census** (`census.mjs`):
   - It wraps `drawElements`, `drawArrays` and their instanced variants plus `bindFramebuffer`, counts main versus offscreen per frame, and counts frames by colour clears on the default framebuffer.
   - Setup: 8 poses (z 700 to 8,750), 120 simulated frames to stream at each pose, `hold(true)`, 3 rendered frames.
   - Runs: Whiteout `high`/`medium`/`low` and Alpine `high`/`low` on `46ed200`, and Whiteout `high`/`low` on a `b70a793` build (a git worktree in `/tmp`, removed afterwards).
   - The rear inset was not up in any sampled frame: three's last-render counter equalled main plus shadow.
6. **Mid-run shader link census** (`progs.mjs`): 12 km of Whiteout `high`.
7. **Scan LOD triangle counts and decimation time** (Vitest in `/tmp/revD3/vt`).
8. **Endless memory over 40 km of Whiteout** (`tools/endless_memory.mjs`, `medium`): see the table below.
9. **CI:** GitHub check runs and SonarCloud annotations for `46ed200` via `gh api`.
10. **Logs:** the `candidate/` logs are headed `46ed200`:
    - `tsc: ok`;
    - unit 489/489 (51 files);
    - all 11 e2e specs pass, `game` on its rerun;
    - the build log has no SHA line, but it was committed in `f7d4820` with the others.

**Endless memory, 40 km of Whiteout (`medium`, 1 km teleport steps, gc before each sample; `/tmp/revD3/endless_whiteout.json`):**

| | R2 (`b70a793`) | **R3 (`46ed200`)** |
|---|---|---|
| JS heap (MB) | 62.7–84.1 | **67.4–90.0** (mean of first 10 km 78.4, last 10 km 80.5) |
| Geometries | 482–583 | **478–572** (first 10 km 518, last 10 km 540) |
| Textures | — | **28–35** |
| Page errors | 0 | **0** |
| Outcome | ran 40 km | ran 40 km, no catch, caves live ≤ 2 |

There is no upward trend: the round-3 objects and the never-evicted clear-zone cache leave no measurable growth over 40 km. Stability is **verified**.

## (d) What I could not verify

- **GPU frame time** on any real GPU, whether integrated or discrete. Every GPU conclusion is a submitted-work comparison.
- **Per-mesh attribution of the shadow pass.** Ridge rocks, spires and boulders are inferred from code, not measured separately.
- **Shader-compile cost on real drivers.** The 81.6 ms is SwiftShader. Also, the teleport walk only approximates which first sights a real run hits.
- **SonarCloud's full issue texts.** I read only the annotation titles and the gate condition.
- **Visual regressions from the decimated scans** (vertex clustering on a 12³ grid). That belongs to A and F; I saw no captures dedicated to it.
- **Audio cost** of the new presence calls. They are one-shots, and I did not re-run an audio probe.

## What would raise Performance and stability to 9

1. **D3-1:** slice the storm-cave dressing (`dressSteps`) and make the spindrift texture a singleton. Target: no Endless frame over 16 ms outside cinematics in the 12 km run (it is 9 today).
2. **D3-2:** a coarse LOD for ridge, spire and far boulders, fewer shadow casters on the flank and rim families, and `ultra` capped. Target: Whiteout `high` within 1.5× of Alpine in the census, then one integrated-GPU capture.
3. **D3-3:** warm the storm, cloud and cave-dressing materials at load, compile the scan materials after loading, and set `checkShaderErrors = false` in production. Target: 0–2 program links after `startRun` in the 12 km walk.
4. **D3-5 and D3-6:** turn the Sonar gate green (exclude `tools/`), put the SHA and preset in the perf JSON, add a `low` run, and update W-038, W-016 and W-017 in the tracker.
