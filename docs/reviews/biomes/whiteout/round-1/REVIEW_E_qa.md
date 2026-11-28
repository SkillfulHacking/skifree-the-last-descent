# Whiteout Ridge, round 1: Reviewer E (QA and Accessibility Lead)

- **Reviewer:** E, QA and Accessibility Lead. Owns category 7 (Accessibility and controls) and QA coverage.
- **Nature of review:** model-based reviewer, **not a human playtester**. I did not play the game in real time. Feel, motion comfort and real listening were not assessed.
- **Build:** `3f7bc45` (branch `pass5-whiteout`). I checked that `git diff 0f04659 3f7bc45 -- src` is empty. The screenshot manifest records `6d0cdfa`, which has the same `src`.
- **What I examined:**
  - Source: `src/game/GameSession.ts` (weather HUD, captions, Yeti storm look, audio frame state), `src/ui/Hud.ts`, `src/ui/styles.css`, `src/ui/location.ts`, `src/ui/achievementsView.ts`, `src/core/settings.ts`, `src/input/Input.ts`, `src/game/CourseConfig.ts`, `src/progression/achievements.ts`, `src/audio/storm.ts`, `AudioCore.ts`, `ambience.ts`, `src/world/biomes/whiteout/*` (storm, hazards, scenery lamps, rescue beacon), and `World.releaseWeather`.
  - Tests: `tests/e2e/whiteout*.spec.ts`, `menu.spec.ts`, `release.spec.ts`, `tests/unit/whiteout*.test.ts`, `tests/sim/courses.measure.test.ts`.
  - Evidence: `round-1/e2e.txt`, `courses.json`, `audio.json`, the manifest, and screenshots 01–07, 16, 17, 18 and 19. I sampled pixels with PIL.
  - One headless probe of my own, written under `/tmp`: `frontAt` and `WHITEOUT_WEATHER.sample` run through `tsx` over 20 minutes on 4 seeds.
  - I did not read DEFECTS.md, SLICE_REVIEW.md or any other Whiteout review.

## Verdict

**FAIL** for category 7 against the 9/10 target. Controls and saves are sound. However, the storm, which is the location's signature, is not conveyed reliably or redundantly:
- the captions are too fast to read, can be suppressed, and can overflow the screen;
- the audio barely changes in a storm;
- there is no option to reduce the whiteout itself.

The Achievements screen also tells players the location is "coming soon", and a test enforces that text.

| # | Category | Score | One-line justification |
|---|---|---|---|
| 1 | Visual art direction (lc) | 7 | Strong storm and clearing palette in 01–07. 16/17 show a clear sky while the HUD and manifest say STORM. |
| 2 | Environmental uniqueness (lc) | 8 | Fronts, a storm wall and lamp-lined lines are distinct from Alpine and Fjord. |
| 3 | Skiing and hazard mechanics (lc) | 6 | Developer data (W-034) shows the weather decisions the captions recommend are neutral or harmful. |
| 4 | Difficulty and fairness (lc) | 5 | 11/18 Normal "informed" sims in `courses.json` are caught, including Classic Sprint and today's Daily. |
| 5 | Cinematics (lc) | 7 | Not my speciality. The cave hand-back leaves the HUD and the visuals disagreeing. |
| 6 | Performance and stability (lc) | 5 | Developer perf README: 7.5 ms median CPU per frame and 1,220 frames over 16 ms, against Fjord's 17. |
| **7** | **Accessibility and controls (owned)** | **6** | Remapping and saves are fine. Storm information is not redundant (findings E1–E5). |
| 8 | Overall player experience (lc) | 6 | Atmospheric, but balance and the accessibility gaps above weigh on it. |

## Findings

Severity: Critical, Major or Minor. **[V]** means I verified it myself (code read, pixels measured or probe run). **[D]** means a developer number taken from the evidence documents.

### E1 (Major): Storm and blizzard warnings are silently lost whenever a Yeti caption is on screen [V]

- **The mechanism:**
  - `GameSession.ts:170` re-issues the hard caption `[heavy footsteps behind you]` (1.2 s) on every Yeti footstep while the Yeti is under 45 m in the chase. Hard captions have priority `Infinity` (`Hud.ts:210`).
  - `Hud.caption` rejects any soft caption while a higher-priority caption is showing (`Hud.ts:211`).
  - The front warning (`GameSession.ts:1182`) and the blizzard telegraph (`GameSession.ts:814-816`) are soft "warning" captions.
