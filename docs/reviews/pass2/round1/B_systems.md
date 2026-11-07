# Pass 2, round 1: Reviewer B (systems and progression)

**Reviewer:** Reviewer B. This is an internal review by another model instance, not an external human. I did not write this code.
**Commit reviewed:** `0631c26e7471053e239b3aba0bce702eebd43276` ("Generated courses: alternate lines…"), branch `pass2`. I started on `23e8cfe`, then moved to `0631c26` when the lead asked.
**Method:** I exported the commit with `git archive 0631c26` into a clean directory so that uncommitted work by other agents could not affect the results. I read the code, ran the unit suite, and wrote probe tests (`tests/review/b_*.test.ts`). I made no changes to source files.

Run the probes from the repo root with:
`npx vitest run --config tests/review/vitest.config.ts --disableConsoleIntercept`
The root vitest config only includes `tests/unit`, so plain `npx vitest run tests/review` finds nothing.

## Verdict

| Requirement | Score | Result |
|---|---|---|
| P4 configurable lengths / generated courses / Endless | **6/10** | **FAIL** (B1, B2, B3, B4) |
| P5 Daily / Custom / records | **8/10** | **PASS**, conditional on B1 (the app does not build) |
| P9 acceptance (systems part) | n/a | Simulations pass. The "no memory growth" claim is only partly true (B6). |

## Evidence

- Unit suite at `0631c26`: `npx vitest run` → **5 files, 104 tests passed** (32 s).
- `npx tsc --noEmit` at `0631c26` → **3 errors**: `src/world/Cave.ts(9)` imports `centerX`/`routeX`, which `course.ts` no longer exports, and `src/game/World.ts(160)` calls `StoryProps` with 3 arguments. `npx vite build` → **fails**: `[MISSING_EXPORT] "centerX" is not exported by "src/world/course.ts"`. See B1.
- `b_geometry`, route skiability. 30 seeds × {3, 10, 20, 50 km} plus Endless to 30 km, sampled every 4 m (about 3,400 km of route):
  - The worst rise over any 20 m (kicker zones excluded) is **−0.24 m**, so there is no uphill anywhere.
  - The 6 m lane leaves the piste **0 times**.
  - Heights are finite everywhere.
- `b_geometry`, lane clearance. 12 seeds × 6 windows of 512 m on 50 km courses: the worst clearance is **5.65 m**, above the required 4.5 m.
- `b_geometry`, segment geometry (averaged over 10 seeds × 50 km). The types really do differ:

  | Type | Slope | Width |
  |---|---|---|
  | chute | 25.1° | 42 m |
  | basin | 10.0° | 181 m |
  | highspeed | 21.0° | 112 m |
  | forest | 17° | 62 m |

  Moguls appear only in mogul segments. Forest density is 1.9 in forest segments and 0.25 in alpine ones.
- `b_geometry`, determinism. These produced identical segment lists and identical `heightAt` values:
  - one-shot generation vs. incremental generation, on 50 km and on Endless;
  - obstacle band 150 generated far-first on a fresh profile vs. after in-order generation.
- `b_winloss`, `simulateGenerated` with streaming. Results:

  | Course | skilled | careless | cautious |
  |---|---|---|---|
  | 3 km, seeds 1, 77, 31337, 20261107 | victory | caught | caught |
  | 10 km, seeds 1, 77, 31337 | victory | caught | caught |
  | 20 km, seed 77 | victory (938 s) | caught | not run |
  | 50 km, seed 31337 | victory (2361 s) | caught at 46.3 km | not run |
  | Endless, seed 5 | 40 km, 4 refuges | caught at 5.3 km | not run |
  | Classic Sprint | victory | caught | caught |

  `peakBands` was 6 in every run.
- `b_endless_late`, run starting just before Endless encounters 0, 5 and 9 (speedMul 1.0, 1.22, 1.22), seeds 5 and 4242. Skilled reaches the refuge every time (minGap 22–41 m); careless is caught 60–100 m after the cave every time.
- `b_daily`:
  - Rollover is exact: `23:59:59.999Z` → `2026-12-31`, and +1 ms → `2027-01-01`. `msUntilRollover` gives 1 and then 86,400,000.
  - The label shows "(UTC)". 400 consecutive daily seeds are all distinct.
  - Course codes round-trip and reject invalid dates. v1 → `CLASSIC-SPR` migration works. Records with invalid JSON reset safely.
  - Problems found: see B8 and B9.
- `b_rearview`: replays `App.render()` → `renderShifted` → `renderRearView`. The rear camera ends up **2,110 m** from the Yeti when it should be about 60 m. See B2.
- `b_firsttouch` / `b_fartile`: provisional profile values at the generation frontier. See B5.
- Endless growth (`b_geometry`, after 1,000 km): 1,913 segments, 4,495 keys per track (×15 tracks), 1,900 kickers, 112 encounters/sightings/checkpoints, 539 alternate lines. `heightAt` is about 1.5× slower and band generation about 1.7× slower than at 10 km. See B6.

