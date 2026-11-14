# Fjord Coast, Round 2: Reviewer E (QA & Accessibility Lead)

- **Reviewer:** E, QA & Accessibility Lead
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `aec1812` (branch `pass4-fjord`)
- **Date:** 2026-11-10
- **Method:**
  - Source reading.
  - Unit suites: `fjord`, `fjord_gameplay`, `fjord_streaming`, `achievements`, `input`, `biome`, `course`, `events`, `capabilities` and `review_regressions` (160/160 pass). `tsc --noEmit` is clean.
  - My own headless scratch tests in `scratch/review-e-r2/`. Run them with `npx vitest run -c scratch/review-e-r2/vitest.config.ts <file> --silent=false`.
  - The round-2 screenshots at 1920×1080, the 1366×768 menu, summit and finish shots, and the 2560×1440 menu.
  - I did not run Playwright, a browser or `vite build`.
  - When I finished, `res-2560/` held only `01_menu.png`. The 2560×1440 summit and finish shots were not there, so I did not judge them.

Scratch files used in this round:

| File | What it checks |
|---|---|
| `gen.test.ts` | Round-1 generator sweep, extended for on-line rock, gullies, and lookout determinism. Output in `gen_out.txt`. |
| `lookchase.test.ts`, `detour.test.ts`, `start.test.ts`, `codes.test.ts` | Round-1 checks, re-run |
| `vp.test.ts`, `enc.test.ts` | Viewpoint distribution and chase layout per length |
| `det.test.ts`, `vpstream.test.ts` | Whether lookout results depend on query order, and which viewpoints exist under the game's streaming access pattern |
| `rockway.test.ts` | Width of the clean way round each on-line rock |
| `gully.test.ts`, `gully2.test.ts` | Gap-gully soft-lock and approach behaviour |
| `capsim.test.ts` | How many Fjord captions are actually shown, given the throttle and Yeti caption priority |
| `sim.test.ts` | Independent chase outcomes, Fjord vs Alpine. Output in `sim_*_sprint.txt`. |

---

## 2. Verdict: **FAIL** against the 9/10 targets for my categories

Round 2 fixes almost all of my round-1 findings, and I confirmed each fix myself:
- No viewpoint is in a chase at any length.
- A skilled detour to the first viewpoint is reached and won 24/24 times (round 1: caught 11/24).
- No-input start stalls: 0/30 (round 1: 4/30).
- The Fjord audio cues have captions, and the wording follows the location.
- Course codes accept `%40` and stray spaces.
- Viewpoint ids are unique per course.
- The howl side is correct.
- The HUD has scrims.

The new mechanics are safe in every sample:
- The route never enters the cornice; minimum distance from route to rim is 54.5 m.
- The finish is always on land, 190 m before the quay.
- Every rock that crosses the route leaves a clean way round at least 4.0 m wide (165 rocks).
- Gully edges stay at least 8.6 m from the route.
- Every one of 224 realistic gap approaches at 2–20 m/s came out the far side, with no crashes.

I found one new **determinism/streaming bug**, though. On a finite course, the viewpoint generator permanently stops placing viewpoints if its first query is small, and every query the game makes is small. So in a real Endurance or Expedition run, **only the first viewpoint exists**: 1 of 3 on Endurance, 1 of 8 on Expedition. The unit tests do not catch this, because they ask for the whole course in one call. In addition, the remediation's own placement rule already reduces Sprint and Standard to a single viewpoint in the first 500 m. Taken together, every finite Fjord run now offers exactly one viewpoint, at the top. That undercuts the "Scenic Exploration" identity the brief gives this location.

Accessibility is close to 9. The remaining gaps:
- The menu does not scale at 2560×1440.
- The rear-view label is still faint.
- A rock caption can suppress the next squall warning.
- The gap gullies have no telegraph beyond the kicker.

