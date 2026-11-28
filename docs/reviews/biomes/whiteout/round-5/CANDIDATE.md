# Round-5 candidate

**Frozen source:** `729e226` (branch `pass5-whiteout`, draft PR #9).
- **Later commits change only tests, tools and documents.** `bbbef83` changes the evidence harness's cave-shot labelling. `git diff 729e226 <later> -- src` is empty.
- **Two SHAs appear in the logs:**
  - the evidence re-run (`whiteout/`) and the perf JSON record `bbbef83`; `whiteout_victory/` and `a11y_rcm_flash/` record `f71f1b4` (a documents-only commit; source and harness identical to `bbbef83`);
  - the unit, tsc, build, e2e and balance logs record `729e226`.

**Round 4:** `71c9ceb`. `git diff 71c9ceb 729e226 -- src` shows every source change since then: 36 files, +701 / −93.

## What changed since round 4
Work order: `../round-4/CONSOLIDATED.md`, plus the owner's round-5 brief (`OWNER_DECISIONS.md`). Tracker: `../DEFECTS.md`. In it, CLAIMED means fixed by the developer and not yet verified.

**Balance (W-094, W-095).** Commit `946b531`; method and data in `../balance/r5/README.md`.
- **Yeti pace is now per difficulty:** `BiomeTerrain.difficultyPace`, read through `yetiSpeedFor`.
  - Alpine ×1.09 on Hard only.
  - Whiteout ×1.06 on Normal only.
  - Fjord is unchanged and no longer inherits Alpine's pace.
- **Whiteout Hard gets a stronger storm, not a faster Yeti:**
  - hazard intensity 1.1;
  - the storm builds down the course (×1.5 between 3 and 8 km, `hazards.builds`), so a longer descent carries risk per kilometre.
- **Untouched:** the global Yeti speed, the catch-up rule and the hand-off physics. There is no rubber-banding and nothing reacts to the player.

**Searchlight beat (W-083).** Commit `946b531`.
- **Root cause:** the beam's distance fade used `−z`, so its alpha was 0 on every frame. `searchlight_beam.test` fails on the old code.
- **Beam and light:**
  - a 60 m warm cone drawn after the storm dome;
  - a glare sprite at the lamp and a lit pool at the Yeti;
  - the scene dims for the beat.
- **Yeti:** a new `recoil` pose, hand to mouth.
- **Shots and staging:**
  - two shots: from behind the Yeti toward the lamp, then a front ¾ view;
  - beat 23 is framed on the Yeti→skier line;
  - no pole in the lantern hand.

**Yeti in the inset (W-082).** Commit `946b531`.
- During the inset render, inset fog is lowered to 0.45×.
- The inset FOV narrows with distance (9°–48°) so the Yeti fills about 0.32 of the inset's height, keeping him at least 40 px tall within 60 m (`rear_inset.test`). (Corrected after Reviewer D: an earlier draft called `REAR_INSET_FILL` a fill light; it is a framing fraction. There is no added light.)
- The inset now shows on Low for the whole chase.
- The set-up shot is at 38°, with the tucked head and waist in frame (`handoff_camera.test`).

**Art (W-065, W-093).** Commits `946b531`, `23d9113`, `729e226`.
- **Rim and flank:**
  - the drop flank below the lip is scoured dark rock with wind streaks;
  - spindrift plumes rise above the lip;
  - rim wands stand every 24 m, 1.5 m in from the lip, 3.4 m tall.
- **Blizzard curtains:** now camera-facing billboards with a far fade. The sheet at the vanishing point is gone.
- **Storm wall:**
  - billowing top, soft foot and ends;
  - reworked after a blind read called it "a cardboard backdrop";
  - **not blind-read again since that change.**
- **Rocks:** rimed rock; rim rocks use a fixed decimated mesh per rock family (not distance LOD).
- **Racing line:** unchanged; W-056 holds.
- **Blind read** during development, before the storm-wall change: 5/10. The drop was "inferred".

**QA and accessibility (W-097, W-098, W-099).**
- **Accessibility:**
  - RUN. is no longer double-scaled at UI 150% (`a11y.spec`).
  - Lamps hold steady with Reduce Flashes; the Timeline has a `calm` flag.
  - Reduce Weather Effects: 0.25 strength, fog kept at 0.4.
  - The Reduce Camera Motion note is in the menu.
- **Tests:**
  - `cave_skip` measures alignment with the run direction and logs the values;
  - a sub-frame Space tap registers (input test);
  - `cave_history` covers pause-menu Restart and Exit, and changes of seed, length and difficulty.
- **Storm cave:** generators use try/finally, with a cloned sheet texture per cave (`storm_cave_abandon.test`).
- **Evidence harness:**
  - every shot declares what must be in it (Yeti, skier, letterbox) and the run fails unless `LENIENT`;
  - manifests record SHA, course, preset and settings;
  - closest-approach rim shots.
- **Perf harness:** records per-km memory and resources, programs compiled in play, and the largest cave slice.

**Security (W-087).** Commit `e6193cf`.
- **Two new path-traversal findings,** in the round-5 table tools (`AaIXUMn7HHykExLUeKFl`, `AaIXUMmpHHykExLUeKFk`). They were fixed with an enumerated catalogue. `tool_paths.test` covers all three table tools and fails on the old versions. The rating went from C back to B.
- **The remaining B vulnerability could not be identified.**
  - It is not in the GitHub annotations.
  - SonarCloud's API returned 403 from this environment, and no token was available.
  - W-087 is **BLOCKED** pending the issue details from the owner.
  - No rule was suppressed, no directory excluded, and the gate is unchanged.

**Gitar:** approved on `729e226`. All 9 findings are closed; the last one (searchlight disposal) was fixed in `50dc466` with a regression test.

## Evidence (`candidate/`)

**Typecheck, build and unit tests**
- `tsc.txt` and `build.txt`: both exit 0.
- `unit.txt`: 67 files, 542/542.

**Browser suites (`e2e/`).** All 12 specs, 37 tests, pass on their first run on `729e226`.

| Spec | Tests | Time |
|---|---|---|
| menu | 8 | 1.1 h |
| migration | 2 | 15 m |
| progression | 2 | 17 m |
| release | 3 | 54 m |
| poles | 2 | 25 m |
| scenic | 1 | 1.2 h |
| cave_skip | 6 | 1.0 h |
| cave_history | 2 | 20 m |
| a11y | 3 | 39 m |
| whiteout | 3 | 11 m |
| whiteout_rerun | 3 | 10 m |
| game | 3 | 22 m |

**Balance re-measure on the frozen tree (`balance/`).** Files: `expert` (400 rows), `binary` (300), `sloppy` (450) and `tension`. Seeds: Classic plus held-out R5V-01…24. These match the validation runs in `../balance/r5/data/validate/` row for row: 0 differences.

**Renders (`evidence/`).** SwiftShader, so there is no GPU timing.
- **`whiteout_run1_harness_label/`: the first candidate run. It stopped by design at shot 15.**
  - The shot was labelled "The leap (15.2 s)" and required the Yeti in frame. The frame shows the camera turning to the chase view, with no Yeti.
  - The leap plays after control returns, as the chase's first second; the hand-off strips cover it.
  - The round-4 note for the same frame was wrong in the same way.
  - The harness was corrected in `bbbef83`: shot 15 is now the set-up shot (14.45 s, Yeti required), and 15b is the turn.
- **`whiteout/`: the re-run with the corrected harness.** Course WO-R1 (`SEED-3403625622-SPR@WHITE`), 1366×768.
  - Shots 01–20 pass their checks. The Yeti is in frame in the set-up shot (15).
  - **The run stopped by design at 21 (victory beat 2, welcome, 5.2 s): the skier is not in the frame.** The rescuers wave from the porch at someone off-screen.
  - The round-4 frame is the same, and its note ("skier arriving") was wrong.
  - This is reported as a finding against the game (the beat's staging), not fixed on this candidate.
- **`whiteout_victory/`: the victory beats (20–26), captured with `LENIENT=1`** so that the beats after 21 exist. The manifest lists the failed checks.
- **`strip_high/`:** hand-off strips for all three locations.
- **`strip_low/`:** Alpine and Whiteout on Low.
- **`strip_rcm/`:** Whiteout with Reduce Camera Motion.
- **`rim_1366/` and `rim_1920/`:** gameplay-camera rim views. They include the closest approach to the lip.
- **`a11y_reduce_weather/`, `a11y_ui150/` (1280×720) and `a11y_low/`.**
- **`a11y_rcm_flash_run1_strict/`: the victory with Reduce Camera Motion and Reduce Flashes. It stopped at shot 21.**
  - Beat 2 (welcome, 5.2 s) does not show the skier. The default-motion run shows the same, so Reduce Camera Motion is not the cause.
  - **This is a finding against the game, not the harness.** It is not fixed on this candidate.
  - `a11y_rcm_flash/` is the same run with `LENIENT=1`, so the remaining beats are captured. The manifest lists every failed check.

**Performance (`perf/`).** Whiteout, Alpine and Fjord on `high` and `low`; summary and target table in `perf/README.md`.
- **Met:** Whiteout high's software render cost is 1.10× Alpine (2.10× in round 4).
- **Not met:**
  - frames over 16 ms: 17 on high, 9 on low;
  - programs compiled during play: 6, against a target of ≤ 2;
  - cave slice: 24.7–31 ms.

## Not done or not met (developer's view; the reviewers decide)
- W-087 BLOCKED (above).
- Hard Sprint is at or just above the owner's range for the progressive-tuck expert (79–83%).
- The storm wall has not been blind-read since its change.
- The victory welcome beat (beat 2) does not show the skier, in default motion or with Reduce Camera Motion.
- W-086 frame and compile targets (above).
- No human playtest.
