# Whiteout Ridge, round 5 consolidation (frozen source `729e226`)

**Result: FAIL.** No owned category reached 9/10.

| Owner | Category | Score |
|---|---|---|
| A | Visual art direction | 6 |
| A | Environmental uniqueness | 6.5 |
| B | Skiing and hazard mechanics | 8 |
| B | Difficulty and fairness | 8 |
| C | Cinematics | 8.5 |
| D | Performance and stability | 8 |
| E | Accessibility and controls | 8.5 |
| F | Overall player experience | 8 |

PR #9 stays a draft. It is not merged or deployed.

**Critical findings:** none.
**Major findings:** eleven, merged below into seven themes.
**Security:** W-087 stays BLOCKED. SonarCloud is still B on new code, and the issue cannot be read from this environment.

**How the reviews were run:**
- Each reviewer's report (`REVIEW_{A_art,B_physics,C_cinematics,D_tech,E_qa,F_critic}.md`) is the reference.
- Reviewers got no expected scores. Every score is as written by its owner: nothing was adjusted, averaged or re-asked.
- Reviewer F did not read the other round-5 reports or the blind read.
- All six reviewed `729e226`, through copies of the tree under `/tmp`.
- They are model reviewers, not human playtesters. Nobody judged motion at 60 fps, audio or rumble, and GPU time is unmeasured (SwiftShader).
- The blind first-time-viewer read (`blind/blind_read_rim_storm.md`) saw only 10 frames, with no description of the intended terrain.

## Scores, round 4 → round 5 (owner's score in bold; others are low confidence)

| Category | Owner | R4 | R5 | Others (lc) | Main reason it is not 9 |
|---|---|---|---|---|---|
| 1 Visual art direction | A | 6 | **6** | 7, 7, 7.5 | The drop is inferred in clear weather and absent in storm. The new scoured-flank shading darkens the uphill wall, not the drop (A5-2). The vanishing-point mass still reads as a wall. The cloud sea reads as water. |
| 2 Environmental uniqueness | A | 6.5 | **6.5** | 7, 7.5, 8 | Palette and cloud sea are distinct; the composition is still Alpine's. Plumes read as light shafts; spires read as rock fins. |
| 3 Skiing and hazard mechanics | B | 8.5 | **8** | 5.5, 7, 7.5, 8 | Whiteout Hard's storm build-up has no visual or audio cue (B5-1). "Stronger knocks" is false above intensity 0.8. |
| 4 Difficulty and fairness | B | 8 | **8** | 7.5 | Alpine Hard is outside both ranges. Flawless descents are lost on 12/32 Alpine and 5/32 Whiteout Hard Standard courses (B5-2, predates this round). Whiteout sits at the top edge. |
| 5 Cinematics | C | 8 | **8.5** | 6, 7.5, 7.5 | Victory welcome beat frames an empty porch: the camera is placed behind the skier's mark (C5-1). Set-up shot letterbox cuts the tucked skier (C5-2). |
| 6 Performance and stability | D | 7.5 | **8** | — | SonarCloud gate B (D5-1). Shader links in play understated: ≥ 12 gross against ≤ 2 (D5-2). 17 frames over 16 ms; cave slice 24.7–31 ms (D5-3). |
| 7 Accessibility and controls | E | 8.5 | **8.5** | 6, 7.5, 8, 8.5 | RUN. at UI 150% still covers the skier's head at the hand-off; the test cannot see it (E5-1/2). Several Reduce-* behaviours untested or not applied (spindrift, inset zoom). |
| 8 Overall player experience | F | 7.5 | **8** | 6, 8, 8, 8 | Clear-weather view looks fake (storm wall, lake-like cloud sea). The Normal chase peaks at the finish line, and knocks are never won back (F5-3). The ending is unfinished. No human playtest. |

## What round 5 verifiably fixed (confirmed by the named reviewer)

**Searchlight beat (W-083): closed after three rounds (C).**
- Beam, glare and pool are visible.
- The recoil reads.
- Beat 23 has the skier, lantern and Yeti.
- No pole in the lantern hand.

**Yeti in the rear inset (W-082) (C, F).**
- Height: 36–43 px through the leap on High, Low and Reduce Camera Motion (round 4: 15–20 px), and about 65 px at 28 m in the chase.
- The inset shows on Low for the whole chase.
- Alpine's pale-on-pale leap (C4-2) is fixed.

**Set-up shot (W-091) (C).** The Yeti stands on the ledge, 60 px tall, in the harness shot. C5-2 covers the letterbox in normal arrival.

**Normal pursuit (W-095): fixed, with two owner clauses unmet (B, F).**
- **Reproduced on round-4 code:** competent player caught 0/9 with no pressure.
- **Now:**
  - The competent reader sees CLOSING in 13/13 runs (F).
  - Wins on B's fresh seeds: 19/24 and 15/24, against 23/24 and 22/24 with the pace undone. Median closest gap 23.5–35 m.
  - The clean expert escapes 24/24 (B) and 12/13 to 13/13 (F).
