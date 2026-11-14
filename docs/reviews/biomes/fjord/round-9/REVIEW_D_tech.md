# Fjord Coast, Round 9: Reviewer D, Technical (performance, stability, asset pipeline)

## 1. Header

- **Reviewer:** D, technical. **Model-based reviewer (same model family as the developers; not external).** Not a human reviewer.
- **Build:** `3bf5a7e` (branch `pass4-fjord`). During the review `HEAD` moved to `564cd5b`, which adds only evidence and docs: `git diff --stat 3bf5a7e HEAD -- src tools tests package.json` is empty. I changed no source and committed nothing.
- **Date:** 2026-11-14
- **Last review by me:** round 8 (`round-8/REVIEW_D_tech.md`, build `d1f642b`).
- **Scratch:** `scratch/review-d-r9/` holds every script, log and JSON cited below.
- **Evidence claim checked:** `git diff c9ffd1b 3bf5a7e -- src` touches only `src/world/caveTerrain.ts`. `git diff e0e2eca 3bf5a7e` touches only `caveTerrain.ts` and `tools/biome_evidence.mjs`. So the developers' perf runs on `e0e2eca` are valid for `3bf5a7e`: the jamb margin has no streaming cost.
- **Production bundle:** `dist/` was built 15 s after the `3bf5a7e` commit. It contains the round-9 code (`sharedGeometry`). It holds 8 WebP files and 3 `.skm` files, all hashed and module-relative.

### Machine load

Two other reviewers and a Playwright `game.spec` run were active for most of this review. Load average was:

- 2.7–3.8 during my A/B chain;
- 4.5–6.4 during the repeat run, the Endless runs, the unit tests and `tsc`.

Every frame number below is **thread CPU time** of the replay thread, so contention mostly does not inflate it. The starvation counts are affected, because the budget runs on wall time.

**Timer caveat, new this round:** `process.threadCpuUsage()` on this VM advances in ticks of about 4 ms (I measured this in `node -e`). Per-frame p50 and p90 are therefore coarse to about ±4 ms. Counts over 16 ms and over 33 ms, the maximum, and the per-consumer attribution of large spikes are still meaningful. My round-8 numbers were taken on the same VM with the same method, so the two rounds compare like with like.

### What I ran

- `npx tsc --noEmit`: exit 0 (`tsc.log`).
- `tests/unit/fjord_streaming`, `round4_streaming` and `pin_rescue`: 3 files, **10 of 10 passed**, under load 5–6.6 (`unit.log`).
- `rockset.test.ts` (ref-counting and colour space): passes.
- `frames9`: replay of the real `World.update` with a stub renderer, at the shipped 6 ms budget, 12 km. A `fetch` stub serves the shipped `.skm` files, so the islands and cave boulders are really built (`fetched: 3`, 43 islands).
  - **Same-load A/B, interleaved:** the candidate against the round-8 tree (`git archive d1f642b` into `r8tree/`), for Fjord and Alpine (`chain.sh`, `chain.log`).
  - A repeat Fjord run with per-consumer maxima (`frames_fjord_high_rep2.json`).
- `endless9`: Fjord Endless, 40 km at 1 m per frame with the islands built. One run with the lifecycle tracker; one heap run with gc and no tracker.
- `fine.py`: the `06` sea-wall lattice FFT.

**Not run:** Playwright, the dev server, `vite build`. The brief forbids them.

## 2. Verdict

**FAIL** against the 9/10 target for Performance and stability. Score **8.5**, up from 8 in round 8.

**Round 9 fixed the two things that cost the most last round. I verified both:**

- **The island-placement stall is gone.**
  - The round-8 tree, at the same load, still produced **89.1, 66.0 and 58.8 ms** frames in `islandsWant`.
  - On the candidate, `ScanIslands.want` costs at most 1.8 ms and `pump` at most 7.9 ms (one 4 ms tick of granularity). No frame over 16 ms is attributed to the islands.
- **The vegetation band spikes are gone.** In the round-8 tree, 20 of 32 frames over 16 ms were vegetation-dominated. On the candidate there are none, and `vegetation` peaks at 8.1 ms.

**Also fixed:**

- Island materials are now bounded at 4–6 over 40 km (they grew 5 → 15 before).
- Scans are fetched once each (6 fetches before, 3 now).
- The cave no longer disposes the shared scan geometries.
- Endless is leak-free with a flat heap.
- A production-bundle CPU measurement now exists.

**Why it is still not 9:**

