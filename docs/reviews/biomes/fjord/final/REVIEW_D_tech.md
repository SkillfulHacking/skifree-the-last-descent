# Fjord Coast, final round (round 3) review: Reviewer D, Technical & Performance Engineer

- **Reviewer:** D, Technical & Performance Engineer. I am a **model-based reviewer** from the same model family as the developers. I am not an external human reviewer.
- **Build:** `aba21bc` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`). No source changes by me.
- **Date:** 2026-11-10
- **Method:**
  - I read the code that changed since `aec1812` (round 2) in `World`, `presentation/{hazardViews,cave,refuge}`, `fjord/views/{seaCave,shelter,start,harbour,hazardViews,mist,water}`, `TerrainRenderer`, `snowMaterial`, `GameSession`/`App` (snowball warm-up), `SnowballView` and the physics loop.
  - I took my own headless measurements with scripts in `scratch/review-d-r3/`:
    - `hitch3`: a frame loop that replays `World.update` order (hazard band + budgeted pump, sliced caves, then sliced dressings, sliced shelters, scenery pump, terrain at a 3 ms budget). It runs at 0.5 m per frame (30 m/s at 60 Hz) over 24 km of Endless, for both Fjord and Alpine.
    - `views`: per-kind hazard view cost.
    - `terrain`: terrain cost and resident triangles, measured on this build and on an `aec1812` `src` snapshot extracted into scratch.
    - `budget3`: draws, triangles and program signatures per preset.
    - `slots3`: water coverage ahead and behind.
    - `endless3`: lifecycle and heap with sliced shelters, caves and dressings.
    - `caves`: cave residency.
  - Screenshots viewed: final `06`, `03`, `09d`, `10`.
- **Timing caveat:**
  - There is no GPU and no browser here, so **nothing in this report is a frame rate, a GPU time or a shader compile time.**
  - The machine was shared (load average 9–12 on 2 CPUs), so all timings are **process CPU time** of Node main-thread JavaScript, including GC.
  - Read them as relative magnitudes. Fjord-versus-Alpine comparisons ran concurrently under the same load.
- **Checks:**
  - `npx tsc --noEmit` (strict): exit 0.
  - `npx vitest run`: **17 files, 273 of 273 tests pass**.
  - I did not run `vite build` or Playwright (the brief forbids both).

## 2. Verdict

**FAIL (narrowly)** against the 9/10 target for Performance and stability. The score is **8.5** (round 1: 6.5; round 2: 7.5).

The round-2 remediation is real, and my own measurements confirm it:
- The scoured-rock views are now built on a per-frame budget. Hazard-view frame max fell from 53 to 25 ms CPU.
- The sea-cave dressing is time-sliced: 9 slices per cave, max 22.6 ms, against 63 ms in one frame before.
- The coastal shelter is sliced (max 17 ms, was 31).
- The mist seams are gone from `06` and `03`.
- The start area dropped from 124 to 22 draws, below Alpine's 35.
- Rear-view water coverage is complete on all 28 variants.
- The low preset has its own lighter coastal terrain program, and the water `discard` is removed.
- Lifecycles stay clean over 130–200 km, now including caves and sliced dressings: 0 undisposed geometries, 0 streamed lights, and heap +2 MB over 180 km.

What keeps the score below 9 is the **whole frame**, not any single system:
- Fjord adds three more streaming consumers, each with its own budget: hazard views 2 ms, scenery 3 ms and dressing 3 ms, on top of terrain 3.5 ms and caves 4 ms. Nothing caps their sum.
- In the same replayed frame loop, Fjord had **156 frames over 16 ms CPU in 24 km, against Alpine's 34 (4.6×)**, and **7 frames over 33 ms against 1**.
- The art request R3 (finer far terrain tiles) adds **+29% resident terrain triangles on high and +40% on low**, with no preset gate.
- The harbour is still heavier than the Alpine resort on low.

All evidence is still Sprint-only. No screenshot shows an Expedition or Endless arm, or the rear-view inset on a long course.

## 3. Scores (from a technical/performance point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 8 (low confidence) | The mist seams and the sky rectangle are gone, and the harbour reads well in `10`. Vertical striation on the great wall in `06` is still visible to me. Art judgement belongs to Reviewer A. |
| Environmental uniqueness | 8.5 (low confidence) | These are real coast capabilities: arms, a sea cave with its own dressing, harbour, gaps, spines and viewpoints. They are not a re-skin. |
| Skiing and hazard mechanics | 8.5 (low confidence) | The new airborne squall push is an acceleration integrated inside the fixed 120 Hz step. Gap markers are `cosmetic` and skipped by physics. Game feel belongs to Reviewer B. |
| Difficulty and fairness | 8 (low confidence) | Hazard views still appear about 0.9–1.1 km ahead. The view queue stays at ≤ 9 pending, so budgeting did not create late pop-in. The developers' own open issue (Sprint ladder not robust) belongs to Reviewers B and E. |
| Cinematics | 8.5 (low confidence) | The dressing is finished synchronously only if the cinematic needs the cave before its slices finish (`World.caveFor`). With caves built about 1.8 km ahead and about 9 slices per dressing, that should not happen in practice. No lights are created mid-cinematic. |
| **Performance and stability** | **8.5** | Every round-2 Major is fixed or reduced to Minor, and lifecycles, light count, heap and water coverage are clean. Below 9 because of the uncapped sum of per-system budgets (4.6× Alpine's rate of > 16 ms frames), the ungated finer far terrain, and the harbour on low. GPU cost is still unmeasured. |
| Accessibility and controls | 8 (low confidence) | The rear-view label is on a dark pill (`09d`). The input stack is unchanged. Not otherwise assessed. |
| Overall player experience | 8.5 (low confidence) | Likely stable on Sprint. Long runs will show more frequent small hitches than Alpine (see defect 1). |

## 4. Defects

### Round-2 (and still-open earlier) findings: status from my own verification

| R2 | Status | My evidence |
|---|---|---|
| **New 1 (Major)** Scoured-rock views built synchronously, 12–53 ms per band | **Fixed (Minor residual: defect 3)** | See detail below the table. |
| **New 2 (Major)** Sea-cave dressing in one frame, 49–63 ms | **Fixed** | See detail below the table. |
| **New 3 (Major)** Mist billboards cut by the water: hard seams | **Fixed** | See detail below the table. |
| **New 4 (Minor)** Water shader `discard` | **Fixed** | `water.ts:72` is now a comment only. The quad is still clipped geometrically (`water.ts:150-156`). The only remaining `discard` in Fjord views is the transparent mist (`mist.ts:90`, alpha < 0.003), which is harmless. |
| **New 5 (Major)** Harbour and start over the Alpine budget, weak preset scaling | **Start fixed; harbour partially fixed** (defect 4) | `budget3`. Start: **22 draws / 10–11 kt** on every preset (was 124 / 11 kt; Alpine 35 / 5 kt). Harbour: high **84 d / 303 kt**, low and medium **62 d / 256 kt** (round 2 low: 81 / 267). Alpine resort: 35–37 d / 194–241 kt. |
| **New 6 (Minor)** Coastal shelter built synchronously, 9–31 ms | **Fixed** | `CoastalShelter.sliced` and `World.stepLodges` (`World.ts:322-333`), sliced when the refuge is more than 600 m ahead. In the frame loop: slices p50 1.3, max **17.1 ms** (one `house()`). `lodgeSync` happened 0 times in 24 km. Fjord refuge: 6 draws / 2 kt / 0 lights. |
| **New 7 (Minor)** Rear-view water missing on Expedition | **Fixed** | `waterReaches` (`water.ts:189-197`) now orders arms in the 12 km far plane, then arms in the 2.5 km rear far plane, then the rest. `slots3` (28 variants, every 25 m, 54,040 positions): **0.00%** missing ahead within 12 km and **0.00%** missing within 2.5 km behind. The arm under the camera is never missing, and no position has more than 6 arms in [−2.5, +12] km. Not visually confirmed: there is no rear-view capture on a long course. |
| **New 8 (Minor)** Snowball glint compiled at the first throw | **Partially fixed** (defect 5) | `GameSession.ts:146-150` creates the held ball and glint at session start at y = −5000, visible. `App.ts:514` compiles `warmupObjects`, and three r187 `compile` uses `traverseVisible`, so the sprite program is warmed. The throw slot (beam, ring, fill) is still created lazily at the first throw. |
| **New 9 (Minor)** Coastal terrain full cost on low | **Fixed** | See detail below the table. |
| **New 10 / R1 D10** Absolute-coordinate geometry (float32 at 100+ km) | **Not fixed (carried, engine-wide)** | Unchanged. Chunks, hazard views and dressings are still built in world coordinates. |
| R1 D11 Module singletons never disposed | **Not fixed (accepted), bounded** | Still **5 materials and 2 textures** after 130 km (`endless3`), as before. |
| R1 D1–D9, D12 | **Remain fixed** | Shelters have no lights (0 lights seen over 130/200 km, including cave dressings). Gusts, the warm-up and the far clamp are unchanged. |

**New 1 detail.**
- `HazardLayer.add` now only queues. `pump(2 ms, focusZ)` builds nearest first and at least one view per call (`presentation/hazardViews.ts:104-113`). `World.update` calls it every frame (`World.ts:429`), and `flush()` handles load and teleport.
- `views.test.ts` (30 km, CPU):

| Measure | p50 | p90 | p99 | max |
|---|---|---|---|---|
| Single scoured-rock view | 3.2 ms | 8.5 ms | 30.8 ms | 40.7 ms (GC-inflated tail) |
| Sea-gust view | 2.1 ms | – | – | 3.6 ms |
| Gap marker | 4.4 ms | – | – | – |
| Band placement | 0.1 ms | – | – | 3.3 ms |

- In the full frame loop (24 km), hazard frames were p50 6.5, p99 24.6, max **25.4 ms**, with **9 > 16 ms**. Round 2 had 53.4 ms max and about 17 > 16 ms per 24 km.
- The view queue peaked at 9 pending, so views are still created about 1 km ahead.

**New 2 detail.**
- `CavePresentation.dressSteps` is implemented (`seaCave.ts:305-323`) with a 3 ms ticker and 9 yield points.
- `World.stepCaves` runs dressings first, at one slice per frame (`World.ts:229-233`). The dressing is never built in the frame that finishes the cave (`installCave`, `World.ts:257-280`).
- Frame loop: **dressing slices p50 3.2, p90 9.7, max 22.6 ms**, 45 slices for 5 caves. The largest slice is the final `cols.geometry()` plus `Batch.build` (`seaCave.ts:647-664`).
- Abandoned jobs are `return()`ed and dispose their partial work in `finally`. That partial group is never added to the scene, so nothing reaches the GPU before disposal.
- 22 caves and 22 dressings over 130 km left 0 undisposed geometries.

**New 3 detail.**
- `mist.ts`: each bank carries its water level (`aLvl`), and alpha is multiplied by `smoothstep(0, 0.55..0.8, (y − level)/H)`, which is **exactly 0 at the waterline**. Sprites sit at `level + 0.16·size` with half-height `0.2·size`, so only the faded bottom crosses the water.
- In final `06_long_distance.png`, the bands across the water (about x 750–1500, y 820–870, and near the far shore at y ≈ 600) have soft lower edges. There is no straight seam.
- In final `03_mid_mountain.png` there is no hard edge along the waterline.

**New 9 detail.**
- `snowMaterial.ts:85-108`: on low, the gneiss drops `folF`, `blk` and the master joints `mj`.
- `shoreGlsl` (`snowMaterial.ts:140-165`) evaluates the wash, spray and surf noise only when `dh < 30`. That gate is sound, because spray is 0 above 28 m. Surf is omitted on low.
- Program key: `skifree-snow-v6:fjord:low` on low, `skifree-snow-v6:fjord` otherwise, and Alpine stays `skifree-snow-v6` (`budget3`).
- The terrain material is the only `createSnowMaterial` caller (`TerrainRenderer.ts:82`), so there is no second variant per preset.
- I generated both fragment shaders through `onBeforeCompile` against `ShaderLib.standard`. Braces balance (25/25), and the low text contains none of the high-only identifiers (the one `surf` hit is in a comment). I could not compile GLSL here (no GL or validator), as the developers also note.

### New or remaining defects

#### 1. Major (newly measured): independent per-system streaming budgets add up; Fjord shows 4.6× Alpine's rate of > 16 ms frames

**Evidence:** `hitch3.test.ts`, the same replayed `World.update` order for both locations, 24 km of Endless at 30 m/s (48,000 frames), run concurrently.

| | Fjord | Alpine |
|---|---|---|
| Frames > 8 ms | 674 | 193 |
| **Frames > 16 ms** | **156** (about one every 5 s of play) | **34** (about one every 24 s) |
| Frames > 33 ms | 7 | 1 |
| Worst frame | 55.0 ms (cave slice 32.1 + terrain 16.6) | 37.7 ms |

- Each system yields correctly on its own budget: terrain 3.5 ms (`GameSession.ts:1006`), caves 4 ms, scenery 3 ms, hazard views 2 ms, dressing 3 ms, plus one shelter step.
- But `World.update` (`World.ts:425-433`) runs them all in the same frame, and each also overshoots by one indivisible unit.
- Fjord-only systems over 16 ms on their own account for only 21 frames (hazard 9, scenery 10, dressing 1, shelter 1). Most of the 156 come from **coincident** work. For example, at z 10774: scenery 16.1 + terrain 20.2. At z 2064: scenery 23.4 + terrain 9.9.
- Fjord terrain alone also overruns more than Alpine's: > 16 ms 16 vs 5, and total terrain CPU 141 s vs 76 s per 24 km (`terrain.test.ts`). The coastal `heightAt` is more expensive, and defect 2 adds to it.

**Fix:**
- Give `World.update` one shared streaming budget per frame (for example 5–6 ms), and hand it out in priority order, passing the remainder on: physics-critical and nearest items first (terrain near LOD, then hazard views nearest the skier), then caves, dressings, shelters and scenery.
- Or let only one non-terrain job system run per frame, round-robin.
- Measure `renderer.info` and `performance.now()` in the browser before claiming parity.

#### 2. Minor (new, from art request R3): finer far terrain tiles on every preset (+29% resident terrain triangles on high, +40% on low)

**Evidence:**
- `TerrainRenderer.ts:87` sets `fineFar = !!mountain.coast` regardless of `quality`. Tiles inside |x| ≤ 3072 m use 32 m steps: 4× the vertices, and a yield every 4 rows.
- Resident terrain after streaming (`terrain.test.ts`):

| Preset | Round 2 (`aec1812` snapshot) | This build | Alpine |
|---|---|---|---|
| High (24 km) | 820 kt | **1,054 kt** | 809 kt |
| Low (3 km) | 376 kt | **525 kt** | 366 kt |

- Fjord terrain CPU went from 121 to 141 s per 24 km.
- On low, the Fjord terrain alone now costs 43% more triangles than Alpine's. Low is the preset where triangle count matters most.

**Fix:** gate `fineFar` to medium and above (the walls are farther and hazier on low anyway), or fine-step only the sea-side column.

#### 3. Minor (residual of round-2 New 1): one scoured-rock view is indivisible

**Evidence:**
- The pump builds at least one view per call. A rock view is p50 3.2 / p90 8.5 ms CPU, with a GC-inflated tail to 30–40 ms (`views.log`).
- The low preset builds the same view (p50 3.1 ms; 35 draws / 24 kt for 11 views on both low and high: `budget3`).

**Fix:** split `rockView` into a generator (grid, skin, ribs, merge), or reduce its ring and rib counts on low.

#### 4. Minor (residual of round-2 New 5): the harbour is still heavier than the Alpine resort, especially on low

**Evidence:** `budget3`. Low and medium: **62 draws / 256 kt** against Alpine's 35 / 194. High: 84 / 303 against 37 / 241. This is better than round 2 (low 81 / 267), and the start area is now below Alpine.

**Fix:** merge house kits and the boardwalk per material, as the start area now does. Use simpler boats beyond about 300 m.

#### 5. Minor (residual of round-2 New 8): the throw slot (beam, ring, fill) is still created at the first throw; the beam's program is unique

**Evidence:**
- `SnowballView.slot()` (`src/yeti/SnowballView.ts:101-119`) runs on the first throw.
- The beam uses `MeshBasicMaterial` with an `alphaMap`, `fog: false` and `DoubleSide`. No other `alphaMap` material exists in `src` (grep), so that program is compiled mid-chase on Hard.
- The trail sprites share the now-warmed glint program, and the ring and fill are plain basic materials, so this is one compile.

**Fix:** call `this.slot()` once in the constructor (left unused and hidden), so `warmupObjects` covers it. The objects must be visible during `compile`, because three's `compile` uses `traverseVisible`.

#### 6. Minor (carried, D10): float32 precision of absolute-coordinate geometry

Unchanged since round 1. The engine-wide fix is a per-object origin, as `TerrainRenderer` uses.

## 5. What works

**Lifecycles** (`endless3`):

| Run | Peak residency | Shelters / caves / dressings | Lights | Hazard views | Undisposed |
|---|---|---|---|---|---|
| High, 130 km | 12 chunks, 31 views, view queue ≤ 9, 1 shelter, 1 cave | 21 / 22 / 22 | 0 seen | 1,182 created, all disposed | 0 of 5,618 geometries |
| Low, 60 km | 9 chunks | 10 / 11 / 11 | 0 | – | 0 geometries |

Only the bounded singletons remain (5 materials, 2 textures).

**Heap** (`endless3`, 200 km with caves and dressings, no tracker):
- 29.9 MB at 0 km, 33.1 MB at 20 km, 35.2 MB at 180 km.
- That is about 12 kB/km of slow growth, consistent with the coast bookkeeping lists.

**Cave programs:** caves still overlap on every length (0 installs with no other cave alive), so the dressing programs are not released and recompiled between encounters.

**Water:** coverage is complete ahead and behind on 28 variants, and the shore band and the surface share one selector.

**Shaders:**
- The low coastal variant has its own key.
- The ranges far clamp stays look-gated, so Alpine keys are unchanged.
- Hazard kinds are warmed.
- The new gap markers reuse the windsock material, so they bring no new program.

**Physics:**
- `PHYS_DT` is still 1/120 with the accumulator, frame dt clamped to 0.1 s and the 12-step guard (`GameSession.ts:244, 288-297`). The victory loop is bounded by the same dt clamp.
- The new airborne squall push is an acceleration inside the fixed step.
- `SkierPhysics.ts` is unchanged since round 2.

**Build:** strict `tsc` is clean, and there are no `as any`, `@ts-ignore` or `@ts-expect-error` in the Fjord, coast, presentation or `World` code. 273 of 273 unit tests pass.

## 6. Brief compliance (Fjord bullets relevant to Reviewer D)

| Requirement | Status | Evidence |
|---|---|---|
| Sea level and coastline integrate at all supported lengths | **Done (measured); not visually evidenced beyond Sprint** | 0% undrawn arms ahead (12 km) and behind (2.5 km) on 28 variants. No long-course capture. |
| Streamed, not fully resident scenes (§5) | **Done** | Bounded residency over 130–200 km, high and low. |
| All modes including Endless (§5) | **Mostly done** | Generation, disposal and memory hold, and every Fjord system is now sliced. Combined frame-time tail is still above Alpine's (defect 1). |
| Hazard resource lifecycles (§8 D) | **Done** | Created = disposed (1,182 / 1,818 views). Pending views are dropped on release (`hazardViews.ts:125`). Committed test exists. |
| Shader management (§8 D) | **Mostly done** | No streamed lights. Hazard kinds warmed. Low-preset coastal key. Glint warmed. Remaining: the beam program at the first throw (defect 5). |
| Draw calls / triangle budgets / GPU memory (§8 D) | **Partial** | The start area is fixed. The harbour is still above Alpine on low (defect 4), and finer far terrain is ungated (defect 2). GPU memory was not measurable. |
| Physics timestep stability (§8 D) | **Done** | Fixed 120 Hz step with guards. New forces are inside the step. |
| Production build compatibility (§8 D, §10) | **Done (as far as permitted)** | `tsc` is clean and the unit suite passes. `vite build` and Playwright were not run (forbidden). |
| Endless generation and resource disposal tests (§10) | **Done** | `tests/unit/fjord_streaming.test.ts` and `fjord_r3.test.ts` (sliced shelter, rear water, low shader key). Independently reproduced. |
| Never claim a frame rate (§8 D) | **Done** | This report claims none. Neither do the remediation notes. |

## Reproducing

From `/home/claude/sf-fjord`:

```
npx vitest run --config scratch/vitest.config.ts scratch/review-d-r3/<file>.test.ts --silent=false
```

- `hitch3` reads `BIOME` and `KM`.
- `endless3` reads `KM`, `Q` and `TRACK=0` (heap mode, needs `NODE_OPTIONS=--expose-gc`).
- `terrain` reads `SRC=./aec/src` for the round-2 snapshot, plus `Q` and `BIOMES`.

Logs are in `scratch/review-d-r3/*.log`.
