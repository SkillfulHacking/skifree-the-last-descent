# Fjord Coast, Round 1: Reviewer E (QA & Accessibility Lead)

- **Reviewer:** E, QA & Accessibility Lead
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `f8519ca` (branch `pass4-fjord`; worktree HEAD `78cb83f` adds evidence commits only, and `git diff f8519ca HEAD -- src tests` is empty)
- **Date:** 2026-11-10
- **Method:** source reading; the existing unit suites (`fjord`, `achievements`, `input`, `events`, `capabilities`: 104/104 pass; `tsc --noEmit` clean); new headless scratch tests in `scratch/review-e/` that sample many seeds; and the round-1 screenshots at 1366×768, 1920×1080 and 2560×1440. I did not run a browser, Playwright or `vite build`.

Scratch tests (run with `npx vitest run -c scratch/review-e/vitest.config.ts <file> --silent=false`):
`codes.test.ts`, `gen.test.ts`, `sim.test.ts` (env `LEN`, `N`, `STYLES`), `start.test.ts`, `stuck.test.ts`, `lookchase.test.ts`, `detour.test.ts`, `sight.test.ts`. Raw sim output is in `sim_fjord_*.txt`.

---

## 2. Verdict: **FAIL** against the 9/10 targets for my categories

On QA grounds the Fjord build is solid. Generation is deterministic and independent of query order. Over 63 finite-course seeds and 3 Endless seeds (60 km each) I found no impossible obstacle layout, no route, alternate line or kicker inside the cornice, no shelter on the cliff, and no finish in the water. Every finite length ends exactly 190 m above the quay, on land 2.2–19 m above the open sea. `@FJORD` course codes round-trip in every mode, length and difficulty, both raw and percent-encoded in a URL, and the existing un-suffixed codes are unchanged. Difficulty separation holds across 12 Sprint seeds: skilled skiers win 36/36 runs, and intermediate skiers win 12/12 on Relaxed and Normal but only 7/12 on Hard. Scenic Route is wired from the real discovery trigger to a persisted unlock, with debug runs excluded.

Two areas fall short of 9:
- **Difficulty and fairness.** The optional viewpoints sit almost entirely inside live Yeti chases (Defect 1). A bot that detours to one is caught about 3 times in 8, **even on Relaxed**. This contradicts the brief's "reward exploration without punishing" intent for a 2/5 "Scenic Exploration" location.
- **Accessibility.** The Fjord's new audio cues (squall build-up and blow, surf, viewpoint) have no captions. Some player-facing text still says "resort" at a harbour finish. HUD and menu small text has low contrast over the bright Fjord sea and snow.

I found no Critical defects.

## 3. Scores

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 7 (low confidence) | It reads clearly as a coast: cliffs, open sea, coloured harbour houses. From a QA view, the far islands render as flat white slabs, and in `04b_hazard_rock.png` (top centre) there is a flat beige triangle hanging in the sky. Defer to Reviewer A. |
| Environmental uniqueness | 8 (low confidence) | It is instantly distinguishable from Alpine in every screenshot (sea on the right, harbour finish). Defer to A/F. |
| Skiing and hazard mechanics | 8 | Hazards are deterministic, never sit on the racing line, and stream with bounded residency. The cornice guard never let a skier over the rim in any sample. The squall (onshore only, airborne only) and the scoured rock (speed cost only) are safe but mild. |
| Difficulty and fairness | 7 | There are no unfair layouts across all sampled seeds, and Relaxed, Normal and Hard separate as intended. Two problems hold it back: viewpoint detours are heavily punished because they happen during chases (Defect 1), and some seeds have an unusually flat run-in at the start (Defect 6). |
| Cinematics | 7 (low confidence) | Only the stills were checked. The victory trophy shot is readable, but the "Skip Esc" hint has low contrast. Defer to C. |
| Performance and stability | 8 (medium-low confidence) | `tsc` is clean and the suites pass. Hazard and obstacle streaming are bounded over 60 km, and seeded generation is stable. Frame rate was not measured (rule-restricted). |
| Accessibility and controls | 7 | Input is unchanged and complete (keyboard remapping, gamepad), and the Location row works with menu navigation and does not clip at any of the three resolutions. However, the new Fjord cues have no captions, the squall telegraph is visual-only for Deaf or hard-of-hearing players, the copy is inconsistent ("resort"), and small HUD and menu text has low contrast. |
| Overall player experience | 7.5 | Robust and fair to race. Exploring, the location's stated identity, is risky rather than rewarding. |

## 4. Defects