1. **Fjord is still roughly twice as heavy as Alpine.**
   - In the shipped bundle: 27 against 12 frames over 16 ms, and **4,785 against 435** over 8 ms, per 12 km.
   - In my same-load replay: 14 (repeat 9) against 7 over 16 ms, and 1,705 against 524 over 8 ms.
   - The remaining roughly 20 ms spikes are indivisible near-terrain tile builds on the coast, and cave build slices that ignore the budget.
2. **The asset-pipeline minors from rounds 4 and 8 are all still open:**
   - lossy normals;
   - no preload;
   - `gneiss` shipped;
   - conversion script not committed;
   - `meshoptimizer` undeclared;
   - stale `cliff_side` row.
3. **New minor:** the cave boulders' colliders exist whether or not their mesh ever loads.
4. **No Fjord browser Endless memory run,** although the tool now supports one.

**Public-preview gate for my area: met.** See section 7. There is no performance regression any more; the candidate is better than both the round-8 and the round-4 trees.

## 3. Scores (technical point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 7.5 (low confidence) | The `06` sea wall is unchanged in my metric: lattice amplitude 0.23 and 0.36 grey levels, the same as round 8. Islands and cave boulders load and render in the production shots (`06`, `07`, `standard/08`). The art judgement belongs to Reviewer A. |
| Environmental uniqueness | 8.5 (low confidence) | Scanned islands, the cliff kit, sea caves and the harbour are real coastal systems. Not my area. |
| Skiing and hazard mechanics | 8.5 (low confidence) | The fixed 120 Hz step is unchanged. `pin_rescue.test.ts` passes. The cave boulders are now solid via `World.extraColliders`, which is cached and allocation-free per physics step. The physics audit belongs to Reviewer B. |
| Difficulty and fairness | 8 (low confidence) | Hazard-view queues peak at 1–3, so there is no late pop-in from streaming. One fairness risk is in my area: invisible boulder colliders if a scan fails to load (defect 3). |
| Cinematics | 8 (low confidence) | Cave mouths render without holes in the `3bf5a7e` shots (`07`, `standard/08`). The cave boulders still arrive asynchronously, so pop-in on a slow first load is possible. Reviewer C owns the look. |
| **Performance and stability** | **8.5** | <ul><li>No crashes or exceptions in about 116 km of replay, Endless and tests.</li><li>Endless heap flat at 46.9–50.0 MB over 40 km.</li><li>No frame over 33 ms in any candidate run, in the bundle or in Node.</li><li>The round-8 regression is fixed.</li></ul>Below 9: Fjord's frame cost is still about 2× Alpine's at 16 ms and 3–11× at 8 ms (defect 1), and the pipeline minors are carried (defects 4–7). |
| Accessibility and controls | 8 (low confidence) | `TESTS.md`: all 19 browser tests and 311 unit tests pass on the candidate's code. Not my area. |
| Overall player experience | 8 (low confidence) | Stable. Long Fjord runs will show an occasional single dropped frame about every 450 m on this class of CPU, against about every 1 km on Alpine. There is no recurring multi-frame hitch any more. |

## 4. Defects

### 1. Major, for the 9/10 target (carried: D r8 #2, F-007): Fjord's CPU frame cost is still about 2× Alpine's

This is not a gate blocker, because it is not a regression.

**Evidence: the developers' production-bundle run** (`perf/prod_frames_{fjord,alpine}.json`, 12 km, Chrome, CPU per simulated frame). I re-analysed it:

| | mean | median | p95 | p99 | max | > 6 ms (budget saturated) | > 8 ms | > 16 ms | > 33 ms |
|---|---|---|---|---|---|---|---|---|---|
| Fjord | 3.99 | 3.0 | 9.8 | 11.9 | 31.6 | **45%** | **4,785** | **27** | 0 |
| Alpine | 2.39 | 0.5 | 7.5 | 8.2 | 19.1 | 27% | 435 | 12 | 0 |

The step distributions are bimodal, with a large mode at 6.5–6.8 ms: the shared streaming budget spent in full. Fjord sits in that mode almost half the time.

**Evidence: my same-load replay** (thread CPU, 12 km, `chain.log`, load 2.7–3.8):

| Run | max | > 8 ms | > 16 ms | > 33 ms | Dominant consumer in the frames over 16 ms |
|---|---|---|---|---|---|
| **Fjord, candidate** | 21.6 | 1,705 | **14** | 0 | terrainNear 6, caves 4, terrainFar 2, scenery 1, hazardViews 1 |
| Fjord, candidate (repeat, load 4.5–6.2) | 22.8 | 1,372 | 9 | 0 | caves 3, terrainNear 3, terrainFar 2, scenery 1 |
| Fjord, round-8 tree `d1f642b` | **89.1** | 1,725 | 32 | **3** | **vegetation 20**, stream (islands) 4, terrain 6 |
| Alpine, candidate | 24.2 | 524 | 7 | 0 | caves 5, terrainNear 2 |
| Alpine, round-8 tree | 20.6 | 676 | 11 | 0 | terrainNear 4, caves 4, vegetation 3 |

