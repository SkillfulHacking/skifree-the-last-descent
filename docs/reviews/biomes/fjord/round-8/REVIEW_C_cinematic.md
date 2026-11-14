# Fjord Coast — Round 8 — Reviewer C: Cinematics

- **Reviewer:** C, cinematics
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `d1f642b` (branch `pass4-fjord`; `git rev-parse --short HEAD` = `d1f642b` in `/home/claude/sf-fjord`)
- **Date:** 2026-11-13

## 1. Evidence used and gaps

- **Images:** every 1920×1080 PNG in `round-8/candidate/` from `07` to `11j`, plus `09`, `10`, `10b` and `14`, all viewed. Shot poses, phases and cinematic times come from `candidate/manifest.json` (new this round).
- **Pixel diff against round 7** (`scratch/review-c-r8/diff.py`; a pixel counts as changed if any channel moves by more than 8/255):
  - **Real change:** `08c` 71.6% (new gull shot), `08d` 24.6% (mist and particles only; same pose and framing).
  - **Global re-lighting and grade only:** 10–24% on `09`–`11j`. The composition is the same, and I re-checked each frame.
  - **Essentially unchanged:** `07` 0.3%, `07b` 1.4%, `08` 2.1%, `08b` 2.6%. This supports the claim that the harness change (`settle()`) did not move the cinematic cameras.
- **Crops:** `scratch/review-c-r8/crops8.py`, which writes `r8_08c_yeti.png` and `r8_08c_gulls.png`. Comparisons: `r8_11j_r7_vs_r8.png`, `r8_11c_r7_vs_r8.png`, `r8_10b_island.png`, `r8_11_fg.png`.
- **Source:** the `7b0a5bc..d1f642b` diff of these files:
  - `seaCaveCinematic.ts:162–171`: the new gull shot;
  - `seaCaveCinematic.ts:207–218`: the reveal now goes through `coastalReveal`;
  - `seaFraming.ts:182–206`: the new `coastalReveal`;
  - `harbour.ts:487–503`: the waterfront change;
  - `buildings.ts`: the roof parameter;
  - `tests/unit/fjord_reveal.test.ts`.
  - I also read the shared timeline `src/cinematic/CaveCinematic.ts` (Yeti placement, shade and dimming).
- **Tests:** `fjord_reveal.test.ts` and `fjord_art.test.ts` pass, 8/8.
- **My own probes** (`scratch/review-c-r8/`; headless, calling the shipped functions):
  - **`sweep8.test.ts` → `sweep8.txt`:** `coastalReveal` on 74 caves:
    - Classic Sprint, Standard and Endurance;
    - 30 Standard seeds and 10 Endurance seeds;
    - my round-7 problem seeds C4G, C4H, C4J, C4K, R5B, R6A and R6B.
    - For each cave it records: the camera's clearance at both ends of the move, the water share at both ends (the shipped `waterFraction`), whether the mouth and brow are in frame with line of sight, and island clearance.
  - **`revealimg8.test.ts` → `img8_*.ppm`, `img8_grid.png`:** schematic ray-cast renders of the reveal at both ends of the move for four caves. The run timed out under load (load average about 7) before writing its text summary. The four rendered caves' images are complete, and I measured them with PIL.
  - **`gullshot8.test.ts` → `gullshot8.txt`:** builds the real dressing (`dressSeaCave`, quality `high` and `low`) for 9 caves (Classic Sprint, Classic Standard, 6 Standard seeds) and rebuilds the shipped gull-shot pose. For each cave it records:
    - gull homes in frame;
    - gulls in frame through the beat, with the shipped flight model simulated at 60 Hz;
    - camera clearance;
    - whether the Yeti's head (from the shared exit-path placement) is in frame with terrain line of sight at 2.4, 3.0 and 3.6 s.
- **Missing evidence:**
  - **`round-8/candidate/standard/` was still not captured** when I finished. The capture was still on `res-1366`, so for the **fourth round running no cave cinematic has been rendered on a Standard course**. My Standard findings rest on the probes above.
  - `round-8/TESTS.md` had not appeared.

## 2. Verdict — **FAIL** (Cinematics 8/10 against the 9/10 target; unchanged from round 7)

**What round 8 fixed (I checked each one myself):**
- **The reveal camera can no longer be inside the hillside.** On 71 caves with a reveal, clearance is never below 10 m (minimum 29 m; it was −351 m on C4J). On the three late Endurance caves where no clear pose exists (C4J, E7X1 and E7X9 at z 13977), the reveal is skipped and the three-quarter shot plays from 7.9 s.
- **The reveal's opening frame always has water.** At the start of the move, water is at least 0.10 on 71/71 caves (it was dry on 6/30 Standard caves).
- **On the Sprint cave the gull beat is back on screen:** `08c` shows four gulls taking off from the snow-capped boulders, under the caption.

