# Whiteout Ridge, round 5: Review C (Cinematics & Camera)

- **Reviewer:** C, Cinematics & Camera. I own category 5. My scores for the other categories are low confidence (lc).
- **What kind of review this is:** I am a model reviewer, not a human playtester. I judged still frames, manifests, source at `729e226` and the committed e2e logs. I saw no motion at frame rate and heard no audio. Where a judgement depends on motion or sound, I mark it as inference.
- **Build:**
  - The frozen source is `729e226`. `git diff 729e226 bbbef83 -- src` and `git diff 729e226 f71f1b4 -- src` are both empty.
  - The manifests record `729e226` (strip_high, run 1), `bbbef83` (whiteout, strip_low, strip_rcm, a11y strict run) and `f71f1b4` (whiteout_victory, a11y_rcm_flash). The source behind all three is the same.
  - `CANDIDATE.md` does not mention `f71f1b4` as an evidence SHA. This is only a documentation gap.
- **Method:**
  - I looked at every image before reading the manifest notes: cave 12–15b, chase 16–17, victory 19–26 (default, and with Reduce Camera Motion + Reduce Flashes), and run-1 15 and 21.
  - From the strips I made contact sheets of the inset for frames 07–15, at 2×:
    - Whiteout on High, Low and RCM;
    - Alpine on High and Low;
    - Fjord on High.
  - I made 4× nearest-neighbour crops of the Yeti with a pixel ruler (High 07/09/11/13/14/15, Low 09/14/15, RCM 11/15).
  - I measured luminance (Yeti against background, beam, pool, doorway).
  - I made crops of the skier in the set-up shot against the letterbox.
- **Code read at `729e226`:**
  - `rescueVictory.ts` (all beats, gloom, recoil);
  - `rescue.ts` (`rescueLayout`, `STOP_OUT`, `searchBeam`);
  - `victorySteer.ts`;
  - `tools/whiteout_evidence.mjs` (at `bbbef83`: `shot()`, checks, cave capture);
  - `tools/handoff_strip.mjs` (arrival);
  - `tests/e2e/cave_skip.spec.ts` (assertions).
- **Not done:** I ran no browser.

---

## (a) Scores

| # | Category | R4 | R5 | Justification |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 7 | 7 | The cave rime blades still look like folded paper (13, 14), and a free-floating snow crescent sits at the mouth (15). The beam is a flat, faceted wedge. I leave this to A. |
| 2 | Environmental uniqueness (lc) | 7.5 | 7.5 | Not re-examined. |
| 3 | Skiing and hazard mechanics (lc) | 6.5 | — | Not examined. |
| 4 | Difficulty and fairness (lc) | — | — | Not examined. |
| **5** | **Cinematics** | **8** | **8.5** | **Verified fixed in pixels:** the searchlight beat now shows the beam, a lit pool and a readable recoil (C4-1). The Yeti in the inset is about 36–43 px during the leap on High, Low and RCM, including Alpine (C4-2). The pole is out of the lantern hand (C4-5). The reveal now carries the letterbox and the title. Skip parity holds. **What keeps it from 9:** the welcome beat has no skier because the camera stands on the skier's mark (C5-1, Major). The set-up shot still crops the tucked skier on the letterbox in a normal arrival (C5-2). The doorway is still a flat tan panel (C4-4). There are small staging artefacts in the beat (C5-3, C5-4). |
| 6 | Performance and stability (lc) | 7 | — | Not examined. Every manifest I read has `errors: []`. |
| 7 | Accessibility and controls (lc) | 7.5 | 7.5 | RCM victory: the crane is replaced by a hold or cut (25 is already at the reveal pose), and beats 23–24b match default motion. I cannot judge lamp steadiness under Reduce Flashes from stills. |
| 8 | Overall player experience (lc) | 7.5 | 8 | The finish now has a climax you can see: the light hits him, he shields his eyes and he leaves. The chase opening reads well in the inset. |

**Category 5: 8.5/10. The 9 gate is not met.** There is no Critical finding. One Major remains (C5-1), and it is new to this report: the developer reported the symptom, and I confirmed the cause in code.

