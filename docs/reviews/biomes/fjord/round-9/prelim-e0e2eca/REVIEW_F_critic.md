# Fjord Coast, round 9: Reviewer F (Hostile Game Critic)

- **Reviewer:** F, Hostile Game Critic
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `e0e2eca` (branch `pass4-fjord`); most stills from `c9ffd1b`
- **Date:** 2026-11-14
- **Evidence used**
  - I viewed these at full size: `08c` (Sprint and Standard), round-8 `08c`, `15`.
  - I viewed these as half-size contact sheets (`scratch/review-f-r9/s_*.png`): `07`, `07b`, `08`, `08b`, `08d` (Sprint and Standard), and `01`, `02`, `06`, `09`, `11c`, `16`.
  - Crops and before/after pairs, round 8 against round 9, in `scratch/review-f-r9/`:
    - `cmp07_mouth.png`, `cmp14_crest.png`, `cmp10_shore.png`
    - `crop08c_smudge.png`, `crop08c_boulder.png`, `crop07std_boulders.png`, `crop07std_mouth.png`, `crop08cstd_wall.png`
  - Pixel difference against round 8 for every shot (`diff.py`). I also measured the contrast of the instruction pill in `15`.
  - Source:
    - I checked `git diff c9ffd1b e0e2eca -- src`. The claim holds: only `src/world/caveTerrain.ts` changes.
    - I read `git diff d1f642b e0e2eca` for `seaCave.ts`, `seaCaveCinematic.ts`, `presentation/cave.ts` and `SkierPhysics.ts`.
    - I read `round-9/DEFECTS.md` and `candidate/EVIDENCE.md` as claims to verify.
  - **Headless re-run:** I re-ran my round-6/7/8 harness without changes (`scratch/review-f-r9/wind.test.ts`). Seeds `CRITG01`–`06`, Normal Sprint, Fjord and Alpine, drivers `read`/`wrong`/`skilled`: 30 runs in `critg_normal.jsonl`, 24 s total, run once under `nice`.
  - `npx vitest run tests/unit/pin_rescue.test.ts tests/unit/fjord_reveal.test.ts` passed 5/5.
- **Not available:** `round-9/TESTS.md` had not appeared by the time I finished.

## Verdict: FAIL against the 9/10 target. Overall 8 / 10: down from 8.5, and exactly at the public-preview threshold.

Round 9 is a round of invisible fixes. Measured against round 8, 30 of the 36 primary shots change by less than 1 % of pixels. That includes every hero view: `01`, `02`, `06`, `11c` and `16`. I named five things in round 8. Only one of them visibly changed: the cornice-relocation instruction now sits on a dark pill, and I measured it at about 10:1. The rest is still on screen:
- The Sprint difficulty step is still smaller than seed noise. My re-run is bit-identical: 30/30 runs, max |Δt| = 0.00 s.
- The closing reveal `11c` (terraces, crater ring, fluted wall, grey curtain) is unchanged at 0.3 %.
- The menu-sea streaks, the sugarloaf and the Alpine-like Expedition middle are unchanged.

The tracker is candid that F-039, F-050 and F-051 are still open.

The one shot that changed a lot is the gull beat, `08c` (64 % of pixels changed). It has lost the thing I praised in round 8.
- **Round 8:** gulls lifted off the boulders in front of a black sea-cave mouth, with the Yeti a shape in the dark.
- **Round 9:** a flock of low-poly gulls against an open piste, with the start gate and a stand of conifers. No cave, no sea and no Yeti.

The code says the camera "looks out past it toward the sea". It looks along `cave.outward` (`seaCaveCinematic.ts:82`, `:191`). The evidence manifest itself says that direction faces inland, toward the piste. Reviewer C's round-8 complaint (the Yeti visible before his growl) is fixed, but the fix trades a Fjord shot for a shot that could be Alpine.

**New this round:** I could see the Standard cave set (the default length) for the first time. It shows the sea in at most one of six frames, and there only as a pale sliver (`standard/08c`). The emergence, which the manifest captions as "the Yeti against the fjord", is the Yeti against rock and snow (`standard/08`). The leap `standard/08b` is a Yeti over an Alpine slope in front of a horizontally banded, pepper-dotted wall.