- **Unmet clause "excellent recovery can save the run":** the median gap regained after the closest point is 0 m.
- **Clean-expert catch:** one clean expert was caught by blizzard placement alone (F5-3).

**Hard (W-094): partly met (B).**
- **Whiteout:** at the top edge. Sprint 75–88% and Standard 38–53%, pooled over 56 seeds and three techniques.
- **Fjord:** inside the ranges.
- **Alpine:** outside them. Sprint 88%; Standard 14% with a binary tuck.
- **Forbidden mechanisms:** none. B found no new player-reactive mechanism, no rubber-banding, and no hand-off physics change. `hazards.builds` depends only on course position.

**Performance (D).** The round-4 regression is gone.
- Software render: Whiteout high is 1.10× Alpine (round 4: 2.10×).
- Rim-rock triangles are down 84%.
- Cloud-sea cost per pixel is halved.
- 0 errors and 0 restarts across the six perf runs.

**Code health (D, E).**
- Storm-cave abandon and searchlight disposal fixes are verified by tests that fail on the old code.
- `input` (Space tap) and `timeline_calm` fail on `71c9ceb` and pass now.

**Accessibility (E).**
- Reduce Camera Motion now covers cave, defeat and victory.
- Reduce Weather is visibly different.
- Captions, `aria-live` and vibration have browser tests.
- `cave_skip` is measured against the run direction.
- Cave history (owner decision B) and W-076 parity hold.

**Stability.** tsc and build pass. 542/542 unit tests. 37/37 browser tests on the first run, in 12 specs. The frozen-tree balance matches validation row for row.

**Gitar.** Approved on `729e226`; 9/9 findings closed.

**Evidence integrity (W-097, partly fixed; E, C).**
- The harness now stops on a missing subject, and it did so twice. Both stops matched their images; the round-4 notes for those frames were wrong.
- Notes are still template text, and two thirds of shots declare nothing.

## Merged Major themes (round-6 work order, in priority order)

**1. Security gate (W-087, D5-1).** Blocked on information.
- The owner reads the SonarCloud issue in a browser (key, rule, file, line). The repo is public and the PR #9 page shows the issue list.
- D's leading candidate is the "PATH variable" findings on the bare `execSync('git …')` in four tools:
  - `prod_frames.mjs:16`
  - `whiteout_evidence.mjs:21`
  - `handoff_strip.mjs:17`
  - `rim_view.mjs:16`
- This is an inference: stock Sonar treats that rule as a hotspot.
- Fix the root cause with a regression test, then verify an A rating. No suppression, exclusion or gate change.
- The 403 comes from this environment's egress proxy, not from SonarCloud, so a token would not help here.

**2. The ridge drop and the clear-weather view (W-065, W-093; A5-2, A5-3, A5-4, A5-5, F5-2; blind read).**
- **A5-2, scoured flank:**
  - Key the shading to the drop side (the rim side and the distance past the lip), not to camera height.
  - It must not darken the uphill wall.
  - Add a test at the round-5 gameplay cameras.
- **Storm cue for the drop:** give storm weather a cue for the drop side that survives the whiteout. Wands must be readable in storm; a contrast-stretched speck is not.
- **Vanishing-point mass (A5-3):** the white mass ahead must not read as a wall across the course. Diagnose what it is first; A found it is not the curtain. The reviewers disagree here: F reports the translucent sheet gone, while A measures it unchanged from round 4 within 2–6/255. A's pixel comparison is the more specific evidence.
- **Cloud sea (A5-4):** must read as cloud, not water or ice.
- **Spindrift plumes (A5-5):** must not read as light shafts.
- **Storm wall (F5-2):** must not read as a cardboard sawtooth. Blind-read it.
- **Rim captures:** in storm, and at the true closest approach, under 20 m from the lip. `sprint_3` has the rim off screen.
- **Acceptance:** a fresh blind read, with no description given, names the drop side in clear and storm frames from the gameplay camera, and A scores at least 9.

**3. Flawless-descent winnability and difficulty spread (B5-2, B5-3, B5-4, B5-10; untracked B4-2 and B4-6).**
- **The cause (B5-2):** on Alpine Hard Standard, 8–9° basins let the Yeti's gentle-ground cap (17.3–17.6 m/s) outrun a tucked skier (15–16.5 m/s). The owner's "a flawless descent must have a plausible path to victory" fails on 12/32 courses, and the problem predates round 5.
- **Fix direction:** fix it in terrain or course generation (basin length and grade on Hard), not with a global Yeti change.
- **Alpine Hard:** bring it into both ranges, validated on 32 or more fresh seeds.
- **Publish:** pooled confidence intervals, and the outcomes by tuck technique.
- **Tracker:** add B4-2 and B4-6 to `DEFECTS.md`.

