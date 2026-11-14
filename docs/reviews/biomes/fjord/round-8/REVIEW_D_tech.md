# Fjord Coast, Round 8: Reviewer D, Technical (performance, stability, asset pipeline)

## 1. Header

- **Reviewer:** D, technical. **Model-based reviewer (same model family as the developers; not external).** Not a human reviewer.
- **Build:** `d1f642b` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`). `HEAD` was `d1f642b` for the whole review; the only working-tree changes were the untracked round-8 evidence and other reviewers' reports. I changed no source.
- **Date:** 2026-11-13
- **Last review by me:** round 4 (`round-4/REVIEW_D_tech.md`, build `8d19542`).
- **Scratch:** `scratch/review-d-r8/` holds every script, log and JSON cited below.
- **Production bundle checked:** `dist/` (built 09:09 today). It contains round-8 code (`rkBandD`, `pinned against the rock`, exactly three `.skm` files), so it is the `d1f642b` build the evidence was captured from.

**What I ran on the candidate:**

- `npx tsc --noEmit`: exit 0.
- `round4_streaming`, `fjord_r4_integration` and `pin_rescue` unit tests: 12 of 13 passed.
  - `fjord_r4_integration` › "P-M6 hamlet houses…" **timed out** after 86 s against its 60 s limit. Load average was 6–9 on 2 CPUs. It is a timeout, not an assertion failure. The full suite verdict belongs to Reviewer E and `TESTS.md`.
- `frames8`: replay of the real `World.update` with a stub renderer, at the shipped 6 ms budget, 12 km each, measuring thread CPU time. It differs from my round-4 script and from the developers' harness in one way: a `fetch` stub serves the shipped `.skm` scans from disk, so the **scanned islands and cave boulders are actually built**.
  - Without the stub, `fetch(file://)` fails in Node and `ScanIslands` never places an island.
  - The developers' `perf/` run therefore **does not include the islands**.
- **Same-load A/B:** the round-4 tree (`git archive 8d19542` into scratch) and the candidate, interleaved Fjord r8 → Fjord r4 → Alpine r8 → Alpine r4. All four saw load average 6–9, so they are comparable with each other but not with my round-4 numbers (which were taken on a quieter machine).
- `endless8`: Fjord Endless, 40 km at 1 m per frame through the real `World`, with the islands built. One run tracked resource lifecycles; one measured the heap with gc and no tracker.
- `rockset`: ref-counting and colour-space test. Passes.
- `fine.py` / `period.py`: FFT of the `06` sea-wall crops in rounds 4, 7 and 8.

**Not run:** Playwright, the dev server, `vite build`. The brief forbids them.

**Evidence status when I finished:**

- `round-8/candidate/perf/` appeared during the review, but it holds only the developers' **headless CPU replay** (`frames_{fjord,alpine}_high.json`, `summary.json`).
- There is still **no production-build (browser) frame-time measurement.**
- `round-8/TESTS.md` had not appeared.
- I re-checked for about an hour after the last `perf/` file (13:58). Nothing more arrived.
- **Nothing in this report is a frame rate, a GPU time, an upload cost or a shader-compile time.**

## 2. Verdict

**FAIL** against the 9/10 target for Performance and stability. Score **8**, down from 8.5 in round 4.

**What the developers fixed (I verified each one):**

- **The distant cliff lattice is gone in practice.** Its amplitude in `06` fell from 0.96 to 0.23 grey levels, measured on the same crop.
- **Cliff materials no longer accumulate.** There are 2–3 live over 40 km of Endless; in round 4 it was 13.
- **The perf harness now measures the shipped 6 ms budget.**
- **The `06` method change holds up in the code.** The debug free camera is applied after `session.frame()` → `world.update()` (`App.ts:822` vs `GameSession.ts:1016`). Gameplay and cinematic cameras are set earlier in `frame()` (`GameSession.ts:258–368`).
- **Endless is still clean.** There were 0 undisposed resources after teardown and the heap stayed flat at 46–49.5 MB over 40 km.
- **The production bundle is still correct.** All assets are hashed and module-relative, with no absolute paths and no Poly Haven host.

**What pulls the score down:**

1. **A new, unbudgeted stall: Major.** The round-6 scanned-island rebuild (`ScanIslands.want`) runs synchronously outside the shared frame budget.
   - It cost **44.8, 59.3 and 66.3 ms CPU** in single frames, about every 4 km.
   - The candidate now has **3 frames over 33 ms per 12 km**. The round-4 tree under the same load had **none** (max 32.9 ms against 66.3 ms).
   - The developers' perf run cannot see this, because their harness never loads the scans.
2. **Fjord is still well behind Alpine** under the same conditions: 41 vs 7 frames over 16 ms, and 602 vs 90 over 8 ms, per 12 km. The remaining spikes are still the indivisible vegetation band build (round-4 defect 3, not fixed).
3. **Completion brief §8 is still unmet:** "measure performance in the production build" (F-033, OPEN).
4. **Round-4 minors still open:**
   - lossy normals;
   - no preload of the rock textures;
   - unused `gneiss` still shipped;
   - the conversion step still outside the repository;
   - island materials per water level now repeat the cliff-material growth that was just fixed (5 → 15 over 40 km).

## 3. Scores (technical point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 7.5 (low confidence) | The sea wall in `06` lost its regular dot lattice. It now reads as a smooth, nearly featureless surface: high-pass std 1.5 grey levels, against 4.3 in round 4. Islands load and render in production (`01`, `03`). Art judgement belongs to Reviewer A. |
| Environmental uniqueness | 8.5 (low confidence) | Scanned islands, the cliff kit, sea caves and the harbour are real coastal systems, not a reskin. |
| Skiing and hazard mechanics | 8.5 (low confidence) | The fixed 120 Hz physics step is unchanged. `pinWatchdog` exists and `pin_rescue.test.ts` passes. The physics audit belongs to Reviewer B. |
| Difficulty and fairness | 8 (low confidence) | Hazard-view queues stay 0–3 deep, so no late pop-in from streaming. The difficulty ladder belongs to Reviewer B. |
| Cinematics | 8 (low confidence) | The cave is still built during loading. The cave's scanned boulders arrive asynchronously and are added when the fetch resolves, so on a slow first load they can pop in. Reviewer C owns the look. |
| **Performance and stability** | **8** | No crashes or leaks in 64 km of replay plus Endless, and the heap is flat. Below 9 because of: the new 45–66 ms island-rebuild stall outside the budget (defect 1); Fjord at 6× Alpine's frames over 16 ms on the same machine (defect 2); still no production-build measurement (defect 3); and the open resource minors (defects 4–9). |
| Accessibility and controls | 8 (low confidence) | Not assessed; `TESTS.md` had not appeared. |
| Overall player experience | 8 (low confidence) | Stable. Expect an occasional visible hitch on long Fjord runs: one every ~4 km from the island rebuild, plus vegetation band spikes. |

## 4. Defects

### 1. Major (new, regression): scanned-island placement is a synchronous, unbudgeted rebuild costing 45–66 ms CPU per frame

**Evidence:**

- `src/world/art/scanIslands.ts:115-172`. `FjordScenery.stream()` calls `ScanIslands.want()` (`scenery.ts:115`) **outside** the shared `frameBudget`.
  - When the window slides it rebuilds the whole window (about 14.5 km of z by about 9.3 km of x, `coast.islandBlobs`).
  - Every candidate costs 1 + 10 `Mountain.heightAt` calls (the "landy" ring).
  - Blobs it **rejects** are never remembered, so they are re-tested on every rebuild.
- My replay at 12 km (`frames_fjord_high_default.json`, the `worst` list), at the same load as the controls:

| Frame z (m) | CPU (ms) | of which `islandsWant` |
|---|---:|---:|
| 10,255 | **66.3** | 66.3 |
| 2,064 | **59.3** | 58.2 |
| 6,192 | **44.8** | 44.8 |

- Same-load A/B, 12 km at the 6 ms budget (`chain.log`):

| Run | p50 | p99 | p99.9 | max | > 8 ms | > 16 ms | > 33 ms | starved turns |
|---|---|---|---|---|---|---|---|---|
| **Fjord, candidate `d1f642b`** (islands built) | 3.88 | 9.47 | 20.7 | **66.3** | 602 | 41 | **3** | 5,499 |
| Fjord, round-4 tree `8d19542` | 3.90 | 9.42 | 18.7 | 32.9 | 607 | 36 | 0 | 4,920 |
| Alpine, candidate | 2.49 | 7.00 | 12.5 | 23.3 | 90 | 7 | 0 | 125 |
| Alpine, round-4 tree | 2.28 | 7.63 | 11.9 | 19.7 | 130 | 4 | 0 | 91 |

- The browser does the same at start-up: each of the three scan fetches resolves separately, and each resets the window (`this.win = [1, 0]`) and rebuilds everything (`scanIslands.ts:104-109`). That is three full rebuilds, possibly after the run has started.
- At 60 Hz, a 66 ms CPU frame is about 4 dropped frames. That is a visible hitch at speed, and it recurs on every course longer than about 4 km.
- The developers' `perf/` cannot show it: in Node their harness's `fetch` fails ("island scan failed to load … not implemented"), so no island is ever placed.

**Fix:**

- Make placement incremental: only the new z range when the window slides. Drop islands that leave by key, as now.
- Cache the accept/reject decision per blob key, including rejections.
- Run placement as a generator under the shared `frameBudget`, like `cliffSegmentSteps`.
- Rebuild once, after all three scans have loaded (`Promise.all`), not once per scan.
- Add the `fetch` stub to the perf harness so `perf/` measures what ships.

### 2. Major (carried, round-4 defect 1 in part; F-007): Fjord streaming is still far heavier than Alpine on the same machine

**Evidence:**

- Same-load table above: Fjord has 41 frames over 16 ms per 12 km against Alpine's 7, and 602 against 90 over 8 ms.
- The developers' own `perf/summary.json` (16 km) agrees: **55 vs 4** over 16 ms, **5 vs 0** over 33 ms, max **38.8 vs 19.8** ms, starved turns **7,694 vs 136**, peak queued terrain jobs **290 vs 31**.
  - Their Fjord run overlapped other reviewers' load (Reviewer F, D16).
  - My interleaved runs control for that, and the ratio stands.
- Of my 41 Fjord frames over 16 ms, **34 are dominated by `vegetation.update`**: the indivisible band build, worst 28.3 ms of a 30 ms frame. This is round-4 defect 3, unchanged.
- Tracker F-007's "129→2" is still not reproduced by anyone on the candidate, including the developers' own round-8 run.

**Fix:**

- Slice `Vegetation.buildBand` into budgeted steps, as `generateBandSteps` did for obstacles.
- Cache the coastal `heightAt` per band column.
- The terrain backlog (290 queued against Alpine's 31) suggests the coast `heightAt` itself is the cost. Profile it and memoise per tile.

### 3. Major (carried, round-4 defect 1; F-033 OPEN): no production-build frame-time measurement, so completion brief §8 is unmet

**Evidence:**

- `round-8/candidate/perf/` contains only the headless Vitest replay (`frames.test.ts` with a stub renderer).
- No browser, `vite preview` or Pages measurement of `d1f642b` exists. The tracker itself lists F-033 as OPEN.
- There is still no Fjord browser Endless memory run either: `tools/endless_memory.mjs` is unchanged and still has no biome setting.

**Fix:**

- Run the production bundle (`vite preview` or the Pages deploy), Fjord and Alpine, same seed and route, on an otherwise idle machine. Report p50, p99, max, and frames over 16 and 33 ms. Label it SwiftShader CPU+raster, not GPU.
- Add a `biome` setting to `endless_memory.mjs` and run it on Fjord.

### 4. Minor (new, the same pattern as round-4 defect 5): island materials, one per water level, are never released

**Evidence:**

- `ScanIslands.material()` (`scanIslands.ts:85-93`) caches a `MeshStandardMaterial` per rounded water level and frees them only in `dispose()`.
- `endless8_fjord_high_heap.log`: `islandMats` was 5, 6, 8, 9, 11, 13, 14 and **15** at 5–40 km, while `cliffMats` stayed at 2–3 (that fix works).
- The cost is small: one shared program, since water level is a uniform, plus shared textures. But it is unbounded in Endless, and it is exactly the defect fixed for `CliffStream` this round.

**Fix:** reuse `CliffStream.want`'s "free materials no live mesh uses" pass in `ScanIslands.want`. Or pass the water level per instance or vertex and use a single material.

### 5. Minor (carried, round-4 defect 6): rock textures are not preloaded, and the placeholder swap is still fragile; the scans now load lazily as well

**Evidence:**

- `rockSetsReady()` (`rockMaterial.ts:124`) still has no caller in `src/`. The swap still writes a new image into a texture that was uploaded as a 1×1 canvas (`rockMaterial.ts:89-104`). It works only because the anisotropy change (1 → 4) changes three's texture cache key.
- New this round, two more lazy loads:
  - `ScanIslands` fetches its three scans in its constructor and rebuilds when they arrive.
  - `seaCave.ts:403` adds the cave boulders "when the shared scans arrive".
- None of these is awaited by `World.create`, so on a slow connection the islands and cave boulders pop in after the run starts.

**Fix:**

- Await `rockSetsReady()` and the location's scans (`loadScan` for each id) in `World.create` / loading.
- Use one scan cache. Today `scanIslands.ts` and `scanModels.ts` each keep their own `URLS` table and fetch, so each file is fetched twice.

### 6. Minor (new): sea-cave dispose disposes the shared, session-lifetime scan geometries

**Evidence:**

- `scanModels.ts:5` says the geometries "live for the session" and are shared by every user.
- `seaCave.ts:698-701` calls `geometry.dispose()` on **every** mesh in the cave group, and that includes the boulder meshes built from the shared `loadScan` geometry.
- three re-uploads a disposed geometry on its next use, so this works today. But it is an ownership violation: any cave still alive loses its GPU buffers for a frame and pays a re-upload.

**Fix:** skip meshes whose geometry came from `loadScan`, for example by marking them with `userData.shared` and checking it in `dispose`.

### 7. Minor (carried, round-4 defect 4): normal maps are still double-lossy WebP

**Evidence:**

- `src/world/art/textures/*` and `pack_scans.py` are unchanged since `ac5234a`. That is the round-4 state.
- My round-4 measurement therefore still applies: `rock_face_03` mean angular error 6.5°, p99 22.7°; `cliff_side` 5.3° and 21.7°.

**Fix:** store `*_nhr` as lossless WebP, or as KTX2/UASTC.

### 8. Minor (carried, round-4 defects 7 and 8, with a new wrinkle): provenance tooling is not reproducible, the documentation is stale, and unused assets ship

**Evidence:**

- The EXR→WebP step (`conv.py`) is still outside the repository.
- `tools/artbake/scan_to_skm.mjs` imports `meshoptimizer`. It is present in `node_modules` but **not declared in `package.json`**, so a clean install cannot rebuild the `.skm` files.
- The converter ignores glTF node rotation and parent transforms. That is acceptable for the three current scans, but it is a latent trap.
- `docs/ASSETS_AND_LICENSES.md` still says `cliff_side` is "the sea-cliff kit's MACRO layer". Since round 7 it is used only as the islands' macro layer (`cliffStream.ts:163`, `scanIslands.ts:87`).
- On the plus side, the `.skm` provenance table (pages, authors, CC0, removals) matches the shipped files: three files, `SKM1` headers, 5,000 triangles each.
- `dist/assets/gneiss_*.webp` (513 KB) still ships, and `dist/textures/` is still an empty directory.

**Fix:**

- Commit `conv.py` as `tools/artbake/convert_polyhaven.py`.
- Add `meshoptimizer` to `devDependencies`.
- Update the `cliff_side` row.
- Move `gneiss` behind a lazy import used only by `artCoast.ts`.

### 9. Minor (carried, round-4 defect 9): resident geometry keeps growing; the harbour budget is still not measured

**Evidence:**

- Fjord terrain on high is now **1,034 kt** against Alpine's 860 (+20%; round 4: 989 kt).
- On top of that come the cliff kit (peak 261 kt) and the islands: up to 43 live meshes × 5,000 triangles = **about 215 kt**. Each island is a separate draw call (not instanced), and there is no lower-detail variant on low quality.
- None of this is GPU-measured.

**Fix:**

- Instance the islands per scan id (three `InstancedMesh`es).
- Ship a 1.5k-triangle variant for distant islands and for low quality.
- Re-measure the harbour on low.

## 5. What works

**Distance fades fix the lattice.**

- The 9 m detail now fades to its own 1×1-mip mean between 225 and 630 m, with the normals fading too (`rockMaterial.ts:281-290`). The 11 m strata band hands over to a 70 m field past 300–800 m.
- The `06` wall FFT at the same crops:

| Round | Lattice amplitude (grey levels) | Visible at normal contrast? |
|---|---|---|
| 4 | 0.96, 1.03 | yes |
| 7 | 0.26, 0.38 | — |
| 8 | 0.23, 0.36 | no; only after a 1% autocontrast stretch (`crop06_r8.png`) |

**Correct normals on non-uniformly scaled scans.** `vRkN` now uses `transpose(inverse(mat3(modelMatrix)))` (`rockMaterial.ts:226`). That is correct for the islands' `(sx, h, sz)` scaling, and GLSL ES 3.0 is fine on three r187's WebGL2.

**Endless, 40 km with the islands built:**

- With the tracker: 0 geometries left undisposed before teardown (1 transient at 10 and 35 km).
- Without the tracker: the heap held at **46.0–49.5 MB** from 5 to 40 km.
- Cliff segments peaked at 20 (limit 24), and cliff materials at 3.
- After `World.dispose`: 0 undisposed resources without the tracker. With the tracker: 1 geometry, 6 materials and 2 textures, the same module singletons as in round 4.
- The heap growth seen in the tracked run (48.8 → 64 MB) is the tracker holding references, not the game.

**Pipeline correctness (unchanged from round 4, re-checked):**

- Albedo is sRGB; the data map is `NoColorSpace`.
- Normals are OpenGL with `flipY`.
- Textures use trilinear filtering, anisotropy 4 and mipmaps.
- Rock sets are ref-counted (`rockset.test.ts` passes).
- Textures are anchored to `ROCK_ORIGIN`.

**Pages paths.** The bundle uses `new URL(new URL('<name>-<hash>.ext', import.meta.url).href, import.meta.url)` for all 8 WebP and 3 `.skm` files. There are no absolute `/assets` paths, no `polyhaven` string and no runtime API call. `index.html` uses `./assets/…`.

**Save compatibility.**

- `git diff 8d19542 d1f642b -- src/progression src/core` is empty.
- The keys `skifree-tld.settings.v1`, `records.v1` and `records.v2`, and `progress` are unchanged, so no migration changed.
- The terrain changes (`course.ts` `rangeSoft`, the coast islands) change course geometry, not save formats.

**Stability.** There were no exceptions in 64 km of replay plus 80 km of Endless.

## 6. Round-4 defects and tracker items (by my own verification)

| Item | Status | Evidence |
|---|---|---|
| D r4 #1 / F-033: no production-build frame times; harness used 3.5 ms | **Partially fixed** | The harness now uses the shipped budget (`frames.test.ts:73-74`). Still no production-build measurement (defect 3). |
| D r4 #2 / F-026: cliff detail lattice at distance | **Fixed** (my area: tiling) | Lattice amplitude 0.96 → 0.23 grey levels; not visible in `06`. |
| D r4 #3: vegetation band spikes | **Not fixed** | 34 of 41 Fjord frames over 16 ms are dominated by vegetation (defect 2). |
| D r4 #4: double-lossy normals | **Not fixed** | Textures unchanged since `ac5234a` (defect 7). |
| D r4 #5 / F-034 (part): cliff materials per water level | **Fixed for cliffs; regressed pattern in islands** | `cliffMats` 2–3 over 40 km (was 13). `islandMats` 5 → 15 (defect 4). |
| D r4 #6 / F-034 (part): no texture preload, fragile swap | **Not fixed** | `rockSetsReady` has no caller; scans also lazy (defect 5). |
| D r4 #7: conversion step outside the repository | **Not fixed** | Plus an undeclared `meshoptimizer` dependency (defect 8). |
| D r4 #8 / F-034 (part): unused gneiss shipped | **Not fixed** | `dist/assets/gneiss_*` 513 KB; empty `dist/textures/`. |
| D r4 #9: harbour on low, resident triangles | **Not fixed / not measured** | +20% terrain against Alpine, plus about 215 kt of islands (defect 9). |
| F-007: streaming spikes, "129→2" | **Not reproduced (partial)** | Shared budget works; Fjord 41 vs Alpine 7 frames over 16 ms per 12 km, same load. |
| F-019: beam shader compiled mid-chase | **Fixed** (verified round 4; code unchanged) | `SnowballView` unchanged since `8d19542`. |
| F-021: pinned skier (stability side only) | **Present, not mine to verify** | `pin_rescue.test.ts` passes (3 tests). Reviewers B and E own the sweep. |
| F-036: islands from terrain-patch scans | **Fixed (asset side)** | Only the three boulder `.skm` files are in `src/` and `dist/`; the removals are documented. |
| Round-8 harness method change (`settle()`) | **Reasoning verified** | Free camera applied after the world update (`App.ts:822-826` after `session.frame` → `GameSession.ts:1016`). Gameplay and cinematic cameras are applied before it. `scenery.update` re-LODs the cliffs on a move of more than 80 m (`scenery.ts:279`). Rounds 5–7 `06` showed a LOD a player would not see from there. |

## 7. Public-preview gate (completion brief §10), my area

| Gate item | Status | Evidence |
|---|---|---|
| No critical defects / unrecoverable states in my area (crash, leak, save loss) | **Met** | No exceptions in 144 km of replay. Endless leak-free, heap flat. |
| Assets load in production | **Met (static)** | 8 WebP and 3 `.skm` files hashed and module-relative in `dist/`. The islands and the cave visibly render in the production-bundle shots (`01`, `03`, `07`). No subpath browser test exists. |
| Saves compatible | **Met** | Save code and keys untouched since round 4. |
| Endless streams reliably | **Met (headless)** | 40 km, bounded queues, flat heap. The browser memory tool is still Alpine-only (defect 3). |
| No major performance regression | **Not met** | New 45–66 ms unbudgeted island-rebuild frames. Under the same load the round-4 tree had none over 33 ms and the candidate has 3 per 12 km (defect 1). |
| Performance measured in the production build, compared with Alpine (§8) | **Not met** | No browser measurement (defect 3). |
| Asset pipeline correct (§4): colour spaces, normals, packing, triplanar, tiling, mipmaps, disposal, bundled only, provenance | **Met, with minors** | Tiling now met. Lossy normals, no preload, the shared-geometry dispose, material growth and the provenance tooling are open as minors. |
| All automated tests pass | **Cannot verify** | `TESTS.md` had not appeared. In my partial run one integration test timed out under load (86 s against 60 s). |

**Gate result for my area: not met.** The blockers are the new unbudgeted island stall (a performance regression) and the still-missing production-build measurement. Defect 1's fix is small and local.

## Reproducing

From `/home/claude/sf-fjord`:

```
BIOME=fjord|alpine Q=high KM=12 npx vitest run --config scratch/vitest.config.ts scratch/review-d-r8/frames8.test.ts --silent=false
scratch/review-d-r8/chain.sh          # same-load A/B against the round-4 tree in scratch/review-d-r8/r4tree
NODE_OPTIONS=--expose-gc [TRACK=0] KM=40 npx vitest run --config scratch/vitest.config.ts scratch/review-d-r8/endless8.test.ts --silent=false
python3 -I scratch/review-d-r8/fine.py "<png>@100,480,500,780" "<png>@200,150,450,350"
python3 -I scratch/review-d-r8/summ.py docs/reviews/biomes/fjord/round-8/candidate/perf/frames_*_high.json
```