Since I scored round 8 from the Sprint set alone, a player on the default course gets a weaker signature sequence than I credited. The Sprint foreshadow shot `07` also has a **new pale shard** floating inside the cave mouth, with blue see-through gaps at the back of the chamber. Round 8 had neither (`cmp07_mouth.png`).

None of this breaks the game:
- the run is winnable;
- the harbour finish from `11d` to `11j` is still this location's best material;
- the pin rescue is now fairer in code.

But a player who loves Alpine and picks Fjord on the default length meets an Alpine-looking cave cinematic in the first third and an ugly terrain frame at the very end. That is 8, not 8.5. I am not rounding up.

## Scores

| Category | R8 | **R9** | Justification |
|---|---:|---:|---|
| Visual art direction | 8 | **8** | Hero views unchanged (≤ 0.3 % pixel change in `01`, `02`, `06`, `11c`). The far crests at the viewpoint are a little rounder but still gabled and banded (`cmp14_crest.png`). New problems pull the other way: the shard in Sprint `07`; the "bedded" boulders now read as sheared plates with paper-flake snow (`crop08c_boulder.png`, `crop07std_boulders.png`); the Standard cave wall is banded and pepper-dotted. Held at 8 only because the main frames did not get worse. Low-moderate confidence (A's primary). |
| Environmental uniqueness | 8.5 | **8** | First look at the Standard cave set: the sea is effectively absent from the default course's signature cinematic (0–1 of 6 frames). The gull beat now looks at the piste. The Expedition middle (`16`) and the start (`02`, sugarloaf) are unchanged. The archipelago, menu and harbour are still unmistakably Fjord. |
| Skiing and hazard mechanics | 7.5 | **7.5** | Gameplay is bit-identical to round 8 in my harness (30/30). The wind gate is still a decision: the wrong side costs +2.2 to +12.3 s per Normal Sprint on these seeds. The cave boulders are now colliders (`seaCave.ts` `solids`), which I did not probe. |
| Difficulty and fairness | 7.5 | **7.5** | The rescue is fairer in code: only tuck without brake counts as "trying to get going", and the rescue is no longer a crash (`SkierPhysics.ts:1017`, `relocate(..., false)`). The Sprint ladder is unchanged: the Fjord is faster than Alpine on CRITG03 (151.3 vs 159.0 s). |
| Cinematics | 8 | **7.5** | **Down:** the gull beat lost the cave, the sea and the dark-mouth foreshadow (D2). The Standard emergence and leap show no fjord (D3). The Sprint `07` shard is a regression (D4). The closing reveal `11c` is unchanged and still the weakest hero frame (D5). **Held:** Sprint `08`, `08d`, `08b`, and the harbour gag through the plunge are strong. Partly C's area. |
| Performance and stability | 7 (lc) | **7 (lc)** | **Low confidence.** `EVIDENCE.md` / `perf/` (CPU only; I did not re-measure): Fjord median 3 ms vs Alpine 0.5; frames > 8 ms 4785 vs 435 (11×); p99 11.9 vs 8.2; 0 frames > 33 ms in either. Heap 159 vs 122 MB. Inside a frame up to p99, but a much heavier location. No errors in my runs. |
| Accessibility and controls | 7 (lc) | **7.5 (lc)** | **Low confidence.** The relocation rule is now on a dark pill, about 10:1 (`15`, rows 280–306). The caption and the "WIPEOUT!" chip still stack under it. `TESTS.md` is absent, so I cannot speak to keyboard/pad or menu runs. |
| **Overall player experience** | 8.5 | **8** | No visible progress on any of my round-8 Majors except legibility. The one reworked cinematic beat is less Fjord than before. The default-length cave sequence, seen for the first time, barely shows the coast. Still a worthy second location on Sprint, and still not a reskin, but the gap to 9 grew. |

## My measurements

### Pixel change, round 8 → round 9 (mean absolute luma / share of pixels changing by more than 20)

- **`08c`: 60.7 / 64.1 %.** New gull framing: the piste behind, no cave, no sea.
- **`08d`: 5.3 / 5.8 %.**
- **`07`: 2.6 %.** The new shard and gaps.
- **`10`: 2.1 %.** The wet band, barely perceptible (`cmp10_shore.png`).
- **`15`: 1.9 %.** The pill.
- **`14`: 1.1 %.** Crests softened, top 465 rows only.
- **Every other shot ≤ 1.1 %,** including `01`, `02`, `06`, `11c` and `16` at ≤ 0.3 %.

### Gameplay (30 runs, Normal Sprint)

- Identical to round 8 in every run (max |Δt| = 0.00 s). One crash in total, all victories.
- Fjord `read` vs Alpine `read`, in seconds:

| Seed | Fjord | Alpine |
|---|---|---|
| CRITG01 | 154.8 | 145.2 |
| CRITG02 | 163.5 | 143.2 |
| CRITG03 | **151.3** | **159.0** |
| CRITG04 | 166.6 | 148.2 |
| CRITG05 | 170.0 | 161.8 |
| CRITG06 | 156.7 | 148.8 |

- On CRITG03 the Fjord is faster than Alpine. The round-6/7 24-seed result (the Fjord faster on 9/24) therefore stands.

### Contrast of the instruction pill

- `15`, text row y 280–306, x 670–1250: about **10.3:1** (was 1.07:1).

## Defects

### D1. Major: the Sprint ladder is still within seed noise (F-039 OPEN; round-6 D4, round-7 D3, round-8 D1)

**Evidence:** bit-identical gameplay, and the Fjord is faster than Alpine on CRITG03 (above). No source change touches pace, hazards or profile.

**Fix:** use a per-course gate and squall floor, or calibrate against the Alpine course with the same seed, so that F − A > 0 on ≥ 22/24 seeds. Add that as a unit test.

### D2. Major (cinematic regression in identity): the gull beat now looks at the piste, not the sea (F-037)

**Evidence**
- `08c` (Sprint) shows gulls, the start gate and windsock (about 520–650 × 300–380), conifers and an open snow bowl. There is no water pixel and no cave.
- Code: `seaCaveCinematic.ts:191`, where `lookG = c + O*5` and `O = cave.outward` (`:82`). The comment at `:185-187` says "looks out past it toward the sea". The manifest's own caption for `07b` says the mouth "faces inland, toward the piste". Outward is therefore inland.
- `standard/08c` shows the gulls against a horizontally banded, boulder-peppered valley wall (`crop08cstd_wall.png`), with a sea sliver at about 1650–1800 × 400–500.
- C's complaint (the Yeti before his growl) is fixed. The location's identity in this beat is lost.
- **Also:** an unexplained dark smeared blob floats in mid-air at about 660–780 × 430–450 (`crop08c_smudge.png`).

**Fix:**
1. Aim the gull shot at the sea side: `-T*side`, or the direction of the nearest water sample from `seaFraming`.
2. Assert in `fjord_reveal.test.ts` that the shot includes ≥ 10 % water and excludes the mouth.
3. Find and remove the dark smear.

### D3. Major: the Standard (default length) cave cinematic shows no fjord (F-024, F-038 not met on screen)

**Evidence** (`standard/07`, `07b`, `08`, `08b`, `08d`)
- In 0 of 5 frames does the sea read as the sea. In `standard/08c` it is a sliver.
- `standard/08` is captioned "the Yeti against the fjord": he is against rock and snow.
- `standard/08b` is the leap over an Alpine-like slope in front of a terraced, pepper-dotted wall.
- The tracker's "emerge 15/18" claim is not borne out by the one Standard set provided.

**Fix:** apply the Sprint framing logic (high or far station, sea behind the Yeti) to the emergence and leap on every course, and gate it with a water-fraction test per shot. For the wall:
- smooth its banding at that distance;
- thin the pepper boulders.

### D4. Major (regression): a pale shard and see-through gaps inside the Sprint cave mouth (`07`, new in `e0e2eca`)

**Evidence:** `cmp07_mouth.png` (round 8 on the left, round 9 on the right; crop 760–1120 × 400–700 of `07`):
- A white, blade-shaped sliver hangs in the dark of the chamber at about 940–960 × 480–560.
- Two blue patches at the back of the chamber, at about 1130–1200 × 470–500, show sky or fog through the rock.
- Round 8 had neither. The Standard mouth is clean (`crop07std_mouth.png`).
- This is exactly the "pale floating shard" failure from round 2 (A4) that `seaCave.ts:302-304` was written to avoid.

The only `src` change since `c9ffd1b` is the jamb cap in `caveTerrain.ts:357-368`. That makes it, or the boulder and terrain-streaming changes, the prime suspect. I could not render to confirm.

**Fix:**
1. Probe those pixels with `probe-cave` to name the object.
2. If the terrain is involved, restrict the jamb cap to the mouth's actual jamb width, or keep the chamber floor mesh covering it.
3. Add the Sprint `07` mouth to the dark-chamber pixel test.

### D5. Major: the closing reveal is still the weakest hero frame (F-051, F-050 OPEN; round-8 D2)

**Evidence:** `11c` changed by 0.3 %. Still present:
- the stepped contour terraces and the crater ring at about 1260 × 500;
- the fluted organ-pipe wall at 690–1000 px;
- the grey curtain on the headland with a vertical smear.

The run still ends on a terrain close-up, not an ocean/mountain payoff.

**Fix:** as in round 8: re-aim so that the sea and the archipelago fill at least 40 % of the frame, smooth the normals, and put scan rock on the headland.

### D6. Minor: cave boulders read as sheared plates with paper snow (F-040 claimed; not fixed on screen)

**Evidence:** `crop08c_boulder.png` and `crop07std_boulders.png`.
- Cut at the waist, the scans show a flat sawn top under a separate flat snow sheet.
- Detached white flakes float around the 08c foreground boulder.
- One boulder in `standard/07` reads edge-on as a needle (lower left, about 300 × 960).
- There is still no blended drift collar.

**Fix:** a snow skirt that blends into the terrain normal (a decal, or vertex-blended terrain), instead of separate cap sheets. Vary the bedding depth so that some crowns stay rounded.

### D7. Minor: the cave-outlook wedge is unchanged (round-7 D13, round-8 D14)

The pale vertical translucent quad is still there in `07b` and `standard/07b`, at about 1430–1520 × 640–860 of the right half.

### D8. Minor: the menu-sea streaks, the sugarloaf and the Alpine-like Expedition middle are unchanged (round-8 D10, D11, D5; F-029 OPEN)

`01`, `02` and `16` changed by ≤ 0.3 %. These are the first two images a player sees, plus the longest stretch of the Expedition run.

### D9. Minor: victory details are unchanged (F-042 OPEN; round-8 D7, D8, D9)

- `11g`: the trophy hides the presenter's head.
- `11h`: the splash crown is a straight-walled cylinder.
- The plaza box row is unchanged.
- The chips are unchanged (F-032).

### D10. Minor: the wet band and the crest softening are barely visible (F-048, F-049 claimed)

- **Wet band:** `cmp10_shore.png` shows no perceptible wet band at the finish waterline at this distance.
- **Crests:** `cmp14_crest.png` shows the viewpoint massif's peaks a little blunter, but still gabled, horizontally banded and putty-grey.

### D11. Minor: the rescue claim has no unit test for its new rule

- `pin_rescue.test.ts` has 4 cases, all "drive into the pocket, get back".
- Nothing asserts the round-9 rule, that standing still and steering (or braking) never triggers the rescue. The tracker's "17/17" does not match the 4 tests in that file.
- **The code itself is correct:** `pushSince` resets unless the skier holds tuck without brake (`SkierPhysics.ts:1017`). A skier standing against a wall (`walled`) is still relocated, which is the intended behaviour.

**Fix:** add the "stand still with a steer or brake key held for 10 s, off-piste, with no wall" case.

### D12. Minor (process): `TESTS.md` is absent

The gate's "all automated tests pass" and "keyboard and controller work" items are unverified.

## What works

- **The relocation instruction is now readable** (10:1, on a pill). This was my round-8 accessibility Major.
- **The Sprint cave cinematic `08`/`08d`/`08b`** is still a fine set-piece: the Yeti at the iced mouth with the archipelago and harbour behind, the roar with spray, and the leap.
- **The harbour finish**, from the stockfish gag to the cannonball, is unchanged and remains Fjord's best material. Nothing in Alpine compares.
- **The rescue logic is fairer** (no crash, no misfire on steer). Gameplay is otherwise untouched and fully deterministic. All 30 runs won.

## Status of round-8 defects (my own verification)

| R8 # | Defect | Status | Evidence |
|---|---|---|---|
| D1 | Major: Sprint ladder in seed noise | **Not fixed** | 30/30 identical; CRITG03 F < A |
| D2 | Major: closing reveal `11c` | **Not fixed** (0.3 %) | D5 |
| D3 | Major: the relocation rule is unreadable | **Fixed** | `15`, about 10.3:1 |
| D4 | Minor: crude gulls; featureless `06` wall | **Not fixed.** Gulls are the same models, now larger in frame; `06` changed by 0.3 % | `crop08c_smudge.png` |
| D5 | Minor: Expedition middle reads Alpine | **Not fixed** | `16`, 0.3 % |
| D6 | Minor: perched cave boulders | **Partial.** Bedded deeper, now read as sheared plates | D6 |
| D7 | Minor: trophy hides head | **Not fixed** | `11g`, 0.0 % |
| D8 | Minor: splash rim | **Not fixed** | `11h`, 0.1 % |
| D9 | Minor: waterfront and plaza | **Not fixed** this round | `10`/`11` |
| D10 | Minor: start and sugarloaf | **Not fixed** | `02`, 0.4 % |
| D11 | Minor: menu sea streaks | **Not fixed** | `01`, 0.3 % |
| D12 | Minor: scoured plates | **Not fixed** | `04b`, 0.2 % |
| D13 | Minor: deserts, Hard Standard, gimme | **Not fixed** | Unchanged code |
| D14 | Minor: wedge in `07b` | **Not fixed** | D7 |
| D15 | Minor: hamlet strand wedge | **Not fixed** | `06`, 0.3 % |
| D16 | Minor (process): incomplete evidence, contaminated perf | **Partial.** `standard/` and `res-*` are present, and perf was re-captured (`EVIDENCE.md`). `TESTS.md` is absent | D12 |

## Status of tracker items in my area (my verification)

| ID | Status |
|---|---|
| F-021 (pinned skier) | **Fixed as far as I test.** `pin_rescue` 4/4; 0 pins in 30 runs |
| F-024 (sea in Standard cave shots) | **Not met on screen** (D3) |
| F-029 (sugarloaf) | **Open, confirmed** |
| F-037 (gull beat) | **Partial / regressed in identity.** Gulls fill the frame and the Yeti is hidden, but the shot looks inland (D2) |
| F-038 (coastal reveal) | **Not evidenced as a sea reveal** on the Standard set (D3) |
| F-039 (Sprint ladder) | **Open, confirmed** (D1) |
| F-040 (boulder collars and solidity) | **Partial.** Deeper bedding and colliders in code; on screen they are sheared plates (D6) |
| F-041 (hamlet strand) | **Open** |
| F-042 (victory details) | **Open** |
| F-046 (rescue misfire) | **Fixed in code** (`SkierPhysics.ts:1017`, `:1032`). The new rule has no unit test (D11) |
| F-047 (relocation legibility) | **Fixed** (10.3:1) |
| F-048 (wet band) | **Not visible** at the evidence distances (D10) |
| F-049 (needle crests) | **Partial** (D10) |
| F-050, F-051 (headland, closing reveal) | **Open, confirmed** (D5) |

## Public-preview gate (completion brief §10), for my area

| Item | Status | Evidence |
|---|---|---|
| Hostile-critic Overall ≥ 8 | **Met, at exactly 8** | Scores above |
| No critical gameplay or physics defects; no unrecoverable states | **Met as far as I tested** | 30/30 won, 0 pins; `pin_rescue` passes |
| All finite lengths completable | **Sprint met** (my runs). Others not run by me this round | |
| No major regression in a signature cinematic | **At risk, not met cleanly.** The gull beat lost its location identity (D2), and the Sprint `07` shard is a regression (D4). I rate these Major, not Critical: the sequence still plays and lands | D2, D4 |
| All automated tests pass | **Not verified.** `TESTS.md` absent; the 2 files I ran passed 5/5 | |
| No major performance regression | **Not judged** (D's area). CPU numbers show the Fjord about 11× Alpine in frames > 8 ms, but p99 under 16.7 ms | `EVIDENCE.md` |
| Art direction ≥ 8 | **Met on my reading (8)**; A's score is the gate figure | |

**Gate result for my area:** the critic threshold is met at the minimum, with no margin. I would hold the preview until:
- D4 (the shard in the cave mouth) is fixed;
- the gull beat is turned to the sea (D2);
- `TESTS.md` shows a clean run.

**Path to 9:**
1. Put a floor under the Sprint ladder (D1).
2. Show the sea in the cave cinematic on every length (D2, D3).
3. Make the closing reveal a sea-and-mountain payoff (D5).
4. Blend the boulders into the snow (D6).
5. Fix the first two images a player sees: the menu streaks and the sugarloaf (D8).