---

## (b) The owner's questions

### W-082: is the Yeti readable during the leap, in the rear inset and on Low? **Yes: verified on High, Low and RCM (and on Alpine).**

The inset covers x 336–624 and y 78–198 of the 960×540 frame, so it is 120 px tall. I measured from the head to the feet in 4× crops:

| Frame (chase t) | High | Low | RCM | Backdrop |
|---|---|---|---|---|
| 07 (0.07 s) | ≈43 px (standing in the mouth) | ≈43 | ≈43 | dark mouth |
| 09 (0.60 s) | ≈41 | ≈38 | — | dark rock (body lum 104 against 34) |
| 11 (1.13 s) | ≈41 | — | ≈41 | dark rock |
| 13 (1.67 s) | ≈40 | — | — | dark rock (84 against 44) |
| 14 (1.93 s) | ≈38 | ≈39 | — | snow slope (98 against 104) |
| 15 (2.07 s, `run`, landed) | ≈36, snow burst at the feet | ≈36, burst | ≈36, burst | snow |

- **Size and position:** the Yeti fills about 0.30–0.36 of the inset's height, which matches the `REAR_INSET_FILL` claim. That is about 7 % of screen height, against about 2 % in round 4.
- **Low and RCM:** both look the same as High apart from texture detail. The inset is shown on Low.
- **Alpine:** `strip_high/alpine_07–15` and `strip_low/alpine_*` show the figure at about 40 px against grey limestone, dark hollows and trees, with the landing readable in 15. **C4-2 is closed.**
- **Weakness (minor, noted under C5-5):** in frames 14–15 the fur is almost the same luminance as the snow (98 against 104). He reads there by shape, his dark face and mouth, and shading, not by value contrast.
- **Inference I cannot confirm in stills:**
  - The inset lens holds him at a nearly constant size and position (head at about y 117–122 in every frame), so the arc of the jump is carried by the backdrop sliding past, not by the figure moving across the frame.
  - Whether that reads as a leap at 60 fps is a motion judgement I cannot make.
- **Manifests:** the strip manifests record `yetiAirborne`, `yetiMode` and the camera, but not the Yeti's inset size. The measurements above are mine. The run-1 whiteout manifest records shot `15_cave_leap` with `yeti.inMainView:false, heightPx:0`. That matches its image (the turn, with no Yeti), so the failed check was correct.

### W-083: beam, lit ground, recognisable reaction (24, 24b, 24c); the skier with the lantern in 23. **Yes, verified. C4-1 is closed.**

| Frame | What the image shows | Measured | Manifest |
|---|---|---|---|
| **23** (10.2 s) | **Yes: skier with lantern.** His helmet, raised arm and the brass lantern with its halo fill the near-left foreground. The Yeti is about 97 px, mid-frame, walking in out of the white. The eyeline reads. | Yeti `heightPx` 97 (RCM: 103) | Skier and Yeti `inMainView:true`: correct. |
| **24** (11.6 s) | **Beam: yes.** It is a warm cone from the lamp (with a glare star) on the mast, across the frame, enclosing the Yeti's upper body. **Lit ground: yes.** There is a warm pool at his feet, and the station and the skier with his lantern are in the background. | beam (182,184,174) against sky (145,165,185); pool (231,205,159) against unlit snow (79,97,122) | "lamp…shaft…pool": correct. `yetiPx ≥ 60` is enforced and he is 311 px. |
| **24c** (12.7 s) | **Recoil: recognisable.** A front three-quarter view: forearm thrown across the eyes, head turned away, mouth open, warm light on the lit side. It reads as "blinded", not as a snarl. | 485 px | Correct. Skier `false`: correct. |
| **24b** (13.4 s) | He turns away and lumbers off into the white (seen from behind). | 406 px | Correct. |

