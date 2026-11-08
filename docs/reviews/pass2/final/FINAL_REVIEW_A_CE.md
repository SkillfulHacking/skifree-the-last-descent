# Pass 2, final round 3: Reviewer A (visual art direction) and Reviewers C/E (cinematic and UI/UX)

- **Reviewers:** A, C and E. These are INTERNAL reviews by another model instance, not by external humans. We did not write the code under review, and we have authority to reject.
- **Commit reviewed:** `820b280` (`820b280a20b0e932459c59b8472289e63f9ed9ec`), branch `pass2`: "Round-3 cinematic evidence (1920x1080, all beats + hand-off; 584 frames grounding: soles 0 cm, hands >= 14 cm, head >= 3.7 m below roof); no double step on the touchdown frame". The working tree was clean.
- **Changes since round 2:** `79f95d2..820b280` (`77c2735`, `0380d2b`, `8a44135`, `ca0e4de`, `17cebbf`, `73351d2`, `51f1db9`, `3c53ce4`, `5e7762d`, `74c0e38`, `820b280`).
- **Method:**
  - Looked at every round-3 still, at full size and in pixel crops. Measured luminance with PIL.
  - Re-aggregated all 584 frames of `cinematic/grounding_report.json`, including per-frame root step and Δstep (acceleration).
  - Read the code diffs and the e2e spec, and the raw Playwright logs in `/tmp/menu_e2e{3..7}.log`.
  - Ran `npx tsc --noEmit` (exit 0) and `npx vitest run` (**109/109 passed**, 45 s).
  - Did not launch a browser or rebuild.
  - Did not take developer claims (DEFECTS.md, the R3 notes, commit messages) as evidence.
- **Bar:** polished, believable, cohesive procedural stylisation, not photorealism.
- **Pass marks:** 7 for visual areas; 8 for cinematic and grounding; 8 for menu and UX.

## Verdict

| Area | R1 | R2 | **R3** | Pass | Result |
|---|---:|---:|---:|---:|---|
| A1 Cave geology & integration with terrain | 4 | 6 | **7** | 7 | **PASS** |
| A2 Cave interior/darkness & every cinematic angle | 5 | 5 | **6.5** | 7 | **FAIL** |
| A3 Yeti model/face/fur/eyes | 6 | 6 | **6.5** | 7 | **FAIL** |
| A4 Yeti grounding & locomotion (as visible) | 7 | 8 | **8** | 7 | PASS |
| A5 Trees | 6 | 7 | **7** | 7 | PASS |
| A6 Terrain/rock/snow shading | 4 | 6 | **7** | 7 | **PASS** (marginal) |
| A7 Atmosphere/distance/skyline | 7 | 7 | **7** | 7 | PASS |
| A8 Overall cohesion | 5 | 6 | **7** | 7 | **PASS** (marginal) |
| C Cinematic & grounding (P2) | 7 | 8 (cond.) | **8** | 8 | **PASS** (C10 condition met in substance; see C10 and C13) |
| E Menu & UX (P3) | 7 | 7.5 | **8** | 8 | **PASS** |

**Overall: REJECT on two visual areas, both close to the line.** Everything else passes.

### Why the two visual areas still fail

**Cave interior and cinematic (6.5).**
- The darkness beats now work. At t=5.4, 6.6 and 7.9 the Yeti is a silhouette with two ember eyes; the mean luma of the Yeti region at t=5.4 dropped from 54 to **13.7**. This is the best footage in the build.
- But the **first frame of the "huge shadow moves in the darkness" shot (t=3.8) still shows the Yeti fully lit, white and grinning at the mouth** (region luma 52.6, against 59 in round 2).
  - Cause: the dim ramps from 3.6 s with an exponential rate of 2.5, so it is only about 39% at the 3.8 s cut and reaches 80% at about 4.25 s (`CaveCinematic.ts:228-233`).
  - The reveal is therefore spoiled for about 0.4 s before the dark beat even begins.
- Grey disc orbs are still present: a double disc beside the head at t=5.4 and the disc by the head at t=14.6.
- The threshold seam line (A10) is unchanged.

