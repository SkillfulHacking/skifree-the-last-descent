# Review D: Technical Quality, Performance and Stability, Whiteout Ridge, round 4

- **Reviewer:** D (technical quality, performance, stability). I am a model reviewer, not a human playtester. I did not play in real time, and I ran no browser this round (rule of this review).
- **Build:** frozen candidate `71c9ceb` (branch `pass5-whiteout`, draft PR #9). The checkout is at `4d08115`; `git diff 71c9ceb HEAD -- src` is empty.
  - I rebuilt the production bundle into `/tmp/revD4/dist`. Its `main-D2Drj1FT.js` has the same content hash as `candidate/build.txt`, so my build, the perf runs and the e2e logs all used the same bundle.
  - Round 3 was `46ed200`. I read `git diff 46ed200 71c9ceb -- src tools tests`: 10 commits, 72 files, +1,685 / −227.
- **Category owned:** 6, Performance and stability, plus code health.
- **GPU timing is unavailable.** The machine renders with SwiftShader. The only render-side figure in the evidence is `softwareRenderMs` from `prod_frames.mjs`: the median CPU-rasterised time of one 640×360 frame (main pass plus shadow pass). It is a **proxy for submitted work, not a GPU frame time**.

## Verdict

**Category 6: 7.5/10** (R1 6, R2 7, R3 8). **FAIL** against the 9/10 gate. This is half a point **lower** than round 3.

The round's W-086 work is real in code, and I verified most of it:
- the storm-cave dressing is sliced;
- the spindrift textures are singletons;
- ridge-rock shadow casters are down 71 %;
- Ultra is capped at High's scan LOD;
- `checkShaderErrors` is off in the production bundle;
- the fair-weather layers are shown for the load-time compile.

W-087 is fixed properly, and W-092's code part is fixed with a test.

**But the only measurement of the frozen build moves the wrong way on the default preset, and nobody measured the targets W-086 was given.** Whiteout `high` against round 3, with Alpine as the control for run-to-run noise:

| Whiteout 12 km Endless, `high` | R3 `46ed200` | **R4 `71c9ceb`** | Alpine R3 → R4 (control) |
|---|---|---|---|
| CPU frames > 16 ms (target: 0) | 10 | **22** | 3 → 4 |
| CPU frames > 12 ms | 28 | **78** | 12 → 14 |
| CPU p99 / p99.9 (ms) | 8.4 / 11.5 | **9.7 / 14.0** | 7.5 / 8.8 → 7.6 / 9.4 |
| Software render, median ms per frame | 6,537 | **8,886 (+36 %)** | 4,108 → 4,232 (+3 %) |
| Software render × Alpine (target ≤ 1.5×) | 1.59× | **2.10×** | — |

On `low`, Whiteout is now close to Alpine: render 1,558 vs 1,433 ms (1.09×), and 3 frames over 16 ms against Alpine's 4. That is good.

Stability is good:
- `tsc` passes;
- 521/521 unit tests pass (my run);
- the build is clean apart from the chunk-size warning;
- all 11 e2e specs pass. The three first-run failures were test races or stale expectations, not product bugs;
- no page errors and no restarts in any of the four perf runs.

## (a) Scores

| # | Category | R3 | **R4** | Justification |
|---|---|---|---|---|
| 1 | Visual art direction | 6.5 (lc) | — | Not assessed (A owns it). |
| 2 | Environmental uniqueness | 7 (lc) | — | Not assessed. |
| 3 | Skiing and hazard mechanics | 7 (lc) | 7 (lc) | Not assessed (B owns it). The W-078 edge ease and the W-081 per-gust latch read correctly in code. Hazard simulation stays cheap. |
| 4 | Difficulty and fairness | 7 (lc) | 7 (lc) | Not assessed (B owns it). |
| 5 | Cinematics | 7 (lc) | — | Not assessed (C owns it). The new cinematic code paths allocate trivially. The first cave's dressing materials are still not pre-compiled (D4-7). |
| **6** | **Performance and stability** | **8** | **7.5** | Verified in code: sliced dressing, texture singletons, shadow casters −71 %, Ultra capped, shader-status stall removed, weather layers warmed. Measured on the frozen build: Whiteout `high` CPU spikes 2.2× round 3 and software render +36 % (Alpine +3 %), so the default preset moves away from W-086's targets. The rim band doubles the full-scan rocks, with no LOD on any preset (D4-1, D4-2). No census, link count or slice timing (D4-9). SonarCloud gate still red (D4-8). Stability is clean. |
| 7 | Accessibility and controls | 7.5 (lc) | — | Not assessed (E owns it). |
| 8 | Overall player experience | 7 (lc) | — | Not assessed (F owns it). |
| — | **Code quality / architecture** | — | **8** | Clean, commented, every fix has a test. Weak spots: the storm-cave generator breaks World's abandonment contract (D4-5); a shared texture is mutated per instance (D4-6); the perf guard test is still relative (D4-4). |

## (b) Findings

### Major

#### D4-1 (Major). W-086's targets were neither measured nor met; Whiteout `high` regressed on the evidence that exists

**Targets set in round 3** (`DEFECTS.md` W-086, my round-3 report):
- no Endless frame over 16 ms outside cinematics;
- `high` within 1.5× of Alpine in the triangle census;
- at most 2 program links after `startRun`.

**What the candidate supplies:** four `prod_frames` runs (`candidate/perf/*.json`). There is no reading of them in `CANDIDATE.md`: perf appears only as "CPU frame cost (`perf/`)". There is no census, no link count and no cave-slice timing.

**What those runs show** (my statistics from the raw `step` arrays, `/tmp/revD4/stats.py`; table above):
- **CPU.** Frames over 16 ms went from 10 to 22, and frames over 12 ms from 28 to 78. Alpine's counts stayed level (3 → 4, 12 → 14).
  - The over-8 ms count is noisy between runs: Alpine went from 75 to 128 on code whose step data is unchanged. So I rely on the over-12 and over-16 counts.
  - The R4 Whiteout spikes cluster in two stretches: run deciles 3 and 7 hold 284 and 366 of the 1,425 frames over 8 ms.
  - Whiteout `low` shows no such clusters. Ridge rocks are built on every preset, so the clustered cost is a `high`-only one. I could not attribute it without a browser.
  - Caveat: the course itself changed (minSlope 14 → 15, per-cell obstacle stream), so the frame counts differ (36,516 → 35,894). The comparison is not frame for frame.
- **Render proxy.** The SwiftShader median rose 36 % for Whiteout `high` and 3 % for Alpine on the same machine. Against Alpine that is 2.10×, up from 1.59×.
  - The one-frame `renderer` snapshot agrees in direction: 215 → 670 calls and 3.21 M → 5.46 M triangles. It is a single frame, so it is only indicative.
- **Max frame** 23.3 ms; none over 33 ms.

**Player impact:**
- On the default preset, about 2 dropped frames per minute of Endless on this desktop V8 (22 in ~10 minutes at 60 Hz). That means 40–60 ms frames on a laptop CPU 2–3× slower.
- More geometry and fill work than round 3 for the GPU, where round 4 was meant to bring it down.
- `low` is fine.

**Fix:**
1. Fix D4-2 and D4-3.
2. Re-measure against the three targets with the round-3 tools: the census, the link walk, and `frames_caves.mjs` for the slice sizes.
3. Write the reading into `candidate/perf/README.md`.
4. Find the `high`-only CPU clusters with a CDP profile of deciles 3 and 7.

### Minor

#### D4-2 (Minor; main contributor to D4-1). The rim band doubles the full 5,000-triangle scans, on every preset, with no LOD

**Change:** `ridgeRocks.ts:133-143` (W-065).
- Rim samples went from every 4th to every 2nd.
- The skip went from 35 % to 12 %.
- The rocks are full scans (`loadScan`, no `decimateUnit`). `quality` only selects the material.

**Measured** (my Vitest census, `/tmp/revD4/vt/census.test.ts`, calling `ridgeRockPlacements` on both trees; Classic, Relaxed):

| Course | R3 rocks (casters) | **R4 rocks (casters)** | rim R3 → R4 |
|---|---|---|---|
| Sprint 3 km | 130 (130) | 142 (69) | 23 → 35 |
| Standard 10 km | 473 (473) | 545 (271) | 85 → 157 |
| Endless 12 km (the perf run) | 1,103 (1,103) | **1,778 (322)** | **641 → 1,316** |

- **Endless:** 92 → 148 full scans per km. With 6 resident chunks (1.5 km), that is about 0.7 M → 1.1 M scan triangles resident in the main pass, before culling.
- **Shadow casters:** fell 71 %, which is the W-086 claim, verified. So triangles moved from the shadow pass into the main pass rather than going away.
- **Not done** (and the tracker admits it): the coarse LOD.
- **`low`:** also draws these 5,000-triangle scans, while `low` obstacles use the procedural rock.

**Fix:**
- A second scan LOD at grid 6–8 (about 300–400 triangles) for the rim, flank and spire families. `decimateUnit` already exists.
- A coarse or procedural rock on `low`.
- Optionally, the rim band as one merged low-poly strip per chunk.

#### D4-3 (Minor). The cloud sea's fragment cost doubled, over a larger visible area

`cloudSea.ts` FRAG:
- **Round 3:** 2 `fbm` calls (8 value-noise evaluations).
- **Round 4:** 4 `fbm` calls (16 evaluations): two for the billows, one for the floor tone, one for the ridged spurs.

`farRanges 0.3` lowers the far ranges, so more of the drop-side view is now this plane rather than terrain. It is transparent and depth-tested (drawn after the opaques), so hidden pixels are rejected.

This is probably part of the +36 % software render. It is cheap on a real GPU, but it is per pixel over a large part of the clear-weather frame.

**Fix:** fold the floor and spur noise into one `fbm` (reuse the octaves of `c`), or bake a tiling floor texture.

#### D4-4 (Minor). The dressing is sliced; the largest slice is unmeasured and the guard test is still relative

**Verified in code:**
- `dressStormCaveSteps` yields after the grains, then after `browTriangles`, the roots, the cornice, the feathers and the bank (`stormCave.ts:117-150, 346-475`).
- `World.stepCaves` advances one slice per frame (`World.ts:245-249`).
- The registration passes `dressSteps` (`views/index.ts:25`).
- The 1,260-stroke spindrift canvas is drawn once per page.

**Open:**
- The first architecture slice holds the material set-up plus all of `browTriangles`. That function was 7.8 ms in my round-3 profile, above the 6 ms streaming budget, and it can coincide with terrain streaming in the same frame.
- No cave-instrumented run exists for this build, so the slice sizes are unknown.
- `tests/unit/cornice_roots.test.ts` is unchanged. It still asserts only that it is faster than `Raycaster` (my run: `gather 25.8 ms … vs Raycaster 83.1 ms`), and it would pass a 50 ms dressing.

**Fix:**
- Yield inside `browTriangles` every N triangles, or use `dressingTicker(4)` as Fjord does.
- Make the test absolute per slice: drive the generator and assert the slowest `next()` is under 8 ms, with a margin for CI.

#### D4-5 (Minor, code health). An abandoned storm-cave dressing leaks what it has built so far

`World.disposeCave` (`World.ts:316-322`) abandons a half-built dressing with `job.return(null)`. Its comment states the contract: "a generator's finally blocks dispose its partial work". Fjord's `dressSeaCaveSteps` has the `try/finally` (`seaCave.ts:236-240`).

`dressStormCaveSteps` and `buildStormArchitectureSteps` have none. An abandoned job therefore never disposes:
- the two `Grains` (each a geometry, a `PointsMaterial` and a flake canvas texture);
- `snow` and `rime`;
- the cornice geometry;
- the feather instances.

`uRime` is also left at 1 on the cave rock material, which is disposed with the cave, so that part is harmless.

**When it happens:** a quality change, quitting, or a large jump of the streaming window during the roughly 7 frames of the job. It is rare, but it is a real GPU leak.

**Fix:** wrap both generators in `try { … } finally { if (!done) dispose partial }`, as Fjord does. Add a unit test that calls `return()` after each slice and checks the disposables count.

#### D4-6 (Minor). The shared spindrift texture is scrolled by every live dressing

`built.update` advances `sheetTex.offset` (`stormCave.ts:497-500`). `sheetTex` is now the module singleton, so with two storm caves live (Endless keeps up to 2), the sheet scrolls at twice the speed in both.

**Fix:** give each dressing a `tex.clone()`. Clones share the `Source`, so the canvas is uploaded once. Or move the scroll into a material uniform (`onBeforeCompile`) and keep the texture static.

#### D4-7 (Minor; W-053b remainder). Shader warm-up is better, not complete

**Verified:**
- `checkShaderErrors = false` under `import.meta.env.PROD` (`App.ts:77-79`; present as `debug.checkShaderErrors=!1` in my bundle). This removes the synchronous `getProgramInfoLog` stall I profiled at 81.6 ms.
- `WhiteoutScenery.warmup` shows the storm dome and wall, the cloud sea and the blowing snow for `renderer.compile`.
- Each of those has its visibility rewritten in its per-frame update (`cloudSea.ts:117,132`, `sky.ts:234`, `blowingSnow.ts:143`), so nothing stays visible by mistake.

**Not done:**
- The storm-cave dressing materials (snow, rime, the sheet's `MeshBasic` with map and alphaMap, the grain `Points`) still compile at the first Endless cave.
- three r187's `compile` builds no shadow-depth variants for classic materials.
- The ridge-rock material only compiles once the async scans arrive.

**Unmeasured:** there is no link census, so the "≤ 2 links after start" target is unverified.

**Fix:**
- Build one dressing at load into the warm-up set, then dispose it.
- Render one off-screen frame with the shadow map after the scans resolve.
- Re-run the link walk.

#### D4-8 (Minor, CI). The SonarCloud gate still fails: "B Security Rating on New Code"; the cause is not visible from here

**Read-only evidence** (`gh api …/commits/71c9ceb…/check-runs`, run 138450537149, and its annotations):
- The gate's single failed condition is **B Security Rating on New Code (required ≥ A)**.
- **All 26 annotations are listed, and none is a vulnerability:**
  - 8 × "Add at least one assertion" on `*.measure.test.ts` (2 new: `ladder`, `parity`);
  - 2 × "async operation in constructor" (`Vegetation.ts:111`, `ridgeRocks.ts:240`);
  - 8 × PATH-variable hotspots in `tools/*.mjs` (new: `prod_frames`, `rim_view`). Hotspots do not set the rating;
  - 8 × `Number.NaN` / `Number.isNaN`.
- The head commit `4d08115` has no SonarCloud run yet; only `test` (in progress) and Gitar (success) are posted.
- `sonarcloud.io` is refused by this environment's proxy, so I could not read the issue itself.

**What a B means:** at least one minor (low-impact) vulnerability on new code. Round 3's path traversal was major, which gave C.

**W-087 verified:**
- `tools/tension_summary.py` now opens only files it enumerated itself under two fixed directories. It skips symlinks, and the argument is used only as a lookup key.
- `tests/unit/tool_paths.test.ts` covers `..`, absolute paths outside the tree, `node_modules`, and symlinks by name and by path.
- The major issue is gone (C → B).

**Probable cause (inference, unverified):**
- `tension_summary.py` is the only Python file and the only CLI-argument-taking file Sonar's taint engine would follow in the PR's new code.
- The remaining flow is `sys.argv → os.path.normpath(key) → comparison against the catalogue`. It ends in a different outcome when a name exists (summary) or not (exit message echoing `key`).
- A low-severity taint rule could flag that: a "filesystem oracle", or a residual path flow downgraded through the comprehension filter.
- Nothing else in the round's diff is a plausible vulnerability sink: no `eval`, no `innerHTML` from input, no `postMessage`, no workflow or dependency changes.

**Fix:**
1. The owner opens the issue in SonarCloud (`…/project/issues?id=SkillfulHacking_skifree-the-last-descent&pullRequest=9&types=VULNERABILITY`) to confirm.
2. Then either:
   - remove the argument-to-file mapping entirely (print the catalogue and select by index, or summarise every file in `.measure/`); or
   - exclude `tools/**` in `sonar-project.properties` with the rationale recorded (developer-only CLI, never shipped).
3. No dismissing.

**Player impact:** none.

#### D4-9 (Minor, evidence and tracker). The perf evidence improved in form, not in coverage

**Done (W-084 perf part, verified):** each JSON records `sha` (`0787168`, source-identical to `71c9ceb`), `quality`, `biome` and `course`. There is a `low` run for Whiteout and for Alpine.

**Missing:**
- No `README` or reading of the numbers. `CANDIDATE.md` does not say that `high` regressed.
- No census, no link count and no slice timing: the three measurements W-086's targets are defined in.
- The `renderer` block is still a single-frame counter (see round-3 D3-6).
- No Fjord run on this build. Fjord's pace changed (headwind).

**Tracker:**
- W-086 is "CLAIMED (re-measure at the freeze)", but there is no re-measure reading.
- W-038 still says "awaiting reviewer D". It was verified in round 2; this is the third time I have noted it.
- W-016 and W-017 are still `OPEN`, although the 40 km memory run and the frame-cost runs exist.

**`CANDIDATE.md`:** `e2e/whiteout_rerun.txt` (a second passing run) is not explained.

#### D4-10 (minor). Smaller code notes

- **`blizzardPushDir`** (`hazards.ts:244-270`) builds a template-string key on every call, at 120 Hz per active cell. That is small GC churn.
  - The module-level memo is bounded (512, FIFO) and deterministic, so it is safe across runs.
  - A numeric key, `g0` rounded and combined with `h.seed`, would allocate nothing.
- **Low now renders the rear inset during the leap** (`App.ts:869-872`): a second scene render for about 2–3 s at each chase start, on the preset meant for the weakest devices. It is probably fine because the viewport is small, but unmeasured.
- **Rim rocks no longer cast shadows** (`ridgeRocks.ts:269-277`), with the comment "shadows nobody on the line can see". The round-4 rim band sits 0.6–2.2 m past the rim, in the gameplay view. A missing contact shadow there may show. This is low confidence and belongs to A.
- **`cellStream`** creates a new `Rng` per 6.5 m cell during band generation. It is inside the time-sliced generator, so it is harmless.

### Round-3 items, re-verified

| Item | Status on `71c9ceb` | Evidence |
|---|---|---|
| D3-1 dressing slice | **Partly fixed:** sliced; largest slice unmeasured (D4-4) | Code |
| D3-1 spindrift texture singleton | **Fixed** (side effect D4-6) | `stormCave.ts:509-577` |
| D3-2 shadow casters | **Fixed for the ridge families:** casters 1,103 → 322 per 12 km | My census |
| D3-2 coarse LOD | **Not done**; rim count doubled (D4-2) | Code, census |
| D3-2 `ultra` cap | **Fixed:** `SCAN_GRID.ultra = 12` | `scanModels.ts:99`; `scan_lod.test.ts` updated |
| D3-3 `checkShaderErrors` | **Fixed** in production | Bundle grep |
| D3-3 weather layers warmed | **Fixed** in code | `scenery.ts:247-251`, `World.ts:479` |
| D3-3 cave dressing, shadow variants, scan materials | **Not done** (D4-7) | Code |
| D3-5 / W-087 path traversal | **Fixed and tested**; gate still B (D4-8) | Code, `tool_paths.test.ts`, check run |
| D3-6 SHA, preset, `low` run | **Fixed**; README and census missing (D4-9) | perf JSON |
| D3-7 `game.spec` flake | Test changed (`hold` across the stepped frames); E owns it | `game.spec.ts` diff |
| W-092 lunge reset | **Fixed** with a test | `YetiAI.ts:125-131`, `yeti_lunge_reset.test.ts` |

### Code quality of the round-4 diff (summary)

**Good:**
- Every change cites its defect and reason.
- The regression tests were written to fail first: W-078 edge, W-081 direction, W-087 paths, W-092 lunge, cave history, obstacle stream, sim streaming.
- The settings and record-book migration is idempotent, keeps unknown fields, and is tested both in unit tests and in a browser spec.
- The sync `dressStormCave` simply drains the generator, so the two paths cannot drift apart.
- The ridge-rock regrouping also fixed round 3's unindented block.

**Weak spots:** D4-5, D4-6, the relative perf guard (D4-4), and two more Sonar "no assertion" measurement tests (`ladder`, `parity`).

## (c) What I ran and read

1. `npx tsc --noEmit`: exit 0 (`/tmp/revD4/tsc.txt`).
2. `npx vitest run`: 61 files, **521/521**, 433 s (`/tmp/revD4/unit.txt`). This matches `candidate/unit.txt`.
3. `npx vite build --outDir /tmp/revD4/dist`: OK. `main-D2Drj1FT.js` is 1,550 kB (488 kB gzip), with the same hash as `candidate/build.txt`, plus the chunk-size warning.
4. Frame statistics recomputed from the raw `step` arrays for the four R4 runs and the R3 Whiteout and Alpine runs: percentiles, over-8/12/16/33 counts, spike contexts and spikes per decile (`/tmp/revD4/stats.py`).
5. Ridge-rock placement census on both trees, using Vitest with the round-3 `src` extracted by `git archive` into `/tmp/revD4/r3` (`/tmp/revD4/vt/census.test.ts`).
6. Read: `CANDIDATE.md`, `DEFECTS.md`, round-3 `CONSOLIDATED.md` and `REVIEW_D_tech.md`, the e2e, tsc and build logs, and the full source diff for my area. Also three r187 `WebGLRenderer.compile`.
7. CI: GitHub check runs and SonarCloud annotations for `71c9ceb` and `4d08115`, read only through `gh api` (REST). I changed nothing on GitHub.

## (d) What I could not verify

- **GPU frame time** on any real GPU. Every GPU statement rests on the SwiftShader proxy or on counts.
- **Census, program links and dressing slice sizes on this build.** No browser runs were allowed in this review, and the candidate supplies none of these.
- **Attribution of the `high`-only CPU spike clusters** (D4-1).
- **The SonarCloud vulnerability's text and location** (D4-8): the host is refused by the proxy.
- **Endless memory over 40 km on this build.** The perf runs show no errors, and heap at the end is 116–122 MB against 105 MB in round 3, but that is one sample at the end, not a trend.

## What would raise Performance and stability to 9

1. **D4-2 and D4-3:** a coarse scan LOD for the rim, flank and spire families (and `low`), and a cheaper cloud-sea floor. Then census Whiteout `high` within 1.5× of Alpine.
2. **D4-1:** no Endless frame over 16 ms in the 12 km `high` run (22 today), with the CPU clusters profiled and removed.
3. **D4-4, D4-5, D4-6:** finer slices with an absolute per-slice test; `try/finally` in the storm-cave generators; a per-dressing texture clone.
4. **D4-7:** a dummy dressing in the warm-up and an off-screen shadow frame, then 0–2 links in the walk.
5. **D4-8:** the Sonar gate green by a real change or a recorded exclusion of `tools/**`.
6. **D4-9:** `perf/README.md` with the readings, and the tracker rows corrected.
