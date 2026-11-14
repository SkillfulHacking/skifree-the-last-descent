# Fjord Coast, round 9 (final): Reviewer F (Hostile Game Critic)

- **Reviewer:** F, Hostile Game Critic
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `3bf5a7e` (branch `pass4-fjord`). Cave and cinematic shots were re-rendered on `3bf5a7e`; the rest are from `c9ffd1b`.
- **Date:** 2026-11-14
- **Preliminary report on `e0e2eca`:** `round-9/prelim-e0e2eca/REVIEW_F_critic.md`. This report replaces it.

### Evidence used

- **Source diffs**
  - `git diff c9ffd1b 3bf5a7e -- src` touches only `src/world/caveTerrain.ts`, as `EVIDENCE.md` claims.
  - `git diff e0e2eca 3bf5a7e -- src` narrows the jamb cap: the new `JAMB_CAP.cd` is 1.6, against the earlier `cd < 2.6`. The chamber-wall margin drops from 1.5 m to 0.5 m.
  - `git diff 3bf5a7e HEAD -- src tests` is empty.
- **Images viewed at full size:** `08c` (Sprint and Standard), round-8 `08c`, `15`.
- **Images viewed as half-size contact sheets** (`scratch/review-f-r9/`):
  - all six Sprint and Standard cave/cinematic shots on `3bf5a7e` (`s3_cave_sprint.png`, `s3_cave_std.png`);
  - `01`, `02`, `06`, `09`, `11c`, `16` (`s_main.png`).
- **Before/after crops and pairs** (`scratch/review-f-r9/`):
  - `cmp07_mouth.png` (round 8 vs `e0e2eca`) and `cmp07_mouth_3bf.png` (round 8 vs `3bf5a7e`);
  - `cmp14_crest.png`, `cmp10_shore.png`;
  - `crop08c_smudge_3bf.png`, `crop08c_boulder.png`, `crop07std_boulders.png`, `crop08cstd_wall.png`.
- **Measurements:** pixel difference against round 8 for every shot (`diff.py`), and contrast of the instruction pill in `15`.
- **Headless re-run on `3bf5a7e`:** my unchanged round-6/7/8 harness (`scratch/review-f-r9/wind.test.ts`).
  - Seeds `CRITG01`–`06`, Normal Sprint, Fjord and Alpine.
  - Drivers `read`, `wrong`, `skilled`; 30 runs, output in `critg_normal_3bf.jsonl`.
  - The same harness on `e0e2eca` is in `critg_normal.jsonl`.
- **Unit tests:** `npx vitest run tests/unit/pin_rescue.test.ts tests/unit/fjord_reveal.test.ts` passes 5/5 on `3bf5a7e`.
- **Claims to verify:** I read `round-9/TESTS.md`, `round-9/DEFECTS.md` and `candidate/EVIDENCE.md` as claims.

## Verdict: FAIL against the 9/10 target. Overall 8 / 10 (round 8: 8.5). Meets the public-preview threshold, with no margin.

Most of round 9's fixes cannot be seen on screen. Against round 8, every hero view is unchanged within 0.3 % of pixels: `01`, `02`, `06`, `11c`, `16`.

Of the five things I named in round 8, only one changed visibly. The cornice-relocation rule now sits on a dark pill, at about 10:1 contrast. The rest is unchanged:
- **Sprint ladder:** the difficulty step is still smaller than seed noise. My re-run on `3bf5a7e` matches round 8 exactly (30/30, max |Δt| = 0.00 s).
- **Closing reveal `11c`:** unchanged.
- **Opening and middle:** the menu-sea streaks, the sugarloaf and the Alpine-like Expedition middle are unchanged.

**The regression I found in the preliminary review is fixed.** On `e0e2eca`, a pale shard floated inside the Sprint cave mouth and there were see-through gaps at the back of the chamber. On `3bf5a7e` the mouth matches round 8 (`cmp07_mouth_3bf.png`).

**The gull beat has lost its Fjord identity.** In round 8, the gulls lifted in front of a black sea-cave mouth with the Yeti in the dark behind them. In round 9 the shot shows low-poly gulls against an open piste, with the start gate and conifers. There is no cave, no sea and no Yeti.
- The code comment says the camera looks "toward the sea".
- The camera actually looks along `cave.outward` (`seaCaveCinematic.ts:82`, `:191`).
- The manifest itself says the mouth faces inland, toward the piste.