**Why it still fails:**
- **The new gull shot shows the whole Yeti standing in the cave mouth at about 2.95 s (new regression).** That is before "[something growls in the dark]" (4.9 s) and the glowing-eyes beat (5.4 s). The encounter's slow reveal from the dark is given away in the third shot.
- **On the default course the gull fix does not work.** On the Standard cave the shot is aimed at the midpoint between two separate groups of perched gulls. **No gull is in frame at any point in the beat on 7/7 Standard caves probed**, while the caption still reads "[gulls scream and scatter]".
- **The reveal is still a coastal cutaway:**
  - the cave, the brow and the gulls are in frame on 0/71 caves;
  - by the shipped water metric, the frame at the end of the move has under 10% water on 18/71 caves (11 of them 0.00), because only the start of the move is checked;
  - the Yeti still never shares a frame with the sea on the default course.
- **The victory sequence is essentially untouched for the fifth round.** The waterfront change is real but small.

## 3. Scores

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7.5** | The cave and harbour are unchanged in substance. The boulders still sit on the snow without collars (`07`, `08`, `08b`). The new gull close-up exposes the gull model: single-triangle wings and a faceted body about 400 px across (`r8_08c_gulls.png`). The victory podium still reads as toy blocks (`11`, `11d`, `10b`). The islands in the harbour mouth read as pillow blobs (`r8_10b_island.png`). |
| Environmental uniqueness | **8** | The harbour, the quay, the stockfish racks, the plunge and the reveal over the fjord are clearly not Alpine. Sea-level reveal views of the cliffs on most non-Sprint caves add to it. |
| Skiing and hazard mechanics | **7** (low confidence) | Stills only. Not my area. |
| Difficulty and fairness | **7** (low confidence) | Not assessed this round. |
| Cinematics | **8** | Up: the reveal camera is never underground, the opening frame always has water, and the Sprint gull beat is visible. Down: the gull shot now shows the Yeti before his reveal (a new regression), shows no gulls on Standard caves, and the reveal still never shows the cave. The victory is frozen. Net: no change. |
| Performance and stability | **7** (low confidence) | 8/8 related unit tests pass. `TESTS.md` was not available, and I did no profiling. |
| Accessibility and controls | **7** (low confidence) | The captions are legible and timed. On Standard caves "[gulls scream and scatter]" again describes something not on screen (probe). |
| Overall player experience | **7.5** | Sprint players get a strong encounter, apart from the early Yeti glimpse. Standard players get an empty slope under a gull caption, a monster visible too early, a clean sea-level cutaway that never shows the cave, then inland shots. The ending is still the best part. |

## 4. Defects

**No Critical defects found in my area.**

### 1. Major (new regression) — The gull shot shows the Yeti in the cave mouth at 2.4–3.8 s, before the dark/eyes reveal

**Evidence:**
- **The frame:** `08c` (manifest: t = 2.97 s; crop `r8_08c_yeti.png`) shows the Yeti at x 1420–1590, y 285–395, standing in the mouth: head, teeth, eye glints, shoulders and arms are all readable.
  - Luminance: the body has a median of 9/255 and the face a mean of 7.7/255, against 1/255 for the cave interior.
  - On any display he is a clear figure, not a hint.
- **The planned structure (`CaveCinematic.ts`):**
  - 3.8–6.6 s: "a huge shadow moves in the darkness";
  - 4.9 s: "[something growls in the dark]";
  - 5.4 s: the eyes light;
  - 7.9 s: the emergence.
- **Cause:**
  - The new shot (`seaCaveCinematic.ts:166–169`) puts the camera 9 m outward from the gulls' centroid and looks back toward the face, so the open mouth sits in the background.
  - At that time the shared timeline has the Yeti prowling toward the mouth: depth s = 12.5 → about 5 m at 2.95 s (`CaveCinematic.ts:271–276`, ease-out).
  - His shade there is about 0.30 (`applyShade`: `1 − 0.88·(s − 0.5)/6`).
  - The global dimming only starts at 2.9 s and ramps up (`dim` time constant 2.5/s).
  - The old brow shot looked up at the lip and never saw into the chamber.
- **Probe:** the Yeti's head is in frame with terrain line of sight at one or more of 2.4/3.0/3.6 s on **9/9 caves** (`gullshot8.txt`; the cave shell itself is not in the line-of-sight test, but `08c` confirms the Sprint case).

