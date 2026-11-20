# Whiteout Ridge, round 2: Reviewer E (QA and Accessibility Lead)

- **Reviewer:** E, QA and Accessibility Lead. I own category 7 (Accessibility and controls) and QA coverage: test evidence, regressions and save integrity. Scores outside category 7 are low confidence (lc).
- **What this review is:** a review by a model, **not a human playtester**. I did not play the game in real time, and I did not listen to it. I did not judge feel, motion comfort, real reading speed at 60 km/h, or how the audio actually sounds.
- **Build:** candidate `b70a793` (branch `pass5-whiteout`), as named in `CANDIDATE.md`. Round 1 was `3f7bc45`. I read `git diff 3f7bc45 b70a793 -- src tests`.
- **Later commits:** `CANDIDATE.md` says every commit after `b70a793` "adds evidence and documents only (`git diff b70a793 <later> -- src` is empty)". **That is false.** `68aba34` changes `src/core/settings.ts` (`saveSettings`).
  - `68aba34`, `f51fd74` and `3864f4a` are tests, evidence and that settings fix.
  - **How I treat them:** I review gameplay and accessibility on `b70a793`. I review save behaviour on `b70a793 + 68aba34` (HEAD `src`), because that is the code the save-related browser specs claim to have run on, and it must ship with the candidate. The release candidate therefore has to be frozen again (finding N2).
- **What I examined:**
  - **Source:** `src/ui/Hud.ts` (the two-line caption box, queue and `readSeconds`), `src/ui/styles.css` (`.hud-caption`, `.hud-weather`, `.ui` zoom), `src/ui/scale.ts`, `src/game/GameSession.ts` (`envCaption`, blizzard and front captions, `weatherAudio`), `src/game/App.ts`, `src/core/settings.ts`, `src/world/look/weatherFx.ts` and all five of its readers (`World.ts:606`, `Environment.ts:165`, `blowingSnow.ts:138`, `sky.ts:254`, `hazardViews.ts:304`), `src/audio/logic.ts` (`windTargets`), `ambience.ts`, `audio/storm.ts`, `whiteout/hazards.ts`, `whiteout/views/scenery.ts`, `whiteout/views/rescue.ts`, `progression/achievements.ts`.
  - **Tests:** `tests/unit/captions.test.ts`, `reduce_weather.test.ts`, `storm_audio.test.ts`, `achievements.test.ts`, `tests/e2e/migration.spec.ts`, `progression.spec.ts`, `release.spec.ts`, `whiteout.spec.ts`, `tests/sim/courses.measure.test.ts`.
  - **Evidence:** `round-2/e2e.txt`, `courses.json` (tallied myself), `audio.json` (recomputed), `perf/README.md`, `balance/round2/*.jsonl` (win counts recomputed: they match the README), and screenshots 04, 05, 16 and 29 with the manifest. I sampled pixels with PIL.
  - **Two short headless experiments of my own (Vitest, under `/tmp/eexp`)** against the repository's `src`:
    1. `saveSettings`/`loadSettings` on a Pass 3-like save and on corrupt but parseable values;
    2. the `Hud` caption queue, with real caption texts and TTLs.
  - **Not read:** `DEFECTS.md` status columns and the other round-2 reviews.

## Verdict

**FAIL** for category 7 against the 9/10 target.

Round 2 fixes the biggest round-1 problems:
- warnings are no longer lost behind the Yeti;
- captions are short, wrap, and stay up long enough to read;
- the wind bed follows the storm, with direction;
- a presentation-only Reduce Weather Effects setting exists;
- the achievement card is correct.

What remains:
- The blizzard cell's push direction is still not conveyed reliably. The HUD arrow and the new wind pan point the other way for about half the cells inside a front, and the caption that carries the right direction can still expire unseen.
- The save-safety fix after the candidate is sound in what it does, but the browser log that claims to validate it cannot be reconciled with the code.
- None of the new accessibility features has browser or screenshot evidence.