## 3. Scores

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 8 (low confidence) | Reads clearly as a coast at every resolution I checked, and the harbour finish (`10_finish`, `10b_finish_ground`) is rich. In the menu there is an odd floating white shard below the snow lip (`01_menu.png` ≈ 850,860). Defer to A. |
| Environmental uniqueness | 8.5 (low confidence) | Unmistakable against Alpine in every shot. The new spines, squall lanes and on-line rock add Fjord-specific play. Defer to A/F. |
| Skiing and hazard mechanics | 8.5 | Squall lanes, rock on the line, spine gaps and the cornice recovery are all deterministic and safe in every sample, and each has a readable cue. The gullies themselves are untelegraphed (Defect 5). |
| Difficulty and fairness | 8 | Exploring no longer costs the chase (E1 fixed). Start stalls are gone. On my 8 independent Sprint seeds, Relaxed is approachable: average bot 6/8 Fjord vs 3/8 Alpine, cautious 2/8 vs 2/8. However, the optional-exploration reward has shrunk to one viewpoint per finite run (Defects 1–2). And on my seeds Fjord does not measure as harder than Alpine (Hard intermediate: 6/8 Fjord vs 3/8 Alpine), so the 2/5 vs 1/5 step is not visible in outcomes. Defer that last point to B. |
| Cinematics | 8 (low confidence) | From a readability view: the skip hint is now legible (`11_victory_trophy.png`, `11c_victory_reveal.png`), and the reveal subtitle has a working dark halo. Defer to C. |
| Performance and stability | 8 (medium-low confidence) | `tsc` is clean, the suites pass, and the 120 km Endless disposal test passes. Lookout generation depends on query order (Defect 1), which is a stability and determinism fault in generation state. Frame rate was not measured. |
| Accessibility and controls | 8.5 | The new cues are captioned with sensible priority, the copy follows the location, and the HUD has scrims and 12 px+ labels. Input is unchanged and complete. Remaining: the menu at 1440p and above is still fixed-px and small, the rear-view label is pale over bright sky, and the squall-warning throttle (Defects 3–4). |
| Overall player experience | 8 | Fair, robust and readable to race. But exploration, the location's headline identity, is now one viewpoint per run near the summit. |

## 4. Defects

### 1. Major (determinism / streaming): viewpoints after the first free stretch never exist in a real finite run

**Evidence**

The bug is in `src/world/coast.ts:347–350`:
- `lookouts()` looks up the next encounter with `P.encounters(-Infinity, z1 + 3000)`.
- `encounters()` returns only encounters with `foreshadowZ − 600 ≤ z1` (`profile.ts:1004`).
- When the next encounter is beyond that window, the code sets `this.lookoutStretch = -1` on any non-Endless course. This permanently ends placement, even though the course has more encounters further down.

Every in-game caller uses small windows:
- `GameSession.ts:760` queries ±20 m.
- `fjord/views/scenery.ts:132` queries one chunk.
- `physics/obstacles.ts:200` queries one band.

So the first call ends placement after stretch 0.

`vpstream.test.ts` emulates streamed obstacle bands, scenery chunks and `checkLookouts`, over 4 seeds per length:

| Length | Viewpoints designed | Viewpoints existing in a streamed run |
|---|---:|---:|
| Sprint | 1 | 1 |
| Standard | 1 | 1 |
| Endurance | 3 | **1** |
| Expedition | 8 | **1** |

`det.test.ts` shows the same thing directly: a band-first query order gives 2 of 3 viewpoints on Endurance; a window-walk order gives 1. My round-1 sweep (`gen.test.ts`) now flags `CLASSIC: lookouts order-dependent` on Endurance. Endless is not affected (5 of 5).

Knock-on effect: obstacle bands exclude obstacles from viewpoint platforms through the same call, so the generated obstacle field can also depend on query order.

The unit tests (`fjord.test.ts:202,383,403`, `fjord_gameplay.test.ts:261`) call `lookouts(0, L)` on a fresh world, which hides the bug.

**Fix**
- On a finite course, stop placement only when `k` is past the last encounter of the whole course (for example, check `P.encounters(-Infinity, P.length)`). Otherwise, just `break` and resume on a later query.
- Add a unit test that walks the course in 40 m windows and compares the result with `lookouts(0, L)` at every length.

### 2. Major (brief compliance: "optional exploration bonuses", 2/5 "Scenic Exploration"): viewpoint content collapsed to one per finite run

**Evidence**

`vp.test.ts` (20 seeds per length; `enc.test.ts` gives the stretch layout):

| Length | Viewpoints by design | Where | Round 1 |
|---|---|---|---|
| Sprint | 1 per course | z ≈ 90–237 m, in the run-in | – |
| Standard | 1 per course | z ≈ 482 m; after that, a single 9 km chase from 982 m to the finish has none | 7 per course |
| Endurance | 3 | | |
| Expedition | 8 | | |

With Defect 1, the real count is 1 on every finite length. Scenic Route is still achievable, and the reward was raised to 500 points. But the brief's "beautiful enough that players want to slow down and explore" now has one optional stop, at the summit.

**Fix**

Keep the free-stretch placement, and also allow chase-time viewpoints where exploring is made safe:
- the Yeti hesitates or loses ground while you stand on a viewpoint platform, or
- viewpoints are placed only where a measured detour costs less than a set number of seconds.