1. **Major: viewpoints are almost always inside a live Yeti chase, so the "optional exploration bonus" is effectively punished.**
   - *Evidence:* `scratch/review-e/lookchase.test.ts` (8 seeds per length) counts viewpoints that fall between an encounter's `triggerZ` and `chaseEndZ`:
     - Sprint: 14 of 14
     - Standard: 55 of 56
     - Endurance: 112 of 112
     - Endless: 161 of 162
   - The lateral detour from the racing line is 21–110 m (median about 60 m), toward the cliff.
   - `scratch/review-e/detour.test.ts` uses the skilled autopilot plus a steer to the first Sprint viewpoint and back. That bot is caught on Relaxed 3/8, Normal 4/8 and Hard 4/8. The same autopilot without the detour wins 12/12 at every difficulty (`sim_fjord_sprint.txt`).
   - The cause is that `Coast.lookouts` (`src/world/coast.ts`, `busy()`) excludes only cave shelves and refuges. The first viewpoint starts at z ≥ 580 (`lookoutZ = 380` plus 200–500 m), after the Sprint trigger.
   - The achievement itself still unlocks, because the event fires before the catch.
   - *Fix:* bias viewpoint placement into reprieve windows: the run-in before the first trigger, and the stretch after each refuge before the next cave. On Sprint, add one viewpoint in the pre-cave run-in. Alternatively, make the Yeti lose ground or hesitate while you are on a viewpoint platform. Then add a headless test like `detour.test.ts` asserting a skilled detour wins on Relaxed.

2. **Minor (accessibility): the new Fjord audio cues have no captions.**
   - *Evidence:* the squall plays `gust-build` / `gust-blow`, and scoured rock and viewpoints play `rock-scrape` / `viewpoint`. `GameSession.listenEnvironment` (`src/game/GameSession.ts` ~698–707) and `checkLookouts` (~710–722) call `audio.playCue` but never `hud.caption`. Every Yeti cue does have a caption (`[heavy footsteps behind you]` and others), and `settings.captions` defaults to true.
   - The windsock and spindrift telegraph (`04_signature_hazard.png`) exists, but it is small, sits off to one side, and is easy to miss at speed.
   - *Fix:* when captions are on, caption the first squall telegraph of a run and any that is directly ahead (for example `[a squall gusts off the fjord]`), and caption the surf/gulls ambience once.

3. **Minor (copy/consistency): the harbour finish is called the "resort".**
   - *Evidence:*
     - Results row "Reached the resort": `src/game/App.ts:590`
     - Refuge title "The resort is still a long way down": `src/game/GameSession.ts:475`
     - Achievement text for First Descent, Not Today Yeti, Long Haul and Daily Ritual says "Reach the resort": `src/progression/achievements.ts:158,166,193,201`
     - Endless blurb "Bank at the lodges": `src/game/CourseConfig.ts:37`
   - By contrast, the intro correctly uses `finishDef.goal` ("harbour").
   - *Fix:* use `finishDef.goal` in the results and refuge strings, and write the achievement text in a biome-neutral way ("Reach the finish").

4. **Minor (visibility): small HUD and menu text has low contrast over the bright Fjord sky, sea and snow.**
   - *Evidence:*
     - `09_pursuit.png` / `09c_hard_snowball_marker.png`: the thin 13 px red-orange "YETI 24 m — MOVE!" sits on pale sky; "TO FINISH", "×1.0", "KM/H" and the 10 px "BEHIND YOU" (`styles.css:157`) are faint.
     - `01_menu*.png`: the Location note is 11 px dim text (`styles.css:56`) over trees and snow with no panel. At 2560×1440 the menu uses fixed px sizes, so it is tiny relative to the screen.
     - `11_victory_trophy.png`: the "Skip Esc" hint is faint.
   - The same issue exists in the Alpine baseline (`alpine-baseline/09_pursuit.png`), but the Fjord's open bright sea backdrop makes it more frequent.
   - *Fix:* add a subtle dark scrim or plate behind the HUD corner clusters and the Yeti meter label, increase the minimum HUD label size to about 12–13 px with heavier weight, and scale menu type with the viewport (`clamp`) at ≥ 1440p.

5. **Minor (course codes): two forgiving-input gaps.**
   - *Evidence:* `scratch/review-e/codes.test.ts`:
     - A code pasted in its URL-encoded form, `CLASSIC-SPR%40FJORD`, is rejected by the menu's code field.
     - `CLASSIC-SPR @FJORD` or `@ FJORD` (inner space) is rejected.
     - `CLASSIC-SPR@ALP` is accepted as a non-canonical alias of `CLASSIC-SPR` (harmless).
     - The code-error help text gives only examples without `@CODE`, so players are never shown the location suffix.
   - Round-trip, case-insensitivity, raw `@` in a query string, future-day rejection and the 32-character field limit (longest Fjord code is 28 characters, `DAILY-2026-11-09-SPR-R@FJORD`) are all fine.
   - *Fix:* in `parseCourseId`, `decodeURIComponent` when the input contains `%`, and strip inner whitespace. Add one `@FJORD` example to the error text.

6. **Minor (fairness/onboarding): the Fjord summit run-in is flatter than Alpine on some seeds.**
   - *Evidence:* `scratch/review-e/start.test.ts` runs 30 seeds × 3 lengths. With no input for 20 s, the skier comes to a full stop within 13 m on 4/30 Fjord seeds versus 2/30 Alpine. Example: `SEED` text `ST6839` stops at z = 0.3 m; `SIM1441` has a 0.22 m drop per 5 m from z = 0–20.
   - Tuck (skate push) always gets moving, so this is a soft-lock only for players who have not learned tuck. The "careless" autopilot timed out at z = 7 on `SIM1441` at all difficulties (`sim_fjord_sprint.txt`).
   - *Fix:* guarantee a minimum gradient over the first 30 m of the run-in (the coast berm and sea-bank shaping is the likely cause), or give a small start push. Add a seeded test asserting that a no-input start reaches z > 30 m.