**On the Standard course, the default length, the cave cinematic shows no sea in any of its six frames** (`standard/07`–`08b`). The emergence, captioned "the Yeti against the fjord", puts the Yeti against rock and snow. The leap happens over an Alpine-looking slope, in front of a banded wall dotted with boulders.

None of this breaks the game:
- the run is winnable;
- the browser suite and the unit suite pass;
- the harbour finish is still this location's best material.

But on the default length, a player who loves Alpine and picks Fjord gets a cave cinematic that looks Alpine in the first third of the run. At the very end they get a terraced terrain close-up. That is an 8, not an 8.5, and I am not rounding up.

## Scores

| Category | R8 | **R9** | Justification |
|---|---:|---:|---|
| Visual art direction | 8 | **8** | Hero views unchanged (≤ 0.3 %). The viewpoint crests are slightly blunter, but still gabled and banded. The Sprint mouth is clean again. Weaker points: the cave boulders read as sheared plates with flat snow caps, and the Standard cave wall is banded and dotted with boulders. Low-moderate confidence (A's primary). |
| Environmental uniqueness | 8.5 | **8** | The default length's cave cinematic has no sea in any of 6 frames, and the gull beat looks at the piste. The Expedition middle (`16`) and the start (`02`, sugarloaf) are unchanged. The archipelago, the menu and the harbour are still unmistakably Fjord. |
| Skiing and hazard mechanics | 7.5 | **7.5** | Gameplay is identical to round 8 in my harness (30/30 on `3bf5a7e`). The wind gate is still a real decision: the wrong side costs +2.2 to +12.3 s per Normal Sprint on these seeds. Cave boulders are now colliders (`seaCave.ts`, `solids`); I did not probe them. |
| Difficulty and fairness | 7.5 | **7.5** | The rescue is fairer in code: only tuck without brake counts as "trying to get going", and a rescue is no longer a crash (`SkierPhysics.ts:1017`, `:1032`). There is no unit test for the new rule. The ladder is unchanged: the Fjord is faster than Alpine on CRITG03 (151.3 s vs 159.0 s). |
| Cinematics | 8 | **7.5** | **Down:** the gull beat has lost the cave, the sea and the foreshadowing in the dark mouth (D2). On Standard, no frame shows the fjord (D3). The closing reveal `11c` is unchanged (D4). **Still strong:** Sprint `08`, `08d` and `08b`, and the harbour sequence from the gag to the plunge. The `e0e2eca` shard is gone. Partly C's area. |
| Performance and stability | 7 (lc) | **7 (lc)** | **Low confidence.** From `EVIDENCE.md`/`perf/` (measured on `e0e2eca`, CPU only; I did not re-measure), Fjord against Alpine: median 3 ms vs 0.5 ms; frames over 8 ms 4785 vs 435 (11×); p99 11.9 ms vs 8.2 ms; no frames over 33 ms in either; heap 159 MB vs 122 MB. Every percentile up to p99 fits in one frame, but the location is much heavier. 19/19 browser tests pass with 0 page errors. |
| Accessibility and controls | 7 (lc) | **7.5 (lc)** | **Low confidence.** The relocation rule is on a dark pill, about 10.3:1. `TESTS.md`: keyboard, mouse and gamepad menu control (#9) and the real keyboard-play unlock (#18) pass. The caption and the "WIPEOUT!" chip still stack under the title in `15`. |
| **Overall player experience** | 8.5 | **8** | Only legibility moved visibly among my round-8 Majors. The one reworked cinematic beat now looks less like the Fjord. The default-length cave sequence, which I saw for the first time this round, does not show the coast. It is still a worthy second location on Sprint and not a reskin, but the gap to 9 is wider than in round 8. |

## My measurements

### Pixel change, round 8 → round 9

Mean absolute luma difference / share of pixels changing by more than 20. These are the `c9ffd1b` shots, and for the cave shots the preliminary `e0e2eca` set. The `3bf5a7e` cave shots differ from that set only at the Sprint mouth (`cmp07_mouth_3bf.png`).

| Shot | Change | Reading |
|---|---|---|
| `08c` | 60.7 / 64.1 % | New gull framing: piste behind, no cave, no sea |
| `08d` | 5.8 % | |
| `10` | 2.1 % | Wet band, hardly perceptible |
| `15` | 1.9 % | The pill |
| `14` | 1.1 % | Crests softened |
| All other shots | ≤ 1.1 % | `01`, `02`, `06`, `11c` and `16` all ≤ 0.3 % |

### Gameplay on `3bf5a7e`

30 runs, Normal Sprint. Identical to round 8 and to `e0e2eca`: all victories, 1 crash in total, max |Δt| = 0.00 s.

| Seed | Fjord `read` (s) | Alpine `read` (s) | Fjord `wrong` (s) |
|---|---:|---:|---:|
| CRITG01 | 154.8 | 145.2 | 163.1 |
| CRITG02 | 163.5 | 143.2 | 175.8 |
| CRITG03 | **151.3** | **159.0** | 154.4 |
| CRITG04 | 166.6 | 148.2 | 169.1 |
| CRITG05 | 170.0 | 161.8 | 168.9 |
| CRITG06 | 156.7 | 148.8 | 158.9 |

### Instruction pill

In `15`, the text row (y 280–306, x 670–1250) measures about **10.3:1**, against 1.07:1 in round 8.

## Defects

### D1. Major: the Sprint ladder is still within seed noise (F-039 OPEN; round-6 D4, round-7 D3, round-8 D1)

**Evidence:** gameplay is identical to round 8 in all 30 runs, and on CRITG03 the Fjord beats Alpine (table above). Nothing changed in pace, hazards or the profile.

**Fix:** add a per-course floor for the gates and squalls, or calibrate against the Alpine course built from the same seed, so that F − A > 0 on at least 22 of 24 seeds. Add this as a unit test.

### D2. Major: the gull beat looks at the piste, not the sea (F-037)

**Evidence: Sprint `08c`**
- The frame shows gulls, the start gate and windsock (about 520–650 × 300–380), conifers and an open bowl of snow.
- There is no water and no cave in the frame.

**Evidence: the code**
- At `seaCaveCinematic.ts:191`, `lookG = c + O*5`, where `O = cave.outward` (`:82`).
- The comment at `:185-187` says the shot looks out "toward the sea".
- The manifest describes the mouth as facing "inland, toward the piste".

**Evidence: Standard `08c`**
- The gulls fly against the banded valley wall (`crop08cstd_wall.png`).
- The only water is the frozen pool beside the mouth.

**Also in Sprint `08c`:** an unexplained dark smeared blob floats in mid-air at about 660–780 × 430–450. It is still there on `3bf5a7e` (`crop08c_smudge_3bf.png`).

C's round-8 complaint, that the Yeti was visible before his growl, is fixed. The cost is the location's identity in this beat.

**Fix:**
1. Aim the shot toward the sea side (`-T*side`, or the nearest water sample from `seaFraming`).
2. Assert at least 10 % water in frame and no mouth in frame in `fjord_reveal.test.ts`.
3. Find and remove the dark smear.

### D3. Major: the Standard (default length) cave cinematic shows no fjord (F-024 and F-038 not met on screen)

**Evidence:** `standard/07`, `07b`, `08c`, `08`, `08d` and `08b` on `3bf5a7e`. None of the six frames shows the sea.
- `standard/08`, captioned "the Yeti against the fjord", puts him against rock and snow.
- `standard/08b` is the leap over an Alpine-looking slope, in front of a wall with contour terraces and scattered boulders.
- The tracker claims the sea shows in 15 of 18 emergence shots. The one Standard set provided does not support that.

**Fix:**
1. Use the Sprint framing (a high or distant station, with the sea behind the Yeti) for the emergence and the leap on every course.
2. Gate each shot with a water-fraction test.
3. Soften the wall banding at that distance and thin the scattered boulders.

### D4. Major: the closing reveal is still the weakest hero frame (F-050 and F-051 OPEN; round-8 D2)

**Evidence:** `11c` has changed by only 0.3 % since round 8. It still shows:
- contour terraces;
- a crater ring at about 1260 × 500;
- a fluted organ-pipe wall at about 690–1000 px;
- a smeared grey curtain over the headland.

The run still does not end on an ocean-and-mountain reveal.

**Fix:**
1. Re-aim the camera so that the sea and the archipelago fill at least 40 % of the frame.
2. Smooth the terrain normals.
3. Put scan rock on the headland.

### D5. Minor: the cave boulders read as sheared plates with paper-thin snow (F-040 claimed; not fixed on screen)

**Evidence:** `crop08c_boulder.png` and `crop07std_boulders.png`. The cave dressing is unchanged since `e0e2eca`.
- Cut at the waist, each scan shows a flat sawn top under a separate flat snow sheet.
- Loose white flakes float around the foreground boulder in `08c`.
- One boulder in `standard/07` reads edge-on as a needle.
- There is no drift collar blending boulder and snow.

**Fix:**
- Blend a snow skirt into the terrain normal instead of using cap sheets.
- Vary the bedding depth.

### D6. Minor: the wedge in the cave outlook is unchanged (round-7 D13, round-8 D14)

The pale vertical translucent quad is still in `07b` and `standard/07b`, at about 1430–1520 × 640–860 of the right half (both on `3bf5a7e`).

### D7. Minor: the menu-sea streaks, the sugarloaf and the Alpine-like Expedition middle are unchanged (round-8 D10, D11, D5; F-029 OPEN)

`01`, `02` and `16` have each changed by 0.4 % or less.

### D8. Minor: the victory details are unchanged (F-042 OPEN)

- The trophy hides the presenter's head (`11g`).
- The splash crown is a cylinder (`11h`).
- The box row on the plaza and the chips are unchanged (F-032).

### D9. Minor: the wet band and the softer crests are barely visible (F-048, F-049 claimed)

- `cmp10_shore.png`: there is no visible wet band at the waterline at the finish.
- `cmp14_crest.png`: the peaks are slightly blunter, but still gabled, banded and putty-grey.

### D10. Minor: the new rescue rule has no unit test (F-046)

The coordinator confirms that `pin_rescue.test.ts` has 4 tests; the "17" in the tracker counted `pin_rescue` and `terrain_contact` together. Those 4 tests all drive into a pocket and check that the skier gets back. None checks that standing still while holding steer or brake never triggers the rescue.

The code is correct as I read it: `pushSince` resets unless the skier holds tuck without brake (`SkierPhysics.ts:1017`). Contact with a wall still triggers a rescue, which is intended.

**Fix:** add a test case. Stand still off the piste, away from any wall, holding a steer or brake key for 10 s, and assert that no relocate happens.

### D11. Minor (process): the full-loop browser test did not run on the candidate build

`TESTS.md`:
- The full-loop test (#2: learn → cave cinematic → chase → caught → victory) passed on `e0e2eca`.
- Only `menu.spec.ts` was re-run on `3bf5a7e`.
- The only source difference between them is the cave-mouth heightfield, which is exactly the area the cinematic plays in.

My headless runs on `3bf5a7e` pass 30/30, and the unit suite passes 311/311 on `3bf5a7e`. The risk is low but not zero.

**Fix:** re-run `game.spec.ts:71` on `3bf5a7e`.

## What works

- **The relocation rule is readable** (about 10:1, on a pill). That was my accessibility Major in round 8.
- **The Sprint cave mouth is clean again** on `3bf5a7e`, and the jamb fix keeps Standard clean (`cmp07_mouth_3bf.png`).
- **The Sprint cave cinematic** (`08`, `08d`, `08b`) works: the Yeti at the iced mouth with the archipelago and the harbour behind him, the roar with spray, and the leap toward the sea.
- **The harbour finish**, from the stockfish gag to the cannonball, is still the best material in this location. Nothing in Alpine compares to it.
- **The rescue is fairer** (no crash, no false trigger on steer).
- **Determinism and tests:** gameplay is fully deterministic, 30/30 of my runs won, and the browser suite (19/19) and unit suite (311/311) pass.

## Status of round-8 defects (my verification)

| R8 # | Defect | Status | Evidence |
|---|---|---|---|
| D1 | Major: Sprint ladder within seed noise | **Not fixed** | 30/30 identical; CRITG03 F < A |
| D2 | Major: closing reveal `11c` | **Not fixed** (0.3 %) | D4 |
| D3 | Major: relocation rule unreadable | **Fixed** | `15`, about 10.3:1 |
| D4 | Minor: crude gulls; featureless wall in `06` | **Not fixed.** Same gull models, now larger in frame; `06` changed by 0.3 % | `crop08c_smudge_3bf.png` |
| D5 | Minor: Expedition middle reads as Alpine | **Not fixed** | `16`, 0.3 % |
| D6 | Minor: perched cave boulders | **Partial.** Bedded deeper, but they now read as plates | D5 |
| D7 | Minor: trophy hides the head | **Not fixed** | `11g` |
| D8 | Minor: splash rim | **Not fixed** | `11h` |
| D9 | Minor: waterfront and plaza | **Not fixed** this round | `10`, `11` |
| D10 | Minor: start and sugarloaf | **Not fixed** | `02` |
| D11 | Minor: streaks on the menu sea | **Not fixed** | `01` |
| D12 | Minor: scoured plates | **Not fixed** | `04b`, 0.2 % |
| D13 | Minor: gate deserts, Hard Standard, the gimme achievement | **Not fixed** | Code unchanged |
| D14 | Minor: wedge in `07b` | **Not fixed** | D6 |
| D15 | Minor: hamlet strand wedge | **Not fixed** | `06` |
| D16 | Minor (process): incomplete evidence, contaminated perf run | **Fixed.** `standard/`, `res-*`, the perf re-capture and `TESTS.md` are all present (caveat in D11) | |
| prelim #3 (`e0e2eca`) | Major regression: shard and gaps in the Sprint mouth | **Fixed** on `3bf5a7e` | `cmp07_mouth_3bf.png` |

## Status of tracker items in my area (my verification)

| ID | Status |
|---|---|
| F-021 (pinned skier) | **Fixed as far as I test:** `pin_rescue` 4/4; 0 pins in 30 runs |
| F-024 (sea in the Standard cave shots) | **Not met on screen:** 0 of 6 frames (D3) |
| F-029 (sugarloaf) | **Open,** confirmed |
| F-037 (gull beat) | **Partial; identity regressed.** Gulls are in the frame and the Yeti is hidden, but the shot faces inland (D2) |
| F-038 (coastal reveal) | **Not evidenced** as a sea reveal on Standard (D3) |
| F-039 (Sprint ladder) | **Open,** confirmed (D1) |
| F-040 (boulder collars, solidity) | **Partial:** colliders in code; plates on screen (D5) |
| F-041 (hamlet strand) | **Open** |
| F-042 (victory details) | **Open** |
| F-046 (rescue false triggers) | **Fixed in code;** no unit test for the new rule (D10) |
| F-047 (legibility of the relocation rule) | **Fixed** (10.3:1) |
| F-048 (wet band) | **Not visible** at the distances in the evidence (D9) |
| F-049 (needle crests) | **Partial** (D9) |
| F-050, F-051 (headland, closing reveal) | **Open,** confirmed (D4) |

## Public-preview gate (completion brief §10), for my area

| Item | Status | Evidence |
|---|---|---|
| Hostile-critic Overall ≥ 8 | **Met, at exactly 8** | Scores above |
| No critical gameplay or physics defects; no unrecoverable states | **Met as far as I tested** | 30/30 won, 0 pins on `3bf5a7e`; `pin_rescue` passes |
| All finite lengths completable | **Sprint met** in my runs; other lengths are covered by others' runs and tests, not mine this round | |
| No major regression in a signature cinematic | **Met, narrowly.** The shard regression is fixed. The gull beat lost its Fjord identity (D2, Major), but the sequence still plays and lands | D2 |
| All automated tests pass | **Met:** browser 19/19 and unit 311/311 (`TESTS.md`); my 2 files pass 5/5 on `3bf5a7e`. Caveat in D11 | `TESTS.md` |
| Keyboard and controller; menus | **Met per `TESTS.md`** (#3, #9, #14, #18; menu fits at 3 resolutions); E's area | |
| No major performance regression | **Not judged** (D's area). CPU-side, the Fjord has 11× Alpine's frames over 8 ms, but p99 is under 16.7 ms | `EVIDENCE.md` |
| Art direction ≥ 8 | **Met on my reading (8);** A's score is the gate figure | |

**Gate result for my area:** the critic threshold is met at the minimum. Before the public preview, I would:
1. turn the gull beat toward the sea (D2);
2. re-run `game.spec.ts:71` on `3bf5a7e` (D11).

**Path to 9:**
1. Put a floor under the Sprint ladder (D1).
2. Show the sea in the cave cinematic on every length (D2, D3).
3. Make the closing reveal pay off with sea and mountain (D4).
4. Blend the boulders into the snow (D5).
5. Fix the first two images a player sees: the menu streaks and the sugarloaf (D7).