Then use my `detour.test.ts` pattern to assert that a skilled detour on Relaxed wins. Target at least about 3 viewpoints on Standard.

### 3. Minor (accessibility): a rock-scrape caption can suppress the next squall-lane warning

**Evidence**

`GameSession.envCaption` (`GameSession.ts:747–753`) applies one 3 s throttle shared by all location captions.

In `capsim.test.ts` (10 Sprint runs and 2 Standard runs, skilled and intermediate bots), **7 of 56 squall-lane warnings were throttled**. The cause was mostly an after-the-fact rock caption; scoured rock always lies just downwind of a lane.

Blocking by the Yeti's footsteps caption was negligible: the Yeti was within 45 m for only 11 s of 2077 s of chase.

**Fix**

Give anticipatory warnings priority:
- a squall telegraph may replace a soft rock caption, or
- throttle per kind.

### 4. Minor (visibility): residual E4 items

**Evidence**
- `round-2/res-2560/01_menu.png`: the menu still uses fixed px. At 2560×1440, the Location note, course-code line and key hints are about 11–12 px on a 1440 p screen, and the panel fills about 30% of the width. The developers say they deliberately left this unchanged.
- `09_pursuit.png`, `09b_hard_snowball.png`: the "BEHIND YOU" label inside the rear view is still pale pink on a pale sky.
- The blue "×1.0/×1.1" multiplier is small and low-contrast.

**Fix**
- Scale menu type with `clamp(…, vw/vh, …)` from 1440 p up, and update the e2e fit thresholds.
- Give the rear-view label a dark pill background.

### 5. Minor (hazard readability): gap gullies are not telegraphed, and a stationary skier can stick on the far ramp

**Evidence**

No view code references `gaps`/`GapCut`. The remediation lists take-off markers as an open art follow-up. The take-off kicker is the only cue for a gully about 1.7–2.0 m deep.

Realistic approaches are fine: in `gully2.test.ts`, 224/224 approaches (2–20 m/s; coast, tuck, brake-then-release, pop) came out with 0 crashes.

`gully.test.ts` covers the contrived case of a skier placed at a standstill on the gully's far ramp. In that case, tuck (skate) fails to get out within 25 s in 3/8 side positions and 1/8 centre positions. I could not reach this state through normal play, so this is low severity.

**Fix**
- Add a lip marker (flags or a pennant line) and a visible shadow or edge on the gully.
- Give the far ramp a minimum gradient that the skate push can climb, or let skating climb short ramps.

### 6. Minor (test and process): the test record does not support the claims

**Evidence**
- `REMEDIATION_gameplay.md` §6 says the Playwright menu result is filled in "below", but no TEST RESULT line exists.
- `tests/e2e/menu.spec.ts:113` now uses `click({ force: true })` on the Mountain row. This skips Playwright's actionability and occlusion checks, which are part of what the menu-layout test is for.
- The unit tests query viewpoints in one full-course call, which hides Defect 1.

**Fix**
- Record the e2e result.
- Prefer waiting for stable layout over `force`, or keep one un-forced click assertion.
- Add the streamed-order viewpoint test.

## 5. What works

- **Determinism (except lookouts).** Obstacle bands are identical whether built forward or in reverse, at all lengths. The 120 km Endless streaming and disposal test passes.
- **Coastline at every length.** Over 63 finite seeds across Sprint, Standard, Endurance and Expedition, plus Endless:
  - The finish area is 2.2–19.3 m above the sea, and the quay is 190 m past the finish.
  - Route guard is 0. Alternate lines, kickers, cliff bands and gullies all have guard 0.
  - Coastal shelters stand 95–109 m inside the rim, with a foot spread ≤ 0.73 m.
  - The obstacle-free lane is at least 5.2 m wide.
- **New mechanics are fair.**
  - On-line rock always leaves a clean way round at least 4.0 m wide (median 45 m).
  - Gullies stay at least 8.6 m from the route and never enter the cornice.
  - The cornice now returns an over-the-rim skier with a title and a caption.
- **Course codes.** All of these resolve correctly:
  - `%40` input;
  - inner spaces (`@ FJORD`, ` @FJORD`);
  - mixed case;
  - raw or encoded `@` in a URL.
  - Future days and over-range seeds are rejected.
  - The longest code is 28 characters, within the 32-character field.
  - The error help now shows a `@FJORD` example.
  - Alpine codes are unchanged.
  - Daily Alpine and Daily Fjord share the date seed but have different world seeds.
