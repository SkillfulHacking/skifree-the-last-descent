# Fjord Coast, Round 4 (release decision): Reviewer D, Technical & Performance Engineer

## 1. Header

- **Reviewer:** D, technical. I am a **model-based reviewer (same model family as the developers; not external)**. I am not a human reviewer.
- **Build:** `8d19542` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`). `HEAD` was `8d19542` for the whole review, and the only working-tree change was the untracked `round-4/candidate/` evidence. I made no source changes.
- **Date:** 2026-11-12
- **Scratch:** `scratch/review-d-r4/` holds my scripts, logs and JSON.
- **What I could not verify:**
  - `round-4/candidate/perf/` did **not exist** when I finished. It was still being produced, so I have no browser or production-build frame-time data for the candidate.
  - `round-4/perf/frames_summary.json` is from code before the candidate (`7698f77` plus remediation, before the cliff/island integration). I treat it as pre-candidate.
  - The candidate shots were still arriving while I worked. I looked at `03`, `05`, `06` and `07`.
  - No GPU is available here. **Nothing in this report is a frame rate, a GPU time, an upload cost or a shader compile time.**
- **What I ran on the candidate tree:**
  - `npx tsc --noEmit` exited 0.
  - `tests/unit/round4_streaming.test.ts` and `fjord_r4_integration.test.ts`: 9 of 9 pass.
  - `frames4`: a frame replay of the **real `World.update`** with a stub renderer. It runs Fjord and Alpine, 12 km each, sequentially, and per-thread CPU time is measured.
  - `endless4`: Fjord Endless for 40 km at 1 m per frame through the real `World`. One run tracks the lifecycle and another records the heap with gc.
  - `rockset`: a unit test of ref-counting and colour spaces.
  - `nhr_fidelity`: the shipped packed normals compared with the original Poly Haven EXRs.
  - `period`: an FFT of screenshot crops.
- **Not run:** `vite build`, Playwright and the dev server. The brief forbids them.

## 2. Verdict

**FAIL** against the 9/10 target for Performance and stability. My score is **8.5**, the same as round 3, for different reasons.

What improved, by my own measurement:
- The round-3 Major (independent per-system budgets stacking up) is structurally fixed. There is now one shared 6 ms budget, handed out in priority order (`core/frameBudget.ts`, `World.stepStreaming`).
- On the candidate, Fjord's worst CPU frame fell from 55 ms to 19.7 ms, and there are no frames over 33 ms.
- Endless is clean: 0 leaked geometries over 40 km, the heap is flat (48.0 → 49.1 MB), and teardown leaves 0 undisposed resources.
- The Poly Haven pipeline is mostly correct. Colour spaces are right, the normals are OpenGL as shipped, roughness is linear, textures are ref-counted and released, and they are bundled with hashed names that resolve under any Pages subpath. No runtime API is called.

What keeps it below 9:
- **The brief's own requirement is unmet in the evidence:** "Measure performance in the production build" (§8). No candidate frame-time data exists.
- The developer CPU numbers (tracker F-007 "129→2", REMEDIATION "92→4") were taken on pre-candidate code with a **3.5 ms budget, while the game runs with 6 ms**. On the candidate I do **not** reproduce them:
  - Fjord: 14 frames over 16 ms per 12 km.
  - Alpine: 0 frames over 16 ms under the same conditions.
  - Fjord has 4× Alpine's frames over 8 ms.
- The cliff kit's 9 m detail tile repeats as a **visible regular lattice** on the sea walls in `06`. Texture tiling is one of the §4 items the pipeline must get right.

## 3. Scores (technical point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 7.5 (low confidence) | The scanned rock reads as rock at cave range (`07`). At long range the cliff wall shows a regular 9–10 px dot lattice: the detail tile repeating (defect 2). Floating hexagonal blocks sit above the cave mouth in `07`. Art judgement belongs to Reviewer A. |
| Environmental uniqueness | 8.5 (low confidence) | Authored cliff segments with a surf ribbon, sea caves, arms and islands are real coastal systems, not a re-skin. |
| Skiing and hazard mechanics | 8.5 (low confidence) | The physics step is still a fixed 120 Hz with an accumulator. I did not audit the `TERRAIN_CONTACT` rework (+390 lines), which belongs to Reviewer B. |
| Difficulty and fairness | 8 (low confidence) | Hazard views stay queued at most 1–3 deep in my replay, so there is no late pop-in. Balance belongs to Reviewer B. |
| Cinematics | 8 (low confidence) | The next cave is built while loading (`World.syncCaves`), so cave programs compile at load. The floating blocks in `07` need Reviewer C's look. |
| **Performance and stability** | **8.5** | The shared budget works, the tail is bounded (max 19.7 ms, none over 33 ms), and Endless is leak-free and heap-flat. Below 9 because: no production-build measurement; Fjord still has 14 vs 0 frames over 16 ms and 649 vs 160 over 8 ms against Alpine on the candidate; the published numbers do not measure the shipped budget; and two small resource issues (defects 5, 6). |
| Accessibility and controls | 8 (low confidence) | Not assessed beyond `TESTS.md` (19/19 browser tests on the candidate, run by the developers). |
| Overall player experience | 8 (low confidence) | Likely stable, with an occasional single-frame hitch on long Fjord runs. Distant cliff tiling is visible. |

## 4. Defects

### 1. Major: no production-build frame-time evidence for the candidate, and the published CPU figures do not measure the shipped configuration

**Evidence:**
- `round-4/candidate/perf/` was absent at the end of my review.
- `round-4/perf/frames_summary.json` and REMEDIATION Phase E were measured on `7698f77` plus remediation, before the cliff kit (`cliffStream`) and the island changes.
- That harness calls `w.update(1/60, time, focus, cam, 3.5)` (`round-4/harness/frames.test.ts:62`). The game calls `world.update(dt, time, focus, camera.position)` (`GameSession.ts:1013`), which uses the default `STREAM_BUDGET_MS = 6` (`World.ts:54`).
- My replay on the candidate (`scratch/review-d-r4/frames4.test.ts`), 12 km each at 0.5 m per frame, sequential runs on the same shared machine:

| Run | p50 / p90 / p99 / p99.9 / max (ms CPU) | > 8 ms | > 16 ms | > 33 ms | starved turns | resident terrain |
|---|---|---|---|---|---|---|
| **Fjord high, game budget (6 ms)** | 3.56 / 6.71 / 9.24 / 13.79 / **19.7** | **649** | **14** | 0 | 988 | 989 kt (+253 kt cliff kit) |
| **Alpine high, game budget (6 ms)** | 0 / 5.07 / 7.87 / 10.04 / 15.8 | 160 | **0** | 0 | 20 | 860 kt |
| Fjord high, harness budget (3.5 ms) | 3.30 / 5.30 / 7.92 / 16.22 / 30.5 | 207 | 25 | 0 | 3,891 | 956 kt |

- Developer claims: 4 frames over 16 ms per **24** km (REMEDIATION), and "129→2" (DEFECTS F-007). My candidate runs give 14 per **12** km at the game budget and 25 per 12 km at 3.5 ms.
- Machine load explains some of the gap. It does not explain the Fjord-versus-Alpine difference, because Alpine ran under the same conditions and had 0.

**Fix:**
- Run the production-build browser measurement on `8d19542`, Fjord and Alpine, with the same route and seed: p50, p99 and max frame time, and frames over 16 and 33 ms. Report it as SwiftShader CPU+raster, not as GPU performance.
- Make the harness use the game's budget (drop the explicit `3.5`), and re-measure the candidate rather than the pre-integration tree.

### 2. Major: the cliff-kit detail tile repeats as a visible regular lattice on the sea walls at distance

**Evidence:**
- In `candidate/06_long_distance.png` the left sea wall is covered in a uniform dot/grid texture. See my crops `scratch/review-d-r4/crop06_wall.png` and `crop06_wall2.png`.
- An FFT of high-passed crops (`period.py`) gives a dominant period of **9.9 px** at (100,480)–(500,780) and **8.9 px** at (200,150)–(450,350), with peak/median ratios of **85** and **49**.
- Snow and sky crops in `03` and `05` show no peak at that frequency. The period shrinks with distance, so it is a world-space repeat. At the hamlet's scale in `06` (about 0.8 m per px), 9–10 px is about 8 m: the **9 m detail tile** (`cliffStream.ts:163`, `tile: 9`).
- The macro scan (85 m, mip-biased) modulates luminance but does not break up the repeat. At that range the detail tile is about 11 px wide, so its low-frequency blob survives the mip chain and stamps every repeat.
- §4 lists "texture tiling" among the things the pipeline must get right, and "artificially repeated patterns" among the named failures.

**Fix:**
- Fade the detail albedo toward its mean, and the detail normal toward flat, beyond about 150–250 m (a distance-based or `fwidth`-based fade).
- Or randomise per-tile UV offset and rotation (stochastic or hex tiling) for the wall projection (`rk_tri` `ux`/`uz`).
- Or blend two detail tiles at incommensurate scales (for example 9 m and 23.7 m).

### 3. Minor: residual Fjord streaming spikes are mostly the indivisible vegetation band build

**Evidence:**
- In `frames_fjord_high_default.json`, 11 of the 14 frames over 16 ms are dominated by `vegetation.update`. The worst is 17.3 ms of vegetation in a 19.7 ms frame at z 2638, and 15–17 ms recur.
- Fjord is starved for budget 50× as often as Alpine (988 vs 20 turns), so the 6 ms budget is saturated on the coast.
- The developers already list this as open (REMEDIATION "Not done").

**Fix:** slice `Vegetation.buildBand` as was done for the obstacle bands (`generateBandSteps`). Cache the coastal `heightAt` per band column.

### 4. Minor: normal maps are double-lossy WebP (YUV 4:2:0), measurably softening and bending the scanned normals

**Evidence:**
- `tools_conv/conv.py` (outside the repository) writes `*_nor_1k.webp` with `lossless=False`.
- `tools/artbake/pack_scans.py:21` then re-encodes the normal X/Y + height + roughness pack as lossy RGBA WebP (`quality=84`). Lossy WebP subsamples chroma, so normal X, normal Y and height cross-talk.
- Against the original `*_nor_gl_4k.exr`, box-downsampled to 1K (`nhr_fidelity.log`):

| Set | Mean angular error | p99 angular error | 8-bit ideal (for comparison) | High-frequency energy of nx kept |
|---|---|---|---|---|
| `rock_face_03` | **6.5°** | **22.7°** | 0.18° | 54% |
| `cliff_side` | **5.3°** | **21.7°** | 0.18° | 64% |

- Roughness (alpha channel) is fine: mean absolute error 0.008 and 0.005.

**Fix:** store `*_nhr` losslessly (WebP lossless, about 2.4–2.7 MB per set), or as KTX2/UASTC. Keep the albedo lossy.

### 5. Minor: cliff materials accumulate, one per fjord-arm water level, and are never released in Endless

**Evidence:**
- `CliffStream.material()` (`cliffStream.ts:158-166`) caches one `MeshStandardMaterial` per water level and frees them only in `dispose()`.
- In `endless4_fjord_high_heap.log`: 3, 5, 6, 8, 9, 11, 12, **13** materials at 5–40 km, roughly 1 per 3 km and unbounded in Endless.
- They share one program (the water level is a uniform, checked in `rockset.test.ts`) and one texture set, so the cost is small: per-material renderer state and texture refs.

**Fix:** drop materials that no live segment uses (in `want()` and `install()`), or carry the water level per vertex and use one material.

### 6. Minor: rock texture loading is not preloaded, and the placeholder swap is fragile

**Evidence:**
- `rockSetsReady()` (`rockMaterial.ts:124`) has no caller. Texture fetch and decode, and the first real upload, happen whenever they finish, possibly after the run starts.
- The swap writes a new image into a texture already uploaded as 1×1 (`rockMaterial.ts:93-104`). three r187 only reallocates storage because the texture cache key changes (anisotropy 1 → 4; `WebGLTextures.getTextureCacheKey`). If the placeholder's anisotropy ever matched, the upload would hit an immutable 1×1 `texStorage2D`.
- The `basalt` set is held only by cave materials, so it may drop to zero references between caves and be re-decoded and re-uploaded mid-run. I did not verify this; it depends on cave overlap.

**Fix:**
- Await the location's sets in `World.create` (`rockSetsReady()`).
- Mark the placeholder disposed before the swap, or set the real texture objects into the shader uniforms.
- Hold a location-lifetime reference to the location's sets.

### 7. Minor: provenance is reproducible only from files outside the repository

**Evidence:**
- `ASSETS_AND_LICENSES.md:93-111` correctly records the pages, authors and CC0 for `cliff_side` and `rock_face_03`. I cross-checked the uploaded zips: they contain only `*_nor_gl_4k.exr`, so the OpenGL convention is correct.
- But the EXR→WebP step (`/home/claude/tools_conv/conv.py`, which writes linear normals and roughness: correct) is not in the repository. `pack_scans.py` expects `{name}_nor_1k.webp` inputs that the repository cannot produce.
- The cavity AO is derived from displacement, not taken from a scan AO. That is documented and acceptable.

**Fix:** commit `conv.py` as `tools/artbake/convert_polyhaven.py` and document the two-step chain.

### 8. Minor: unused assets shipped

**Evidence:**
- `dist/assets/gneiss_*.webp` (513 KB) is emitted because `URLS` references it statically. Only `artCoast.ts` uses it, and the game does not import `artCoast.ts`.
- `dist/textures/` and `public/textures/` are empty directories.

**Fix:** move gneiss into the art-scene build, or load it lazily through a separate module.

### 9. Minor (carried): the harbour is still heavier than the Alpine resort on low, and the cliff kit adds resident triangles

**Evidence:**
- The developers say the harbour budget was not touched (REMEDIATION "Not done"). I did not re-measure it.
- Fjord high resident terrain plus cliff kit is about **989 + 253 kt** against Alpine's **860 kt** (+44%). It is GPU-unmeasured.

**Fix:** as in round 3 (merge house kits, simpler distant boats). Consider LOD 2 at 24 m columns beyond 1.4 km.

## 5. What works

**Shared streaming budget.**
- `frameBudget.ts`, `World.stepStreaming` and the starvation guard work as designed. Every queue drained in my runs: Fjord peak pending terrain 55, hazard views 1, scenery and cliffs 8.
- The cliff stream yields on the budget (`cliffSegmentSteps(..., this.over)`). In the replay its pump never dominated a frame over 16 ms at the game budget.

**Endless (40 km, real `World`):**
- 0 geometries left the scene undisposed.
- Scene objects stayed between 1,013 and 1,226.
- At most 20 cliff segments existed at once (`maxSegments` 24).
- Heap with gc: 48.0 → 49.1 MB from 5 to 40 km.
- After `World.dispose`, 0 resources were undisposed with tracking off. With the tracker on: 1 geometry, 6 materials and 2 textures, which are module singletons.

**Pipeline correctness:**
- Albedo is `SRGBColorSpace`. The packed data map is `NoColorSpace`, and alpha (AO, roughness) is never sRGB-decoded.
- Normals are OpenGL. `flipY` is true, which is consistent with +V = +Y.
- The triplanar UDN blend has a correct transpose for the rotated top projection (`rockMaterial.ts:259-267`).
- Textures use mipmaps with trilinear filtering and anisotropy 4.
- The macro samples are mip-biased by design.
- Sets are ref-counted, and the macro set is released too (verified in `rockset.test.ts`).
- Textures are anchored to `ROCK_ORIGIN` (the floating origin), so the rock material avoids the float32 drift of defect D10.

**URLs:**
- The bundle uses `new URL(new URL('<name>-<hash>.webp', import.meta.url).href, import.meta.url)`, resolved against `assets/main-*.js`.
- For a Pages subpath this gives `https://<user>.github.io/<repo>/assets/rock_face_03_nhr-Cw4B6rO1.webp` (checked with Node `URL`).
- The bundle has no absolute asset paths, no Poly Haven host and no runtime fetch of assets.