## Defects

| ID | Sev | Where | Defect | How to reproduce | Recommended remedy |
|---|---|---|---|---|---|
| **B1** | **C** | `src/world/Cave.ts:9` and `:254` (committed), `src/game/World.ts:159-160` | **The committed tree does not build, and has not since `4873ba5`.** The committed `Cave.ts` is still the pass-1 version. It imports `centerX`/`routeX` from `./course`, which 4873ba5 removed, and its `StoryProps(m, footprints)` hardcodes classic z values (for example the footprint trail at z 905). `World.buildCave` passes an anchor that is ignored. The working-tree `Cave.ts`, `caveTerrain.ts` and `src/world/cave/` are uncommitted. Every committed P4 claim about a cave per encounter depends on code that is not in the repo. | `git archive 0631c26 \| tar -x -C /tmp/x && cd /tmp/x && npx vite build` → MISSING_EXPORT. `npx tsc --noEmit` → 3 errors. | Commit the cave work, or a minimal anchor-based `Cave`/`StoryProps`. Add `tsc --noEmit` and `vite build` to the pre-commit and acceptance checks: the unit suite does not catch this. |
| **B2** | M | `src/game/App.ts:632-634` and `:660-661`, `src/game/GameSession.ts:275-289` | **The rear-view glance breaks as soon as the floating origin moves away from (0, 0, 0)**, which happens after about 1.5 km, so it is broken in every chase on Standard and longer courses and in most of the Sprint chase. `renderRearView()` runs inside the `renderShifted` callback. It positions `rearCam` from `GameSession.renderPos`, which is in absolute coordinates and is not shifted, and aims it at `yeti.root.position`, which is shifted during the draw. The rear camera ends up kilometres from the scene. | `tests/review/b_rearview.test.ts`: rear-cam → Yeti distance is 2,110 m, not about 60 m. | Compute the rear pose before `renderShifted` and pass `rearCam` in the camera list (it is already in the list but gets overwritten). Or subtract `world.origin` from both pose points inside the callback. Add a test. |
| **B3** | M | `src/world/profile.ts` (`altRoutes`/`altAt`, about lines 663-667 and 788-820) | **The alternate paths and shortcuts are only nominal.** They are straight chords across bends, kept clear of obstacles. Over 30 seeds × 20 km: 3.6 lines per 10 km, a mean saving of **4.4 m** each (about 0.2 s), and a mean maximum separation from the route of 26 m. They are not groomed or marked, so the player cannot see them, and there is no trade-off between risk and reward. The lead has confirmed that markers are not implemented. | `tests/review/b_alts.test.ts` | Give each line a visible identity: groomed surface weight or trail markers. Make some lines real shortcuts or forks (for example through a tree run or over a cliff band with a jump) with a real time saving or a score bonus. Test the saving, not just that the line is shorter. |
| **B4** | M | `src/world/profile.ts:519-526` (one encounter on finite courses), `chaseLength()` | **The pursuit pacing on long courses is weak.** Endurance and Expedition each have one encounter, at 16.6 km and 46.2 km. Before it, the only Yeti presence is "sightings", which are a sound and a caption with no visual. In the 50 km simulation a skilled player skis about 36 minutes before any threat; a careless player skis 71 minutes and is then caught about 9 s into the only chase. The spec says "main confrontation late", which implies earlier, lesser encounters. | `b_winloss`: `L=50000 seed=31337` careless is caught at 46,317 m after 4,282 s, with 9 s of chase. | Add one or two lesser encounters on courses of 20 km or more (a short chase that ends at a lodge, as Endless does, or a visible Yeti on a ridge), with the main encounter still late. |
| B5 | m | `src/world/course.ts:87-94` (`heightAt` reads `centerX`/`halfWidth`/`baseHeight` before `kickersNear` triggers `ensure`), `profile.ts` key tracks | **Order dependence at the generation frontier (Endless).** Values beyond the last key are clamped or extrapolated, and they change when the next segment is generated. The first `heightAt` sample past the frontier mixes provisional and final values. The far-tile emulation found 1 vertex in about 87k off by 3–4 m; a jump far ahead is off by up to **1,058 m** (seed 99, z 20,000). Finite courses are unaffected, because they are fully generated in the constructor. | `b_firsttouch`, `b_fartile` | Call `profile.ensure(z + 200)` at the top of `heightAt`/`surfaceWeights`, or in every `GeneratedProfile` accessor (a cheap comparison with `zDone`). |
| B6 | m | `src/world/profile.ts` (`kick`, `cliffs`, `segs`, `enc`, `sight`, `cps`, `alts`, 15 KeyTracks, `altOk` Map), `flatten()` loops over all `cps` on every `heightAt` call, `sightings()`/`altRoutes()` use linear filters | **Endless state grows without bound.** It is linear and small (about 10⁴ entries after 1,000 km), but per-call costs grow too: `heightAt` is 1.5× slower and band generation 1.7× slower at 1,000 km. Unrealistic play lengths are needed to feel it, but the "bounded memory" claim is literally false. The repo test only checks the obstacle band count. | `b_geometry` "Endless growth" | Prune profile data more than about 2 km behind the furthest point streamed. Binary-search `cps`/`alts`/`sight` as `between()` already does. |
| B7 | m | `src/world/profile.ts:565` (`Math.min(1.22, 1 + 0.045k)`) | **Endless escalation stops at encounter 5 (about 50 km) and is barely measurable before then.** A skilled skier's minimum gap goes from 35–41 m at ×1.0 to 22–36 m at ×1.22. Chase length and terrain mix do not escalate. | `b_endless_late` | Escalate other dimensions within a bounded range: chase length, harder segment weights, more frequent encounters. |
| B8 | m | `src/game/App.ts:330-336` and `:155-160` | **Retry or Restart after 00:00 UTC silently switches Daily to the new day.** `startRun` always re-evaluates `currentCourse()`. The menu card can also show a stale code if it is left open across the rollover. | Read the code. Play today's Daily, wait until after 00:00 UTC, then press Retry. | Pin the `CourseConfig` of the current world for Retry and Restart, and refresh the menu on rollover. |
| B9 | m | `src/core/settings.ts:183` and `:137` | **Corrupt per-course record values are not sanitised.** `{bestTime:"abc", runs:"x"}` merges to `runs:"x1"`, and the best time can never be set. `dailyDate` is only checked by regex (`2026-99-99` is kept; it is handled further down). | `b_daily` "records: corrupt values" | Coerce each record field with the `num()` helper, as `sanitize` already does for settings. Use `isValidDate` for `dailyDate`. |
| B10 | m | `src/game/CourseConfig.ts:87-131`, `App.ts:313` | **Course code and seed edge cases.** A shared code for a future day is accepted, then silently replaced by today's course. Numeric custom seeds wrap (`"0"` and `"4294967296"` collide). A custom word seed shows its hash after a code round-trip ("“3015432823”"). | `b_daily` | Show a caption when a future date is replaced. Reject numbers above 2³²−1 or hash them instead. |
| B11 | m | `src/game/CourseConfig.ts:27-35` | **The spec's "serializable course configuration" covers only `{mode, length, seed, date, customText}`.** There is no difficulty field anywhere in `src/`, and the segment plan, route, biomes, cave and checkpoint layout cannot be exported, so they cannot be reviewed or shared as data. Deriving everything from the seed is a defensible design, but it is not documented as a deviation from the spec. | `grep -ri difficulty src` finds nothing | Either add `profile.describe()` (a JSON plan: segments, encounters, checkpoints, alternate lines) and a difficulty field, or document the deviation. |
| B12 | m | `Particles`, `SkiTracks`, `Footprints`, snow, Vegetation `instanceMatrix` | **Some render buffers store absolute float32 coordinates.** The floating origin only fixes objects whose local vertices are small, such as terrain. The precision loss is under 4 mm at 50 km but reaches about 3 cm beyond about 250 km in Endless (more than 2.5 h of play). | Analysis | Store these buffers relative to a per-object anchor near `origin`, or accept and document the limit. |