- **Neither warning is retried:**
  - `lastFront.phase` is updated whether or not the caption was shown (`GameSession.ts:1185`).
  - A blizzard telegraph fires once per cell.
  - A front caption on screen (priority 2) also blocks a blizzard warning (also priority 2) that arrives within its 3.2 s.
- **Why it matters:** the instructions that need a decision ("it will push you left; stand up out of the tuck") disappear exactly when the Yeti is close, the most dangerous moment. For deaf and hard-of-hearing players, the caption is the only channel that carries the blizzard direction.
- **Fix:** a small caption queue that defers warnings instead of dropping them. Rate-limit the footstep caption (it is a status, not news), or move pursuit status to the Yeti bar.

### E2 (Major): The weather captions are far too fast to read and can run off the screen [V]

| Caption | Characters | Duration | Rate |
|---|---|---|---|
| Front | 121 | 3.2 s | 38 characters/s, about 470 wpm |
| Blizzard | 93 | 2.8 s | 33 characters/s, about 410 wpm |

- Common subtitle guidance is about 15–20 characters/s, and these are read while skiing at 60 km/h.
- `.hud-caption` is `white-space: nowrap` (`styles.css:168`). Only `.hint` wraps (`styles.css:237`).
- I measured the front caption box in `04_build.png`: x 173–1106, which is **934 px at UI scale 1.0**.
- `.ui { zoom: var(--ui-scale) }` (`styles.css:160`). At the "Interface text size" maximum of 150%, the box is about 1,401 px, so it is clipped on both sides on 1366- and 1280-wide screens. Players who raise the text size are the ones most likely to need captions.
- **Fix:**
  - Shorten the text (for example "[Storm front: wind pushes LEFT, shelter or slow down]").
  - Scale the duration to about 15 characters/s, with a minimum.
  - Allow wrapping with a `max-width`, as `.hint` already does.

### E3 (Major): Audio does not carry the storm: no storm layer, no direction, cues shared between events [V] + [D]

- **No storm layer:**
  - `AudioFrameState` has no weather field (`core/types.ts:89-117`), and the frame state is built at `GameSession.ts:1217-1233`.
  - The wind bed is driven by speed, "eerie" and an internal gust clock only (`ambience.ts:191`). Fifty seconds of storm sound the same as clear weather.
  - The only front sound is a 4.6 s `blizzard-build` one-shot at the start of the build.
  - There is no cue when the storm arrives and none when it eases.
- **No direction:** the front cue is played with `pos = null` (`GameSession.ts:1181`), so it gives no hint of which way the wind will push.
- **Cues shared between events:** the front and a local blizzard cell use the same `blizzard-build` cue (`hazards.ts:162`), so the two cannot be told apart by ear.
- **Measured level:** the developer probe gives storm RMS 0.101 against clear 0.089, about **+1.1 dB** ([D] `audio.json`), and the storm segment also contains the closing chase.
- **Why it matters:** for low-vision players, sound is the redundant channel the design document promises ("telegraphed (sky, snow drift, wind audio, HUD)", `biome.ts:10`). It does not exist as a sustained signal.
- **Fix:**
  - Pass `storm` and the wind vector into `AudioFrameState`.
  - Raise the wind bed's gain, lower its pitch and pan it to `windX`.
  - Add an arrival cue and a clearing cue.
  - Give the local blizzard cell a sound distinct from the front.

### E4 (Major): No way to reduce the whiteout, although about half of play time is heavy storm [V]

- **Measured:** my probe over 20 minutes on 4 seeds (including the evidence seed 3403625622) gives:
  - **45–50% of time with storm intensity above 0.5;**
  - **43–49% of time with fog density above 5× the base** (up to 11×, `storm.ts:31`);
  - snowfall up to 2.85× (`storm.ts:198`).
- **No setting covers it:**
  - `Settings` has no visibility or particle option (`settings.ts:7-43`).
  - `reduceCameraMotion` affects only the camera (`FollowCamera.ts:212-226`).
  - `docs/BIOMES.md:154-155` itself anticipates a "reduce visibility effects" setting that scales visibility in the renderer only. This location is where it is needed.
- **Why it matters:** low-vision and motion-sensitive players (dense driving snow streaks, `blowingSnow.ts`) have no option, in the one location built around low visibility.
- **Fix:** add the renderer-only setting described in `BIOMES.md` (fog multiplier toward 1, snowfall and streak density scaled down), with no change to the physics.

### E5 (Major): The Achievements screen says Whiteout Ridge is "coming soon", and a test requires it [V]

