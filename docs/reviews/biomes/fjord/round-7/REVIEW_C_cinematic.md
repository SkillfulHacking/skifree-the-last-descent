# Fjord Coast — Round 7 — Reviewer C: Cinematics

- **Reviewer:** C, cinematics
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `7b0a5bc` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`; `git rev-parse HEAD` = `7b0a5bc0494e…`)
- **Date:** 2026-11-13

## 1. Evidence used and gaps

- **Images:** every 1920×1080 PNG in `round-7/candidate/` from `07` to `11j`, viewed. I compared them with round 6, and with round 5 for `08`.
  - Crops: `scratch/review-c-r7/crops7.py` → `r7_*.png`.
  - Pixel diff against round 6 (`diff.py`; a pixel counts as changed if any channel moves by more than 8/255):
    - **Changed:** `11` 75.1%, `08` 51.9%, `08d` 34.3%, `07` 3.8%.
    - **Essentially unchanged (0.0–2.1%):** every other shot, including `08b`, `08c`, `09`–`10b` and all the victory beats `11b`–`11j`. My round-6 readings of those frames still stand.
- **Missing evidence:**
  - **`round-7/candidate/standard/` was missing.** I checked at the start and again just before writing this report. So for the third round running, **no cave cinematic on a Standard course has been rendered**. My Standard findings rest on the probes below.
  - `candidate/EVIDENCE.md` and `candidate/manifest*.json` do not exist. The camera, phase and timestamp of each shot are therefore inferred.
  - `round-7/TESTS.md` had not appeared.
- **Source:** the `5c28419..7b0a5bc` diff of these files:
  - `seaCaveCinematic.ts` (new reveal pose, `:196–211`);
  - `seaCave.ts` (`PORTAL=false`, drums and bones off, boulders bedded at `0.5·r`, gull perches on boulder crowns `:395`, emergence limit back to 24° `:678`);
  - `seaFraming.ts` (high emergence stations and far leap stations removed);
  - `harbourVictory.ts` (catch shot `:147–165`);
  - the new `tests/unit/fjord_reveal.test.ts`.
- **Tests:**
  - `fjord_reveal.test.ts`: **passes.**
  - `fjord_r4_integration`, `fjord_r3`, `fjord_art` and the reveal test together: 21/22. The failure was `P-M6`, which **timed out at 60 s** (load average 6.5 on 2 CPUs). Re-run alone with `--testTimeout=400000`, it **passes**. So it is a load timeout, not a functional failure. It will still show red in a loaded CI run.
- **My own probes** (`scratch/review-c-r7/`; I re-ran my round-6 probes, updated to the shipped round-7 poses):
  - **`seashots7.test.ts` → `seashots7.txt`:** 28 caves (my 25 from round 6 plus seeds R7A–R7C). For each cave it records:
    - the emergence and leap stations (water share, distance, Yeti size on screen);
    - for the **new reveal** at both ends of the move: water share by the shipped `waterFraction`, whether the mouth and the brow (`lipTop`) are inside the frustum and in line of sight, and how many gulls are visible. Gull positions are simulated with the shipped flight model at the reveal's midpoint, 8.55 s;
    - the camera's clearance above the ground and its distance to the nearest island.
  - **`sweep7.test.ts` → `sweep7.txt`:** the reveal pose (ground clearance and water share) on 60 more caves: 30 Standard seeds and 10 Endurance seeds.
  - **`revealimg7.test.ts` → `img7_*.png`:** schematic ray-cast renders of the new reveal frame (sky / sea / snow / steep rock; the mouth and brow marked in red when they are in front of the camera). In round 6 this method matched the real `08`.

## 2. Verdict — **FAIL** (Cinematics 8/10 against the 9/10 target; up from 7.5)

**What round 7 fixed (I checked each one myself):**
- **The Sprint emergence is restored.** `08` is the round-5 frame again: the Yeti is about 27% of full-frame height, with the open fjord, islands and harbour in the upper left. Probe: Yeti at 19% of the field of view on 7/7 Sprint caves (it was 0/7).
- **The far leap specks are gone.** There are no leap stations on non-Sprint caves now, so the ledge camera is used.
- **The cave props are gone:** the grey drums, the bent plate, the lone monolith, the brow icicles and the fish bones.
- **The catch shot (`11`) now looks seaward** over the quay.
- **The coastal reveal now shows water on most Standard caves.** At both ends of the move, 15/21 probed caves reach at least 0.10 water (it was 0/18).

**Why it still fails:**
- **The reveal is a coastal cutaway, not part of the encounter.**
  - It is low over the water looking about 5° up at the cliff foot, so the cave mouth is 1.2–2.0 frame-heights above the top edge.
  - In **0 of 21** reveals is the mouth, the brow or any gull in frame.
  - On about 20% of Standard caves (6/30 in the sweep) it still shows **no water**: a strand flat fills the foreground.
  - On the third Endurance cave (z 13977) **the camera is inside the hillside** in 3 of the 11 Endurance courses I probed.
- **The gull beat is lost (a new regression).** The gulls were moved from the face to the boulder crowns on the snow. The 2.4–3.8 s "brow" shot (`08c`) now shows bare rock with no gull at all, under the caption **"[gulls scream and scatter]"**.
- **On the default course the Yeti and the sea still never share a frame.**
- **The victory sequence is untouched for the fourth round** (the fish gag, the presenter's face, the repeated houses, the roar jaw).

## 3. Scores

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7.5** | The cave apron is much cleaner without the drums, monolith and icicles (`07` vs round 6). But the scanned boulders still sit on the snow with no contact shading, and the big slab in `07` reads as hovering (`r7_07_right.png`). `11` adds a row of untextured coloured blocks in mid-ground. |
| Environmental uniqueness | **8** | The harbour, the reveal over the fjord, the islands and the racks are clearly not Alpine. The new reveal adds a sea-level view of the cliffs on most Standard caves. |
| Skiing and hazard mechanics | **7** (low confidence) | Stills only. Not my area. |
| Difficulty and fairness | **7** (low confidence) | The Hard throw caption still fires on the first throw only (`GameSession.ts:659`). Not otherwise assessed. |
| Cinematics | **8** | Both round-6 regressions are reversed, the leap speck is gone, the catch shot faces the sea, and props no longer clutter the cave shots. Against that: the reveal never shows the cave or the gulls, and it is dry or underground on a sizeable share of caves; the gull beat is now off-screen; and the victory details are frozen. |
| Performance and stability | **7** (low confidence) | 22/22 related unit tests pass, but `P-M6` needs more than 60 s under shared load. No profiling done; `TESTS.md` not available. |
| Accessibility and controls | **7** (low confidence) | The captions are legible. In `08c`, "[gulls scream and scatter]" now describes something not on screen. The Hard throw cue fires once only. |
| Overall player experience | **7.5** | Sprint players get a strong encounter and everyone gets a strong ending. Standard players get a 1.3 s sea-cliff cutaway, then an inland three-quarter shot and a ledge shot. The cave still feels like it is "near" the sea, not "on" it. |

## 4. Defects

**No Critical defects found in my area.**

### 1. Major — The coastal reveal never shows the cave, the brow or the gulls; it is dry on about 20% of Standard caves; on late Endurance caves the camera is inside the terrain (F-024 / C r6 #1: partial)

**Code:** `seaCaveCinematic.ts:199–210`. The camera `sea0 = (footX − 170, water + 22, M.z − 110)` looks at `rim = (rx − 10, water + 22 + tan5°·d, M.z + 30)`, so the frame is tilted only about 5° up. The field of view is 50 → 48, from 7.9 to 9.2 s.

**What works:**
- Water reaches at least 0.10 at both ends on 15/21 probed caves (`seashots7.txt`).
- The Classic Standard schematic (`img7_classic-standard-x-0_reveal.png`) shows a clear sea-level view: water in the lower third, the shadowed cliff face above, a sliver of sky.
- That is a real coastal frame, which round 6's was not.

**What does not work:**
- **Connection to the encounter:**
  - The mouth sits 222–691 m above the sea.
  - With a 5° tilt and a 25° vertical half-field, it projects at `sy` 1.23–2.06 (above the frame top, which is 1.0) on 20/21 caves.
  - The one cave where it is in the frustum (C4J z 7267) has no line of sight to it.
  - **Mouth visible: 0/21. Brow visible: 0/21. Gulls visible: 0/21.** Gulls are simulated at 8.55 s from the new boulder-crown perches.
  - So the beat the code comment describes ("the gulls burst off it and the growl rolls out") is not in the frame. It plays as a generic cutaway to a sea cliff, with no visual cue that the cave is up there.
- **Dry frames:**
  - The 60-cave sweep (`sweep7.txt`) has water 0.00 at one or both ends on **6/30 Standard** and **11/30 Endurance** caves, and below 0.10 on 6 more.
  - The R6A schematic (`img7_custom-standard-R6A-0_reveal.png`) shows a snow strand flat about 4 m above sea level filling the lower half (profile: x − rim −309…−149, h − water +2…+5) with the cliff above it. That frame has no sea.
- **Camera inside the terrain** (the third Endurance cave, z 13977):
  - C4J: 351 m below the ground surface (`camGroundGap −351`; ground at the camera is water + 373 all the way out to rim − 494 m).
  - E7X1: 97 m below the surface.
  - E7X9: 402 m below the surface.
  - The schematic `img7_custom-endurance-C4J-2_reveal.png` is solid ground.
  - At that z the coast has no open water within 500 m of the rim, but the pose is still built from `seaLevelAt` and `footOffset` without any check.
  - Classic Endurance's z 13977 is fine; 3 of the 11 Endurance courses I probed are not.
- **The new unit test does not catch any of this** (`tests/unit/fjord_reveal.test.ts`):
  - It **copies** the pose instead of calling the shipped code, so the two can drift apart.
  - It checks only `sea0` (not `sea1`), and only the **first two** encounters per course, so z 13977 is never tested.
  - It never checks camera clearance or what else is in frame.
  - It uses 28 rays. With the camera 22 m above the water and tilted only 5°, the bottom rows almost always hit water nearby. So "≥ 0.10 water" is close to guaranteed wherever the foreground really is sea. It says nothing about the cave.

**Fix:**
- Aim the reveal so the frame holds the sea **and** the rim/brow above the cave. For example, put the camera farther out (300–500 m) and tilt it so the brow sits at about `sy` 0.6 and the waterline at about −0.6, or use a longer lens from farther out. Then make sure the gulls (or a second flock spawned at the brow) are in that frame.
- Build the pose through a single shared function that both `seaCaveCinematic.ts` and the test call.
- At build time, reject the pose when any of these fail, and fall back to the three-quarter shot:
  - camera clearance ≥ 10 m above both terrain and island height;
  - water ≥ 0.15 at both ends;
  - the brow inside the frame with a clear line of sight.
- Extend the test to every encounter on every finite length (including the Endurance z 13977 cave) and to both ends of the move.

### 2. Major — The gull beat is now off-screen: `08c` shows bare rock under "[gulls scream and scatter]" (new regression)

**Evidence:**
- **`08c` (round 7):** about 85% of the frame is bare rock face and the mouth is cut off at the bottom. There is **no gull anywhere**, while the caption reads "[gulls scream and scatter]".
- **`08c` (round 6):** there was at least one gull taking off from the face (x 1500–1570, y 575–670). The 1.0% pixel change is that gull and the removed column/icicles.

**Cause:**
- `seaCave.ts:395`: the perches are now the boulder crowns, 7–14 m out on the snow, all with `brow:false`. The column tops that carried the brow perches are gone (`PORTAL=false`).
- The 2.4–3.8 s shot still frames the brow (`seaCaveCinematic.ts:161–164`, look point `lipTop` and the comment "the gulls on the portal").
- The gulls take off at 2.5 s from below the frame and fly outward, away from it.
- The probe confirms they are not in the later reveal either. **In the default-length cinematic the gulls are heard and captioned but never clearly seen.**
- In `07` I cannot identify any gull perched on the boulder crowns either (`r7_07_right.png`). There are only sub-10-px slivers.

**Fix:** re-aim the 2.4–3.8 s shot at the boulder apron (or a three-quarter view of mouth and apron) so the take-off is in frame, or perch some gulls on ledges of the face itself (face samples near `lipTop`, as perches with `brow:true`). Add a test that projects the gull homes into the slough frame and requires at least 3 inside.

### 3. Major — Cave apron: the scanned boulders still read as placed on the snow, not bedded in it (F-023 / C r6 #4: partial, much narrower)

**Fixed:** the drums, the plate, the monolith column, the brow icicles, the ladder-like bones and the stick props are all gone (`07`, `08`, `08d` compared with round 6).

**Remaining:**
- The boulders have no contact shadow and no drift banked against them. The extra bedding (`gy − 0.5·r`) is not visible on screen.
- In `07`:
  - the 1005–1170 × 875–960 slab has a lit, dark underside with a straight lower edge against flat snow, and reads as hovering (`r7_07_right.png`);
  - the 445–490 × 910–1020 shard is a thin upright fin;
  - small chips sit loose (x 975–1035, y 790–820).
- In `08`, the 415–580 × 740–860 boulder is snow on every face, so it reads as a white lump, not rock (`r7_08_boulders.png`).

**Fix:** a blob/contact shadow (or an AO decal) under every boulder; a drift ring (a snow-coloured skirt that blends into the terrain normal); cap the snow coverage on small scans (`snowFrom`) so the rock still shows; reject picks whose aspect gives a thin fin.

### 4. Major — On the default course the Yeti never shares a frame with the sea (F-024 core, carried over)

**Evidence:**
- On non-Sprint caves, `seashots7.txt` gives **emergence stations 0/21 and leap stations 0/21**.
- So after the 1.3 s reveal (defect 1), the player sees:
  - 9.2–11.0 s: the inland three-quarter shot;
  - 11.0 s: the roar (the cave face);
  - 14.6 s: the ledge camera, looking inland from behind the Yeti.
- None of these frames has water.
- That is better than the specks of round 6, but the brief's "coastal reveal" around the Yeti still happens only on Sprint.
- **No rendered Standard shot exists to show otherwise** (`candidate/standard/` missing).

**Fix:** for inland-facing mouths, add one wide shot where the Yeti and the sea are both in frame, for example a high crane behind and above the rim looking down across the cave toward the fjord. Or, once defect 1 is fixed so the reveal includes the brow, cut to it on the roar so that the Yeti and the sea are in consecutive shots. Assert in a test that at least 90% of caves on each finite length have one shot with ≥ 0.10 water and the Yeti ≥ 10% of frame height in that shot or the next.

### 5. Minor — Catch shot (`11`): the sea is there now but only as a thin band; the skier is cropped and seen from behind (F-025 / C r6 #3: mostly fixed)

**Evidence:**
- `11` now looks over the square to the quay, the fjord, the islands and the string lights. That is a real fix (`harbourVictory.ts:147–165`).
- But the water is a strip of about 2–3% of the frame (y ≈ 405–465), partly hidden by booths and people (`r7_11_bg.png`).
- The skier is cut off at the waist by the frame's lower edge (x 1200–1400, y 600–960), and we see the back of the head.
- The ring ski tracks are still prominent (x 500–1500, y 840–960).
- A row of flat-shaded coloured blocks ending in an orange ball sits in mid-ground (x 825–1175, y 505–570; `r7_11_blocks.png`). It reads as toy blocks or placeholder geometry.

**Fix:**
- Pull the camera back or up 1–2 m so the skier is at least head-to-knees in frame.
- Turn it 15–20° so both faces read.
- Lower the look point so the water band grows to at least 8%.
- Texture the crates or replace them with the stockfish/crate props.

### 6. Minor — The roar lost its falling ice

With `PORTAL=false` there are no brow icicles, so the falling-icicle beat and its impact cue (`seaCaveCinematic.ts:229–234`, `11.2–11.8 s`) do nothing. The roar is now sea smoke and spray only (`08d`). It still works, but it is less punchy. If the icicles return, hang them from the actual lip (C r6 #4).

### 7. Minor — Victory blemishes, the fish gag, the presenter's face and the roar jaw: unchanged (C r6 #6–#10)

These frames are pixel-unchanged against round 6 (0.0–1.6%):
- `11j` and `11h` still show eight identical gable houses (F-032).
- `11b`: the box under the sauna deck and the hanging ladder rungs.
- `11h`: the straight-sided crown splash.
- `11c`: the chute groove above the beacon.
- `11j`: the skier on the roof ridge.
- `11f` and `11f2`: the flat olive cut-out cod; the snarl reads as menace, not retching.
- `11g`: the face hidden behind the trophy.

In `08d` the frame moved (34% changed, the column is gone), but the beard cards still hang in front of the open mouth and the jaw is still a hard dark box (`r7_08d_mouth.png`).

### 8. Minor — Other carry-overs

- `07b`: the translucent wedge seam remains.
- The Hard throw cue is still first-throw-only (`GameSession.ts:659`).
- `fjord_r4_integration.test.ts` `P-M6` needs more than 60 s under load and times out in a parallel run. Raise its timeout or lighten it.

### What I could not verify

- **Any Standard-length cave shot on screen** (`standard/` missing). Defects 1, 2 (for Standard) and 4 rest on the probes and schematics; the schematic method matched the real `08` in round 6.
- **That the Yeti is grounded from his first visible frame.** There is no shot of him before 7.9 s.
- **Motion, camera smoothness and audio sync.**
- **The camera and timestamp of each shot** (there is no manifest).

## 5. What works

- **The Sprint encounter is good again.** `08` has a close Yeti beside the portal over the fjord and harbour. `08b` is the clean mid-air leap against the portal with the islands and the harbour.
- **The cave apron is calm and readable** now that the prop clutter is gone. The opening is natural and irregular, and the darkness is controlled (`07`, `08`, `08d`).
- **Where it has water, the reveal pose is a credible sea-level look up the cliffs.** It needs re-aiming, not replacing.
- **The catch shot finally faces the harbour mouth.**
- **The ending is unchanged and still the best part of the build:** the establishing shots (`10`, `10b`), the quay (`11d`), the plunge silhouette (`11j`) and the title reveal over the fjord (`11c`, `11i`).

## 6. Round-6 defects and tracker items (my own verification)

| Round-6 C # / tracker | Status | Basis |
|---|---|---|
| #1 / F-024: the reveal frames a blank cliff | **Partial** | Water ≥ 0.10 on 15/21 caves (was 0/18). But the mouth, brow and gulls are in frame on 0/21; it is dry on 6/30 Standard and 11/30 Endurance caves in the sweep; and the camera is inside the terrain on 3 Endurance caves (defect 1). |
| #2: the Sprint emergence regressed | **Fixed** | `08` is back to the round-5 framing; the probe gives Yeti 19% of the field of view, 15 m, 23° downward on 7/7 Sprint caves. |
| #3 / F-025: the catch shot is inland | **Mostly fixed** | `11` looks seaward. The water is thin and the skier is cropped (defect 5). |
| #4 / F-023: the cave dressing reads as props | **Partial (much improved)** | The drums, plate, monolith, icicles and bones are gone. The boulders still lack contact (defect 3). |
| #5 / F-024: the default leap is a speck | **Fixed (as a speck)** | No far leap stations remain; the ledge camera is used. No sea in that shot (defect 4). |
| #6 / F-032: repeated houses | **Not fixed** (open) | `11j`, `11h` unchanged. |
| #7: victory blemishes | **Not fixed** | Defect 7. |
| #8: fish gag | **Not fixed** | Pixel-identical. |
| #9: presenter's face | **Not fixed** | `11g`. |
| #10: roar jaw | **Not fixed** | `08d` crop. |
| #11: other carry-overs | **Partial** | The `08c` column and icicles are gone, but `08c` is now gull-less (defect 2). `07b` seam remains. The Hard throw cue is unchanged. |
| F-003: black cave | **Still fixed** | `07`, `08`, `08d` |
| F-005: plunge water reads as snow | **Still fixed** | `11b`, `11h`, `11j` |
| F-014: gag and presenter | **Not fixed** | Defect 7 |
| — (new): gull beat lost | **Regressed** | Defect 2 |

The tracker (`DEFECTS.md`) has not been updated for round 7: F-023, F-024 and F-025 still read "CLAIMED" with round-4/5 evidence.

## 7. Public-preview gate (completion brief §10) — my area

| Gate item | Status | Evidence |
|---|---|---|
| No critical defect or unrecoverable state in the cave cinematic or the victory | **met (stills and unit tests)** | No Critical found. The camera inside the terrain (defect 1) lasts 1.3 s and is not a lock. |
| No major regression in a signature cinematic | **not met** | The gull beat is lost (defect 2), and on some Endurance caves the reveal camera is inside the terrain (defect 1). The round-6 regressions are reversed. |
| Cave: natural opening, controlled darkness | **met** | `07`, `08`, `08d` |
| No floating props or clipping in the cave | **partially met** | The free-floating props are gone. The boulders still read as perched, and one slab reads as hovering (defect 3). |
| The Yeti grounded from his first visible frame | **not evidenced** | No shot before 7.9 s. In `08` the feet meet the snow, but there is no contact shadow. |
| Coastal reveal in the encounter (sea, cliffs, birds, mist, sound) | **met on Sprint; partially met on Standard** | Standard has sea and cliffs on about 80% of caves (probe), but no birds and no cave in that frame, and the Yeti never appears with the sea (defects 1, 2, 4). No Standard renders exist. |
| Water that is not snow | **met** | `11b`, `11h`, `11j` |
| Buildings not floating or repeated | **not met** (repetition) | `11j`, `11h` (F-032) |
| Trophy staging | **partially met** | `11` (skier cropped, thin sea), `11g` (face hidden) |
| No inland-facing shots | **met in the victory; not met in the Standard cave sequence** | `11` now faces the sea. The non-Sprint emergence, roar and leap all face inland (defect 4). |
| Fish gag | **met** (minor polish) | `11f`, `11f2` |
| Ending on the ocean and mountain reveal | **met** | `11c`, `11i` |

**Gate result for my area: not met.** No defect is Critical, and this round is a genuine improvement over round 6. But there are four Majors, one of them a new regression (the gull beat), and the default-length encounter still never puts the Yeti and the sea together. The gate is not lowered.
