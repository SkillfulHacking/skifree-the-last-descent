# Fjord Coast — Round 6 — Reviewer C: Cinematics

- **Reviewer:** C, cinematics
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `5c28419` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`; `git rev-parse` confirmed)
- **Date:** 2026-11-13

## 1. Evidence used and gaps

- **Images:** every 1920×1080 PNG in `round-6/candidate/` from `07` to `11j`, viewed in full and compared with round 5 (`round-5/candidate/`).
  - Crops are in `scratch/review-c-r6/` (`crops6.py` → `r6_*.png`).
  - Pixel diff against round 5 (`diff.py`, a pixel counts as changed if any channel moves more than 8/255):
    - **Changed:** `11` 75.6%, `08` 52.8%, `08d` 35.9%, `07` 15.8%, `08b` 6.9%.
    - **Essentially unchanged:** every other victory beat, at 0.4–3.3% (`11b` 0.6, `11c` 1.6, `11d` 2.5, `11e` 3.3, `11f` 0.4, `11f2` 0.5, `11g` 1.1, `11h` 0.9, `11i` 2.2, `11j` 0.8), and the pursuit and finish shots, at 1.1–2.2%.
- **Missing evidence:**
  - **`round-6/candidate/standard/` was still missing when I finished.** I checked at the start, after the probes, and again just before writing. So, as in round 5, **there is no rendered shot of the cave cinematic on a Standard course**.
  - `candidate/EVIDENCE.md` and `candidate/manifest*.json` do not exist either.
  - `round-6/TESTS.md` had not appeared.
- **Source read:**
  - the `e2ce964..5c28419` diff of `seaCaveCinematic.ts`, `seaFraming.ts`, `seaCave.ts` and `harbourVictory.ts`;
  - `seaCave.ts:310–442` (columns, portal colonnade, fallen drums, scanned boulders).
- **Tests:** `npx vitest run tests/unit/fjord_r4_integration.test.ts tests/unit/fjord_r3.test.ts tests/unit/fjord_art.test.ts` → **21/21 passed**.
  - `fjord_r4_integration.test.ts:182` still discards the sea-shot count (`void found`), so these tests do not cover sea framing.
- **My own probes** (`scratch/review-c-r6/`):
  - **`seashots6.test.ts` → `seashots6.txt`.** My round-5 sea-shot probe, re-run on this build over **25 caves**: the 22 from round 5 plus three new Standard seeds, R6A–R6C. It now also:
    - measures the water share of the frame the cinematic **actually renders**, using the shipped `framedLook`;
    - checks the **new coastal-reveal shot** (`seaCaveCinematic.ts:197–205`): its water share, its line of sight to the cave mouth and the brow, and its distance to the cave.
  - **`revealimg.test.ts` → `img_*.png`.** A schematic ray-cast of the heightfield (sky / sea / snow / steep rock, with the subject marked in red).
    - It renders the reveal, emergence and leap frames from the same camera, look point and field of view as the timeline.
    - **Validated against `08`:** the schematic of the Classic Sprint emergence (`img_classic-sprint-x_emerge.png`) matches the real `08`. The sea is in the upper left, the portal is right of centre and the snow is in front.

## 2. Verdict — **FAIL** (Cinematics 7.5/10 against the 9/10 target; down from 8)

**What round 6 did:**
- It took both round-5 fixes I asked for in the sea framing: the shots now use the station's tilt and field of view (`framedLook`), and caves with no sea station get an added "coastal reveal" shot.
- It flipped the catch shot to the other side.
- It replaced the free-standing prism causeways with scanned boulders.

**Why it fails:** on screen and in measurement, none of this achieves what was claimed, and two things got worse.
- **The new coastal-reveal shot shows no coast.**
  - It covers 7.9–9.2 s and is used by **18 of 18** non-Sprint caves.
  - Its camera hangs 240–710 m above the sea, about 150 m out from the rim. It looks at a point that, on Classic Standard, is **31 m inside the hillside**.
  - Every probed frame is **0.00 water**. The cave mouth and brow are hidden behind the hill in all 18 caves.
  - The schematic (`img_classic-standard-x_reveal.png`) is a wall of shadowed sea cliff with a sliver of sky.
  - So on the default course the cinematic now cuts to about 1.3 s of blank rock before the same no-sea three-quarter shot as before.
- **The Sprint emergence, the one good sea frame in round 5, regressed:**
  - The search now accepts higher stations (`maxDropDeg` 30, new `[45,22]` and `[70,34]` stations) and picks a 31 m, 32° downward view.
  - In `08` the Yeti went from about 35% of frame height (round 5, x 1140–1340, y 470–765) to about 14% (x 1170–1290, y 535–655).
  - The sea shrank to the upper-left corner, about 7% of the frame.
- **The catch shot (`11`) is now entirely inland:** snowfield, mountain flank, a stockfish rack and houses. There is no quay or water anywhere.
- **The victory sequence is untouched for the third round running.**
- **The cave dressing still reads as placed props:**
  - The scanned boulders sit on the snow without contact shadows or drifts.
  - Untextured grey hex "drums" and a bent plate float among them.
  - The "colonnade" has collapsed to one lone square pillar standing against the face.

## 3. Scores

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7.5** | The scanned boulders read as rock, which the capped prisms never did (`r6_07_drums.png`), and the scan islands look good in `09d`, `10`, `11d` and `11e`. But the boulders perch on the snow without contact, flat grey drums and a plate float among them, and a lone monolith stands at the portal (`r6_07_column.png`). |
| Environmental uniqueness | **8** | Harbour, stockfish racks, islands, gulls and the summit-to-sea reveal are clearly not Alpine. The default-length cave encounter still has no sea in any shot. |
| Skiing and hazard mechanics | **7** (low confidence) | Stills only. The landing marks and the windsock are legible (`09b`, `09`). Not my area. |
| Difficulty and fairness | **7** (low confidence) | The Hard throw caption still fires on the first throw only (`GameSession.ts:659`). |
| Cinematics | **7.5** | Down from 8. Of the three round-6 changes in my area, one added a dead shot (the reveal), one made the best frame worse (the Sprint emergence), and one moved the catch shot from half-inland to fully inland. The default leap is still a speck (Yeti about 4% of frame height, 1–4% water). The victory beats, the gag and the roar mouth are unchanged. |
| Performance and stability | **7** (low confidence) | 21/21 of the related unit tests pass. No profiling was done, and `TESTS.md` was not available. |
| Accessibility and controls | **7** (low confidence) | The gull, roar, footstep, scrape and gag captions are present and legible (`08c`, `08d`, `09`, `09d`, `11f2`). The snowball caption still appears only once per run. |
| Overall player experience | **7.5** | The ending still lands: the harbour, the gag, the cannonball and the title over the fjord. The mid-run encounter most players see (Standard) still has no coastal identity and now opens on a rock wall. |

## 4. Defects

**No Critical defects found in my area.**

### 1. Major — The new coastal-reveal shot frames a blank cliff: no sea, no cave, no gulls on every non-Sprint cave (F-024 / C r5 #1 not fixed; new dead shot on the default course)

**Code:** `seaCaveCinematic.ts:197–205`:
- camera `sea0 = (rimX − 150, M.y + 18, M.z − 70)`, then `sea1`;
- look point `hill = ((rimX + M.x)/2, M.y + 6, M.z)`;
- field of view 44, from 7.9 to 9.2 s.

**Evidence (`seashots6.txt`, 25 caves):**
- **Used on 18/18 non-Sprint caves.**
- **Water share 0.00 at both the start and the end of the move on all 18.**
- **The line of sight to the cave mouth and to the brow (where the gulls are) is blocked by terrain on all 18.** The mouth faces inland, so from the sea side the camera sees the back of the hill.
- **Camera height:** 240–710 m above sea level. Only the end camera is placed relative to the mouth height (`M.y + 18`), not relative to the water.
- **Over land:** on 12 of 18 caves, the ground under the camera is itself above sea level (the "above ground" figure is below the "above sea" figure), so the camera is not even "out over the water".
- **Classic Standard:**
  - mouth at y −183;
  - look point at y −177, where the ground is at −146, so **the camera aims 31 m into the hill**;
  - sea at y −496.
  - `img_classic-standard-x_reveal.png` shows the whole frame filled with shadowed steep rock and a sliver of sky.
  - With a vertical half-field of 22°, the sea, 330 m below and more than 150 m away, cannot be in frame.
- **What the default player sees from 7.9 to 11.0 s:** cliff wall, then the old high three-quarter shot (no sea), then at 14.6 s the 106 m leap shot (Yeti about 4% of frame height, rendered water 0.04 by the probe and about 0.01 in the dense schematic, `img_classic-standard-x_leap.png`).
- **No rendered Standard shot exists to contradict this** (`candidate/standard/` missing).

**Fix:**
- Place the reveal relative to the sea, not the mouth. Put the camera low over the water (sea level + 20–40 m) beyond the cliff foot, and aim it up at the rim above the cave, so the frame holds water in the lower third, the cliff and the rim with the gulls bursting off it.
- Validate the pose at build time, as the stations are: require at least 0.25 water and a clear line to the brow, and drop the shot otherwise.
- Make `fjord_r4_integration.test.ts:182` assert coverage: at least 90% of caves on every finite length render at least 0.10 water in at least one cave shot, with the Yeti at 10% or more of frame height in that shot or the next.

### 2. Major — The Sprint emergence regressed from a close Yeti with the fjord to a high, distant view

**Evidence:**
- **`08`, round 5:** the Yeti filled about 35% of frame height beside the portal, with the open fjord, islands and harbour across the upper left.
- **`08`, round 6:**
  - The camera is about 31 m away and 32° down (probe: d31, fov 52, drop 32 on all 7 Sprint caves).
  - The Yeti is about 14% of frame height, crouched on the ice pool (`r6_08_yeti.png`).
  - The sea is a corner wedge, about 7% of the frame.
  - The foreground is boulders and floating grey drums (`r6_08_debris.png`).
- **Cause:** `seaCave.ts:670` now calls `bestSeaPose(..., 52, 0.05, 30)` (a downward limit of 30° instead of 24°), and `seaFraming.ts:159` adds the stations `[45,22]` and `[70,34]`. The score `w − 0.0015·dist` lets a farther, higher station with slightly more water beat the close one.
- The probe's "Yeti ≥ 10% of frame height" count is **0/7 emergences**.

**Fix:**
- Weight the Yeti's on-screen size in the score, for example by rejecting stations where the Yeti is below 18% of frame height for the emergence.
- Or restore the 24° limit for the emergence only. The higher stations were meant for caves that have no sea, and there they do not find any (0/18).

### 3. Major — The catch shot (`11`) now looks entirely inland (F-025 claimed fixed in 248be07; not fixed, worse than round 5)

**Evidence:**
- `harbourVictory.ts:158–164` flipped `right` to `−right`.
- `11` (pixel diff 75.6%) now shows:
  - the skier from behind and the waving harbourmaster;
  - behind them, a snow slope, a dark mountain flank, trees, a stockfish rack and the town's houses.
- **There is no quay, no water and no boat.** The code comment ("the quay and the open fjord fill the background") is still not what renders.
- **Why:** both sides look mostly sideways across the skier-to-presenter line, while the sea lies along that line. Neither side can show it.
- The closed ring of ski tracks around the skier is again prominent (x 0–1420, y 690–950).

**Fix:**
- Compute the seaward direction from the harbour (quay or `coast.rimX`) and put the camera on the land side of the pair, looking seaward.
- Or test both sides and both diagonals with `waterFraction` and keep the best.
- Add a test asserting at least 0.15 water for this pose.

### 4. Major — The cave dressing still reads as placed props: perched boulders, floating grey drums, a lone monolith (F-023 / C r5 #4: partial)

**Evidence:**
- **Better:** the scanned boulders (`seaCave.ts:376–409`) read as real rock, which is a genuine improvement on the capped prisms. The second causeway and the wreckage hoard are gone.
- **The boulders sit on the snow, not half-buried in it:**
  - `07`, `08`, `08b`, `r6_07_drums.png`, `r6_08_debris.png`: no contact shadows, no drift banked against them, and lit dark undersides visible.
  - Several clusters stack shard on shard into thin upright fins (`07`, x 330–500, y 900–1080).
  - The code sinks them by `0.35·r` against a minimum ground sample (`seat`). On the slope that is not enough.
- **The "fallen drums" are still placed** (`seaCave.ts:410–421`):
  - They read as **flat, untextured grey hex boxes** hovering beside and on top of the boulders: `07` x 490–570, y 770–850; `08` x 795–870, y 690–790.
  - A bent grey plate floats free: `07` x 330–370, y 885–915; `08` x 655–700, y 815–860.
- **Small pale ladder-like props** stand in the open snow (`07` x 570–690, y 820–860; `08` x 910–1035, y 805–830). I cannot identify them; they read as debris.
- **The portal colonnade** (up to 8 columns per side, `seaCave.ts:423–437`) renders as **one** square-looking dark pillar standing proud of the face, with a pale edge strip:
  - `07` x 1225–1280, y 395–690 (`r6_07_column.png`);
  - leaning in `08` (x 1640–1810);
  - repeated in `08c` (x 1430–1515) and `08d` (x 1660–1900).
  - It reads as a placeholder monolith, not basalt.
- **The icicles** (now `yUp = max(6.1, lipTop − mouth + 0.3)`) hang from flat rock about 80 px above the opening in `07` and well up the face in `08c`. There is no lip or overhang for them to hang from.

**Fix:**
- Turn the drums off along with the wreckage, or texture and sink them.
- Sink the boulders by about 0.5·r against the **lowest** sample, and add a blob shadow or drift ring.
- Either build the colonnade as a clump of three or more columns against the face, or remove the survivor.
- Hang the icicles from the actual lip line, or drop them.

### 5. Major — The default-length leap is still a speck with almost no sea (F-024, carried over)

**Evidence:**
- **Coverage:** 5 of 18 non-Sprint caves get a leap station. All are at **106 m, 39° field of view, Yeti about 4% of frame height**.
  - The rendered water share is 0.00–0.11 by the probe (Classic Standard 0.04, R6A 0.00).
  - The dense schematic shows about 1% water in the far top right (`img_classic-standard-x_leap.png`).
- **No change** to the station rules for the leap.

**Fix:**
- Reject leap stations where the Yeti is below 10% of frame height. Without a station, fall back to the ledge camera, which at least keeps the Yeti large.
- Or add a close station from low on the slope that frames the Yeti against sky.

### 6. Minor — The plunge backdrop is still one house model repeated (F-032, open)

**Evidence:** `11j` and `11h` are pixel-unchanged (0.8–0.9%). They show eight identical gable-fronted houses.

**Fix:** as in rounds 4 and 5.

Downgraded from Major only because it is a tracker-acknowledged open art item. It is still clearly visible at the climax.

### 7. Minor — Victory staging blemishes, unchanged since rounds 3 and 4

- `11` and `11d`: closed ring ski tracks.
- `11b`: a pale box under the sauna deck (x 130–500, y 690–820) and ladder rungs hanging below the deck edge (x 1240–1290, y 830–940).
- `11h`: the crown splash has a hard, straight-edged base (a glass cylinder).
- `11c`: the chute groove continues above the beacon to the top of the letterbox (x 870–1000, y 120–480).
- `11j`: the tucked skier sits on the green roof ridge.
- The plunge water is still flat.

### 8. Minor — The fish gag is unchanged

`11f` and `11f2` are pixel-identical to round 5 (0.4–0.5%):
- the flat olive cut-out cod, a different colour from the rack fish, with its tail over the nostrils;
- the hand at the belly, and a snarl that reads as menace, not retching.

### 9. Minor — The presenter's face is still behind the trophy

`11g` (1.1% change): the hat shows above the wheel ring, and the face is hidden behind the trophy.

### 10. Minor — The roar close-up: the jaw reads as a box behind a fur curtain

`08d` (`r6_08d_mouth.png`): the beard cards still hang in front of the open mouth, and the lower jaw shows as a hard-edged dark rectangle. This is unchanged despite the 35.9% frame change, which comes from the dressing.

### 11. Minor — Other carry-overs

- `08c`: about 80% of the frame is bare rock face, there is one stick-winged gull, and the mouth is cut off at the bottom.
- `07b`: the straight translucent wedge seam remains.
- The Hard-mode throw cue is unchanged (`GameSession.ts:659`, `throws === 1`).

### What I could not verify

- **Any Standard-length cave shot rendered on screen.** The `standard/` folder is missing; defects 1 and 5 rest on the probes. The schematic matched the real `08`, which gives me reasonable confidence in them.
- **The Yeti grounded from his first visible frame:** there is no shot before 7.9 s.
- **Motion, camera smoothness and audio sync.**

## 5. What works

- **The Sprint leap (`08b`)** is still a clean frame: a side-on Yeti in mid-air against the portal, with the fjord, the scanned islands and the harbour flags down the left.
- **The scanned rock itself.** Boulders and islands now read as geology, not as primitives. The islands in `09d`, `10` and `11e` are the best they have been.
- **The roar (`08d`)** keeps its low angle, sea smoke and falling ice. The interior darkness is controlled.
- **The pursuit frames (`09`, `09d`)** look down the run to the sea and the harbour, with the inset showing the Yeti.
- **The harbour stills and the ending:** the establishing shots (`10`, `10b`), the quay (`11d`), the cannonball silhouette (`11j`) and the reveal with the title over the fjord (`11c`, `11i`) remain the strongest images in the build.
- **`framedLook`** correctly applies the station's tilt and field of view, so the searched and rendered frames now agree for the stations that exist. The reveal shot is a sound idea, badly placed.

## 6. Round-5 defects and tracker items (my own verification)

| Round-5 C # / tracker | Status | Basis |
|---|---|---|
| #1 / F-004, F-024: no sea on Standard and Endurance; Classic Standard leap is a speck with no sea | **Not fixed; partly regressed** | Tilt and field of view are now honoured. But non-Sprint emergences with sea: 0/18. The new reveal has 0.00 water and no line of sight on 18/18. Leaps: 5/18, all with the Yeti at about 4%. The Sprint emergence regressed (defect 2). |
| #2 / F-025: catch shot has no sea | **Not fixed (worse)** | `11` is fully inland (defect 3) |
| #3 / F-032: repeated houses behind the plunge | **Not fixed** (open) | `11j`, `11h` unchanged |
| #4 / F-023: cave dressing reads as props | **Partial** | Scans replace the prisms. The drums, the plate and the lone column remain, and the boulders lack contact (defect 4). |
| #5: victory blemishes | **Not fixed** | Defect 7 |
| #6: fish gag | **Not fixed** | Pixel-identical |
| #7: presenter's face | **Not fixed** | `11g` |
| #8: roar jaw | **Not fixed** | `08d` |
| #9: other cave blemishes | **Not fixed** | `08c`, `07b`; the beige strip is now on the lone column |
| #10: Hard throw cue | **Not fixed** | `GameSession.ts:659` |
| F-003: black cave | **Still fixed** | `07`, `08`, `08d`: darkness only inside the mouth |
| F-005: plunge water reads as snow | **Still fixed** | `11j`, `11h`, `11b` |
| F-014: gag and presenter | **Not fixed** | Defects 8 and 9 |

## 7. Public-preview gate (completion brief §10) — my area

| Gate item | Status | Evidence |
|---|---|---|
| No critical defect or unrecoverable state in the cave cinematic or the victory | **met (stills and unit tests)** | No Critical found; 21/21 related unit tests pass. `TESTS.md` was not available. |
| No major regression in a signature cinematic | **not met** | The Sprint emergence lost its close Yeti and most of its sea (defect 2). The default-length cinematic gained a 1.3 s blank-cliff cut (defect 1). |
| Cave: natural opening, controlled darkness | **met** | `07`, `08`, `08d` |
| No floating props or clipping in the cave | **not met** | Defect 4 |
| The Yeti grounded from his first visible frame | **not evidenced** | No shot before 7.9 s. In `08` the feet meet the snow, but there is no contact shadow. |
| Coastal reveal in the encounter (sea, cliffs, birds, mist, sound) | **met on Sprint only (weaker); not met on the default length** | Defects 1, 2 and 5. No Standard shots were provided. |
| Water that is not snow | **met** | `11b`, `11h`, `11j` |
| Buildings not floating or repeated | **not met** (repetition) | Defect 6 |
| Trophy staging | **partially met** | `11` (no sea, ring tracks), `11g` (face hidden) |
| No inland-facing shots | **not met** | `11` (defect 3) |
| Fish gag | **met** (minor polish) | `11f`, `11f2` |
| Ending on the ocean and mountain reveal | **met** | `11c`, `11i` |

**Gate result for my area: not met.** No defect is Critical. But there are five Majors, two of them regressions introduced this round, and the default-length encounter still has no coastal framing. The gate is not lowered.