| # | Category | R1 | R2 | One-line justification |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 7 | 7 | 04, 05, 16 and 29 now show grey storm light while the HUD says STORM (R1 contradiction gone). Still 1280×720 only. |
| 2 | Environmental uniqueness (lc) | 8 | 8 | Fronts, drift rows with marked gaps, the lee. Unchanged in kind. |
| 3 | Skiing and hazard mechanics (lc) | 6 | 7 | Reading the weather now pays: W2H Normal Sprint 22/24 against 10/24 blind (recomputed from `.jsonl`). The lee the caption names still costs wins (17/24). |
| 4 | Difficulty and fairness (lc) | 5 | 6 | `courses.json`: 7 of 18 Normal runs are caught (R1 11/18), including `CLASSIC-SPR@WHITE` at 84.6 s. Normal Standard 13/24 and Hard Sprint 10/48 for the skilled driver. |
| 5 | Cinematics (lc) | 7 | 7 | Not my area. The storm look is now consistent after the cave. |
| 6 | Performance and stability (lc) | 5 | 7 | CPU median 7.5 → 0.7 ms, and frames over 16 ms 1,220 → 18 (developer data). No GPU timing. The last frame holds 13.9 M triangles. |
| **7** | **Accessibility and controls (owned)** | **6** | **7** | E1, E2, E4 and E5 fixed or mostly fixed, E3 mostly fixed. E7–E10 not fixed; E10 now worse (N1). No e2e or capture of any new accessibility feature. |
| 8 | Overall player experience (lc) | 6 | 7 | Clearly better to read and hear. Normal Standard and Hard balance and the storm-direction issues remain. |

**QA coverage: not release-ready.** The candidate is mislabelled, specs were not rerun on the final `src`, a migration assertion contradicts the code (N3), and there is no browser test of captions, Reduce Weather or Whiteout menu selection.

## Round 1 → round 2

| R1 | Status | What I checked |
|---|---|---|
| **E1** Warnings lost behind Yeti captions (Major) | **Partly fixed** | **Fixed:** captions are now two lines. The hard line (Yeti) never blocks the soft line, and same-text footsteps only extend it (`Hud.ts:232-240`). Warnings queue with a TTL instead of being dropped (`Hud.ts:242-249`). Tests in `captions.test.ts`. **Residual** (my probe): a warning queued behind another warning of the same priority expires unseen, and is never retried (N1b). |
| **E2** Captions too fast; overflow at 150% (Major) | **Fixed** (code). Not evidenced at 150%. | `readSeconds = max(base, 1 + chars/15)`, capped at 8 s (`Hud.ts:225`). Rates I computed: front 81 chars in 6.4 s (12.7 chars/s), active blizzard 94 chars in 7.3 s (12.9 chars/s). R1 was 38 and 33 chars/s. The front text is shorter. `.hud-caption` now wraps, with `max-width: min(86vw, 760px)` (`styles.css:168-170`). At UI 150% and `autoUiScale(1280,720) = autoUiScale(1366,768) = 1`, that is at most 1,140 device px, which fits both widths. There is no capture at 150% (N4). |
| **E3** No storm audio layer or direction; shared cues (Major) | **Mostly fixed** | `AudioFrameState.weather` (`types.ts`). `windTargets` adds `0.55·w` low gain, a whistle and Q, and pans toward the upwind side by camera (`logic.ts:256-269`; pan maths checked: right = fwd × up = (−fz, 0, fx)). The front cue is placed upwind (`GameSession.ts:1191`). Recomputed `audio.json`: storm RMS 0.149 against clear 0.088, **+4.6 dB** (R1 +1.1 dB), both segments in the chase, storm s = 0.85–0.88. **Still open:** a blizzard cell's telegraph uses the same `blizzard-build` cue as a front (`hazards.ts:260`). The cue plays at the cell centre, so it carries no push direction. There is no arrival or clearing cue. |
| **E4** No way to reduce the whiteout (Major) | **Fixed (code)**, effect modest, unevidenced | The setting is in the menu (`App.ts:658`) and applied live (`App.ts:101,160`). See N5 for strength and evidence. Physics, hazard and sim modules do not read it: I checked with grep, and so does `reduce_weather.test.ts`. Blizzard walls never fall below 75% (`hazardViews.ts:304`). Drift plumes and mounds, HUD and captions are untouched. |
| **E5** "Coming soon" achievement plus a test enforcing it (Major) | **Fixed** | `requires` removed (`achievements.ts:236-243`). The unit test now ties `requires` to `hasBiome`. `release.spec.ts` asserts that `whiteout-survivor` is neither `.future` nor "coming soon". The unlock rule is unit-tested (`achievements.test.ts:206-207`). `progression.spec.ts` still expected 3 future cards on the candidate, so it **failed on `b70a793`**. It was corrected in `68aba34`, and that test-only change is sound. |
| **E6** Course matrix asserts nothing (Major, QA) | **Partly fixed** | `courses.measure.test.ts:104-105` now asserts victory for Relaxed Sprint and Standard, but that is only **4 runs**. Normal is recorded, not gated: 7/18 caught in `courses.json`, including Classic Sprint and today's Daily Standard. Hard, Endurance, Expedition and Endless are still never simulated. The balance README says the test "asserts outcome bands per difficulty". The code asserts only that Relaxed wins. The same policy loses 1 of 24 Relaxed Sprint runs on W034 (`informed2NoLee`, recomputed), so the gate is thin. |
| **E7** Amber pill contrast 3.8:1 (Minor) | **Not fixed** | `.hud-weather.warn` is unchanged (`styles.css:94`). `04_build` at (178,117) is RGB (170,122,40) with white text: **3.80:1**. Caption background measures 13.9:1. |
| **E8** `reduceFlashes` ignored by new effects (Minor) | **Not fixed** | Storm eye glow `0.75·smoothstep` has no check (`GameSession.ts:1163`). Beacon `sin(2πt)` and light bar `sin(9t)` are unchanged (`rescue.ts:612,615`). |
| **E9** Lamps neither show sequence nor separate lines (Minor) | **Not fixed** | `phase` is still computed (`scenery.ts:159`) and never used; all lamps pulse in unison (`scenery.ts:217`). |
| **E10** HUD arrow can contradict a cell's push (Minor) | **Not fixed, raised to Major** (N1) | Cell direction is still a coin flip (`hazards.ts:238`). **It is visible in the official evidence:** `16_storm_chase` shows the pill "STORM ←" with the caption "...it pushes you right". |
| **E11** HUD STORM over a clear sky after the cave (Minor) | **Fixed** (evidence) | 16 now shows grey storm light under "STORM ←". |
| **E12** Evidence gaps, caption timing, `aria-live` (Minor) | **Not fixed** | `05_storm` (t = 46.5 s) still shows the build caption first captured in `04` (t = 28.5 s), which now lasts 6.4 s. The capture tool still does not tick HUD timers. `whiteout.spec.ts:70-95` still checks only the pill, not the caption. There is no `aria-live` (`Hud.ts`). Captures are 1280×720 only. |

