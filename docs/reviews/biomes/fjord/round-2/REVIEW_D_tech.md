# Fjord Coast, round 2 review: Reviewer D, Technical & Performance Engineer

- **Reviewer:** D, Technical & Performance Engineer. I am a **model-based reviewer** from the same model family as the developers. I am not an external human reviewer.
- **Build:** `aec1812` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`, HEAD = `aec1812`, no source modifications).
- **Date:** 2026-11-10
- **Method:**
  - I read the code paths that changed since `f8519ca` in `World`, `scenery`, `water`, `mist`, `hazardViews`, `shelter`, `seaCave`, `ranges`, `snowMaterial`, `SnowballView`, `SkierPhysics` and `environment`.
  - I took my own headless measurements in `scratch/review-d-r2/`. They are the round-1 scripts adapted to the new APIs, plus new ones: `slots`, `rear`, `hitch`, `hitch2`, `endless`, `heap` and `budget`.
  - I viewed the screenshots `06`, `03`, `01` and `04b`, comparing round 1 with round 2.
- **Timing caveat:**
  - There is no GPU and no browser here, so **nothing in this report is a frame rate, a GPU time or a shader compile time.**
  - The machine was shared with a Playwright capture job (load average 8–11 on 2 CPUs). Wall-clock timings were inflated by that, so the timings I rely on use **process CPU time** (`process.cpuUsage`, in `hitch2.test.ts`).
  - All timings are Node main-thread JavaScript. Read them as relative magnitudes, not browser frame times.
- **Checks:**
  - `npx tsc --noEmit`: exit 0.
  - `npx vitest run`: **16 files, 257 of 257 tests pass**.
  - I did not run `vite build` or Playwright (the brief forbids both).

## 2. Verdict

**FAIL** against the 9/10 target for Performance and stability. The score is **7.5** (round 1: 6.5).

The round-1 remediation is real, and I verified it myself:
- **D2 (streamed shelter light): fixed.** The light count in every streamed group is 0 over 130 km.
- **D3 (water on far arms): fixed for the forward view.** No arm within 12 km ahead is undrawn, measured across 28 course variants.
- **D4 (sky rectangle): fixed.** `06_long_distance.png` no longer shows it.
- **D1 (scenery built in one frame): largely fixed.** Scenery is now time-sliced, with residual slices of up to about 20 ms CPU.
- **D6 (gust cost), D8 (hazard material warm-up) and D9 (hazard view pop-in): fixed.**
- **Endless lifecycle: clean.** A disposal test is now committed.

Three problems still keep this below a 9:
1. **The same class of problem as D1 has moved elsewhere.** The new, denser scoured-rock hazard view is built synchronously inside `World.stream`, costing **12 ms median and up to 53 ms CPU** per band. The new sea-cave dressing costs **49–63 ms CPU in a single frame** per cave. Neither is time-sliced.
2. **The more prominent sea-mist banks are vertical sprites cut by the opaque water plane.** This draws hard straight seams across the fjord in the primary evidence shots `06` and `03`. It is a new visible rendering artefact in the same shot that carried D4 last round.
3. **Draw-call and triangle growth with weak preset scaling.**
   - The harbour is now heavier than the Alpine resort: 301 k vs 241 k triangles, and 83 vs 37 draws.
   - The start area uses 124 draws, against Alpine's 35.
   - Low preset barely reduces either.

The evidence is again Sprint-only, so no screenshot shows an Expedition or Endless arm.

## 3. Scores (from a technical/performance point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 7.5 (low confidence) | The sky rectangle is gone and the walls read darker and more rock-like (`06`). The mist seams across the water in `06` and `03` are a technical blemish in primary shots. Art judgement belongs to Reviewer A. |
| Environmental uniqueness | 8.5 (low confidence) | These are real coast capabilities: arms, spines, gap gullies, a sea cave with its own dressing, and a harbour. They are not an Alpine re-skin. |
| Skiing and hazard mechanics | 8 (low confidence) | The new ground side-slip is a bounded positional term (≤ 3 m/s × `SLIP_EDGE` × dt) inside the fixed 120 Hz step. The relocate path zeroes the state cleanly. Game feel belongs to Reviewer B. |
| Difficulty and fairness | 8 (low confidence) | Hazard views now appear 0.9–1.2 km ahead instead of 0.4–0.65 km. Balance numbers belong to Reviewers B and E. |
| Cinematics | 8 (low confidence) | No lights or heavy objects are created mid-cinematic: the victory adds one plain fish mesh, and the cave cinematic adds gulls with shared geometry. The cave dressing spike happens when the cave is installed, about 1.8 km ahead, not during the cinematic. |
| **Performance and stability** | **7.5** | Every round-1 Major is fixed or largely fixed, and lifecycles, light count and heap hold over 130–200 km. Three things keep it below 9: new unsliced main-thread spikes (rock views, sea-cave dressing), the mist/water intersection artefact, and heavier, poorly scaled finish and start scenes. GPU cost is still unmeasured. |
| Accessibility and controls | 7.5 (low confidence) | The input stack is unchanged. The new snowball glint helps rear-view legibility (Hard). Not otherwise assessed. |
| Overall player experience | 7.5 (low confidence) | Likely stable and attractive on Sprint. Long runs keep periodic 10–50 ms CPU hitches from hazard and cave builds. |

## 4. Defects

### Round-1 findings: status from my own measurements

| R1 | Status | My evidence |
|---|---|---|
| **D1** Scenery chunks built synchronously | **Fixed (small residual)** | See detail below the table. |
| **D2** Streamed shelter `PointLight` → recompiles | **Fixed** | `shelter.ts:90` has no light. `endless.test.ts` over 130 km found 0 lights in the scenery, hazard and shelter groups, and every light count it observed was 0. The only remaining `new PointLight` calls in `src` are the load-time harbour (2), the Alpine resort and the persistent Yeti rim light. No cave, cinematic or streamed object adds a light. |
| **D3** No water on arms beyond the 4 nearest | **Fixed (forward view)**, with a new minor issue (defect 7) | See detail below the table. |
| **D4** Peach rectangle (DistantRanges / open sector) | **Fixed** | The block at x 1170–1405 in round-1 `06_long_distance.png` is absent in round-2 `06` and `04b`. `ranges.ts:69` `FAR_CLAMP` pins the ridge and haze vertices inside the far plane only for `openSector` looks, so Alpine shaders are unchanged. Clamping z per vertex is sound here, because the band is depth-write-off haze behind everything else. |
| **D5** Water drawn first, full-screen quads, `discard` | **Mostly fixed** (static analysis) | See detail below the table. |
| **D6** Gust: 120 `heightAt` per frame | **Fixed** | A 10×6 grid with bilinear lookup. Measured **0.047 ms** per active gust update (round 1: 0.67). Views more than 150 m behind are hidden and frozen. |
| **D7** Scenery ignores the preset | **Partially fixed** | Low now keeps 5 chunks ahead. Low/high scenery: 49 d / 70 kt vs 63 d / 98 kt. The harbour and start area do not scale (defect 5). |
| **D8** Hazard materials not compiled at load | **Fixed** | See detail below the table. |
| **D9** Hazard views pop in 400–656 m ahead | **Fixed** | `World.ts:162-170` streams one band per frame out to d = 912 m. Views therefore appear **912–1168 m** ahead. The remediation note's "1.1–1.36 km" overstates this slightly. Obstacles stream to 1.3–3.2 km. |
| **D10** Absolute-coordinate geometry (float32 at 100+ km) | **Not fixed** (engine-wide, deferred) | Chunks, hazard views and the cave dressing are still built in absolute coordinates. Nothing has changed since round 1 (0.4 mm view-space error at 10 km, 15 mm at 150 km). |
| **D11** Module singletons never disposed | **Not fixed (accepted), bounded** | Now **5 materials and 2 textures**: the new `skin` material is added to round 1's 4. They are bounded and pinned by `fjord_streaming.test.ts` (≤ 6 / ≤ 3). The developers' reasoning (disposal would force a recompile) is valid. |
| **D12** Sea-cave net leaks and animates when unplaced | **Fixed in effect** | `seaCave.ts:493` returns early when the net is unplaced. `netG` is still not disposed in that case, but it was never rendered or uploaded, so GC reclaims it. |
| §10 Endless disposal test | **Done** | `tests/unit/fjord_streaming.test.ts`: 120 km with real views. I reproduced it independently: 4,682 geometries tracked, 0 undisposed, 998 hazard views created and all disposed on teardown. |

**D1 detail.**
- `FjordScenery.stream` only queues builds. `pump(3 ms)` runs every frame (`World.ts:351`) over a generator (`scenery.ts:132`).
- `hitch2.test.ts`, 40 km of Endless at 60 fps and 30 m/s (80,000 frames), CPU time. Frames with scenery work: p50 3.2 ms, p99 17.5 ms, max **22.6 ms**.
- Only **30 frames > 8 ms and 5 > 16 ms** in about 22 minutes of play. Round 1 had about one 23–300 ms build per 512 m.
- The residual long slices are single `house()` builds and the final `Batch.build` merge (p99 19.5 ms).

**D3 detail.**
- `waterReaches()` fills slots with the arm under the camera and the arms ahead first. `SEA_SLOTS` is 6.
- `slots.test.ts`, 28 variants (classic, 3 dailies and 3 custom seeds × 4 lengths), every 50 m: **0.00%** of positions have an undrawn arm within 12 km ahead. The arm under the camera is never missing.
- Behind the camera it is a different story (defect 7).

**D5 detail.**
- `renderOrder` is now 1 (`water.ts:127`), so the water draws after the opaque terrain.
- Each quad is scaled and placed to its arm's [z0, z1) (`water.ts:150-155`).
- The shader still contains `if (P.z < uZ0 || P.z >= uZ1) discard;` (`water.ts:72`). With depth writes on, `discard` stops many GPUs (and all tile-based HSR GPUs) from rejecting hidden fragments early, which is exactly what the reorder was meant to achieve.
- That discard is now redundant: the geometry is already clipped.
- **Fix:** remove it (or keep a 1 m geometric overlap instead), then profile with `renderer.info` and GPU timer queries.

**D8 detail.**
- `HazardLayer.warmup()` (`presentation/hazardViews.ts:108`) puts one view of each kind into the scene for `renderer.compile`.
- For all 12 variants (sprint to endless × classic/daily/custom), both `sea-gust` and `scoured-rock` were warmed, and 0 warm views were left after the first `update()`.
- One caveat: disposing the warm gust view releases its cloned `PointsMaterial`. The program survives only because a material with the same key stays alive. The always-present snowfall `PointsMaterial` (`Environment.ts:125`, also map + transparent + sizeAttenuation) very likely shares it, and live gusts cover 99.6% of frames (1 zero→nonzero transition in 130 km). I could not confirm the key equality without a GL context.

### New or remaining defects

#### 1. Major (new): scoured-rock hazard views are built synchronously on the main thread, at 12–53 ms CPU per band

**Evidence:**
- `World.stream` creates one hazard band per frame out to 1.1 km (`World.ts:162-170`). `HazardLayer.add` builds every view of that band in the same call.
- The round-2 `rockView` (`fjord/views/hazardViews.ts:197`) does the following:
  - drapes a 12×44 ring skin of 529 vertices, each with an `m.heightAt` call;
  - drapes every vertex of 4–6 subdivided rib boxes (about 122 vertices each, again with `heightAt`);
  - adds 26 stones;
  - runs `toNonIndexed`, `computeVertexNormals` and `mergeSimple`, which uses `push(...array)` spreads.
- Measured (`hitch2.test.ts`, CPU time, 40 km of Endless): frames that create hazard views are **p50 11.8 ms, p90 19.6, p99 46.8, max 53.4 ms**. **98 of 145 were > 8 ms and 28 were > 16 ms.**
- That is a > 8 ms main-thread hitch about every 400 m, and a > 16 ms one about every 1.4 km.
- A single `rockView` measured 20 ms median wall-clock under load.
- This is the same class of problem as D1, re-introduced by the art remediation of the rock view. It is now the largest periodic main-thread cost in Fjord.

**Fix:**
- Queue view creation in `HazardLayer` and build within a per-frame budget, the same as `SceneryView.pump`. Views are visual-only and now created 900+ m ahead, so there is ample lead time.
- In `rockView`, sample the ground once on a small grid (as the gust view now does) and drape the skin and ribs from it, instead of about 1,100 `heightAt` calls.
- Replace `mergeSimple`'s `push(...)` spreads with preallocated `Float32Array`s.

#### 2. Major (new): sea-cave dressing is built in one frame mid-run, at 49–63 ms CPU per cave

**Evidence:**
- `World.stepCaves` time-slices `Cave.buildSteps`.
- When the last slice finishes, `installCave` (`World.ts:246-252`) runs `presentation.cave.dress()` synchronously in the same frame.
- The round-2 `dressSeaCave` (`fjord/views/seaCave.ts`, +550 lines) builds basalt columns, a tide pool, the hoard, lobster pots, a net and two canvas textures.
- Measured (`hitch2.test.ts`, CPU time): **p50 48.6 ms, max 63.4 ms** per cave, 5 caves. Alpine has no dressing (0 ms).
- This happens once per encounter (every 6 km on Endless, 7 times on Expedition) while the player is skiing, about 1.8 km before the cave.
- Each cave also brings about 10 k triangles and 7 meshes, with unique programs: custom-keyed basalt, 2 × `MeshPhysicalMaterial` with clearcoat, and an alpha-tested net.
- `endless.test.ts` "cave residency" shows the caves always overlap (0 gaps on all lengths), so those programs are not recompiled per cave. That part is fine.

**Fix:**
- Make `CavePresentation.dress` a generator (or return a job) and step it after the `Cave` job, one slice per frame. The `Cave.buildSteps` pattern already exists.
- Alternatively, build the dressing as part of the cave job's slices.

#### 3. Major (new, visible): sea-mist billboards are cut by the opaque water plane, leaving hard straight seams on the fjord

**Evidence:**
- `06_long_distance.png`: a pale band with a sharp straight lower edge runs across the water from the left shore at about y 900–960, x 380–1400. A second band sits along the far shore at y ≈ 620.
- `03_mid_mountain.png`: similar pale bands with straight edges at x 230–1000, y ≈ 380, and x 1500–1900, y ≈ 400–460.
- Cause (`fjord/views/mist.ts:39-49, 99-103`):
  - The banks are vertical camera-facing quads, 140–320 m tall (half-height 0.32 × size = 45–102 m).
  - They are centred only 8–40 m above the water level, so their lower part extends far below the water.
  - The water is opaque, writes depth and draws first (`renderOrder` 1 < mist 2), so the mist is cut along the waterline.
  - The bottom fade, `smoothstep(-1.0, -0.55, q.y)`, covers only the lowest 22% of the sprite.
- Computed over the placement ranges, the sprite's alpha at the waterline is **0.89 of its peak (median)**, and 0.33–1.0 for p10–p90. The cut is therefore a hard opacity step of about 0.2–0.35.
- The shader comment says it "fades out as the camera approaches (no hard intersections up close)". It does not handle the intersection at distance.
- Round 1 had the same mechanism, but faintly. The art remediation made the banks "evident" (D13), and the seams are now plainly visible in the primary long-distance shot.

**Fix (cheap, no depth texture):**
- Fade by world height in the fragment shader: `a *= smoothstep(level, level + 25.0, vW.y)`, with the arm's level passed per instance (for example a 5th attribute component, or `aMist.w` repacked).
- Or position each sprite so the water plane falls inside the faded bottom 5% (centre y ≥ level + 0.29 × size).
- Recapture `06` and `03`.

#### 4. Minor (D5 remainder): the water shader still `discard`s although the quads are now geometrically clipped

**Evidence:** `water.ts:72`. See the D5 row above.

**Fix:** delete the discard (the clip in `update()` already bounds z), or replace it with a 1–2 m overlap.

#### 5. Major (new): finish and start scenes grew past the Alpine budget, with little preset scaling

**Evidence** (`budget.test.ts`; "draws" counts renderable objects without shadow passes; triangles include instances):

| Scene | Low | High | Round 1 / Alpine |
|---|---|---|---|
| Fjord harbour (finish) | 81 draws / 267 kt | **83 draws / 301 kt** | Fjord round 1: 133 / 166 kt. Alpine resort: 35–37 draws / 194–241 kt. |
| Fjord start area | **124 draws / 11 kt** | **124 draws / 11 kt** | Alpine: 35 draws / 5 kt |
| Fjord scenery (streamed) | up to 49 draws / 70 kt | up to 63 draws / 98 kt | round 1: 46–60 draws / 42–58 kt |
| Hazard views (15 live) | 49 draws / 35 kt | 49 draws / 35 kt | |
| Peak Fjord additions over 130 km of Endless (scenery + hazard views) | – | 122 draws / 136 kt | round 1: 110 draws / 69 kt |

Additional points:
- The start area is on screen at the start and in the menu. Its 124 draws for 11 k triangles show that props are not batched.
- The harbour is visible for the whole final approach.
- None of this is GPU-measured, but draw count and triangle count are the levers that matter on the low preset, and the low preset barely moves them.

**Fix:**
- Merge the start dressing through the same `Batch` the kits use. The goal should be Alpine parity, about 35 draws.
- Give the harbour a low-preset path: fewer boardwalk planks and piles, merged house kits, and simplified boats beyond about 300 m.
- On low, also reduce the rock-view ring count (12×44 to about 6×24) and mist banks (art-owned remainder of D7).

#### 6. Minor (pre-existing, newly reported): the coastal shelter is built synchronously, at 9–31 ms CPU

**Evidence:**
- `World.syncLodges` builds refuges inline.
- Measured (CPU): Fjord `CoastalShelter` **p50 9.3 ms, max 31.4 ms**, against the Alpine refuge's p50 0.4 ms, max 2.4 ms.
- It happens once per refuge (every 6 km on Endless).

**Fix:** build it through the same sliced job path as fix 2, or reuse the kit-merge cache across shelters.

#### 7. Minor (new from the D3 fix): an arm 0.7–2.5 km behind the camera can have no water in the rear-view inset (Expedition)

**Evidence:**
- `waterReaches` fills every slot with arms ahead up to `WATER_AHEAD` = 14 km. That is 2 km beyond the 12 km far plane, so arms that cannot be seen still take slots.
- The rear-view camera (`App.ts:837`, far 2,500 m, shown in the chase on non-low presets) looks back.
- Measured (`rear.test.ts`, classic Expedition): at **26.5%** of positions, an arm within 2.5 km behind gets no water surface and no shore band. It can be as close as **658 m** behind (p50 1.8 km).
- In 530 of those positions, a slot is spent on an arm that starts beyond 12 km. Classic Endless: 0.2%.
- I cannot confirm visually: there is no rear-view capture on Expedition.

**Fix:** take arms ahead only up to the far plane (12 km), then the arms behind within the rear camera's far distance, then the rest.

#### 8. Minor (new, shared engine file): the Hard snowball glint compiles a new program at the first throw, mid-chase

**Evidence:**
- `SnowballView` (`src/yeti/SnowballView.ts:101-118, 138-141`) creates its slots and the held glint lazily on the first wind-up.
- The new glint uses a `SpriteMaterial`. No other `SpriteMaterial` exists anywhere in `src` (checked with grep), so the sprite program is guaranteed to be compiled at the first throw.
- The view is added in the `GameSession` constructor, after `App`'s load-time `renderer.compile`.

**Fix:** pre-allocate one slot and the held glint in the `SnowballView` constructor, and add the view to the scene before the warm-up compile (or call `renderer.compileAsync` on it at session start).

#### 9. Minor (static analysis, GPU cost not measured): heavier terrain fragment work on every preset

**Evidence:** `snowMaterial.ts`.
- The coastal gneiss adds 5 noise evaluations per rock pixel (`fol`, `folF`, `blk`, `blk2`, `mj`).
- The shore block now runs wherever terrain is within **200 m** above the water (was 12 m): `dh < 200.0`, with `lowWall`.
- None of this is gated by `uDetail`, so low pays the same.

**Fix:** gate the extra octaves with a compile-time define for `low`. Shrink the shore branch to the `lowWall` range (about 190 m is fine), but skip the surf and wash noise above about 12 m.

#### 10. Minor (carried, D10): float32 precision of absolute-coordinate geometry

Unchanged since round 1. The engine-wide fix is to place chunk, hazard and cave-dressing geometry relative to a per-object origin, as `TerrainRenderer` does.

## 5. What works

**Lifecycles over Endless** (`endless.test.ts`, 130 km, high):
- Peak 12 chunks, 1 pending job, 29 live hazard views (21 visible after the 150 m behind-cull) and 1 shelter.
- **0 lights** in streamed groups.
- All 4,682 tracked geometries were disposed. Hazard views: 998 created, all disposed.
- Only the bounded singletons remain (5 materials, 2 textures).

**Heap** (`heap.test.ts`, no tracker, 200 km, scenery pumped and hazard views live):
- 25.3 MB at 0 km, 26.6 at 40 km, 27.9 at 200 km.
- The slight linear growth is consistent with the coast bookkeeping lists (64 crests, 122 hamlets, 35 lookouts).

**Water selection:**
- Forward coverage is complete on all lengths.
- The shore band and the water surface share one deterministic selector, and the committed test asserts it every 64 m.

**Shaders:**
- The coast terrain variant is still compile-time keyed.
- The `ranges` far clamp is look-gated, so Alpine shaders are unchanged.
- The gust spindrift program stays resident (live gusts cover 99.6% of frames).
- The caves overlap, so sea-cave programs are not released and recompiled between encounters.

**Physics:**
- Fixed `PHYS_DT` 1/120 with the accumulator, frame dt clamped to 0.1 s and the 12-step guard, all unchanged.
- The new `groundSlip` is a bounded positional term.
- `relocate` resets velocity, air state and contacts, then crashes once.

**Build:** strict `tsc` is clean. 257 of 257 unit tests pass, including the new `fjord_streaming`, `fjord_gameplay` and `fjord_art` tests.

## 6. Brief compliance (Fjord bullets relevant to Reviewer D)

| Requirement | Status | Evidence |
|---|---|---|
| Sea level and coastline integrate at all supported lengths | **Done (forward); partial (rear view)** | 0% undrawn arms ahead on 28 variants. Rear-view gap on Expedition (defect 7). The evidence is still Sprint-only. |
| Streamed, not fully resident scenes (§5) | **Done** | Bounded residency was measured over 130–200 km. |
| All modes including Endless (§5) | **Partial** | Generation, disposal and memory hold. Periodic main-thread spikes remain from rock views (about every 400 m) and the cave dressing (per cave) (defects 1 and 2). |
| Hazard resource lifecycles (§8 D) | **Done** | Created = disposed, and the committed test covers it. Singletons are bounded. |
| Shader management (§8 D) | **Mostly done** | No streamed lights. Hazard kinds are warmed. Cave programs are kept alive by overlap. Remaining: the sprite glint first-use compile (defect 8). |
| Draw calls / triangle budgets / GPU memory (§8 D) | **Partial** | The harbour is heavier than the Alpine resort, the start area has 124 draws, and the low preset barely scales them (defect 5). Water overdraw is mostly fixed (defect 4). GPU memory was not measurable. |
| Physics timestep stability (§8 D) | **Done** | Fixed 120 Hz step with guards. The new slip and relocate paths are bounded. |
| Production build compatibility (§8 D, §10) | **Done (as far as permitted)** | `tsc` is clean and the unit suite passes. `vite build` and Playwright were not run (forbidden). |
| Endless generation and resource disposal tests (§10) | **Done** | `tests/unit/fjord_streaming.test.ts`. |
| Never claim a frame rate (§8 D) | **Done** | This report claims none. The remediation notes claim none either. |

## Reproducing

From `/home/claude/sf-fjord`:

```
NODE_OPTIONS=--expose-gc npx vitest run --config scratch/vitest.config.ts scratch/review-d-r2/<file>.test.ts --silent=false
```

Use CPU-time figures from `hitch2.test.ts` when the machine is loaded. `endless.test.ts` reads `KM` (default 130) and `Q` (`high`/`low`).