**Yeti model (6.5).**
- The skin is much better: warm grey-brown, the static noise is gone, there are wrinkles, and the teeth vary in size.
- **Fur still fills the open mouth in the roar** (`r3_roar`). The face close-up of that roar is filmed in-game at 12.3–13.7 s.
- Long fringe locks hang across the mouth corner in `r3_face_34`.
- The palms are the same purple-grey gloves as before.
- The forehead still has a hard horizontal "beanie brim".
- The R3 notes admit most of this.

---

## Evidence examined

- **Cinematic, 1920×1080:** `cinematic/cine_t0_1`, `t3_8`, `t5_4`, `t6_6`, `t7_9`, `t9_5`, `t11`, `t14_6`, `t15_8`, `t16_6`, `cine_handoff_chase`; `grounding_report.json` (584 frames: 523 cinematic, 61 chase-phase, 0 errors).
- **Yeti:** `yeti/r3_face_front`, `r3_face_34`, `r3_roar`, `r3_body_front`, compared with `r2_face_front` and `r2_roar`.
- **Environment, 960×540:** `visual/r3_cave_piste`, `r3_cave_rock_closeup`, `r3_cave_hill_wide`, `r3_ranges`, `r3_rocks_near`, `r3_rocks_mid`, `r3_preview_front`, `r3_preview_threequarter`, `r3_preview_closeup`.
- **Menu:** `menu/e2e_menu_{1366x768,1920x1080}.png`, `e2e/menu_results.md`, the raw logs `/tmp/menu_e2e3.log` to `menu_e2e7.log`, and `tests/e2e/menu.spec.ts`.
- **Build timing:** `dist/` was built at 01:15:36, after the E12 fix in `0380d2b` (00:38). `src/ui` has not changed since then, so e2e runs 4–7 exercised the current menu code.

### Grounding report, re-aggregated

- Soles are 0.000 on every frame. The minimum hand height is 0.139 m (emerge) and 0.17 m (crawl). The minimum head clearance below the roof is 3.70 m.
- **Landing (frames 494–509):**
  - In flight the step is 0.68–0.71 m/frame.
  - Frame 499 (touchdown, t=16.667) is **1.169** m, a double move.
  - Frame 500 is 0.514. After that the step decays smoothly to 0.440 at t=17.97 (15.4 m/s down to 13.2 m/s).
- **No zero-step frames from frame 470 to the end:** the round-2 freeze is gone.
- **Hand-off (frame 539, the first chase frame):** the step is **0.871** m, between 0.440 and 0.417. This is a second double move, which `820b280` does not address (see C13).
- **Chase:** 0.377–0.544 m/frame (11.3–16.3 m/s), smooth.
- The only other Δstep above 0.15 m/frame is frame 30 (crawl start, from rest to 0.153 m/frame at t=1.03). The Yeti is deep in the tunnel and off-camera then, so it is acceptable.

---

## Per-ID verdicts

Legend: **VERIFIED** (new evidence shows it fixed), **PARTIAL**, **NOT FIXED**, **UNVERIFIABLE**.

### Reviewer A