- **Root cause confirmed in code:** the old shader computed `vD = −z/60`, which made the beam's alpha zero. It is now `position.z/BEAM_LEN`, with normal blending, `renderOrder` 8 after the dome, a glare sprite (`toneMapped:false`), a pool, and `setGloom`/ambient/sun scaling for the beat (`rescueVictory.ts`, the `gloom` term in `update()`).
- **Evidence-integrity rule ("no manifest may claim an object is visible when the image does not show it"):**
  - For 20 and 22–26, every `inMainView:true` I checked is visible in the image, and every `false` is absent.
  - Shot 21's note still describes the intended content ("skier arriving"), but its check records `skier:false` and the run failed on it. The manifest therefore does not *claim* he is visible. It is honest.
  - Round 4's contradictions on 15, 20, 22, 23 and 24 (C4-7) are gone, because the checks are now computed and enforced (`whiteout_evidence.mjs` lines 106–113).
- **RCM + Reduce Flashes run:** 23, 24, 24c and 24b differ from default motion by a mean absolute difference of 0.7–6.6 levels. They are the same staging, and the beam and pool are present.

### W-091: set-up shot `15_cave_setup`. **The Yeti is on the ledge: yes. "Past the skier's shoulder": only loosely. In a normal arrival the skier is still cropped (C5-2).**

- **`whiteout/15_cave_setup` (14.47 s, 1366×768):**
  - The Yeti stands in the dark mouth on the ledge, 60 px tall: white on black, clearly readable.
  - The skier is fully in frame, upright, carving toward the lens, in the lower centre.
  - The Yeti sits up and to the left of the skier's head, about 400 px above it. This is a reverse shot (the skier fleeing toward camera, the hunter above). It is not an over-the-shoulder composition, but the hunter/hunted relation reads.
- **This frame is not representative**, for two reasons:
  1. The harness teleports the skier onto the trigger at **16 m/s** with the **HUD off** (`whiteout_evidence.mjs:268-270`), so the frame has no letterbox (`letterboxPx:0`) and an upright, slow-arrival pose.
  2. The hand-off strips, which use the natural autopilot arrival with the HUD on, show the same shot at 14.30 and 14.57 s differently. In `strip_high/whiteout_01/02`, `strip_low` and `strip_rcm`, the skier is in a **full tuck, cut off by the bottom letterbox** (bar at row 481). Helmet, goggles, shoulders, back and hip line are visible; the legs and skis are under the bar.
- **What this means for the claim:** `CANDIDATE.md`'s claim ("tucked head and waist in frame") is literally met. It is better than round 4, where only the helmet and back showed and the face did not. It still reads as a red lump on the frame edge for about 0.5 s.
- **Other locations:** on Fjord (`fjord_02`) the skier is almost entirely under the bar (red rows 467–474). That is outside Whiteout, on the same code path.

### Victory beat 2 (`21_v_welcome`): **yes, it is a staging defect: the camera is parked on the skier's mark (C5-1).**

- **The image:** 21 (5.2 s) shows the porch, the opening door and two rescuers waving at the lens. There is no skier, in default motion or with RCM.
  - I checked the two dark sticks at the bottom left: they are the rescue sled's handles, not the skier's poles.
  - The skier's z is 3022.39 at 5.2 s and 3022.42 at 8.2 s, so he has already stopped by 5.2 s and does not "glide into frame".
- **The cause in code (`729e226`):**
  - The skier is auto-steered to `stop = door + faces·STOP_OUT` with `STOP_OUT = 8` m (`rescue.ts` `rescueLayout`), using `onMark` (`victorySteer.ts`).
  - The beat-2 camera is `door + faces·10.5 → 9.4`, `across −1.6 → −1.2`, `y +2.6 → 2.4`, looking at `door + faces·1.5 → 1.2` at 1.4 m height (`rescueVictory.ts`, shot 2).
  - So the lens sits **1.4–2.5 m behind the skier's mark and 1.2–1.6 m to one side, about 2.5 m up, looking down past him toward the door.** He is under or beside the lower edge of the frame.
- **The cost:** the script's beat ("the skier glides in…up to the deck as the door swings open") cannot happen.
  - The shot plays as an unintended point-of-view shot, with a camera about 0.8 m taller than the skier.
  - For 3.2 s the welcome beat has no subject.
  - The strict evidence run cannot pass.