**4. The Normal chase's shape and the unseen Hard storm (B5-1, F5-3, F5-5).**
- **B5-1:** the Hard storm build-up past 3 km needs a visual and audio cue. The player must be able to read why it got harder.
- **F5-3:** the competent player's closest moment is the last 1% of the chase in 8 of 11 Sprint escapes, and 5 of 9 Sprint catches are within 65 m of the finish.
  - Look at the finish run-out and at blizzard knocks on the line that can never be won back.
  - The owner's clause "excellent recovery can save the run" needs measured recoveries.
- **F5-5, an owner ruling is needed:**
  - **Labels:** whether "Yeti: Normal/Hard" is an honest label on Whiteout, where Normal ×1.06 ≈ Hard ×1.07.
  - **Catch-up rule:** whether the original catch-up rule (up to +9 m/s past 60 m) conflicts with decision 2's "no Yeti that secretly accelerates". It is not a round-5 change.

**5. Victory staging (C5-1, F5-4; C4-4, C4-6 carried).**
- **Welcome beat:** move the beat-2 camera or the skier's mark (`STOP_OUT = 8`, `rescueVictory.ts` shot 2) so the skier glides in while the rescuers wave. A strict evidence run must pass beat 2, with and without Reduce Camera Motion.
- **Lantern:** must be held by a hand.
- **Beam:** the cone's hard edge (C5-3) must go.
- **Yeti lighting:** the charcoal-to-white pop between beats 23 and 24 (C5-4).
- **Doorway and reveal:** a lit doorway (not flat tan), and figures readable in the reveal.

**6. Accessibility (E5-1..E5-5).**
- **RUN. at UI 150%:** must clear the skier at the hand-off, not only the inset.
- **Fix the test:**
  - measure the glyph box with a child element;
  - take the skier's projected head and body from the game, not an assumed 60% line.
- **Reduce Weather:** must cover the rim spindrift.
- **Reduce Camera Motion:** must freeze the inset's distance-driven zoom.
- **Browser tests:** steady lamps and beacon under Reduce Flashes, `FRONT_QUIET`, the rear zoom under RCM, a mid-cinematic RCM toggle, and pad Start pausing a first viewing.

**7. Performance targets (W-086, W-096; D5-2, D5-3, D5-5).**
- **Tool:** count gross program links, not net. Name each program compiled in play.
- **Shader warm-up:** cut links in play to ≤ 2. Stop re-linking ~3 programs at every cave.
- **Cave work:** split the slice so no Endless frame exceeds 16 ms outside cinematics. Add an absolute per-slice test.
- **Low inset:** measure the second scene pass on Low.
- **Memory:** a 40 km Endless memory run (W-016, W-017).

## Minor findings (fix in passing)

**Physics and balance (B)**
- B5-5, B5-7: README errors about the length explanation and "stronger knocks". Add a unit test for `builds`.
- B5-6: Normal pressure depends heavily on the competent-driver model.
- B5-8: per-difficulty pace also multiplies Endless escalation; Alpine Hard reaches the 1.33 ceiling at encounter 3.
- B5-9: round-4 B4-4 comments are still false.

**Cinematics (C)**
- C5-5: the Yeti's low contrast against snow at the landing.
- C5-6: the cave evidence shots are not normal play (HUD off, teleported arrival).

**Tech (D)**
- D5-4: the searchlight gloom is not reset in `GameSession.dispose`.
- D5-6: the developer's claims were inaccurate. The "fill light" claim and "LOD at distance" are already corrected in `CANDIDATE.md` and `DEFECTS.md`; the "1.10×" figure rests on software render only.
- D5-7: test strength. The abandon test covers one point; the searchlight test is weak.

**Evidence and QA (E)**
- E5-6: evidence notes are template text. The quality preset is missing from Whiteout manifests. The SHA is taken from HEAD, not from the served build. Strip manifests have no checks. The skier check accepts the chest.
- Carried from round 4: debug skip paths still save cave history; the README does not list the vibration or Reduce Weather settings.

**Art (A)**
- A5-6: spires read as fins; decimated tors became lumps; rime shows as dotted noise.
- A5-9: kerb-like cornice; floating cave snow shapes.
- A5-10: warm hillside in frame 17; elliptical ring in the storm sky.

**Overall experience (F)**
- F5-6: 13 of 25 evidence shots show the Yeti 224–265 m back, a state that does not occur on Normal.
- F5-7: a human playtest is needed before category 8 can honestly reach 9.

## Release status
- **Gate:** fails. All eight owned scores are below 9.
- **Security:** blocked.
- **Owner rulings requested:**
  - F5-5: the labels and the catch-up rule;
  - the SonarCloud issue details (W-087);
  - whether a human playtest is to be scheduled.