| ID | Sev | Verdict | Evidence |
|---|---|---|---|
| A2 | M | **NOT FIXED** | The ghost rectangles are still in the snow above the right end of the band: `cine_t15_8` ≈1415–1500, 425–530 and 1570–1630, 450–500; `cine_t14_6` ≈1505–1590, 350–460 and 1680–1740, 370–430. They are pale translucent panels with darker edges, in the climactic leap shots. The R3 notes confirm they were not addressed. |
| A3 | M | **VERIFIED** | No pale overlapping sheets on the jambs: `cine_t3_8` right wall (1250–1920, 120–860) and `cine_t11` right wall (1500–1920, 120–700) are each one continuous rock mass. |
| A6 | m | **VERIFIED** | `r3_preview_front` (≈480–505, 460–495): a soft depression with toes, shaded by the snow, not a line icon. |
| A8 | M | **PARTIAL** | The starfield is gone. Floor texture now reads 2–3 m in (`cine_t3_8` 600–1400, 600–740; `cine_t9_5`). Beyond that the interior is still a featureless black void with no back wall or bend. That is acceptable in the dark beats but flat in the lit ones (`cine_t9_5`, `cine_t11`). |
| A9 | M | **PARTIAL** | Fixed at t=5.4, 6.6 and 7.9: Yeti-region luma 13.7 at 5.4 (54 in round 2), a silhouette with lit eyes. **Not fixed at t=3.8**, the first frame of the "huge shadow" shot (luma 52.6): fully lit white fur and teeth. Cause: `dim` eases in from 3.6 s (about 0.39 at 3.8 s). Remedy: snap `dim`/`dimShade` to 1 at or before the 3.8 s cut, or start the ramp at about 2.9 s. |
| A10 | M | **PARTIAL** (unchanged) | A hard thin curved seam still crosses the floor at the threshold, with a dotted stair-step continuation on the left: `cine_t9_5` 1050–1700, 725–765; `cine_t7_9` 1150–1600, 725–760; `cine_t5_4` 1150–1900, 790–860. |
| A11 | M | **PARTIAL** | The swing is now deliberate (a "cloud" dims sun and ambient) and eased (`CaveCinematic.ts:228-238`). In stills the same jamb goes lit (3.8) → dark (5.4) → lit (7.9) while the snow in front stays lit at 5.4, so it reads more like a dimmer switch than a cloud. Motion is not verifiable from stills. |
| A12 | M | **PARTIAL** | The hand-contact glows are gone (`cine_t3_8`, `t5_4`, `t6_6` hands are clean; the snow-puff guard is at `GameSession.ts:120-122`). Remaining: a soft grey double disc beside the head at t=5.4 (≈520–720, 360–550; luma 7.8 against 1.9 around it, obvious at a glance in the dark frame), and the disc by the head at t=14.6 (≈940–965, 480–505), which is unchanged from round 2. These are probably unlit particle sprites (the snow-slough emitter at 2.5–3.6 s, life 2.2 s), not footstep puffs. |
| A13 | M | **PARTIAL** | Three preview angles were re-shot (front, three-quarter, close-up), and every in-game beat frames its subject. `above` and `c1`–`c12` were not re-shot. |
| A15 | M | **NOT FIXED** | The flat ribbon cheek and mane cards are unchanged (`r3_face_34` 250–700, 250–1000). The shoulder ruff is a radial collar of straight cards that reads as a costume ruff at mid distance (`cine_t3_8` 790–1050, 500–640; `cine_t9_5` 730–1070, 470–620). The silhouette still stair-steps (`r3_roar` and `r3_body_front` outline). The R3 notes say it was untouched. |
| A17 | m | **NOT FIXED** | The palms are dark purple-grey gloves in `r3_roar` (620–690, 210–300 and 1240–1305, 215–300), the same as `r2_roar`. |
| A20 | m | **PARTIAL** (unchanged) | `rootAboveFloor` is still 0 by construction. "Hand" is still the palm bind point; the crawl minimum is 0.17 m. Contact is neither proven nor disproven. |
| A21 | m | **VERIFIED** | The landing approach is now in the held, letterboxed shot: `cine_t16_6` (Yeti at 950–1015, 500–580, about 0.07 s before touchdown). The shot holds to 16.95 s, 0.28 s after touchdown, and then swings continuously. The touchdown burst itself was not captured. |
| A24 | m | **NOT FIXED** | There is no vegetation-placement change for decorative trees. In `r3_cave_hill_wide` (≈400–600, 90–330) small trees still stand on grey rock-exposed patches of the steep wall. |
| A27 | M | **PARTIAL** (unchanged) | Steep faces are still soft grey smudges with no rock structure: `cine_t0_1` right wall (960–1920, 120–560), `cine_handoff_chase` (1000–1600, 100–480), `r3_cave_hill_wide`. |
| A29 | m | **PARTIAL** | The shape is fixed: chunky, cleaved, varied, half-buried rocks (`r3_rocks_near`, `r3_rocks_mid`), and the mid LOD has three variants (`Vegetation.ts:96`). The distribution is not: on steep walls they are still an even "pepper" sprinkle (`cine_t0_1` 1150–1800, 120–450; `cine_handoff_chase` 1150–1600, 100–450). |
| A30 | m | **VERIFIED** | `cine_t15_8` (0–900, 120–300), captured after `5e7762d`: soft rolling spurs and gullies, no egg-crate spikes. Residual: the distant crest beyond the valley is still sawtooth (`r3_cave_hill_wide` 380–760, 20–110, before `5e7762d`; the distant-range term was not changed). This is counted under A31. |
| A31 | m | **NOT FIXED** | `cine_t0_1` (700–1000, 330–385) and `r3_ranges` (380–500, 170–200): the ranges are still low-contrast cards lost in haze, with no visible change from round 2. The R3 notes say it is unverified. |
| A32 | M | **PARTIAL** | Rocks now share the faceted-soft language of trees and terrain, and the cave rock is consistent with the outcrop. Still clashing: the boxy brown gate posts (`e2e_menu_1920x1080` 1215–1235 and 1465–1480, 600–750), bare untextured grey log cylinders (see A43), and the Yeti's semi-real fur ruff against the low-poly skier. |
| A34 | M | **VERIFIED** | No closed quilt cells in `r3_cave_rock_closeup`, `r3_preview_front`, `r3_preview_threequarter`, `cine_t3_8`, `t7_9`, `t9_5` or `t11`. The rock now reads as bedding partings plus a few joints. For the residual, see A45. |
| A35 | M | **NOT FIXED** (roar) / PARTIAL (rest) | `r3_roar` mouth (≈905–1020, 200–320): grey and white chin strands still fill the lower half of the open mouth, essentially as in `r2_roar`. This shot is filmed in-game in the close-up at 12.3–13.7 s. In `r3_face_34` (740–980, 790–1020) long fringe locks hang across the mouth corner and teeth. The closed-mouth front view is clean. |
| A36 | M | **PARTIAL** | Skin fixed: warm grey-brown, the static is gone, wrinkles read (`r3_face_front` 620–1300, 380–950, against `r2_face_front`). Teeth are irregular with fangs. Remaining: the forehead fur is still a smooth cap with a hard horizontal brim (480–1450, 330–380), a "beanie". Several upper teeth are thin translucent slivers (790–1150, 860–930), so the row looks broken rather than fierce. |
| A37 | m | **NOT FIXED** | Triangle-facet shading on the snow apron at the mouth: `r3_preview_threequarter` (430–620, 400–520), clearly triangulated. |
| A38 | m | **VERIFIED** | `cine_t16_6`: the Yeti is in frame and about to land, letterbox still on. The shot holds to 16.95 s. |
| A39 | m | **VERIFIED** | `cine_t14_6`, `t15_8`, `t16_6`: helmet, goggles and shoulders are framed; it reads as an over-the-shoulder shot. |
| A40 | m | **VERIFIED** | One set per wall, rendered as grooves with lighter rims (`cine_t11` 450–540, 630–750; `cine_t7_9` 440–530, 380–480; `r3_cave_rock_closeup`). The duplicate stacked set is gone. Nit: in-game they are still darker than a scrape would be. |