- **Related to C4-6:** the skier's "porch mark" is 8 m out from the door, which is why he stands well off the porch in 22, 25 and 26.

### Round-4 C findings

| ID | R5 status | Evidence |
|---|---|---|
| C4-1 searchlight / flinch (Major) | **Closed (verified)** | 24, 24c, 24b; pixel samples above |
| C4-2 Alpine leap pale on pale (Major) | **Closed (verified)** | `strip_high/alpine_07–15`, `strip_low/alpine_*` |
| C4-3 set-up crops the skier (minor) | **Partly fixed.** Face and hips are now in frame in the tuck; the skier is still cut on the bar. | strips 01/02; becomes C5-2 |
| C4-4 flat tan doorway (minor) | **Open.** Still exactly (196,174,141), with nothing warm spilling out. | 21 |
| C4-5 pole in the lantern hand (minor) | **Closed** | 22 |
| C4-6 reveal subjects small (minor) | **Open, unchanged.** The skier is about 30 px, 8 m off the porch. The title and letterbox are now on. | 26 |
| C4-7 manifest notes against images (minor) | **Closed.** Checks are computed and enforced, and the failures are recorded. | manifests; see C5-6 for the residue |
| C4-8 `cave_skip` margin comment | **Closed.** The test now measures alignment with the run (0.996–1.000), not raw `dir.z`. | `cave_skip.txt` |

### Skip against watch parity (`cave_skip.txt`, 6/6 pass on `729e226`, 1.0 h)

- **What the spec asserts:** watched and skipped hand-offs match within **0.05 m** of camera position and **2°** of direction, and the state vector matches (lines 139–143). This covers Escape at 1 s, pad Start at 9 s, Escape during the swing and pad Start just before the leap.
- **Coverage:**
  - Alpine, Fjord and Whiteout on Normal;
  - Alpine with a slow arrival;
  - Whiteout on Hard;
  - Fjord on Hard with RCM.
- **Results:**
  - The first controllable frame is aligned with the run at 0.998–1.000.
  - The lowest alignment over 2 s is 0.996.
  - The skip is not a pause, and look-back with release returns forward.
- **Parity holds.**

---

## (c) Findings

### C5-1: Major (new; the symptom was reported by the developer). The victory welcome beat frames the spot where the skier stands, so he is never in it.
- **Evidence:**
  - `whiteout_victory/21_v_welcome.png` and `a11y_rcm_flash/21_v_welcome.png`: no skier.
  - The manifest records `checks.skier:false`, and both strict runs stopped there (`whiteout/`, `a11y_rcm_flash_run1_strict/`).
  - Code: `STOP_OUT = 8` (`rescue.ts`) against the shot-2 camera at `door + faces·9.4–10.5` (`rescueVictory.ts`).
- **Player impact:** the "safety and welcome" beat shows rescuers waving at nobody, from a lens about 2.5 m up that stands where the skier is. Continuity also breaks: 20 shows him arriving, 21 shows nobody, and 22 shows him next to the camera.
- **Acceptance:** at 5.2 s the skier is in frame from the waist up (or the whole figure), in front of the porch, in default motion and with RCM. The strict (non-`LENIENT`) victory run passes beat 2. Either:
  - move the mark (for example to about 3 m, on the deck step) and stage the glide-in; or
  - move the camera off the mark line (for example `across ±5`, `faces·6`) so that the mark sits in frame.

### C5-2: minor (carried C4-3 / W-091). In a normal arrival the set-up shot still cuts the tucked skier on the bottom letterbox, and the evidence shot does not show that case.
- **Evidence:**
  - `strip_high/whiteout_01/02`, `strip_low/whiteout_01/02` and `strip_rcm/whiteout_01/02` (bar at row 481; legs under it); `fjord_02` is worse.
  - `whiteout/15_cave_setup` is taken at a 16 m/s teleport arrival with the HUD (and letterbox) off, so it shows an upright skier fully in frame, which a normal arrival does not.
