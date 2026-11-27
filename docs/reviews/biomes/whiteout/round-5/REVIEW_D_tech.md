# Review D: Technical Quality, Performance, Code Health and Security, Whiteout Ridge, round 5

- **Reviewer:** D (category 6: performance and stability, including code health and the security gate). I am a model reviewer, not a human playtester. I did not play in real time; nothing here rests on motion, timing, sound or touch that I experienced.
- **Frozen candidate:** `729e226` (draft PR #9; the PR head on GitHub is `729e226`). The checkout is at `f71f1b4`; `git diff 729e226 HEAD -- src` is empty.
- **Build identity:** I rebuilt `729e226` from `git archive` into `/tmp/revD5/dist`. `main-rJLXQg8W.js` has the same content hash as `candidate/build.txt`, so my build, the perf JSON (`bbbef83`, source-identical) and the e2e logs all used one bundle. `checkShaderErrors=!1` is still in the production bundle.
- **GPU timing is unavailable.** The machine renders with SwiftShader. `softwareRenderMs` is CPU-emulated rasterisation of one 640×360 frame. It ranks submitted scene work between builds; **it is not GPU time**. CPU step times and software-render times are kept apart throughout.
- **No perf re-run.** When I looked, the 2-CPU machine had a load average of ~5 from other reviewers' browser jobs. Any `prod_frames` run of mine would not be comparable, so every perf figure below is from the committed JSON, recomputed by me from the raw `step` and `perKm` arrays (`/tmp/revD5/stats.py`).

## Verdict

**Category 6: 8/10** (R1 6, R2 7, R3 8, R4 7.5). **FAIL** against the 9/10 gate.

**What improved, verified:**
- **The round-4 regression is gone.** Whiteout `high` software render is 5,868 ms against Alpine's 5,336 ms (1.10×, was 2.10×).
- **The rim LOD works.** My census of the 12 km Endless course gives ridge-rock triangles of 0.741 M per km at full scan and 0.119 M per km at the new `high` grids, a cut of 84 %.
- **The cloud sea's noise is halved:** 16 value-noise evaluations per pixel down to 8.
- **D4-5 and D4-6 are fixed with real tests.** The storm-cave generators now have try/finally, and each cave has its own texture clone. `storm_cave_abandon.test` fails on the round-4 source with the expected assertions (`expected 0 to be ≥ 6`, and the same texture object in both caves).
- **The Gitar finding was fixed with a test that bites.** `rescue_dispose.test` fails on `23d9113`, before the fix, naming exactly the searchlight pool and glare.
- **Stability is clean:**
  - tsc exits 0 (my run);
  - the bundle hash matches;
  - 542/542 unit tests in the candidate log, and 26/26 in my targeted run;
  - 37/37 e2e tests on their first run (log);
  - six perf runs with 0 page errors and 0 restarts.

**What keeps it below 9:**
1. **The SonarCloud gate is still red** (B security rating on new code). This round's net security change is zero: two path traversals introduced, two fixed. The annotation set on `729e226` is identical to round 4's. The history points to a specific, testable candidate (D5-1).
2. **Two of W-086's three targets are not met:** 17 CPU frames over 16 ms on `high`, and shader compiles in play. The README understates the compile count: the tool reports a net change of 6, but the samples show at least 9 distinct programs and at least 12 link events, with a 3-program release-and-relink cycle per cave (D5-2).
3. **The largest cave slice was not reduced** (24.7 ms cave, 14.5 ms dressing on `high`; 31.1 ms cave on `low`). D4-4's absolute per-slice test was not written (D5-3).
4. **Smaller items:**
   - a new state leak: the cinematic gloom survives a Retry (D5-4);
   - the Low inset is now on for the whole chase, unmeasured (D5-5);
   - claims in the tracker and in `CANDIDATE.md` that the code does not bear out (D5-6).

## (a) Scores

| # | Category | R4 | **R5** | Justification |
|---|---|---|---|---|
| 1 | Visual art direction | — | — | Not assessed (A owns it). |
| 2 | Environmental uniqueness | — | — | Not assessed. |
| 3 | Skiing and hazard mechanics | 7 (lc) | 7 (lc) | `intensityAt(z)` is position-only and deterministic. The gust memo changed key but not behaviour. Not otherwise assessed. |
| 4 | Difficulty and fairness | 7 (lc) | — | Not assessed (B owns it). |
| 5 | Cinematics | — | — | Not assessed. `Timeline.calm` holds each shot's *end* pose from its first frame, which explains the welcome-beat RCM framing failure the developer found (C/E). |
| **6** | **Performance and stability** | **7.5** | **8** | Regression removed: render 1.10× Alpine, rim triangles −84 %. Disposal fixes are tested and fail on old code. Stability clean. **Not met:** Sonar gate (B); frames over 16 ms (17, target 0); compiles in play (≥ 9 programs, ≥ 12 links, target ≤ 2); cave slice 24.7–31 ms. |
| 7 | Accessibility and controls | — | — | Not assessed (E owns it). |
| 8 | Overall player experience | — | — | Not assessed. |
| — | Code quality / architecture | 8 | 8.5 | Clear comments that cite their defect, and fixes with regression tests. Weak spots: the gloom reset (D5-4), the duplicated fog-colour code in `Environment`, a relative cave-dressing test, and an abandon test that checks only one abandon point. |

## (b) Findings

### Major

#### D5-1 (Major, release gate). SonarCloud still reports "B Security Rating on New Code". The evidence points at the `PATH` lookups in four tools

**Read-only evidence:** REST only, with `env -u GITHUB_TOKEN GH_TOKEN=x gh api …`. I neither printed nor looked for any token.
- **`729e226`:** check run 139866191205, conclusion `failure`. The single failed condition is "B Security Rating on New Code (required ≥ A)". It has 26 annotations.
- **No change since round 4.** The set of (path, title, issue key) for those 26 annotations is **identical** to round 4's `71c9ceb`, also rated B. Round 5's security change is therefore zero:
  - `946b531` introduced `tools/tension_table.py:20` and `tools/ladder_table.py:15`, both "Path Traversal via command-line argument" (`failure`), and the rating went to C;
  - `e6193cf` removed them, and the rating went back to B.
- **Vulnerabilities do appear in annotations on this project.** Both round-5 path traversals and round 3's `tension_summary.py` were annotated. "Not in the GitHub annotations" therefore needs care: the annotations are the only window we have.

**Rating history across all 120 PR commits** (from `/tmp/revD5/sonar_hist.txt`, read against the security-relevant annotations on each run):

| Commit | Rating | Security-relevant annotations |
|---|---|---|
| `526785a` (first Sonar run) | **D** | 5 × "Make sure publicly writable directories are used safely" (`failure`), plus the "PATH" ones (`warning`) |
| `88b3721` | D | the same, plus the `tension_summary.py` path traversal (`failure`) |
| `15d9628` (the /tmp fix) | **C** | path traversal (`failure`) and "PATH" (`warning`) |
| `4b2c892` (after the W-087 fix) | **B** | **only** the "PATH" annotations (`warning`) |
| `71c9ceb` … `729e226` | B (C on `946b531`–`50dc466`) | "PATH" only, apart from the two round-5 traversals while they existed |

- **Every step of the rating coincides with security-phrased annotations disappearing.** Since `4b2c892`, the only security-phrased items left are the "Make sure the "PATH" variable only contains fixed, unwriteable directories" findings:
  - `tools/prod_frames.mjs:16`, `tools/whiteout_evidence.mjs:21`, `tools/handoff_strip.mjs:17` and `tools/rim_view.mjs:16`, each posted twice;
  - each is the same line, `execSync('git rev-parse --short HEAD') … execSync('git status …')`, which runs a bare `git` looked up on `PATH`.
- **Severity fits.** Annotation level follows severity: `failure` for the major and critical items, `warning` for minor ones such as `NaN`. These are `warning`, and B means "at least one minor vulnerability".
- **Caveat.** In stock SonarQube, S4036 ("PATH") and S5443 ("publicly writable") are Security Hotspots, which do not set the Security Rating. The history above suggests they count on this project, through its quality profile or MQR mode. That is an inference, not a reading of the issue.
  - `15d9628` also changed `/tmp` defaults in `tests/review/*` that were never annotated. So unannotated issues cannot be ruled out entirely.

**Other candidates I checked, none with evidence:**
- **The fixed table tools.** The argument is only matched against a catalogue the tool built itself. The residual reflections, `sys.exit(f'refusing {key}…')` and `print(p.split('/')[-1])`, are console echoes, not sinks.
- **`Menu.ts` `innerHTML`.** Round 5 added `it.note` (constants). The course-code echo is HTML-escaped (`App.ts:480`).
- **`new Function` in `tests/e2e`.** This is an S1523 hotspot in test code, and it is not annotated.
- **Nothing else in the PR's non-`src` files.** It has no workflow, dependency, Docker or properties changes; the only non-`src` code is `tools/*.mjs`, the three `.py` tools and `vitest.sim.config.ts`.

**"SonarCloud API returned 403" checked without credentials:**
- **Confirmed unreachable, but the 403 is the proxy, not SonarCloud.**
  - From the shell, `curl https://sonarcloud.io/api/server/version`, an unauthenticated public endpoint, fails with `CONNECT tunnel failed, response 403`. This environment's egress proxy refuses the host; a token would not change that.
  - WebFetch of the issues API and of the issues page both return a site-side `client_error`, with no further detail.
  - The GitHub repo is public (`private: false`). If the Sonar project is public too, the owner can open the issue link in a browser without a token.
- **W-087 therefore stays BLOCKED** under the owner's rule 3. The developer did not suppress or exclude anything and did not touch the gate. I verified that no `sonar-project.properties` exists: the project uses automatic analysis.

**Acceptance (owner-led):**
1. The owner reads the open security issue(s) on PR #9 and records key, rule, severity, file and line.
2. **If it is the "PATH" finding:** make a root-cause change in the four tools. Remove the `PATH` lookup: read `.git/HEAD` and `refs` with `fs`, or call `execFileSync` with an absolute git path and a fixed `env.PATH`.
3. Add a regression test that greps `tools/*.mjs` for bare `execSync('git`.
4. Re-analyse, and the gate shows A.
5. No rule suppressed, no `tools/**` exclusion, no gate change.

### minor

#### D5-2 (minor; W-086 target 3). Shader compiles in play are understated and well over target

`prod_frames.mjs` reports `programsCompiledInPlay = perf().programs(end) − programs0`. That is a **net** figure: programs released and re-linked during the run cancel out.

Whiteout `perKm` program counts (identical pattern on `high` and `low`):

```
high: 92, 100, 101, 98, 98, 98, 98, 101, 101, 98, 98, 98, 98
low:  69,  77,  78, 75, 75, 75, 75,  78,  78, 75, 75, 75, 75
```

**What the samples show** (lower bounds at 1 km resolution):
- **at least 9 distinct new programs** after the start (peak 101 against 92);
- **at least 12 link events** (+8, +1, then +3 at km 7 after −3 at km 3).

**The −3 / +3 cycle is a set of three programs released when a cave is disposed and re-linked at the next one,** so every Endless cave after the first re-links about 3 programs mid-run.
- Alpine shows +3 with no release.
- Fjord shows +2 then −2 (gross ≥ 2, reported as 0).
- The README's "6 (Alpine 3, Fjord 0)" therefore understates Whiteout's figure and Fjord's.

**D4-7's fixes were not done:**
- no dressing in the load-time warm-up;
- no off-screen shadow frame after the scans resolve.

The new rim-spindrift material only compiles at load if a chunk with veils is resident during `warmup()`.

**Acceptance:**
- `prod_frames` counts gross links: sample `renderer.info.programs` after every render, or hook `WebGLPrograms` acquisition, and name the programs.
- Whiteout Endless shows ≤ 2 links after start, with no per-cave re-link. Keep the dressing materials referenced (as `lampTexture` is), or warm and retain them.

#### D5-3 (minor; W-086 target 1, D4-4 not addressed). Frames over 16 ms remain, and the cave slices are the largest single cost

**Recomputed from the raw `step` arrays** (they match the README):

| Run | over 12 ms | over 16 ms | over 33 ms | p99.9 | max |
|---|---|---|---|---|---|
| Whiteout high | 58 | 17 | 0 | 13.8 | 30.0 |
| Alpine high | 22 | 11 | 2 | 11.4 | 49.5 |
| Whiteout low | 36 | 9 | 0 | 12.1 | 32.2 |
| Alpine low | 9 | 1 | 1 | 9.4 | 33.2 |

- **Spread through the run.** Whiteout high's over-16 ms frames are spread across the deciles (1, 1, 2, 0, 5, 1, 2, 0, 1, 4). The round-4 decile-3/7 clusters are gone.
- **The cave slices exceed the whole frame budget.** The new `World.timeSlice` reports 24.7 ms for a cave slice and 14.5 ms for a dressing slice on `high`, and 31.1 ms for a cave slice on `low`.
  - The "cave" job is the shared cave geometry builder (Alpine: 27.2 ms), so the target cannot be met by Whiteout code alone.
  - The dressing's first architecture slice still holds the material set-up plus all of `browTriangles`, which D4-4 asked to split.
- **The cornice test is still relative.** `cornice_roots.test.ts` is unchanged and still asserts only that it is faster than `Raycaster`. My loaded run measured `gather 87.9 ms vs Raycaster 348.1 ms`, and it passed. It would pass a 50 ms slice.
- **One-off main-thread cost from the new LOD.** `RidgeRocks.lod()` decimates on first use: 6 decimations on `high`, 1–14 ms each in my loaded Vitest run. If scans resolve after the run starts, that lands in one streaming frame. Unmeasured.

**Acceptance:**
- The cave builder and `browTriangles` yield inside their loops.
- A unit test drives both generators and asserts that the slowest `next()` is under 8 ms, with a CI margin.
- Whiteout 12 km `high` shows 0 frames over 16 ms outside cinematics, or the owner records an accepted budget.

#### D5-4 (minor, code health; new). The searchlight gloom is not reset when a session ends

- **The setter.** `RescueVictory.update` drives `env.setGloom(gloom)` for t ≈ 9.4–14.2 s, together with `setAmbientScale` and `setSunScale` (`rescueVictory.ts:201-204`).
- **The reset is incomplete.** `GameSession.dispose` resets ambient and sun to 1 (`GameSession.ts:1548-1549`) but **not gloom**.
- **The path to the leak:**
  1. The ending can be skipped after 1.2 s (`GameSession.ts:346-351`).
  2. The ending keeps running behind the results panel (`App.ts:848-850`).
  3. A Retry within ~4.8 s of a skip made inside the gloom window rebuilds the session on the **same world** (`App.ts:517-521`).
  4. `gloomK` stays above 0, and `applyWeather` folds it into the fog colour for the whole next run (`Environment.ts:299`).
- **Side note.** `applyFogColour` duplicates the storm branch's colour code; the two can drift apart.
- **Acceptance:** `GameSession.dispose` (or `Environment` on run start) calls `setGloom(0)`. A unit test sets gloom, disposes the session and expects the fog colour to be the clear/storm value.

#### D5-5 (minor). On Low, the rear inset now renders a second full scene pass for the whole chase. This is unmeasured

- **The change.** `App.ts:883-885` drops the Low exclusion. The comment says the telephoto lens "culls most of the scene, so it is cheap". But `rearInsetFov` is 48° for the Yeti closer than ~5 m, and Low is the preset for the weakest devices.
- **Not visible in the perf runs.** The perf harness renders 1 frame in 240 at 640×360, so the inset's cost is folded invisibly into the software-render median.
  - Alpine low's median went 1,433 → 1,829 ms (+28 %) and Whiteout low's 1,558 → 1,722 ms. Both are inside the spread the README itself declares (±25 %).
- **Acceptance:** a Low software-render (or draw-call) comparison during the chase with the inset on and off. If it costs more than ~15 %, a reduced inset pass on Low: no shadow receivers, and a shorter far plane.

#### D5-6 (minor, evidence and tracker accuracy). The README and tracker overstate or misdescribe several items

- **The software-render ratio.** It is the README's only basis for "Met: 1.10×".
  - The README itself puts run-to-run spread at ±25 %.
  - W-086's round-3 target was stated as a triangle census. The per-km triangle samples give Whiteout/Alpine `high` a median ratio of 1.44×, a mean of 1.60× and a maximum of 1.69×; draw calls give a median of 1.34× (658 vs 492).
  - So "within 1.5×" holds by render time and by median triangles, but not by mean triangles. Report both.
- **Compile counts** (D5-2).
- **"Rim rocks use LOD per family at distance"** (DEFECTS W-096). There is no distance switching: each family gets one fixed decimation grid (`RIDGE_ROCK_GRID`). That is still effective (−84 %), but it is not distance LOD.
- **The inset fill light.** `CANDIDATE.md` says "a fill light is added" during the inset render. `renderRearView` (`App.ts:918-944`) changes only the fog. No light was added in this diff; the only rim light is the pre-existing `yetiRim`.
- **Endless memory.** "No unbounded growth over 12 km" is consistent with the data: Whiteout high heap after a forced GC peaks at 119.2 MB at km 6 and 120.8 MB at km 12; geometries are periodic with the caves. But 12 km is two cave cycles. W-016's criterion is 40 km, and W-016 and W-017 are still `OPEN` with no 40 km run.
- **W-038 still reads "CLAIMED — awaiting reviewer D".** I verified it in round 2. This is the fourth round I have noted it.
- **Acceptance:** README and DEFECTS corrected on these points; a 40 km Endless heap/geometry trend; W-016, W-017 and W-038 rows updated.

#### D5-7 (minor, test strength). Two tests are weaker than the claims made for them

- **`storm_cave_abandon.test`:**
  - it abandons at one point only, after the third `next()`;
  - it asserts at least 6 dispose calls, not "everything created is disposed and the shared singletons are not";
  - its fake cave has no `cave-rock`, so the `browTriangles` path is never exercised.
- **`searchlight_beam.test` would fail on the old code only because `searchBeam` was not exported** (`TypeError`). Its regex parser of the `vD` sign would catch the old `-position.z` if run against it, so the logic is sound. "Fails on the old code" is true only trivially.
- **Acceptance:** the abandon test loops `return()` at every slice index and compares the created resources with the disposed set, using a cave with a rock mesh. Optionally, a shader-level check on the round-4 beam string.

### Smaller code notes (no action required for the gate)

- **The gust memo is now a `WeakMap` keyed by the hazard instance** (`hazards.ts:256-271`). The key no longer includes the environment `seed`, which the computation still reads. That is correct today, because one `HazardInstance` belongs to one seeded field. A comment or assertion would keep it so.
- **Allocations every frame:**
  - `RescueStation.update` clones `searchTarget` every frame while the pool is visible;
  - the blizzard curtains went from 4 to 8 meshes per active cell with `frustumCulled = false`, which is part of Whiteout's higher draw-call count.
- **Fill cost added per fragment:**
  - the scoured-flank `sf_fbm` is evaluated on every Whiteout terrain fragment (`snowMaterial.ts`, unbranched);
  - the storm wall gained a `sf_cloudDensity` call;
  - the rock rime adds two `rk_n` calls.
  - All are cheap on a GPU, and are already inside the measured 1.10×.
- **Disposal:**
  - double disposal of the architecture geometries (group traversal plus explicit pushes) is harmless in three r187;
  - `rimSpindriftMaterial` is a page-lifetime singleton, consistent with the other shared materials.
- **The inset fog override** (`App.ts:930-939`) is saved and restored correctly around `render`. If `render` threw, it would not be restored; that is negligible.

## Round-4 D findings, re-verified on `729e226`

| R4 finding | Status | Evidence |
|---|---|---|
| D4-1 W-086 targets unmeasured, `high` regressed | **Regression fixed** (render 1.10×). Targets measured; 2 of 3 not met (D5-2, D5-3) | perf JSON, my stats |
| D4-2 rim band without LOD | **Fixed:** per-family decimation, ridge triangles −84 % (high 0.119 M/km, low 0.071 M/km vs 0.741 M full) | my census, `/tmp/revD5` |
| D4-3 cloud-sea noise doubled | **Fixed:** 16 → 8 noise evaluations per pixel | `cloudSea.ts` diff |
| D4-4 dressing slice and relative test | **Not fixed:** slices now measured (14.5 ms dressing, 24.7 ms cave); test unchanged (D5-3) | `World.ts:248-256`, `cornice_roots.test.ts` |
| D4-5 abandoned dressing leaks | **Fixed and tested** (test fails on old code; weak coverage, D5-7) | `stormCave.ts:149-163, 367-379` |
| D4-6 shared texture scrolled twice | **Fixed and tested** (clone per cave; image shared) | `stormCave.ts:515-517` |
| D4-7 warm-up incomplete | **Not done** (D5-2) | code, perKm programs |
| D4-8 Sonar gate | **Still B**; round-5 traversals fixed and tested; leading candidate identified (D5-1) | check runs, annotations |
| D4-9 perf README | **Done**, with inaccuracies (D5-6) | `perf/README.md` |
| D4-10 string key at physics rate; Low inset | **Key fixed** (WeakMap + numeric); Low inset widened to the whole chase (D5-5) | `hazards.ts`, `App.ts` |

**Defect rows:**
- **W-086, W-096:** keep OPEN. The regression is resolved, but the frame, compile and slice targets are unmet.
- **W-087:** BLOCKED, correctly. Next step in D5-1.
- **W-099:** largely fixed: D4-5, D4-6, the gust memo and the README. D4-4's test and D4-7 remain.

**Gitar:**
- The summary comment on `729e226` says "Approved, Medium risk, 9 closed / 9 findings". The Gitar check run is a success. Its last blocking review, on `946b531`, is DISMISSED.
- There is no open finding.

## (c) What I ran and read

1. **Copies of the tree:**
   - `git archive 729e226` into `/tmp/revD5/new`;
   - the same with `71c9ceb`'s `src` into `/tmp/revD5/old`;
   - the same with `23d9113`'s `src`, plus `50dc466`'s table tools, into `/tmp/revD5/g`.
   - `node_modules` is symlinked in each. Nothing in the repo was changed apart from this report.
2. **Build and typecheck:** `npx tsc --noEmit` exits 0; `npx vite build`: same bundle hash as the candidate.
3. **Targeted Vitest on the frozen tree** (9 files, 26/26): `storm_cave_abandon`, `tool_paths`, `rescue_dispose`, `searchlight_beam`, `timeline_calm`, `rear_inset`, `w065_r4_views`, `cornice_roots`, `scan_lod`. I did not re-run the full 542-test suite, because the machine was loaded; I rely on `candidate/unit.txt`.
4. **"Fails on old code" checks:**
   - **On `71c9ceb`:** `storm_cave_abandon` 2/2 fail (semantic); `timeline_calm` 1/2 fail (semantic); `rear_inset`, `searchlight_beam` and `rescue_dispose` fail (missing exports, or the glow not marked shared).
   - **On `23d9113`:** `rescue_dispose` fails, naming the pool and glare.
   - **On `50dc466`'s tools:** `tool_paths` refusal tests fail for both table tools.
5. **Perf statistics** recomputed from all six JSON files: percentiles, over-12/16/33 counts, deciles, per-km programs (gross and net), geometries, textures, heap, and triangle and draw-call ratios. The file timestamps and `seconds` fields show the six runs were sequential (19:45–21:03), finishing before the other reviewers' browser jobs started.
6. **Ridge-rock LOD census:** triangles per grid for the three scans and per-km totals on Endless 12 km. A throwaway Vitest in the copy, since deleted.
7. **GitHub, REST only:**
   - check runs and annotations for `729e226`, `71c9ceb`, `4b2c892`, `15d9628`, `88b3721`, `526785a` and the round-5 commits;
   - the Sonar rating for all 120 PR commits;
   - PR reviews and issue comments.
   - Nothing was changed on GitHub.
8. **SonarCloud reachability:** `curl` (proxy CONNECT 403) and WebFetch (site `client_error`). No credentials were used.
9. **Read:**
   - `CANDIDATE.md`, `OWNER_DECISIONS.md`, `DEFECTS.md` (W-016/017/038/069/070/086/087/096/099), `perf/README.md`, the build, unit and tsc logs, and `round-4/REVIEW_D_tech.md`;
   - the full `git diff 71c9ceb 729e226 -- src` (36 files), the table tools, `prod_frames.mjs`, and the new tests.

## (d) What I could not verify

- **GPU frame time** on any hardware GPU.
- **The SonarCloud issue itself.** The host is refused from this environment, so D5-1's candidate is an inference from the rating and annotation history.
- **Which programs compile mid-run, and whether those compiles hitch visibly.** The tool does not name them, and I made no browser runs.
- **The Low inset's cost, and the one-off LOD decimation cost in the browser.**
- **Endless memory beyond 12 km.**

## What would raise Performance and stability to 9

1. **D5-1:** the Sonar gate at A through a root-cause change, after the owner reads the issue. This is the release gate.
2. **D5-2:** gross link counting with names; ≤ 2 links after start; no per-cave re-link.
3. **D5-3:** finer cave and dressing slices with an absolute per-slice test; 0 frames over 16 ms outside cinematics on Whiteout `high`, or a budget the owner has accepted.
4. **D5-4 to D5-7:** the gloom reset, a Low inset measurement, corrected README and tracker claims, a stronger abandon test, and a 40 km Endless memory run.