**What causes the remaining spikes** (`frames_fjord_high_rep2.json` `partMax`, `worst`):

- **Near-terrain tile builds of up to 21.2 ms CPU.** One indivisible tile, because "at most one unit overruns" (`World.ts` around line 502). This is the coast `heightAt` cost.
- **Cave slices of up to 22.6 ms.** `stepCaves` (`World.ts:239-251`) runs one `Cave` generator step per frame with no budget argument, so a heavy step overruns the 6 ms budget by about 3×. This is engine-wide; Alpine shows it too.
- **`terrainFar` up to 13.8 ms, `scenery` up to 12.3 ms, `hazardViews` up to 9.9 ms.**
- The terrain backlog peaked at **166 queued jobs** under load in the repeat run (39 in the A/B run; Alpine 21).

**Impact:** p99 is inside one 60 Hz frame in both locations, so this is not a hitch problem. But Fjord leaves about 5 ms of CPU headroom at p99 before render submission (592 draw calls in Fjord, 510 in Alpine). On slower CPUs or 120 Hz displays it will drop frames clearly more often than Alpine.

**Fix:**

- Give the near-terrain tile build a generator form, like `buildBandSteps`, or memoise the coast `heightAt` per tile column (it is the common cost of terrainNear, terrainFar and the island and vegetation probes).
- Pass the budget into the `Cave` generator: a `tick` like `dressSeaCaveSteps`'s, at 3 ms.
- Re-measure with `prod_frames.mjs` on an idle machine, and record the load in the log.

### 2. Minor (carried: D r8 #3, F-033, partly fixed): the production measurement is CPU-only and has methodological gaps; no Fjord browser Endless run

**Evidence:**

- `tools/prod_frames.mjs` is a real improvement: it runs the built bundle in Chrome with real V8, and the islands are built because there is a DOM.
- Its gaps:
  - It runs with `?debug` and `difficulty: 'relaxed'`, and steps frames without the render loop: one render every 240 steps (lines 26 and 56–65).
  - The machine load is not recorded. The Fjord run took 1,141 s against Alpine's 735 s.
  - `heapMB` is `usedJSHeapSize` without a gc (`App.ts:954`), so 158.7 against 121.8 MB says nothing about retention.
- `tools/endless_memory.mjs` gained a `biome` argument, but no Fjord result exists in `round-9/`.
- No GPU number exists. This cannot be measured on this machine, and the developers say so correctly.

**Fix:**

- Record `/proc/loadavg` before and after each run.
- Run `endless_memory.mjs … 40 fjord` and commit the output.
- Force a gc (`--expose-gc` is already passed) before reading the heap.

### 3. Minor (new): sea-cave boulder colliders are registered whether or not the boulder mesh ever appears

**Evidence:**

- `src/world/biomes/fjord/views/seaCave.ts:401` pushes every boulder into `solids` while placing it.
- The mesh is added only in the `loadScan(...).then` callback, and only when the geometry is non-null (`seaCave.ts:408-420`).
- `loadScan` resolves `null` on any fetch or decode failure (`scanModels.ts:55-58`).
- `World.extraColliders` (`World.ts:428-441`) feeds `solids` to `SkierPhysics` every step.
- **Consequence:** if a scan fails to load (offline after first load, a blocked `.skm` type, a wrong base path), the skier hits invisible rocks around the cave mouth. If it is merely slow, the rocks are solid before they are visible.

**Fix:** push each collider inside the `.then`, only once the mesh exists. Better: await the scans during loading (see defect 4).

### 4. Minor (carried: D r4 #6, D r8 #5, F-034, partly fixed): no preload; scans are still lazy

**Evidence:**

- **Fixed:** the double fetch. One shared `loadScan` cache, `fetched: 3` (round 8: 6).
- **Not fixed:**
  - `rockSetsReady()` (`rockMaterial.ts:124`) still has no caller in `src/`.
  - The scans are fetched from the `ScanIslands` constructor and the cave builder, and nothing in `World.create` awaits them.
  - The 1×1 placeholder image swap is unchanged.

**Fix:** await `rockSetsReady()` and `Promise.all` of the three `loadScan`s in `World.create` or the loading screen.

### 5. Minor (carried: D r4 #4, D r8 #7): normal maps are still double-lossy WebP