### Reviewer C

| ID | Sev | Verdict | Evidence |
|---|---|---|---|
| C4 | m | **PARTIAL** | Same as A9: dark at 5.4 and 6.6, but fully lit at 3.8, the opening frame of the shadow shot. |
| C7 | m | **VERIFIED** | Same as A39. |
| C9 | m | **PARTIAL** | Same as A12: the hand blobs are gone; the head-side discs at 5.4 and 14.6 remain. |
| C10 | **M** | **VERIFIED** (freeze), with caveats | No zero-step frames from touchdown through the chase. The speed decays 15.4 → 13.2 m/s over 1.3 s, and the AI inherits `runV`, the velocity, and `delay = 0` (`CaveCinematic.ts:294-303`). `cine_handoff_chase` shows him running at 9 m in the rear view, not standing at 43 m. Caveats: (1) The touchdown double move (frame 499, 1.169 m) was fixed in code after the capture (`820b280`, `justLanded`) and not re-captured. The guard is a deterministic three-line change, so we accept it on code reading. (2) The requested velocity/acceleration check was **not** added to `tools/cinematic.mjs` (unchanged since round 2). The summary still reports only the maximum step, which is why C13 went unflagged. We did the continuity check ourselves from the per-frame data. |
| C11 | m | **VERIFIED** | The letterbox and the leap shot hold until 16.95 s (`CaveCinematic.ts:96-98`, the `tl.at(16.95)` call); `cine_t16_6` is letterboxed with the Yeti in frame. |
| C12 | m | **VERIFIED** | `cine_t6_6`: both planted fore-hands (740–930, 780–915 and 1440–1630, 760–935) end above the bottom letterbox (y 960). |