**Save compatibility:**
- `skifree-tld.settings.v1`, `skifree-tld.records.v1` and `records.v2`, and `skifree-tld.progress` are unchanged.
- `git diff 3a87a76 8d19542 -- src/progression src/core/settings.ts` shows only description strings and the removal of Scenic Route's `requires`. Migrations are unchanged.
- The developers report the migration e2e tests pass on the candidate. I did not rerun them.

**Other fixes:**
- Finer far terrain is now off on low (`TerrainRenderer.ts:89`).
- The snowball beam is warmed at session start (`SnowballView.ts:97-110`, unit test passes).

## 6. Round-3 defects and tracker items (by my own verification)

| Item | Status | Evidence |
|---|---|---|
| R3 D1 (Major) / F-007: summed per-system budgets, 156 frames over 16 ms per 24 km against Alpine's 34 | **Partially fixed** | Structurally fixed: one budget. On the candidate: 14 over 16 ms per 12 km (about 28 per 24 km), max 19.7, none over 33. Alpine: 0. The tracker's "129→2" is not reproduced (defect 1). |
| R3 D2 (Minor): finer far terrain on every preset | **Fixed** | `fineFar = coast && quality !== 'low'`. High: 989 kt against Alpine's 860 (+15%; round 3: +30%). |
| R3 D3 (Minor): scoured-rock view indivisible | **Partially fixed** | Still one unit, but `pump(…, atLeastOne=false)` now waits for budget, so it no longer stacks (`hazardViews.ts:104-113`). |
| R3 D4 (Minor): harbour over budget on low | **Not fixed** (not re-measured) | The developers confirm it was untouched. |
| R3 D5 / F-019 (Minor): beam program compiled mid-chase | **Fixed** | Constructor creates a visible warm slot; `round4_streaming` "beam … visible for the start-of-run compile, then hidden" passes. |
| R3 D6 / D10: float32 absolute coordinates | **Not fixed (carried)** | Engine-wide. The new rock material uses `ROCK_ORIGIN`, which is correct. |
| R1 D11: module singletons | **Accepted, bounded** | 6 materials, 2 textures, 1 geometry after teardown. |
| F-020: browser suite on the candidate | Not mine to verify (Reviewer E) | `TESTS.md` reports 19/19. |