## New findings

**[V]** means I verified it myself. **[D]** means a developer claim or number.

### N1 (Major): A blizzard cell's push direction still reaches players unreliably, and its main channels can point the wrong way [V]

**a) Contradiction.**
- Each cell's `dir` is `rng.chance(0.5) ? 1 : -1` (`hazards.ts:238`), independent of the front.
- Inside a front, about half the cells push against the HUD arrow.
- Round 2 added a second channel that points the same wrong way: the storm wind bed pans by the front's `dir` only (`GameSession.ts weatherAudio`, using `f.dir`). The cell's own cue plays at the cell centre (`GameSession.ts` `playCue(e.cue, hazard.x…)`), which carries no side.
- So for those cells, the arrow and the wind pan both say one side. Only the caption says the other.
- Evidence: `16_storm_chase` shows "STORM ←" and "[a blizzard is blowing across the piste ahead — … it pushes you right]".

**b) The caption that carries the right direction can expire unseen.** My `/tmp` probe used the real `Hud` and the real texts and TTLs:

| First caption on screen | Second caption | Gap | Second caption ever shown? |
|---|---|---|---|
| Front, 6.4 s | Blizzard warning, ttl 3.5 s | 0.5 s and 2.5 s | No |
| Front, 6.4 s | Blizzard warning, ttl 3.5 s | 3.5 s | Yes |
| Active blizzard, 7.3 s | Front, ttl 6 s | 0.5 s | No |
| Active blizzard, 7.3 s | Second blizzard warning, ttl 3.5 s | 1 s and 3 s | No |

- `caption()` returns `true` when a warning is queued (`Hud.ts:244-246`). `envCaption` then records the throttle, and the blizzard handler has already put the cell in `blizzardWarned`.
- So a warning that expires in the queue is never shown or retried for that cell.