### Reviewer E

| ID | Sev | Verdict | Evidence |
|---|---|---|---|
| E1 | M | **VERIFIED** | e2e run 7 passed the Enter path: `.err` contains NOPE-123 and the input keeps NOPE-123. The click path is covered by E12. |
| E2 | M | **VERIFIED** | e2e run 7: type AVALANCHE, click Start, and the run's label contains AVALANCHE. The click uses `force: true`, but it still dispatches a real click at the element, and the positive assertion would fail if the click were lost. |
| E4 | M | **VERIFIED**, see E15 | e2e run 4 passed: `--ui-scale` = 1.5 asserted on a fresh page; overflowX 0; title intact at 1366×768. The focus-visibility half of the test was weakened; see E15. |
| E5 | M | **VERIFIED** | e2e run 7: `keyboard.type('seed-777-end')` sends real key events, the menu stays `main`, and Enter selects SEED-777-END in mode custom. Menu navigation is suspended while an input has focus (`Menu.ts:357-362`). The round-2 nit stands: there is still no assertion that the focused row and length are unchanged before Enter. |
| E7 | m | **VERIFIED** | The placeholder alpha is 0.58 (`styles.css:187`) and is legible in `e2e_menu_1366x768` (398–552, 534) and `e2e_menu_1920x1080`. |
| E12 | **M** | **VERIFIED** | `commitDrafts()` returns `'rejected'` when a text `set` returns false, and `activate()` aborts (`Menu.ts:310-327`); the App's code row returns false on a bad code (`App.ts:333`). Unit test `review_regressions.test.ts:50`. e2e run 7: type ALSO-WRONG, click Start, mode stays `menu`, and `.err` contains ALSO-WRONG. The `.err` text can only come from `commitDrafts` inside `activate()`, so the forced click is not a false pass. Nit: focus is not moved to the code row. Our round-2 probe `tests/review/e_drafts.test.ts` still prints `started=1` only because it replays the *old* `set` (no `return false`); it is a frozen record of the bug, not a regression signal. |
| E13 | m | **PARTIAL** | Part 2 is fixed: `codeDraft`/`codeError` are cleared in `startRun()` (`App.ts:359-361`). Part 1 is not: `Menu.replace()` (`Menu.ts:72-77`) still keeps `drafts` keyed to the *old* item objects, whose `set` closures still write to the App. Type a code without pressing Enter, change Mountain or Length (the field re-renders empty), click Start, and the hidden draft is applied: the course switches to the typed code, or an error appears for text the user can no longer see. The new UTC-rollover `replace()` (B8, `App.ts:638-643`) adds another path to the same bug. |
| E14 | m | **VERIFIED** | `cine_handoff_chase`: "RUN." at about 395–480 px, clear of the rear view (78–252 px). |

---

## New defects