**Evidence:** `src/world/art/textures/*` and `pack_scans.py` are unchanged since `ac5234a`, so my round-4 measurement still holds: angular error 6.5° mean and 22.7° p99 on `rock_face_03`.

**Fix:** store `*_nhr` as lossless WebP, or as KTX2/UASTC.

### 6. Minor (carried: D r4 #7–#8, D r8 #8): provenance tooling is not reproducible, one documentation row is stale, unused assets ship

**Evidence:**

- `tools/artbake/` still holds only `bake.mjs`, `pack_scans.py` and `scan_to_skm.mjs`. The EXR→WebP conversion step is not committed.
- `meshoptimizer` is still missing from `package.json`.
- `docs/ASSETS_AND_LICENSES.md:103` still says `cliff_side` is "the sea-cliff kit's MACRO layer". It is the islands' macro layer (`scanIslands.ts:88`).
- `dist/assets/gneiss_*.webp` (513 KB) still ships, and `dist/textures/` is still an empty directory.
- What is correct: the `.skm` provenance rows (3 files, CC0, authors, round-8 removals) match `src/` and `dist/`, and the bundle has no `polyhaven` string or runtime API call.

**Fix:**

- Commit the converter.
- Add `meshoptimizer` to `devDependencies`.
- Fix row 103.
- Load `gneiss` lazily, only for `artCoast.ts`.

### 7. Minor (carried: D r4 #9, D r8 #9): resident geometry and draw calls are still above Alpine; islands are not instanced; the harbour is not measured on low

**Evidence:**

- Terrain is 989 kt on Fjord against 860 kt on Alpine, high quality.
- On top of that: the cliff kit (234 kt at peak) and up to 43 islands at 5k triangles each, every one its own draw call.
- In the bundle: 592 draw calls, 565 geometries and 28 textures, against Alpine's 510, 397 and 21 (`prod_*.log`).

**Fix:** use three `InstancedMesh`es, one per scan id, and a 1.5k-triangle variant for far islands and for low quality.

## 5. What works

**The island stall is fixed in the code and in measurement:**

- `want()` only queues blobs (`scanIslands.ts:95-123`).
- `pump()` places them under the scenery slice's deadline (`scenery.ts:129`).
- Each blob's decision, including rejections, is memoised in `decided` and pruned above 600 entries. It reached 582 over 40 km, so it is bounded.

**Vegetation slicing** (`Vegetation.ts`, `buildBandSteps`):

- The build yields every 48 candidates (16 for talus).
- A dropped band cancels its job (`gen.return`).
- `flush` and `dispose` handle an in-flight job.

**Endless, 40 km with the islands built:**

| Measure | Result |
|---|---|
| Heap, no tracker (`endless9_fjord_high_heap.log`) | **46.9–50.0 MB**, flat |
| Undisposed resources after `World.dispose`, no tracker | 0 |
| Island materials | 4–6 (round 8: 5 → 15) |
| Cliff materials | 2–3 |
| Island draw queue | always drained (0) |

With the tracker, 4 geometries remain after teardown: the 3 session-lifetime scans by design, plus 1 module singleton.

**Ownership:**

- The cave dressing skips `userData.sharedGeometry` meshes in both dispose paths (`seaCave.ts:240`, `seaCave.ts:710`).
- It now also frees `partial.mats` on a normal dispose. That was a small leak fixed in passing.

**`extraColliders`:** it is called at 120 Hz per step, and on a cache hit it returns the cached array without allocating.

**Far-tile peak low-pass** (`TerrainRenderer.ts:525-539`):

- Interior vertices only, so tile edges still weld.
- O(n²) per far tile, negligible cost.

**Pipeline correctness, re-checked:**

- Albedo is sRGB and the data map is `NoColorSpace`.
- Normals use the OpenGL convention with `flipY`.
- Trilinear filtering, anisotropy 4, mipmaps.
- Ref-counted rock sets (`rockset.test.ts` passes).
- Every asset URL is module-relative (`new URL(new URL('<name>-<hash>.ext', import.meta.url).href, import.meta.url)`), and `index.html` uses `./assets/…`.

**Saves:**