## Checked and found OK

- **No classic-course hardcoding remains in gameplay paths.** `COURSE.`, `3000`, `1350` and `finishZ` only appear in the classic profile, labels or audio constants.
- **HUD.** Shows km for 50 km and refuge distance for Endless; the progress bar is hidden on Endless.
- **Scoring.** In `GameSession.stats()`, retiring keeps the banked score and being caught keeps the bank plus half of the rest. This is consistent: retiring mid-chase is never better than being caught.
- **Run state.** `RunState.done`, the growl and sighting sets grow by about 3 entries per 9 km, which is negligible.
- **Streaming and release.**
  - Obstacle bands are released and removed from the spatial hash.
  - Vegetation bands are disposed, and queued bands are dropped when released.
  - Caves and lodges are disposed outside the window.
  - Terrain chunks and far tiles are disposed.
- **Floating origin.** The sun's target is a child of the scene, so it is shifted. The sky dome follows the camera. Terrain chunks with `matrixAutoUpdate=false` are children of the shifted group.

## Not verified

- Anything in a browser: rendering, actual GPU memory over a long Endless session, visible floating-origin seams. Other agents are using Chrome, so I launched no browser.
- The menu's appearance.
- U5, U6 and U7 behaviour in the running app, beyond what the code and headless tests show. The logic for U5, U6 and U7 is sound and I would mark them verified once B1 is fixed and the app has been checked in a browser.
- The working-tree (uncommitted) cave, look and marker work. It is outside commit `0631c26` and not reviewed here.