- **Captions.**
  - New captions: squall lane ("… it will push you left", correct because +X is the skier's left), squall over a jump, rock, surf (once), viewpoint, and cornice recovery.
  - They use soft priority, so a Yeti cue is never hidden.
  - A new `GameSession` is created per run, so throttle state cannot leak into a retry.
- **Copy.**
  - "Reached the harbour".
  - Refuge title: "Coastal shelter reached … The harbour is still a long way down".
  - Achievement text is location-neutral.
  - Endless blurb: "Bank your run at the refuges".
- **Menu.** The Location row fits at 1366, 1920 and 2560 with no clipping, and the backdrop is darker so text is easier to read.

## 6. Round-1 findings: verification

| # | Round-1 finding | Status | My evidence |
|---|---|---|---|
| E1 | Viewpoints inside chases | **Fixed** (but see new Defects 1–2) | `lookchase.test.ts`: 0 in chase at every length. `detour.test.ts`: reached and won 8/8 on each of Relaxed, Normal and Hard (round 1: caught 3/8, 4/8, 4/8). |
| E2 | No captions for Fjord cues | **Fixed** (Minor residual: Defect 3) | `GameSession.ts:728–740, 768`. `capsim.test.ts`: 49/56 lane warnings shown. |
| E3 | "resort / lodges" wording | **Fixed** | `App.ts:590`, `GameSession.ts:217,486`, `achievements.ts`, `CourseConfig.ts:37`. A grep finds no leftover player-facing "resort". |
| E4 | Low-contrast HUD and menu | **Partially fixed** | Scrims and heavier labels are visible in `09_pursuit`, `09b` and `09c`. The skip hint is legible in `11_victory_trophy`. Menu scaling at 1440p and above, and the rear-view label, are not done (Defect 4). |
| E5 | Course-code input gaps | **Fixed** | `codes.test.ts` output (§5) |
| E6 | Flat run-in | **Fixed** | `start.test.ts`: Fjord no-input stops 0/30 at every length (minimum z after 20 s is 44.7 m). Alpine is 2/30. |
| E7 | Unstable viewpoint ids | **Fixed** | `coast.ts:385`: `vp-<seed36>-<len>-<z>`. The ids are unique in every sample. |
| E8 | Howl side inverted; a sighting could come from the sea | **Fixed** | `GameSession.ts:461–467` (coast forces +X, and the caption maps +X to "left"). The `coast.ts:22` comment is corrected. `side.mjs` confirms that +X projects to screen-left. |

## 7. Brief compliance (Fjord items relevant to QA and accessibility)

| Brief item | Status | Evidence |
|---|---|---|
| Large open downhill runs | Done | Lane clearance ≥ 5.2 m; minimum slope raised |
| Scenic branching paths / optional ridgeline shortcuts | Done | Every ridgeline has a spine. The spines and their gaps never enter the cornice (`gen_out.txt`). |
| Gentle coastal crosswinds | Done | Squall lanes are telegraphed and captioned, push onshore only, and never knock a skier down |
| Exposed coastal rocks | Done | On the line and beside it; always a way round at least 4 m wide (`rockway.test.ts`) |
| Small terrain gaps and jumps | Done / Partial (readability) | 224/224 safe approaches. The gully has no telegraph (Defect 5). |
| Optional exploration bonuses for viewpoints | **Partial** | Present and safe, but one per finite run in practice (Defects 1–2) |
| Don't make bonuses mandatory detours or punish the fastest descent | Done | Off-line and outside chases. The fastest line is never penalised. |
| Finish near the shore; coastline integrates with all lengths | Done | All finite lengths and Endless (§5) |
| Coastal shelters as refuges (§5) | Done | Stable ground, well inside the rim; the refuge title names them |
| Relaxed / Normal / Hard work in the location (§2) | Done | `sim_fjord_sprint.txt` vs `sim_alpine_sprint.txt`: Relaxed approachable, Hard still a challenge |
| Deterministic seeds (§10) | **Partial** | Lookouts depend on query order (Defect 1) |
| Course codes, `@` suffix, URL encoding, back-compat (§1, §10) | Done | `codes.test.ts` |
| Scenic Route achievement (§6) | Done | Wired to the real event; ids now unique per course |
| Hazard "supported by sound" and visually recognisable (§4) | Done / Partial | Captions and windsock are present; the gully has no marker |
| 1366×768 and 2560×1440 verified (§9) | Partial | 1366 menu, summit and finish are fine. At 2560 only the menu was available: it fits but is small (Defect 4). |