| ID | Sev | Area | Defect | Evidence | Remedy |
|---|---|---|---|---|---|
| A41 | m | Terrain | Stair-stepped, dotted dark seams run along terrain creases and shadow terminators (shadow-map or crease aliasing), reading as stitched lines across the slope. | `r3_rocks_mid` (90–560, 40–170; 280–460, 270–320); `r3_rocks_near` (440–560, 120–160); a similar dotted run at the cave floor seam (`cine_t9_5` 1050–1200, 725–735) | Increase shadow-map resolution or use PCF/normal-offset bias on the terrain. If the seam is a material-band edge, blend it with `fwidth`. |
| A42 | m | Yeti | A visible fur-direction whorl, a "bullseye", in the middle of the forehead. It was also present in round 2. | `r3_face_front` (920–1000, 280–345); `r2_face_front` (same) | Move the singularity in the combing field to the crown, behind the brow, or add noise to the comb direction there. |
| A43 | m | Props/cohesion | Logs are bare, flat-grey, untextured cylinders with no bark, snow cap or contact shadow. One sits beside the skier's head in the climactic over-the-shoulder shots. | `cine_t14_6` (555–740, 670–705), `cine_t15_8` (555–730, 715–750), `cine_t16_6` (550–715, 540–575), `cine_handoff_chase` (1270–1360, 500–530) | Add bark albedo and end-grain, a snow cap and a contact AO patch, or keep logs out of the leap camera's foreground. |
| A44 | m | Yeti | In the 3.8–5.4 crawl the ruff and mane silhouette is a radial "feather boa" of straight cards around the neck and shoulders, inconsistent with the smooth chest and arms. Folded into A15 if preferred. | `cine_t3_8` (790–1050, 500–640); `cine_t9_5` (730–1070, 470–620) | Shorten and comb the shoulder cards back and down along the body, and taper their length toward the chest. |
| A45 | m | Cave | Residue of the A34 fix: bedding partings are evenly spaced, near-parallel dark lines (a "ruled" look on the jambs), and surface-nets facets show as straight polygon edges at the mouth, with a bright snow sliver poking through. | `cine_t3_8` left jamb (0–600, 200–700); `r3_preview_closeup` (430–540, 100–420; sliver 480–540, 370–420); `cine_t9_5` right jamb (1380–1920, 200–560) | Vary parting spacing and depth, and break them with joints. Increase rock bump and normal detail at the jambs, or smooth the normals. Clip the snow fillet behind the jamb. |
| C13 | m | Cinematic | **Double move at the hand-off.** On the frame where the timeline finishes, `cave.update(dt)` moves the Yeti, then `finishCave()` switches to `chase` and `fixedStep()` runs `yetiAI.update()` in the same frame (`GameSession.ts:216-221` then `:356-358`). The `820b280` fix covers only touchdown. | `grounding_report.json` frame 539: step 0.871 m between 0.440 and 0.417 (about 26 m/s for one frame against 13) | Skip the AI's movement on the hand-off frame (or the cinematic's on that frame). Add the requested check to `tools/cinematic.mjs`: \|Δstep\| ≤ 0.15 m/frame outside leap and cuts, no step of 0 for more than 0.3 s in `run`. Re-capture. |
| E15 | m | e2e | The UI-scale test was weakened: ArrowDown presses went from 12 to 8. The classic main menu has 8 focusable rows and `move()` wraps (`Menu.ts:279-281`), so 8 presses return to **Start**, the top row. The "focus stays visible after navigating" assertion now checks the trivial case. | `tests/e2e/menu.spec.ts:91` (diff in `74c0e38`) | Press 7 times (to the last row, Credits) or call `menuFocus('Credits & Licences')`, and assert that the focused row's label is the bottom row and that it is visible. |

**Observation for Reviewer B, not scored here:** the chase now starts with the Yeti **9 m** behind ("YETI 9 m — MOVE!" in `cine_handoff_chase`), where round 2 had 43 m because of the freeze. That is dramatic and probably intended, but confirm against the catch distance that a player who reacts late is not caught within the first second.

---

## IDs not verified as fixed

| Status | IDs |
|---|---|
| NOT FIXED | A2, A15, A17, A24, A31, A35 (roar), A37 |
| PARTIAL | A8, A9 (= C4), A10, A11, A12 (= C9), A13, A20, A27, A29, A32, A36, E13 |
| VERIFIED with a process caveat | C10: touchdown fix not re-captured; continuity check not added to the tool |
| VERIFIED | A3, A6, A21, A30, A34, A38, A39, A40, C7, C11, C12, E1, E2, E4, E5, E7, E12, E14 |

## Required to clear the two failing visual areas

**Cave interior (6.5 → 7+)**
1. Make the Yeti dark from the first frame of the 3.8 s shot (A9/C4).
2. Remove or light the grey particle discs that sit in front of the black interior (A12/C9).
3. Hide the threshold seam line (A10).

**Yeti model (6.5 → 7+)**
1. Clear the fur from the open mouth at full roar, from the shipped close-up angle (A35).
2. Pull the fringe locks off the mouth corner.
3. Give the palms skin, not glove pads (A17).
4. Break the forehead brim (A36).
5. Optionally comb back the ruff (A44).

**Cinematic hygiene:** fix C13, add the continuity check to the tool, and re-capture the grounding report through the hand-off.