- **Acceptance:**
  - On the strip arrival, with the HUD and letterbox on, the skier's figure is clear of the bar down to the knees in frames 01–02 on Whiteout (and Fjord).
  - The evidence harness captures the set-up shot with the letterbox on, at the normal arrival speed.

### C5-3: minor (new). The beam cone's wall shows as a hard vertical edge when the camera is near or inside it.
- **Evidence:**
  - `24c`: a vertical seam at x ≈ 1014 running the full height of the picture, with a 10–15-level luminance step (157,160,160 → 141,150,161 at y 400).
  - `23`: a pale vertical slab from x ≈ 1015 rightwards.
  - The cause is an 18-segment, double-sided, open cone with no soft edge or depth fade (`searchBeam()`).
- **Acceptance:** no straight-edged luminance step above 4 levels from the beam geometry in 23 and 24c. For example, fade alpha by `abs(dot(vN, vV))` (a Fresnel edge), or skip the beam when the camera is inside the cone.

### C5-4: minor (new). The Yeti's colour jumps between beats 4 and 5.
- **Evidence:** in `23` he is charcoal grey (a storm silhouette, as in the chase shots 16 and 17). 1.4 s later in `24` he is bright white fur, and he stays white in 24c and 24b.
- **Why it matters (inference):** the shift is motivated by the light, but at a hard cut it can read as a different creature or a lighting pop.
- **Acceptance:** either let the silhouette lift over the light's swing-on (10.6–11.4 s), or confirm with a frame at 11.0–11.3 s that the transition is visible on screen and not a cut.

### C5-5: minor (new, observation). At the landing the inset Yeti has no value contrast against the snow.
- **Evidence:** in `strip_*/whiteout_14–15` the body's luminance is about 94–98 against snow at about 104. He reads by shape and his dark face.
- **Acceptance (optional):** keep a luminance difference of at least 25 levels between body and backdrop through the landing, for example with a slight darkening of the Yeti in the inset or the existing storm-silhouette tint.

### C4-4: minor (carried). The doorway is still flat tan.
- **Evidence:** `21`, pixel (196,174,141), identical to round 4.
- **Acceptance:** a warm, saturated doorway (for example R−B > 100), with spill on the deck.

### C4-6: minor (carried). The reveal's subjects are small, and the skier stands 8 m off the porch.
- **Evidence:** `26`. This interacts with C5-1: moving the mark would help both.

### C5-6: minor (evidence). The harness's camera shots do not always represent normal play.
- **Evidence:** the cave shots 12–15b are captured with the HUD off and a 16 m/s teleport (see C5-2). Shot 21's note still describes intended content (the failed check does flag it).
- **Acceptance:** cave shots with the letterbox on and a natural arrival; the note for 21 reworded once C5-1 is fixed.

---

## (d) What I could not verify
- Motion:
  - whether the inset leap reads as a jump when the lens holds the figure at a constant size;
  - the pace of the light swing and the recoil;
  - the comfort of the crane.
- Audio: the growl at the recoil, the fanfare, the landing thud.
- Lamp steadiness under Reduce Flashes (stills cannot show flicker).
- The exact projection of the skier in beat 2. I inferred his position from the code and from the camera and z values in the manifests. The manifest does not record the skier's x.

## Summary
- **Fixed:**
  - The climax now shows the beam, the pool and a readable recoil (W-083; C4-1 closed after three rounds).
  - The inset leap is readable at about 36–43 px on High, Low and RCM, Alpine included (W-082; C4-2 closed).
  - The pole is out of the lantern hand.
  - The evidence checks are now honest.
  - Skip parity holds.
- **Remaining:**
  - Victory beat 2 has no skier because its camera sits on his mark (C5-1, Major).
  - The set-up shot still cuts the tucked skier in a normal arrival (C5-2).
  - Small beam and continuity artefacts (C5-3, C5-4).
  - The doorway (C4-4).
- **Cinematics 8.5/10:** the 9 gate is not met. C5-1 is a contained fix to the shot-2 camera or to the stop mark.