**Player impact:** deaf and hard-of-hearing players, and anyone who reads the arrow, are told the wrong side or nothing, for the hazard whose only counter is reacting to its side.

**Fix:**
- Align cells inside a front with `f.dir`, or show the cell's direction on the HUD (an arrow chip near the pill while a cell is in range).
- Pan the bed with the local `windX` (the environment already writes `e.windX = dir·9·w`), not only `f.dir`.
- Let a newer warning of the same priority replace one that has met its minimum reading time, or give warnings their own line.
- Mark a cell as warned only when its caption is actually displayed.

### N2 (Major, QA): The frozen candidate is not the build that was tested; the final `src` was only partly re-tested [V]

- `CANDIDATE.md` states that `src` is unchanged after `b70a793`. `git diff b70a793 HEAD -- src` shows `src/core/settings.ts` (+18 lines, `68aba34`).
- `e2e.txt` header: `game.spec` and `menu.spec` ran on `src = b70a793`; release, whiteout, migration and progression ran on `b70a793 + fix`.
- `poles.spec.ts` (which asserts that `seenPoleHint` persists, `poles.spec.ts:69-75`, the code path `saveSettings` now changes) and `scenic.spec.ts` were **not run at all**.
- The `menu.spec` test "the choice persists" exercised the old `saveSettings`.

**Impact:** no complete browser pass exists on the code that would ship.

**Fix:** freeze a new candidate that includes `68aba34`, and run the whole suite on it, including `poles` and `menu`.

### N3 (Major, QA / save integrity): The migration browser test as committed contradicts the committed `saveSettings`; the logged pass cannot be reproduced from the code [V]

**What the fix does.** `68aba34` drops, on every save, any key the stored object lacks while that key still equals its default (`settings.ts:184-188`).

**What I reproduced** (`/tmp/eexp/save.test.ts`):
- A Pass 3-style save without `controlHints` is loaded, its course is changed, and it is saved.
- The stored object then contains **no `controlHints`, no `reduceWeather` and no `seenPoleHint`**.
- `seenPoleHint` appears only once it becomes `true`.

**What the test expects.** `migration.spec.ts:171` still requires `toEqual({ ...PASS3_SETTINGS, course: 'classic', controlHints: true, ... })`:
- `PASS3_SETTINGS` has no `controlHints` (`migration.spec.ts:23-58`).
- Nothing else writes settings: every write goes through `saveSettings`, called from `App.ts:155,531,538`.
- So this assertion should fail on `f51fd74`, yet `e2e.txt` logs it as passed (10.2 min).
- Line 169 (`typeof savedS.seenPoleHint === 'boolean'`) also fails unless the pole hint happened to fire.

**The failure story does not match the code either.**
- `e2e.txt` says the first failure was the settings gaining `reduceWeather` "on open". At `b70a793` nothing saves on open: the save call sites above are menu changes, the pole hint and tutorial retirement. The round-1 build passed the same "loads unchanged" check with `controlHints` already absent.
- The failure was almost certainly at line 171, after the run, where a plain test update in the Pass 6 style would have sufficed.

**The test was weakened.** `f51fd74` makes `reduceWeather` optional (`...('reduceWeather' in savedS ? {reduceWeather:false} : {})`). It now passes whether or not the key is written. Its comment ("written at its default by a save") contradicts `68aba34`, which ensures that the key is never written there.

**My judgement of the fix itself:**
- It is **safe**: no save is rewritten on load, there is no migration, no key changes, and defaults fill missing keys on load.
- It **changes behaviour for every setting**, not only Reduce Weather: Pass 3 saves will now never store `controlHints`.

**Fix:**
- Rerun `migration.spec.ts` on the final `src` and publish the real output.
- Make line 171 state the actual rule: the keys are absent while at their default, as `reduce_weather.test.ts` does.
- Correct the `e2e.txt` account.

### N4 (Minor): No capture or browser test of any new accessibility feature [V]

- **Captions:**
  - There is no screenshot of two caption lines (Yeti and warning) together, and none at UI 150% or at 1366×768.
  - At 150% the font is 22.5 px and the box is anchored `calc(11vh + 64px)` from the bottom inside the zoomed `.ui`. My estimate is that two lines, or one wrapped warning, put the box top at about y 370–450 on 720p. That is over the skier (y ≈ 440–515 in 04, 05 and 16) and the terrain just ahead. This is unverified, so it needs a capture.