- `git diff d1f642b 3bf5a7e -- src/progression src/core` is empty.
- The keys `skifree-tld.settings.v1`, `records.v1` / `records.v2` and `progress` are unchanged.
- The migration browser tests (#12, #13) pass.

**Tiling:** the `06` lattice is unchanged from round 8: 0.23 and 0.36 grey levels, not visible.

## 6. Round-8 defects and tracker items (by my own verification)

| Item | Status | Evidence |
|---|---|---|
| D r8 #1 / F-043: island placement stall, 45–66 ms | **Fixed** | Round-8 tree at the same load: 89.1, 66.0 and 58.8 ms `islandsWant` frames. Candidate: `islandsWant` at most 1.8 ms, `pump` at most 7.9 ms, 0 island-dominated spikes, 0 frames over 33 ms. |
| D r8 #2 / F-007 / F-044: Fjord vs Alpine; vegetation band spikes | **Vegetation fixed; Fjord vs Alpine partial** | Vegetation-dominated spikes: 20 → 0, maximum 8.1 ms. Fjord over 16 ms: 32 → 14 at the same load. Still about 2× Alpine (defect 1). |
| D r8 #3 / F-033: no production-build measurement | **Partially fixed** | `prod_frames.mjs` in the bundle exists (CPU). No load recorded, no Fjord browser Endless run, no GPU (defect 2). |
| D r8 #4 / F-045: island materials per water level | **Fixed** | 4–6 over 40 km. |
| D r8 #5 / F-045 (part), F-034: no preload; scans fetched twice | **Partially fixed** | One fetch per scan. Still no preload, and it now combines with defect 3 (defect 4). |
| D r8 #6 / F-045 (part): cave disposed shared scan geometries | **Fixed** | `userData.sharedGeometry` guard in both paths; after teardown only the 3 scans remain. |
| D r8 #7: double-lossy normals | **Not fixed** | Textures unchanged (defect 5). |
| D r8 #8: provenance tooling, stale documentation, gneiss | **Not fixed** | Defect 6. |
| D r8 #9: resident geometry, harbour on low | **Not fixed** | Defect 7. |
| F-034: cliff materials / normals / gneiss / preload | **Open (partial)**, as the tracker says | Cliff materials fixed (2–3); the rest open. |
| F-019: beam shader compiled mid-chase | **Fixed** (unchanged since round 4) | — |
| F-021: pinned skier (stability side only) | **Tests pass** | `pin_rescue.test.ts` passes. Reviewers B and E own the sweep. |
| F-036: islands from terrain-patch scans (asset side) | **Fixed** | Only the 3 boulder `.skm` files are in `src/` and `dist/`. |

## 7. Public-preview gate (completion brief §10), my area

| Gate item | Status | Evidence |
|---|---|---|
| No critical defects or unrecoverable states in my area (crash, leak, save loss) | **Met** | No exceptions in about 116 km of replay and Endless. Leak-free; heap flat. |
| Assets load in production | **Met** | 8 WebP and 3 `.skm` files hashed and module-relative in `dist/`. Islands, cave and boulders render in the production shots (`06`, `07`, `standard/08`). Page errors: 0 per `EVIDENCE.md`. The failure path has defect 3 (minor). |
| Saves compatible | **Met** | Save code and keys untouched; migration tests #12 and #13 pass. |
| Endless streams reliably | **Met (headless)** | 40 km, bounded queues and materials, flat heap. No Fjord browser memory run (defect 2). |
| No major performance regression | **Met** | Better than the round-8 tree at the same load (max 21.6 against 89.1 ms; over 16 ms 14 against 32; over 33 ms 0 against 3). Better than round 4. |
| Performance measured in the production build, compared with Alpine (§8) | **Met for CPU, with gaps** | `prod_frames` Fjord against Alpine in Chrome. Load not recorded; GPU not measurable here (defect 2). |
| Asset pipeline correct (§4) | **Met, with minors** | Colour spaces, normals convention, packing, triplanar, tiling, mipmaps, disposal and bundling are correct. Defects 4–7 are minors. |
| All automated tests pass | **Met** (from `TESTS.md`, partly re-run) | 311 unit and 19 browser tests per `TESTS.md`. My re-runs: `tsc` clean, 10 of 10 streaming and pin tests, rockset. |

**Gate result for my area: met.** Full approval (9 in Performance and stability) is not reached: defect 1, and the carried pipeline minors.

## Reproducing

From `/home/claude/sf-fjord`:

```
scratch/review-d-r9/chain.sh   # interleaved candidate vs d1f642b tree, Fjord + Alpine, 12 km
BIOME=fjord Q=high KM=12 [CLOCK=wall] npx vitest run --config scratch/vitest.config.ts scratch/review-d-r9/frames9.test.ts --silent=false
NODE_OPTIONS=--expose-gc [TRACK=0] KM=40 npx vitest run --config scratch/vitest.config.ts scratch/review-d-r9/endless9.test.ts --silent=false
python3 -I scratch/review-d-r9/fine.py "<png>@100,480,500,780" "<png>@200,150,450,350"
```
