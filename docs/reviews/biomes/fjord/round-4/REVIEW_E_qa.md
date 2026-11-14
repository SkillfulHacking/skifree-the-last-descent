# Fjord Coast, Round 4 (release decision): Reviewer E (QA and Accessibility)

## 1. Header

- **Reviewer:** E, QA and Accessibility Lead.
- **Nature of review:** model-based reviewer (same model family as the developers; not external). I am not a human playtester and I did not play the game in a browser.
- **Build:** `8d19542` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`). HEAD stayed at `8d19542` with no tracked changes under `src/` or `tests/` while I worked.
- **Date:** 2026-11-12.

### Method

- **Source reading:**
  - the full `aba21bc → 8d19542` diff of `src/ui/scale.ts`, `App.ts`, `GameSession.ts`, `capabilities/environment.ts` (telegraph and stall code) and `course.ts`;
  - `SkierPhysics.ts:458–480` (the wall retry);
  - `styles.css` (`.ui` zoom, `.hud-yeti`, `.rear-view`);
  - `tests/e2e/scenic.spec.ts` and `menu.spec.ts`.
- **Commands I ran:**
  - `npx tsc --noEmit` is clean.
  - I ran 15 unit files, and **140/140 tests pass**: `ui_scale`, `achievements`, `input`, `cosmetics`, `fjord_scenic_schedule`, `review_regressions`, `fjord_r3`, `fjord_r4_integration`, `fjord_cornice`, `round4_streaming`, `fjord_streaming`, `game`, `snowballs`, `events` and `fjord`.
  - I did not re-run the full 306-test suite, Playwright or a build.
- **Headless scripts:** all in `scratch/review-e-r4/`, run sequentially on **fresh seeds** (`E4L*`, `E4Q*`, `E4W*`). Run them with `npx vitest run -c scratch/review-e-r4/vitest.config.ts <file> --silent=false`. Raw output is in `*_out.txt` and `*.txt` next to the scripts.

| Script | What it checks |
|---|---|
| `lengths.test.ts` (`lengths_out.txt`, `lengths_alpine_hard.txt`, `lengths_endless.txt`) | Every length × difficulty, with the `skilled` and `intermediate` autopilots, streaming obstacles, snowballs on Hard. Fjord against Alpine on identical seeds. Endless to 30 km. |
| `trap.test.ts` (`trap_out.txt`, `trap_new_w12.txt`), `trapold.test.ts` (`trapold_out.txt`) | My own probe of Reviewer B's cave-mouth trap. 864 approaches per location aimed at points across the first cave mouth, a braking stop, then 5 player-like recovery policies of 30 s each. Also run against the `aba21bc` engine, extracted by me with `git show`. |
| `capsim4.test.ts` (`capsim4_out.txt`) | My round-3 caption model, updated to the new per-squall throttle key and gate captions. Also counts squalls entered while live (telegraph or active) that had no caption in the previous 10 s. |
| `guardw`, `start`, `vp`, `gully3` (re-runs of my round-3 scripts) | Snowball clamp against the cornice guard, start stalls, viewpoint counts, slow gully drop-ins. |

- **Images I viewed:**
  - `scenic-journey/01_menu_fjord.png`, `02_viewpoint_toast.png` and `03_achievements_after_reload.png`;
  - `round-1/e2e_menu_location_2560x1440.png` and `_1366x768.png` (added in `8d19542`);
  - `candidate/04_signature_hazard.png` and `09c_hard_snowball_marker.png`, with pixel measurements.

### Evidence gaps

- **The resolution shot sets for the candidate were never delivered.** `round-4/candidate/res-1366/` and `res-2560/` were **missing when I started and still missing at my final check (17:19 UTC)**.
- `candidate/EVIDENCE.md`, `candidate/manifest*.json` and `candidate/perf/` (all named in the brief) **do not exist**. The only perf file is `round-4/perf/frames_summary.json`.
- **No in-game HUD frame exists at 1366×768 or 2560×1440 for this build.**
- **The completion brief has no §10.** `8dc283d1-attachment.txt` ends in §9, and the review brief does not summarise §10 either. For §7 I use:
  - completion-brief §2 (saves, Scenic Route journey) and §3 ("no … unrecoverable position may remain");
  - the review brief's Critical definition.
- **The tests ran on the parent commit.** `TESTS.md` reports results on **`c0ea8ae`**, not `8d19542`. I checked `git diff --stat c0ea8ae 8d19542`: `src/` is identical. The only changes are docs, PNGs and a test-only click timeout. The recorded results therefore carry over to the candidate, but I could not re-run any of them.

## 2. Verdict: **FAIL** against the 9/10 target for my categories

**Fixed this round, verified by me:**
- **Menu at 1440p.** It now scales: in the 2560 shot the menu panel spans about 33 % of the width, against 24 % in round 2.
- **Squall captions.** One squall can no longer mute the next (`GameSession.ts:777`).
- **Scenic Route journey.** The no-debug journey (choose Fjord with the keyboard, reach a viewpoint, toast, Achievements, reload) is implemented honestly in `scenic.spec.ts`, and its screenshots show what `TESTS.md` claims.
- **Finite lengths.** Every finite length is completable on Relaxed and Normal on fresh seeds, including a 50 km Expedition.
- **Endless streaming.** It stays bounded at 6 resident bands over 30 km.
- **Save code.** It is untouched since round 3.

**What fails the round:**
- **Critical: an unrecoverable state at cave mouths, in both locations.** I reproduced Reviewer B's finding independently, with a different approach set and different seeds. **24/864 Fjord and 25/864 Alpine approaches** that stop at the first cave's wall cannot get back by any of five recovery policies. The only way out is Pause → Restart Run. The same probe on the round-3 engine fails far less often (6/576 and 4/576 against 15/576 and 22/576 on the same seeds). So the trap is not new in kind, but the wall fix makes it 2.5–5× more frequent, and it is now engine-wide in a build that will replace the shipped Alpine.
- **Major: Hard is a wall in the Fjord.** On identical fresh seeds:
  - the hazard-blind skilled autopilot wins Hard **1/7 in the Fjord against 7/7 in Alpine**;
  - Endless Normal catches the skilled autopilot before 30 km on **2/4 Fjord seeds against 0/4 Alpine**.

**Smaller issues:**
- The rear-view window was left out of the new UI scale.
- A third of gate squalls are entered mid-gust with no cue or caption.
- Three round-3 Minors are unfixed: slow gully crashes, the snowball clamp and the stale comment.
- The 1366 and 2560 candidate shots are missing.

## 3. Scores (QA and accessibility point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 8 (low confidence) | From the few frames I viewed, it reads clearly as a coast (`04`, `09c`, the scenic journey). The left mountain in `09c` shows regular horizontal banding. Defer to A. |
| Environmental uniqueness | 8.5 (low confidence) | Windsocks, wind gates, a sea horizon, a viewpoint sign ("UTSIKT") and a harbour finish. It plays differently from Alpine, as my squall and gate counts show. Defer to A/F. |
| Skiing and hazard mechanics | 7 | The launch is gone (B), but a skier who stops at a cave mouth can be trapped with no control-based way out (Defect 1). Slow gully drop-ins still count as "hard landing" crashes (Defect 6). |
| Difficulty and fairness | 7 | Relaxed and Normal: 100 % autopilot wins at every finite length, a sensible step. Hard: 1/7 against Alpine's 7/7. Endless Normal catches the autopilot on 2/4 seeds against 0/4 (Defect 2). |
| Cinematics | 8 (very low confidence) | Not reviewed beyond caption priority: a Yeti caption correctly overrides the viewpoint caption in `02_viewpoint_toast`. Defer to C. |
| Performance and stability | 7 | No crash, no timeout and no stuck streaming in 78 headless runs. Bands are bounded at 6. A run-level soft-lock is a stability failure. CPU frame time is not mine to measure (D found no production-build measurement). |
| Accessibility and controls | 8 | Menu scaling, per-squall captions, gate caption text that states the choice, and the keyboard Scenic Route journey all work. Against that: the rear-view window and its label do not scale and collide with the Yeti bar at higher UI scales (Defect 4); 30 % of live gate-squall entries get no audio cue or caption (Defect 5); there is no in-game evidence at 1366 or 2560 (Defect 3). Input code is unchanged since round 3. |
| Overall player experience | 7 | A fair, readable run on Relaxed and Normal. A curious player who stops to look at a cave can lose the run, in Alpine too, and Hard is close to unwinnable for non-expert play. |

## 4. Defects

### 1. Critical (stability / unrecoverable state, engine-wide): a skier who stops at a cave-mouth wall can be left with no way back to the piste

**Evidence (mine, `trap_out.txt`, `trap_new_w12.txt`, `trapold_out.txt`):**

| Probe | Fjord | Alpine |
|---|---|---|
| `8d19542`, seeds E4W1–3, Sprint + Standard, first cave: approaches | 864 | 864 |
| came to rest (< 2 m/s) | 679 | 694 |
| back by plain skating to the line | 772 | 789 |
| **no recovery by any of 5 policies, 30 s each** | **24** | **25** |
| Same probe on seeds E4W1–2 only: `8d19542` | 15 / 576 | 22 / 576 |
| Same probe on seeds E4W1–2 only: `aba21bc` engine (round 3, shipped Alpine) | 6 / 576 | 4 / 576 |

- The five policies were: skate to the line; turn downhill and then to the line; back away from the wall and then to the line; pop while skating; and mashing recover.
- The trapped skiers rest 40–60 m off the line, within 5 m of the cave's z, at 0.00–0.20 m/s. That is before the trigger, so no Yeti arrives and nothing relocates them.
- I did **not** reproduce B's frozen-with-velocity state: 0 cases in my detector. The trap itself I did reproduce.
- **Cause.** The new retry rule returns "stay put" when the second attempt also meets a face (`SkierPhysics.ts:474–480`). There is no general stuck backstop: `CORNICE_STALL` covers only the cliff rim (`environment.ts`), and GameSession has no stuck rule.
- **Mitigation and severity.** Pause → **Restart Run** (`App.ts:573`) exists, so the game is not locked and no save data is at risk. The run is lost, though, and the brief's §3 ("no unrecoverable position may remain") and the review brief's "soft-lock" both apply.
- **Fix:**
  - Add an engine-wide stall backstop: grounded, not crashed, speed < 1 m/s or no net displacement for > 4 s, and a wall contact in the last 2 s or outside the piste half-width. Then relocate to `routeX(z − 6)` with a "BACK ON THE PISTE" title and a caption, and no crash.
  - Make the inside-corner retry slide along the shared tangent instead of returning zero displacement.
  - Add a regression test with a grid of rest points within 40 m of each cave mouth on both locations: "skate to the line" reaches the line within 20 s, or the backstop fires.

### 2. Major (fairness): Hard and long Normal runs step far too steeply from Alpine for a 2/5 location

**Evidence (mine, identical fresh seeds; files `lengths_out.txt`, `lengths_alpine_hard.txt` and `lengths_endless.txt`):**

| Run | Driver | Fjord | Alpine |
|---|---|---|---|
| Hard, Sprint ×4 + Standard ×2 + Endurance ×1 | skilled (dodges snowballs) | **1/7 wins** | 7/7 |
| Hard, same runs | intermediate | **0/7** | 2/7 |
| Endless Normal, to 30 km, 4 seeds | skilled | **2/4 caught** (at 20.8 and 26.8 km) | 0/4 caught (min gap ≥ 43.6 m) |
| Relaxed and Normal, every finite length incl. Expedition 50 km | both drivers | 100 % wins, 0 crashes | — |

- This corroborates Reviewer B's Defect 2, with a different driver and different seeds.
- **Fix:** see B. Lower the Hard environment intensity (1.2 → about 1.0–1.1) or scale it down beyond Sprint, and add a pooled-seed ladder assertion for Hard and Endless.

### 3. Minor (evidence / gate process): the 1366 and 2560 candidate sets, manifests and in-game 1440p evidence are missing

- `candidate/res-1366/`, `candidate/res-2560/`, `candidate/EVIDENCE.md`, `candidate/manifest*.json` and `candidate/perf/` were absent from start to finish.
- **What exists at 2560 is a menu only:** `round-1/e2e_menu_location_2560x1440.png`, from the `?debug` e2e run. I judged it good: the panel spans about 842 of 2560 px, and the Location note is about 15 px.
- **No HUD, caption, toast or rear-view frame exists at 2560 or 1366.**
- **The Scenic Route screenshots are at 640×360,** which is not a target resolution. At that size the Achievements key-hint footer overlaps the "Ice Dancer" and "Steam Runner" cards (`03_achievements_after_reload.png`, bottom third).
- `docs/reviews/pass2/menu/e2e_menu_2560x1440.png` was not updated by the claimed menu rerun (last commit `b0baae6`). This suggests the e2e runs happened in another worktree. That is not wrong, but it is unrecorded.
- **Fix:**
  - Capture `res-1366` and `res-2560` from `8d19542`: menu, a chase frame with the rear view and the Yeti bar, a caption, the toast and the summit.
  - Record the worktree and commit of the Playwright run in `TESTS.md`.

### 4. Minor (accessibility / layout): the rear-view window is not part of the UI scale and collides with the Yeti bar at larger UI scales

- **Why it is unscaled.** `.rear-view` is appended to `document.body`, not to `.ui` (`App.ts:849–860`). Its size is `min(420, 0.3·W)` and its top is a fixed 78 px. So it gets neither the new `autoUiScale` nor the player's text size. Its "BEHIND YOU" label stays 12 px at 2560.
- **Why it collides.** The Yeti bar is inside `.ui` (zoomed). In `09c` at ×1 its bar ends at y = 56 px, measured. Scaled:

| Setting | Effective zoom | Yeti bar bottom | Rear-view frame top | Result |
|---|---:|---:|---:|---|
| 2560, default UI | 1.33 | about 75 px | 78 px | about 3 px gap; its dark backdrop (inset −14 px ×1.33) overlaps the frame |
| 1080, UI text 150 % | 1.5 | about 84 px | 78 px | overlap |
| 2560, UI text 150 % | 2.0 | about 112 px | 78 px | overlap |

- This is derived from code and one measurement, **not seen in a frame**, because no such frame exists (Defect 3).
- **Fix:**
  - Place the frame in `.ui`, or multiply `w` and `top` by the effective UI scale.
  - Set `top` from the `.hud-yeti` bounding rect's bottom + 10 px.
  - Scale the label with the UI.

### 5. Minor (accessibility): gate squalls entered mid-gust get no build cue and no caption

- **Evidence:** `capsim4_out.txt`, 9 runs, Normal.
- **Covered:** of squalls with a telegraph event that the skier entered, 65 were warned and 4 were not (blocked by another priority-2 caption on screen). That is **94 %, up from 89 % in round 3.**
- **Not covered:** of the 71 entries made while a squall was live (telegraph or active), **23 had no telegraph event at all**: 20 gates and 3 jump squalls, all entered in the *active* phase.
- **Cause.** `environment.ts:266` reports a phase transition only if it happens while the hazard is within 150 m ahead. A squall that started building further away is reached mid-gust with no "gust-build" cue and no caption. The windsock is the only cue, so a player who relies on captions or sound gets nothing for about 30 % of live gate encounters.
- **Fix:**
  - When a periodic hazard first comes within alert range already in telegraph or active, emit a late telegraph: cue plus caption, for example "[the squall is already blowing through the notch — take the lee]".
  - Optionally drop the viewpoint caption to priority 1, which removes the remaining equal-priority blocks.

### 6. Minor (fairness, carried as F-015, accepted by the developers): a slow drop into some gullies is still a "hard landing" crash

- **Evidence:** `gully3_out.txt` (r4) against r3, on the same seeds.
- 24 approaches crash, against 27 in round 3, on 3 gaps (now GU7 z2432, GU8 z6545 and GU9 z5465).
- 3 no-steer approaches at 2–6 m/s on GU9 z5465 are still in the gully after 40 s. Steering always gets out.
- **Fix:** as in round 3. Cap the landing impact for low entry speed, and test every gap at 2–15 m/s.

### 7. Minor (risk, carried): snowball landings can still be marked inside the cornice guard

- `guardw_out.txt`: the guard is 36 m inside the crest everywhere, and the sea-side clamp limit is inside it at **585/780 samples, unchanged**. `Snowballs.ts` was not modified.
- **Fix:** clamp to the first x where `coast.guard(x, z) === 0`, plus 2 m.

### 8. Minor (wording, carried): stale comment

`GameSession.ts:10` still says viewpoints "sit outside the chases: exploring is free". This is not player-facing.

## 5. What works

- **Finite lengths.** Every one completes on fresh seeds on Relaxed and Normal for both drivers, with 0 crashes:
  - Sprint ×4, Standard ×2, Endurance ×1;
  - Expedition 50 km on Normal (2,638 s) and Relaxed (2,513 s).
  - No timeouts anywhere in 78 runs.
- **Endless streaming.** Peak resident obstacle bands are 6 for the whole 30 km in both locations, the same as Sprint.
- **The Scenic Route journey is real.**
  - No `?debug` (the test asserts that `progress` is not exposed). Fjord is chosen on the menu with the arrow keys and steered with two key taps.
  - The save keeps the 3 earlier achievements, the jacket, the equipped jacket, the wins and both Alpine PBs, and gains `fjord` in `biomesVisited`.
  - After a reload, 4/12 shows with the card marked "Earned 12 Nov 2026".
  - The screenshots match: the viewpoint sign, the toast, and a Yeti caption correctly taking priority.
- **Save compatibility by construction.** `src/progression/`, `src/core/settings.ts`, `CourseConfig.ts` and the input code are unchanged since round 3. The keys `skifree-tld.settings.v1`, `.records.v2` and `.progress` are intact. Alpine terrain is unchanged: `course.ts` changes apply only with a coast or `rangeSoft`. The migration e2e tests are recorded as passing.
- **Menu at 2560.** It now keeps its 1080p proportions (`autoUiScale`, with a test). It is unchanged at 1366, where its fit is verified by e2e and the shot.
- **Captions.** The per-squall throttle works. The new gate caption states the decision ("take the lee of the rocks, or the notch in the lull").
- **Viewpoints.** Counts are unchanged and healthy: Sprint 1–5, Standard 4–13, Endurance 10–22, Expedition 24–38, Endless 18–27 per 30 km. None has a zero.
- **Start stalls** are unchanged: no-input 1/30 on Fjord and 2/30 on Alpine; tuck-only 0.
- **Unit tests.** All 15 files I ran pass, and `tsc` is clean.

## 6. Round-3 E defects and tracker items (my verification)

| Item | Status | My evidence |
|---|---|---|
| R3 E1 / F-017: one squall's caption mutes the next | **Fixed** | Per-squall key (`GameSession.ts:777`). Telegraphed-and-entered squalls are 94 % captioned (65/69); the residual is equal-priority blocks. New, separate gap: live entries with no telegraph (Defect 5). |
| R3 E2 / F-015: slow gully drop-ins crash | **Not fixed** (accepted as open by the developers) | 24 crashes on 3 gaps; 3 no-steer stuck at 40 s (Defect 6). |
| R3 E3 / F-016: menu and HUD unscaled at 1440p | **Partially fixed** | Menu and HUD scale through `.ui` zoom (2560 shot: panel 33 % of the width). The rear view is excluded (Defect 4). No in-game 2560 shot, and `res-2560` is missing (Defect 3). |
| R3 E4: snowball clamp inside the cornice guard | **Not fixed** | 585/780, unchanged (Defect 7). |
| R3 E5: new cues unverified on screen; menu e2e not run | **Partially fixed** | Viewpoint sign, trick, toast and caption are confirmed by the Scenic journey. `menu.spec.ts` rerun is recorded at 8/8. There is still no gully-marker shot and no squall-caption shot. |
| R3 E6: stale comment | **Not fixed** | `GameSession.ts:10` (Defect 8). |
| F-020: browser suite never run on R4 | **Fixed (by record)** | `TESTS.md`: 19/19 on `c0ea8ae`. I confirmed that `src/` is byte-identical to `8d19542`. I could not re-run it. |
| F-001: wall launch (unrecoverable-state side) | **Regressed into a trap** | Defect 1 (launch side: B). |
| F-018: Relaxed intensity 0.5 | **Partially verified** | Relaxed keeps the mechanics: Fjord Relaxed Endless is 0.5–4.6 % slower than Alpine to 30 km on my 4 seeds, and it never catches the autopilot. I did not verify the intensity value directly. |
| F-002: cornice stall | Not verified by me | B reports 0/1,630 stuck. |

## 7. Public-preview gate (my area)

§10 is absent from the supplied brief, so I applied completion-brief §2 and §3 and the review brief's Critical definition.

| Gate item | Status | Evidence |
|---|---|---|
| No soft-lock / unrecoverable position | **Not met** | Defect 1: about 2.8 % of cave-mouth stops in both locations, reproduced independently. |
| Existing saves, achievements, cosmetics and PBs protected; no key changes | Met | Code unchanged since round 3. Migration and release e2e recorded as passing. Scenic spec assertions. |
| Scenic Route obtainable by real play, toast, Achievements, persists after reload | Met | `scenic.spec.ts` (reviewed), the three screenshots, `TESTS.md` #19. |
| All finite lengths completable | Met | §5: 100 % on Relaxed and Normal, including 50 km. |
| Endless streams without accumulation (headless) | Met for obstacle bands | Bounded at 6 over 30 km. GPU and texture memory not measured by me (see D). |
| Keyboard, mouse and controller | Met (by record) | `TESTS.md` #3, #9 rerun, #14, #18. Input code unchanged. |
| Menus at 1366 / 1920 / 2560 | Met for the menu, **not met for in-game** | e2e fit at all three plus shots. No HUD frame at 1366 or 2560, and the candidate `res-*` sets were never delivered (Defects 3 and 4). |
| Every browser test on the candidate | Met (by record) | 19/19 on `c0ea8ae`, with `src/` identical. |

**Gate result for my area: NOT MET**, because of Defect 1 alone. Once a stall backstop is in place, my remaining items are a Major balance step (shared with B) and Minor polish and evidence.