- **Reduce Weather Effects:** no on/off pair of captures exists. Its strength is in N5.
- **Whiteout in the Location menu:** still untested. `menu.spec.ts:197` covers Alpine and Fjord only.
- **Captions in a Whiteout front:** `whiteout.spec.ts` asserts the pill only. `weatherHud().caption` exists (`App.ts:994`) but is unused.

### N5 (Minor): Reduce Weather Effects is safe but modest, and its documentation overstates it [V]

- **Fog:** with the setting on, 60% of the storm's excess fog density is kept (`WEATHER_FX_FOG_KEEP`, `World.ts:606-610`). The peak of 11× base becomes 7×, so the visible range grows by only about 1.6× in the worst storm.
- **Snowfall:** 0.615× (`World.ts:609`).
- **Blowing streaks:** density 0.64× (`blowingSnow.ts:139`).
- **The storm look itself:** flat grey light, the lost horizon and the sky dome are not touched.
- **Documentation:** `weatherFx.ts:3-4` says it thins "the drift plumes". No plume code reads `weatherFx`. That is the right behaviour, because plumes are a telegraph, but the documentation is wrong.
- **Evidence:** there is no evidence of what a player with the setting on sees.
- **Fix direction:**
  - Consider a stronger fog floor (for example keep 0.4).
  - Add an option to soften the grey-out.
  - Capture 05 and 28 with the setting on.

### N6 (Minor, regression): `saveSettings` silently stops saving when the stored value is parseable JSON but not an object [V]

My probe stored `5`, `true` or `"x"` under the settings key and then saved. **The settings were never written again**: `k in 5` throws, and the outer `catch` swallows the error.

- Before `68aba34`, the first save overwrote such a value.
- `loadSettings` copes with these values, so the game runs, but no change the player makes is ever persisted.
- This contradicts the module's promise that "corrupt or hand-edited storage can never break the game" (`settings.ts:128`).
- **Fix:** treat `stored` as null unless it is a plain object (`typeof === 'object' && !Array.isArray`).

### N7 (Minor): The front caption points players at the lee, which the developer's own data shows costs wins [V]+[D]

- The caption reads "...the left shoulder is the lee" (`GameSession.ts:1194`).
- Recomputed from `balance/round2/*.jsonl`, W2H Normal Sprint: `informed2` (with lee) **17/24** against `informed2NoLee` **22/24**. On W034 it is 21 against 20.
- The README lists the lee as open (W-055).
- A caption should not steer toward a measurably worse choice. Either make the lee pay (Reviewer B's call), or drop the lee from the text until it does.

### N8 (Minor): `aria-live`, pill contrast and the `reduceFlashes` gaps carried over

E7, E8, E9 and the `aria-live` part of E12 are unchanged; see the table above. Together they keep "redundant, non-colour, flash-safe" storm information short of a 9.

## Controls and saves (verified, no defect beyond N3 and N6)

- **Controls:** no new actions. The captions name no keys, so they stay correct after remapping.
- **Reduce Weather:** a boolean, sanitized (`settings.ts:143`). An old save loads it as `false`.
- **Progress and records:** formats, keys and record keys are unchanged in `src/progression` and `settings.ts`. The only progression change is the removed `requires`.
- **Persistence of the settings fix:** after `68aba34`, nothing is written on load, and a fresh install still stores every key (unit test and my probe).

## What would raise category 7 to 9

1. **N1:** make a cell's direction agree across HUD, audio and caption, or carry it on the HUD. No warning may expire unseen; test this in `captions.test.ts` with the overlapping cases above.
2. **E7, E8, E9:** a pill at 4.5:1 or better; `reduceFlashes` applied to the storm eye glow, beacon and light bar; lamps that run in sequence and lines told apart by more than colour.
3. **N4 and E12:** captures at 1366×768 and 1280×720 at UI 150% with two caption lines; Reduce Weather on/off pairs; a capture tool that ticks HUD timers; e2e assertions on the front and blizzard captions and on selecting Whiteout in the menu; `aria-live="polite"` on the caption box.
4. **QA:** re-freeze the candidate with `68aba34` (N2); fix N3 and N6; rerun the full suite, `poles` included, on the final `src`.
5. A stronger Reduce Weather fog floor (N5), and a front caption that does not recommend a losing line (N7).