**Fix:** any of these:
- frame the gull beat so the mouth is outside or occluded (for example, shoot along the apron parallel to the face, or from low behind the boulders with the face filling the background beside the mouth);
- keep the Yeti at `CRAWL_FROM` until 3.8 s;
- force `setShade` to at most 0.05 and start the dimming at 2.4 s while this shot is live.

Add a test that projects the Yeti's head into every shot before 7.9 s and requires it to be outside the frame or below a luminance budget.

### 2. Major — On Standard caves the gull beat still shows no gulls: the shot aims at the midpoint between two separate gull groups (F-037: partial)

**Evidence:**
- **Probe on the real dressing (`gullshot8.txt`):**
  - **Classic Standard (z 960) and 6 Standard seeds:** 10 gulls; homes in frame at the start **0/10**; gulls in frame through the beat **0/0/0/0** at 2.4/2.8/3.2/3.6 s, on **7/7 caves**.
  - The homes project to NDC x ≈ +1.1…+2.0 (frame right) and −1.1…−1.7 (frame left). The look point, their centroid, falls on empty snow between the two groups.
  - The scatter velocity is outward and sideways (`vel = O·(3.5…5.5) + T·sin(i·1.9)·3.5`), so the gulls fly further out of frame.
  - **Classic Sprint:** 5/11 gulls in frame (high quality) and 3/7 (low), which matches `08c`.
- **Caption:** "[gulls scream and scatter]" still plays at 2.5 s on every cave.
- **Rendered evidence:** none for Standard; `standard/` was not captured.
- **Test coverage:** no test covers this shot.

**Fix:**
- Aim at the densest group, not the mean: for example, the perch with the most neighbours within 6 m, and its cluster.
- Choose the camera side so the scatter velocity carries the gulls across the frame, not out of it.
- Add a test that rebuilds the dressing and the pose for each finite length and requires at least 3 gull homes in frame at 2.4 s and at least 2 in flight at 3.2 s.

### 3. Major — Coastal reveal: no longer underground, but it never shows the cave, and its closing frame is near-dry on about 25% of caves (18/71) (F-038: partial)

**What is fixed:** `coastalReveal` (`seaFraming.ts:188–206`) steps out over the water until the camera is clear. Across 74 caves (`sweep8.txt`):
- 71 have a reveal (including the Classic Sprint pose, which the game does not use because Sprint has a sea station); the 3 Endurance z 13977 caves (C4J, E7X1, E7X9) skip it;
- camera clearance is ≥ 29 m on every one;
- the water at the start of the move is ≥ 0.10 on 71/71.

**Remaining:**
- **The cave is never in the frame.** Mouth or brow in frame with line of sight: **0/71**. The mouth projects at `sy` 1.2–1.7, above the frame's top edge, on the typical Standard cave. The tracker already says so ("the cave is still not in the reveal").
- **Only the opening frame is checked.** The shot moves from `sea0` to `sea1` and tilts up 6 m (`seaCaveCinematic.ts:214`), but `coastalReveal` and the test only measure `sea0`. With the shipped metric at the `sea1` pose:
  - water < 0.10 on **18/71** caves;
  - **0.00 on 11/71** (for example S7X8, S7X14, S7X17, S7X24 and E7X0 z 7267).
- **Schematic renders (`img8_grid.png`):** on S7X8 and S7X17 a white strand flat fills the lower third. Measured water share:
  - S7X8: 17.5% → **3.9%** from start to end of the move;
  - S7X17: 19.4% → **7.2%**.
  - Classic Standard stays at 29% → 23% and is a good frame.
- **The 7×4 ray grid flatters the frame.** One bottom-row hit is worth 3.6%, and the bottom row sits at 12% from the frame's lower edge, so a thin waterline passes.