7. **Minor (progression data): viewpoint ids are not stable across courses.**
   - *Evidence:* `Lookout.id` is `lookout-<n>` per course (`coast.ts`, `lookouts()`), so the persistent `scenic` stat set (`achievements.ts:135`) merges "fjord:lookout-0" from every course into one entry.
   - Scenic Route works, but any future "discover N viewpoints" goal would undercount.
   - *Fix:* include the course id or rounded world position in the id (for example `<courseId>/lookout-0`), or document that the set counts per-index.

8. **Minor (latent, cross-biome): the sighting caption names the wrong side, and on the Fjord the "ridge" would be the sea.**
   - *Evidence:* projecting a +X point with the gameplay camera (looking +Z) lands on screen-left (`scratch/review-e/side.mjs`, NDC x = −0.47). Yet `GameSession.ts:456` captions `side > 0` as "to your right".
   - On the Fjord, `side < 0` would put the howl 140 m beyond the piste edge, over the sea.
   - It is currently latent: none of 12 sampled Fjord Endurance, Expedition or Endless seeds generates a sighting (`sight.test.ts`). The `coast.ts` header comment ("the sea is on −X, the skier's left") has the same inversion.
   - *Fix:* swap the caption mapping, force sightings on coastal biomes to the land side (+X), and correct the comment.

## 5. What works

- **Determinism.** Mountains, obstacle bands, hazard bands and viewpoints are identical when built in reverse or arbitrary order (`gen.test.ts`). Daily Alpine and Daily Fjord share the date seed but mix the biome into the world seed.
- **Coastline at every length.** The finish is always on land with the open sea beyond the quay. The route never enters the cornice (max guard on the route was 0.00 over every sample, and the minimum route-to-rim distance was 53.5 m). Alternate lines, kickers and cliff drops all have guard 0. Coastal shelters stand 95–110 m inside the rim, on level ground (foot spread ≤ 0.73 m).
- **Clear racing lane.** The minimum lane clearance over all seeds was 5.3 m. Scoured rock is never on the lane and always on the piste. No obstacles stand on the rim or on viewpoint platforms.
- **Difficulty and length outcomes.** Relaxed, Normal and Hard separate meaningfully without Yeti-speed-only scaling. Standard and Endurance runs finish for skilled skiers on Relaxed and Normal. Hard (snowballs) catches a crude dodging bot 1/4 times on Standard and 1/2 on Endurance, which is plausible for Hard.
- **Retry.** A retry reuses the world, and `SkierPhysics` resets the environment's hazard tracks, so no stale hazard events leak into the next run. Daily retries keep the same course across the UTC rollover.
- **Persistence.** Scenic Route unlocks from the real `ScenicLocationDiscovered` event (biome `fjord`), commits immediately, and debug or autopilot runs never persist. Settings with an unknown biome fall back to Alpine, and records are keyed by `@FJORD` code.
- **Menu.** The Location row fits without clipping or overflow at 1366×768, 1920×1080 and 2560×1440, and it is only shown when more than one location exists.

## 6. Brief compliance (Fjord bullets relevant to QA and accessibility)

| Brief item | Status | Evidence |
|---|---|---|
| Large open downhill runs | Done | `widthScale` 1.08; lane clearance ≥ 5.3 m on all seeds |
| Scenic branching paths / ridgeline shortcuts | Done | Alternate lines present, never in the cornice (`gen.test.ts`) |
| Gentle coastal crosswinds | Done | Airborne-only, onshore, < 2.5 m drift (fjord.test) |
| Exposed coastal rocks | Done | Scoured rock: beside the lane, speed cost only, no crash |
| Small terrain gaps and jumps | Done | Kickers and cliff bands with squalls; none at the rim |
| Optional exploration bonuses for viewpoints | Partial | Present at every length, off-lane and reachable, but 99% are mid-chase and the detour risk is high (Defect 1) |
| "Do not turn bonuses into mandatory detours / don't punish fastest descent" | Done (letter) / Partial (spirit) | The fastest line is never penalised, but exploring is (Defect 1) |
| Finish near the shore; coastline integrates with all lengths | Done | All finite lengths: quay 190 m past the finish, finish area 2.2–19 m above sea; Endless coast continues for 60 km |
| Coastal shelters as refuges (§5) | Done | `coastal-shelter`, on stable ground well inside the rim |
| Relaxed / Normal / Hard work in the location (§2) | Done | Sim tables in `scratch/review-e/sim_fjord_*.txt` |
| Course codes `@` + URL encoding + back-compat (§1) | Done | Minor input-forgiveness gaps (Defect 5) |
| Scenic Route achievement from Fjord viewpoints (§6) | Done | Event wired, persisted, debug-safe; id stability caveat (Defect 7) |
| Hazard "supported by sound", visually recognizable (§4) | Partial | Sound and visuals present; no captions (Defect 2) |