- `achievements.ts:242` still has `requires: 'Whiteout Ridge location'`, so `achievementsView.ts:28` renders "**Needs the Whiteout Ridge location (coming soon)**" on the locked Whiteout Survivor card.
- Meanwhile `capabilities.test.ts:589` confirms that Whiteout ships and is in the Location menu.
- `release.spec.ts:55` *asserts* the "coming soon" text for `whiteout-survivor`, and that test passed on the candidate (`e2e.txt`, release #1).
- Fjord's `scenic-route` dropped its `requires` when Fjord shipped (commit 7fb1fd0), so this is a missed step in that pattern.
- **Fix:** remove `requires`, update `release.spec.ts` (two future cards, `whiteout-survivor` not `.future`), and move the card out of the "still in development" block.

### E6 (Major, QA): The course matrix records failing playability but asserts nothing about it, and the spec's matrix is not met [V] + [D]

- `courses.measure.test.ts` simulates only Normal Sprint and Normal Standard, and never asserts the outcome. In `courses.json`, **11 of the 18 "informed" runs are `caught`**:
  - `CLASSIC-SPR@WHITE` at 84.9 s and `CLASSIC-STD@WHITE`;
  - both lengths of today's Daily (`DAILY-2026-11-18-SPR/STD@WHITE`);
  - 7 other Custom and Daily runs.
- Relaxed, Hard, Endurance, Expedition and Endless are never simulated.
- `docs/BIOMES.md` "Test expectations" requires skilled and intermediate runs over at least 3 seeds × Sprint, Standard and Expedition × all three difficulties, and "Skilled finishes or survives".
- The unit tests run only 4 Relaxed Sprint seeds plus hand-picked WD seeds (`whiteout.test.ts:300-313`).
- Balance itself is Reviewer B's call (lc). As QA: the acceptance gate does not exist, and the evidence shows it would fail.
- **Fix:** assert the spec's matrix, or record a waiver.

### E7 (Minor): The amber "STORM IN n s" pill fails text contrast [V]

- I measured white text on the pill background in `04_build.png` at (178,117), RGB (170,122,40): **3.8:1**.
- The text is 14 px / weight 800 (`styles.css:94`), which counts as normal text, so it needs 4.5:1.
- For comparison, the storm pill measures 11.1:1 and the CLEARING pill 8.2:1, both fine.
- **Fix:** a darker amber (about #8A5200) or dark text on amber. Consider an icon in addition to colour.

### E8 (Minor): "Reduce flashes & pulsing" is not applied to Whiteout's new effects [V]

- The storm-look eye glow is `0.75 × smoothstep` with no `reduceFlashes` check (`GameSession.ts:1157-1158`). The cave cinematic does honour it (`CaveCinematic.ts:186`), and `DESIGN.md:138` says the setting softens the Yeti eye glow.
- The rescue station beacon (1 Hz, scale 2.4→4.0) and the light bar (`sin(9t)`, about 1.4 Hz, opacity 0.25→1.0) ignore it (`rescue.ts:581-585`). Both are below 3 Hz, but the setting promises "pulsing" is reduced.

### E9 (Minor): The trail lamps neither show direction nor distinguish the lines in a storm [V]

- `scenery.ts:7` says the lamps "pulse slowly in sequence down the hill". In the code, every lamp in every chunk pulses in unison (`scenery.ts:217`). The per-lamp `phase` array is computed (`scenery.ts:150,158`) and never used.
- Amber (main line) against blue (exposed line) is a colour-only distinction (`scenery.ts:157`). With additive blending over fog the lamps render white:
  - `05_storm` lamp at (492,384): average RGB 246,246,246;
  - `19` lamp at (1073,338): 255,255,255.
- The "sheltered line" the caption recommends is never identified anywhere in the game (searched `src/game`, `src/ui`).

### E10 (Minor): The HUD arrow can contradict a blizzard cell's push [V]

- Each cell's direction is a coin flip (`hazards.ts:140`), independent of the front's direction (`storm.ts:102`).
- Inside a "STORM ←" front, a cell may push right. Only its (droppable, E1) caption, the curtain's sweep and the spatial cue say so.
- **Fix:** align the cells with the front, or show the cell's direction on the HUD.

### E11 (Minor): The HUD says STORM while the screen shows clear weather after the cave [V, needs confirmation]

- In `16_storm_chase` and `17`, the pill reads "STORM ←" and the manifest gives storm intensity 0.84, but the sky is blue with sun.
- The HUD reads the model directly (`GameSession.ts:1166`), while the presentation fades back over 7 s (`World.releaseWeather`, `stormCave.ts:176-180`).
- Either that is a 7 s contradiction in play, or the capture is unrepresentative. Either way, 16 is not usable as evidence of "captions and HUD in a storm" (no caption is visible in it).

### E12 (Minor): Gaps in the evidence and in a test's stated coverage [V]

- **Missing screenshots and resolutions:**
  - no main-menu shot with Whiteout selected (`BIOMES.md` checklist item 1);
  - no blizzard or drift telegraph and active shot (item 4);
  - all shots are 1280×720, where the checklist asks for 1920×1080 plus 1366×768 and 2560×1440.
- **Misleading caption timing:** `05_storm` still shows the build caption, which first appears in `04` 18 s earlier (it lasts 3.2 s). The capture's `setTime` does not run HUD timers, so the screenshots misrepresent caption timing.
- **Test header:** `whiteout.spec.ts:3` says the front is announced by "HUD pill + caption", but the test asserts only that the pill text is non-empty (`whiteout.spec.ts:77-85`). It checks neither the caption, the countdown text nor the arrow.
- **ARIA:** there is no `aria-live` region for the pill or the captions (`Hud.ts:104,112`). This predates Whiteout.

## Controls, saves and course codes (verified, no defect)

- **Controls:** Whiteout adds no actions. The captions name no keys (safe under remapping). Rebinding and pad tests pass (`e2e.txt` poles #14–15).
- **Saves:**
  - Whiteout changes no settings or progress keys. `skifree-tld.settings.v1` and `records.v2` are unchanged; the only `settings.ts` diff on the branch is the Pass 6 `controlHints`/`seenPoleHint`, merged from main.
  - An unknown biome falls back to Alpine (`settings.ts:152`), so a downgrade is safe.
  - Records are keyed by `@WHITE` codes and do not collide with other locations.
- **Course codes:** codes parse case-insensitively. `courses.json` round-trips all 51 codes and confirms that they are deterministic and finish at the right length.

## Untested risk areas (concrete)

1. **Menu:** choosing Whiteout through the Location row with keyboard, mouse or pad; the "●●●○○ Stormy" note; and layout fit at 1366/1920/2560. `menu.spec.ts:196` covers Alpine and Fjord only.
2. **Captions:** text, duration, priority interplay (E1), the captions-off path and overflow at UI scale 150% (E2). There are no unit or e2e tests of any weather caption.
3. **Weather pill:** countdown values, arrow direction against the sign of `windX`, and the warn/storm/calm classes.
4. **Real progression:** a non-`?debug` Whiteout victory that persists `biomesVisited` and unlocks Whiteout Survivor. The e2e only checks that a debug run does *not* persist.
5. **Settings:** `biome: 'whiteout'` surviving a reload. Only the generic `test-dunes` unit test covers it.
6. **Endless in Whiteout:** banking at the `ridge-rescue-hut` refuge and records. Endurance and Expedition finish in a real browser.
7. **Quality presets:** the Whiteout e2e runs only at `quality: 'low'` (`whiteout.spec.ts:61`) and 960×540. The W-031 rerun ran at 320×180. High and ultra storm rendering is unexercised.
8. **Hard snowball marker:** it is asserted as a boolean flag, not as legibility in fog.
9. **Audio:** no unit test for `stormCue` (`audio.test.ts` has no storm cue), no limiter interplay between front and cell `blizzard-build` cues, and no listener test.
10. **Accessibility settings in storm:** `reduceFlashes`, `reduceCameraMotion` and camera shake 0 during fronts and the rescue victory.
11. **Simulation coverage:** Relaxed, Hard, Endurance, Expedition and Endless (E6). Daily with -R/-H.
12. **Visibility as a human experiences it:** not measured anywhere. The developers note that the headless driver sees through fog.

## What is good

- The storm pill (11:1) and the CLEARING pill (8:1) are legible over fog. The Yeti label is about 13:1 in a storm.
- The countdown and arrow are a good quick read.
- Save handling is careful and backward compatible.
- The course-code matrix is thorough on round-trip and determinism.
- The W-031 rerun test is a good regression guard.
- Front timing is deterministic and has a calm start.

## What would raise category 7 to 9

- Fix E1–E5: a caption queue; short, wrapping captions with durations scaled to their length; a storm audio layer with direction; a renderer-only "reduce weather effects" setting; and the corrected achievement card and test.
- Fix E7–E9: pill contrast, `reduceFlashes` coverage, and line identification that does not rely on colour.
- Add e2e coverage for items 1–4 and 10 above.
- Provide 1920×1080 menu and hazard evidence.