**Fix:**
- Check both ends of the move (`sea1` with `rim + 6`, fov 48) at ≥ 0.15, using a denser grid (at least 16×9).
- Re-aim so the brow sits inside the frame (see C r7 #1: farther out with a longer lens, brow at about `sy` 0.6).
- Extend `fjord_reveal.test.ts` to assert the end-of-move water and brow visibility.

### 4. Major — On the default course the Yeti still never shares a frame with the sea (F-024 core, carried over)

**Evidence:**
- `seaFraming.ts` gained only `coastalReveal` this round; the emergence and leap stations are unchanged.
- My round-7 probe (emergence 0/21, leap 0/21 on non-Sprint caves) therefore still applies.
- The non-Sprint sequence is:
  - 7.9–9.2 s: the reveal, with no Yeti and no cave;
  - 9.2–11.0 s: the inland three-quarter shot;
  - 11.0 s: the roar against the face;
  - 14.6 s: the ledge camera looking inland.
- No Standard render exists to show otherwise.

**Fix:** as in C r7 #4. Add a wide crane shot behind and above the rim looking down across the cave to the fjord, or make the reveal include the brow and cut to it on the roar. Assert that at least 90% of caves on each finite length have a shot with the Yeti at ≥ 10% of frame height and ≥ 0.10 water, in that shot or the next.

### 5. Major — Cave apron boulders still read as placed on the snow (F-040, carried over)

**Evidence:** `07`, `08` and `08b` are pixel-stable against round 7 (0.3–2.6%), so the round-7 observations stand:
- no contact shade or drift collar;
- the slab at x 1005–1170, y 875–960 in `07` hovers;
- the fin at x 445–490 in `07`;
- the all-white lump at x 415–580, y 740–860 in `08`.

The new `08c` adds snow-capped scans in close-up with flat cut-off bases against smooth snow (x 70–460, y 800–960).

The tracker rates this minor. In the hero shots of the signature cinematic it is clearly visible, so I keep it Major for a 9/10 target.

**Fix:** as in C r7 #3: a contact AO decal, a drift skirt that blends into the terrain normal, and capped snow on small scans.

### 6. Minor — The gull model does not survive the new close-up

In `08c` (`r8_08c_gulls.png`):
- the nearest gull is about 400 px across, with flat single-triangle wings that read as blades or sticks;
- the body is a visibly faceted 10×7 sphere (`gullMeshes`, `seaCaveCinematic.ts:40–76`);
- another gull is cut off at the left edge (x 0–100).

The gulls fly straight at the lens because the scatter is along +O and the camera is at +9·O.

**Fix:** a wing with 3–4 segments and some thickness, plus a smoother body; or keep the camera ≥ 12 m from the nearest flight path.

### 7. Minor — The catch shot (`11`) is unchanged

`11` changed only by its global grade (7.5%):
- the skier is cut off at the waist and seen from behind;
- the water is a band of about 2–3% of the frame;
- the podium reads as toy blocks: a red cube, two blue slabs, a yellow box and an orange ball at x 825–1175, y 505–570 (`r8_11_fg.png`).

**Fix:** as in C r7 #5.

### 8. Minor — Victory details: one small improvement, the rest unchanged (F-042 open, F-032 partial)

- **Waterfront (`11j`, `11h`; `r8_11j_r7_vs_r8.png`):**
  - Now one building of about nine turns its eaves to the sea, with a grey slate roof. The heights and gable pitches step a little.
  - But the snow load whitens most roofs, so the roof-colour variety is mostly invisible.
  - The row is still one gable model in one line along the quay. The F-032 "regimented" reading is only slightly eased.
- **`11g`:** the trophy still hides the presenter's head.
- **`11h`:** the crown splash is still a straight-sided cylinder.
- **`11f` and `11f2`:** the cod is still a flat olive cut-out, and the expression reads as menace, not a gag.
- **`11j`:** the bather still reads as sitting on the roof ridges.
- **`11c` and `11i`:** the pale chute groove above the beacon is unchanged.

### 9. Minor — Carry-overs

- **`08d`:** the roar still has no falling ice (`PORTAL=false`), and the hard dark jaw box and the beard cards in front of the open mouth remain. Only the mist changed.
- **`07b`:** the translucent wedge seam remains.
- **Islands in the harbour mouth:** in the victory backdrop (`10b`, `11d`, `11`, `11g`) they are smooth, fog-washed pillow shapes (`r8_10b_island.png`, x 1070–1260 × y 470–535 in `10b`). Reviewer A should judge this one.
- **Not re-verified this round:** the Hard throw cue.

### What I could not verify

- **Any Standard-length cave shot on screen.** `standard/` was missing. Defects 2, 3 and 4 rest on headless probes.
- **Motion, camera smoothness and audio sync**, including whether the Yeti glimpse in defect 1 also shows during the 2.4–2.9 s part of the beat. The probe says yes; `08c` is the 2.97 s frame.
- **That the Yeti is grounded from his first visible frame.** His first visible frame is now `08c` at 2.4 s. He stands behind a snow crest that hides his feet (`r8_08c_yeti.png`), so grounding is neither shown nor disproved.

## 5. What works

- **The reveal is now safe.** It is never inside the terrain, it is skipped cleanly where no pose exists, and its opening frame always has water. On Classic Standard it is a good sea-level look up the cliffs (29% water).
- **On Sprint the gull beat finally reads:** gulls burst off the boulders in `08c` under the caption.
- **The Sprint encounter frames are still strong:**
  - `08`: the Yeti beside the mouth over the fjord, islands and harbour;
  - `08b`: the leap against the face with the sea beyond;
  - `08d`: the roar with sea smoke.
- **The ending is still the best part of the build:**
  - `10`, `10b`, `11d`: the quay street to the water;
  - `11e`: the stockfish racks;
  - `11b`: the pier apres with real water;
  - `11j` and `11h`: the plunge with water that reads as water;
  - `11i` and `11c`: the closing reveal over the fjord.

## 6. Round-7 defects and tracker items (my own verification)

| Round-7 C # / tracker | Status | Basis |
|---|---|---|
| #1 / F-038: reveal underground, dry, never shows the cave | **Partial** | Underground: fixed (0/71; fallback on z 13977). Opening frame dry: fixed (71/71 ≥ 0.10). Closing frame < 0.10 on 18/71 (0.00 on 11). Cave or brow in frame 0/71. See defect 3. |
| #2 / F-037: gull beat off-screen | **Partial (fixed on Sprint; not fixed on Standard)**, plus a **new regression** | `08c` shows gulls (Sprint). Probe: 0 gulls in frame on 7/7 Standard caves (defect 2). The new shot reveals the Yeti early (defect 1). |
| #3 / F-040 (F-023): boulders perched | **Not fixed** | `07`, `08`, `08b` pixel-stable; defect 5. |
| #4 / F-024: Yeti and sea never share a frame on the default course | **Not fixed** | Stations unchanged; defect 4. |
| #5 / F-025: catch shot | **Mostly fixed, polish open** (unchanged since round 7) | Defect 7. |
| #6: roar lost its falling ice | **Not fixed** | `08d`; defect 9. |
| #7 / F-042, F-014: victory blemishes, gag, presenter | **Not fixed** | Defect 8. |
| F-032: repeated houses / regimented waterfront | **Partial** | One eaves-on building, small height and pitch steps; same model, same line, roofs whitened by snow (defect 8). |
| #8: carry-overs (`07b` seam, Hard cue, P-M6 timeout) | **`07b` not fixed; Hard cue and P-M6 not re-verified** | — |
| F-003: black cave | **Still fixed** | `07`, `08`, `08d` |
| F-005: plunge water reads as snow | **Still fixed** | `11b`, `11h`, `11j` |
| F-004 / F-024 (CLAIMED, partial) | **Partial** | As defect 4. |

## 7. Public-preview gate (completion brief §10) — my area

| Gate item | Status | Evidence |
|---|---|---|
| No critical defect or unrecoverable state in the cave cinematic or the victory | **met (stills, probes and unit tests)** | No Critical found. The reveal camera can no longer be underground. |
| No major regression in a signature cinematic | **not met** | New: the Yeti is shown in the mouth before the dark/eyes reveal (defect 1). The gull fix does not reach the default course (defect 2). |
| Cave: natural irregular opening, controlled darkness | **met** | `07`, `08`, `08d` |
| No floating props or clipping in the cave | **partially met** | No free-floating props. The boulders read as perched, and one slab hovers (defect 5). |
| Yeti grounded from his first visible frame | **not evidenced** | His first visible frame is now about 2.4 s (`08c`), with his feet hidden by the snow crest. |
| Coastal reveal in the encounter (sea, cliffs, birds, mist, sound) | **met on Sprint; partially met on Standard** | Standard: sea and cliffs in the reveal on every probed cave at the start (18/71 near-dry at the end). No cave and no birds in that frame. The gull beat is empty. The Yeti never appears with the sea (defects 2–4). No Standard renders. |
| Water that is not snow | **met** | `11b`, `11h`, `11j` |
| Buildings not floating or repeated | **partially met** | No floating. The repetition is eased slightly but still reads as one model in a line (`11j`, `11h`). |
| Trophy staging | **partially met** | `11` (skier cropped, toy-block podium), `11g` (face hidden) |
| No inland-facing shots | **met in the victory; not met in the Standard cave sequence** | Defect 4 |
| Fish gag | **met (minor polish)** | `11f`, `11f2` |
| Ending on the ocean and mountain reveal | **met** | `11c`, `11i` |

**Gate result for my area: not met.**
- No defect is Critical, and the reveal is now robust.
- But there are five Majors. One is a new regression in the signature cinematic: the monster is shown before his reveal.
- The headline fix for the gull beat works only on the Sprint cave that the evidence set renders, not on the default course.
- The gate is not lowered.