## 7. Public-preview gate (my area)

The completion brief I was given (`8dc283d1`) has no §10. I applied the gate criteria in the review brief (Critical = crash, soft-lock, save loss or missing assets) and completion brief §4 (asset pipeline) and §8 (performance).

| Gate item | Status | Evidence |
|---|---|---|
| No crash, soft-lock or save loss in my area | **Met** | No crashes in 52 km of `World` replay plus 40 km Endless. Save keys and migrations unchanged. |
| No missing assets; loads in dev and on Pages | **Met (static)** | All 8 WebPs are emitted with hashes and resolve relative to the module. Textures visibly load in candidate `07`. No subpath browser test exists (`vite preview` serves at the root). |
| Bundled, no runtime API or internet | **Met** | grep of the bundle. |
| Colour space, normals, roughness, AO, triplanar, mipmaps | **Met, with quality caveats** | Defect 4 (lossy normals). |
| Texture tiling | **Not met** | Defect 2 (lattice in `06`). |
| Memory / GPU disposal | **Met** | Ref-counting verified. Endless heap flat, 0 leaks. Minor growth of the material cache (defect 5). |
| Provenance recorded, not fabricated | **Met** | Pages, authors and CC0 match the zips. Conversion step not in the repository (defect 7). |
| "Measure performance in the production build", compared with Alpine under the same conditions | **Not met** | No candidate browser data. My CPU replay shows Fjord worse than Alpine (14 vs 0 frames over 16 ms per 12 km). |
| No memory growth or geometry accumulation in long Endless runs | **Met (headless)** | `endless4` logs. The browser `tools/endless_memory.mjs` was not run for Fjord: its settings omit the biome, so it defaults to Alpine. |
| Never claim GPU performance from software rendering | **Met** | Neither this report nor the remediation notes claim it. |

**Gate result for my area:** not a blocker of the Critical kind, but **not met** for §8, because there is no production-build measurement, and **not met** for §4 texture tiling.

## Reproducing

From `/home/claude/sf-fjord`:

```
BIOME=fjord|alpine Q=high KM=12 [BUDGET=3.5] npx vitest run --config scratch/vitest.config.ts scratch/review-d-r4/frames4.test.ts
NODE_OPTIONS=--expose-gc [TRACK=0] KM=40 npx vitest run --config scratch/vitest.config.ts scratch/review-d-r4/endless4.test.ts --silent=false
python3 -I scratch/review-d-r4/nhr_fidelity.py rock_face_03 cliff_side
python3 -I scratch/review-d-r4/period.py "<png>@x0,y0,x1,y1"
```
