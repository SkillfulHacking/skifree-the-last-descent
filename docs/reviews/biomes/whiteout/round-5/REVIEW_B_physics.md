# Whiteout Ridge, round 5: Review B (Physics and Hazard Mechanics, Difficulty and Fairness)

- **Reviewer:** B. I own category 3 (Skiing and hazard mechanics) and category 4 (Difficulty and fairness, including Normal pursuit tension).
- **What I am:** a model reviewer, **not a human playtester**. I did not play in real time, see motion or hear audio. Every judgement about feel comes from code, the headless game (`src/game/simulate.ts`, hazard streaming on) and committed data.
- **Build:** frozen candidate `729e226`. I read `git diff 71c9ceb 729e226 -- src`. All experiments ran on a copy (`git archive 729e226` into `/tmp/revB5/tree`). Nothing in the repository was changed except this file.
- **Test-only changes in my copy:** two env options. `XTUCK<0` gives a *wide binary* tuck (on/off at 0.16 + |XTUCK| rad, which is round 4's keyboard-like variant). `SLOPPY_PERIOD` sets how often the competent skier makes a sloppy turn. I also added a trajectory probe (`balanceTraj.ts`, `traj.measure.test.ts`) that logs the gap, both speeds and the slope every second. Game code is untouched.
- **Fresh seeds:** `B5X-01…32`, never used before. Outputs are in `/tmp/revB5/*.jsonl`.
- **Labels:** **[B]** means I produced the number; **[dev]** means it comes from the developer's data.
- **Determinism check:** every Classic row I re-ran matched the candidate exactly (minimum gap to 0.1 m, all 12 Hard Classic rows across two policies) [B].

## Verdict: **FAIL** against the 9/10 gate (cat. 3 = **8**, cat. 4 = **8**)

Real progress this round:
- **W-095 is fixed in the direction the owner asked.** On my own seeds, Whiteout's ×1.06 Normal pace takes the competent weather reader from 23/24 and 22/24 wins (closest gap ≈ the start gap) to 19/24 and 15/24, with real close calls. The clean expert still escapes 24/24 [B].
- **Whiteout Hard is now close to the owner's ranges.**
- **No forbidden mechanism was introduced.**

Three things block a 9:
1. **The main Whiteout Hard lever cannot be seen or heard (B5-1).** The storm-strength build-up past 3 km comes from course position alone (good), but no visual or audio cue scales with it.
2. **"A flawless descent must have a plausible path to victory" is still not shown (B5-2).** On Alpine Hard Standard, 12 of 32 fresh courses were lost by all three expert techniques with no crash, no knock and no snowball hit. Round 4's B4-2 was never added to the tracker.
3. **Alpine Hard Sprint is still above range (B5-3):** 88% on 56 fresh seeds. Alpine Hard Standard with a binary tuck is below range (14%).

| # | Category | R4 | R5 | Confidence | One-line justification |
|---|---|---|---|---|---|
| 1 | Visual art direction | — | — | none | Not reviewed. |
| 2 | Environmental uniqueness | — | — | none | Not reviewed. |
| **3** | **Skiing and hazard mechanics** | 8.5 | **8** | owned | Build-up fixed by position and deterministic. But it has no cue (B5-1); the README's "stronger knocks" is not what the code does; no test pins the build-up (B5-7); B4-3 and B4-4 untouched for another round (B5-9). |
| **4** | **Difficulty and fairness** | 8 | **8** | owned | W-095 fixed [B]. Whiteout Hard at the top of both ranges; Classic Hard won by the expert everywhere. Against: Alpine Hard Sprint above range and Standard below for a binary tuck (B5-3); clean losses lost by every technique (B5-2); Classic Hard depends on the tuck technique, Whiteout margins about 7 m with a keyboard-style tuck (B5-10); the length explanation is partly wrong (B5-5). |
| 5 | Cinematics | — | — | none | Not reviewed. |
| 6 | Performance and stability | 8 (lc) | — | none | Only note: about 1,100 headless runs, all deterministic; unit `difficulty_pace` passes on my copy. |
| 7 | Accessibility and controls | 8 (lc) | 8 (lc) | low | A keyboard tuck is binary (`Input.ts`). A narrow binary tuck loses 4 of 6 Classic Hard courses; a wide one wins all 6 (B5-10). |
| 8 | Overall player experience | 8 (lc) | 8 (lc) | low | Normal Whiteout now has a chase for a competent player. Hard's late-course storm strength is invisible. |

## Owner's decision 1 (Hard ranges): checked independently

### What changed in the code (verified)

| Claim | Verdict | Evidence |
|---|---|---|
| No global Yeti speed change | **Verified** | `YETI` constants and `src/yeti/YetiAI.ts` are not in the diff. `DIFFICULTY` is unchanged (0.93 / 1 / 1.07). |
| Per-location, per-difficulty pace, fixed for the run | **Verified** | `yetiSpeedFor` (`CourseConfig.ts:35`) is a pure function of difficulty and location. It is read once per encounter (`GameSession.ts:788`) and in the sim harness (`balance.ts:200`, `tension.measure.test.ts`). Effective own pace [B, `courseSpec`]: Alpine Hard 1.225 (16.5 → 20.2 m/s); Whiteout Normal 1.06 (17.5 m/s); Whiteout Hard 1.07 (17.7 m/s); Fjord unchanged. |
| No rubber-banding or performance-reactive Yeti | **Verified (nothing new)** | The only gap-dependent Yeti term is the existing catch-up pressure (`YetiAI.ts:241`), which is untouched. No code reads the player's crashes, time or lead to set pace. |
| Hand-off physics unchanged | **Verified** | `caveHandoff.ts` changes only a camera lens (`LEAP_SETUP.fov` 34 → 38). |
| `hazards.builds` fixed by course position, not player state | **Verified, with one caveat** | `intensityAt(z)` = `intensity × (1 + amount × smoothstep(3000, 8000, z))` (`capabilities/environment.ts:117`). Its only input is the sample point's course z, the same for any skier there. It is applied to the hazard contact (`:340`), the exposed skid drag (`:282`) and `hazardVisibility` (`:434`). Sprint (finish z 3000) gets 0. Normal and Relaxed get nothing (amount only on Hard). Caveat: nothing presents it (B5-1), and no test pins it (B5-7). |
| "Stronger blizzard knocks" (README) | **Partly false** | A knock's speed loss saturates at intensity 0.8 (`hazards.ts:362`, `Math.min(1, I / 0.8)`): Hard's knock costs no more speed than Normal's. Only wobble scales, and it now exceeds the crash-level wobble of 1 (0.7 × 1.65 = 1.16). The real levers are side-slip, air push, drift drag and friction (drift `k` reaches 1.65, so friction up to 5.95× against a designed 4×). See B5-7. |

### Fresh-seed results: three expert techniques

Developer R5V (24 seeds) pooled with my B5X (32 seeds) where both exist. Wilson 95% intervals. Whiteout uses the weather reader.

| Location | Technique | Hard Sprint (target 50–75%) | Hard Standard (target 25–50%) |
|---|---|---|---|
| Alpine | progressive tuck (`XTUCK=0.3`) | **49/56 = 88% (76–94)** | 27/56 = 48% (36–61) |
| Alpine | narrow binary (`XTUCK=0`) | 40/56 = 71% (59–82) | **8/56 = 14% (7–26)** |
| Alpine | wide binary (`XTUCK=-0.15`) [B only] | **29/32 = 91% (76–97)** | 17/32 = 53% (36–69) |
| Fjord | progressive | 41/56 = 73% (60–83) | 23/56 = 41% (29–54) |
| Fjord | narrow binary | 40/56 = 71% (59–82) | 15/56 = 27% (17–40) |
| Fjord | wide binary [B] | 21/32 = 66% (48–80) | 8/32 = 25% (13–42) |
| Whiteout | progressive | 44/56 = 79% (66–87) | 28/56 = 50% (37–63) |
| Whiteout | narrow binary | 42/56 = 75% (62–84) | 21/56 = 38% (26–51) |
| Whiteout | wide binary [B] | 28/32 = 88% (72–95) | 17/32 = 53% (36–69) |

My B5X numbers alone [B]:

| Technique | Alpine (Sprint / Standard) | Fjord | Whiteout |
|---|---|---|---|
| Progressive | 91 / 47 | 66 / 34 | 78 / 53 |
| Narrow binary | 81 / 19 | 69 / 25 | 78 / 47 |

My seeds agree with the developer's to within sampling noise.

**Reading of the table:**
- **Whiteout:** at the top edge of both ranges for every technique. Sprint is 75–88%, Standard 38–53%. As objectives rather than quotas, I count this as **met at the edge**.
- **Fjord:** inside both ranges.
- **Alpine:** Sprint is above range for both analog-style techniques; its lower bound of 76% is above 75% (B5-3). Standard is below range for the narrow binary tuck.
  - Alpine was tuned on **12** R5T seeds (`tuning/grid_al_hard/p1.09.jsonl`: Sprint 7/12 = 58%), not the 24 the README states. That 58% was a low draw.

**Classic Hard (closest gap, m)** [B, matches dev]:

| | Progressive | Narrow binary | Wide binary |
|---|---|---|---|
| Alpine Sprint / Standard | won 37.5 / won 44.3 | won 28.4 / **lost** | won 51.1 / won 22.0 |
| Fjord Sprint / Standard | won 6.6 / won 36.5 | **lost** / won 42.8 | won 40.4 / won 27.7 |
| Whiteout Sprint / Standard | won 20.2 / won 16.7 | **lost / lost** | won 7.6 / won 7.2 |

Every Classic Hard course is won by at least two of the three techniques, so "winnable" holds. On Whiteout it rests on the progressive tuck (about 17–20 m) or a keyboard tuck by about 7 m. Round 4's Whiteout Classic Hard Standard margin was 30 m [dev]. See B5-10.

**Location roles:**
- Whiteout: weather reading still decides Whiteout [dev: Hard reader 79/46 against blind 25/0; B: Normal reader 24/24 and 24/24 against blind 21/24 and 15/24]. Hard is "the storm, not the Yeti": the Yeti's own pace differs by 1% between Normal and Hard.
- Fjord: unchanged.
- Alpine: Hard is now set by the Yeti, which fits "pursuit mastery". But for a binary tuck, Alpine Hard Standard (14%) is now the *hardest* cell of the three locations. That is an odd ladder for the teaching location, and it is an owner call.

## The length question

**README claim:** "a winning lead settles at 85–120 m … once settled, a clean skier faces almost no risk per km; the extra 7 km added little risk; Standard above Sprint was sampling noise."

**My finding: half right.**
- **Right:** the catch-up rule caps a lead at about 80–120 m. My trajectories hover at 100–119 m on Normal and at about 80 m under Alpine Hard's 20.2 m/s Yeti [B, `traj_*.jsonl`].
- **Right:** "Standard easier than Sprint" was small-sample noise. Round-4 settings on R5V gave Whiteout reader Sprint 25/25 against Standard 17/25 [dev, `before/expert.jsonl`]. Round-4 B's 40 seeds gave 88% against 73%.
- **Wrong:** "almost no risk per km once settled". The same round-4 data has Whiteout Standard losses spread through the whole chase: 1.9, 2.7, 2.8, 4.7, 5.2, 5.6, 9.1 and 9.7 km. Five of the eight are past 4.5 km. Alpine's are at 1.8–9.7 km.
  - A settled lead does not remove risk. It caps how much any single bad stretch can cost.
  - So a long course carries risk per km wherever stretches are slower than the Yeti: basins of 8–9°, storm-slowed steeps, and the shared 14° → 5° finish run-out. Every course ends with the same last 300 m (`courseSpec`, [B]).
- Standard was already harder than Sprint before round 5. The build-up is a legitimate lever to bring Standard into range: on R5T it takes Standard from 79% (intensity 1.1, no build-up) to 46% [dev, `tuning/grid_wx_hard24`, `grid_wx_hard4`]. But the mechanism it is said to cure was not the observed one (B5-5).
- **Chase lengths [B]:** Sprint 260 → 3000 m (2.7 km of chase); Standard 960 → 10000 m (9.0 km). Each has one encounter.

## Owner's decision 2 (Whiteout Normal pursuit, W-095)

**Reproduction [dev, checked]:** `w095_repro_*.jsonl` (round-4 code) has the competent reader caught 0/9 on both lengths, with closest gap = start gap (41–49 m). That matches the claim.

**Independent check on my seeds:** same tree, with the Whiteout Normal pace undone (`PACE=whiteout:0.9434`) against shipped, competent reader (SLOPPY, 1 sloppy turn every 12 s), B5X-01…24 [B]:

| | Pace ×1.00 (round 4) | ×1.06 (shipped) | Alpine, shipped |
|---|---|---|---|
| Sprint: wins | 23/24 | 19/24 | 22/24 |
| Sprint: median closest gap | 41.9 m | 34.9 m | 40.3 m |
| Sprint: inside 25 m | 1/24 | 7/24 | 2/24 |
| Standard: wins | 22/24 | 15/24 | 12/24 |
| Standard: median closest gap | 38.7 m | 23.5 m | 3.0 m |
| Standard: inside 25 m | 5/24 | 12/24 | 14/24 |

Paired over the 48 Whiteout runs, the pace change flips 11 wins to losses and no losses to wins.

**Expert on Normal [B]:** reader 24/24 Sprint and 24/24 Standard (median closest 47 m). A clean expert usually escapes: **met**.

**Behaviours, first 1.5 km of the chase, Classic + B5X-01…08 [B]:**

| Behaviour (Whiteout Normal) | Sprint: caught / median closest | Standard: caught / median closest | Owner's requirement |
|---|---|---|---|
| Clean (skilled) | 0/9 · 44.8 m (start gap) | 0/9 · 49.1 m | "clean skiing builds a deserved lead": **met** |
| Late crash (20 s) | 4/9 · 16.4 m | 2/9 · 36.3 m | "a recoverable mistake noticeably reduces the gap": **met** |
| Early crash (5 s) | 3/9 · 9.6 m | 4/9 · 6.2 m | "a severe crash creates real risk": **met** |
| Poor route | 8/9 | 5/9 | "poor route choices create pressure": **met** |
| Cautious (brakes above 13 m/s) | 9/9 | 9/9 | "excessive braking creates pressure": met. This is 9/9 in every location and was in round 4 too. |
| Slow arrival (3 m/s) | 0/9 · 25.2 m | 0/9 · 29.1 m | pressure without capture |
| Competent (12 s) | 1/9 · 38.9 m | 1/9 · 38.8 m | its pressure comes later in the run (full-course table) |

- **"Excellent recovery can save the run":** 13 of 36 Whiteout crash runs fell inside 25 m after the crash and still escaped (closest 6–25 m) [B]. **Met.**
- **Presence cues:** the CLOSING caption shows for a median 4.6 s in the competent Sprint (round 4: 0 s) [B].
- **No forced near-catches and no secret acceleration:** there is no code for either. The Yeti's own pace in every trace is flat at 16.5 × 1.06 = 17.5 m/s, except the existing gentle-ground cap, catch-up and lunge [B, `traj_sloppy.jsonl`].

**Two caveats (B5-6):**
1. **The pressure depends heavily on how often the "competent" model errs.** With one sloppy turn every 20 s instead of 12 s, Whiteout Normal is 23/24 and 22/24 wins, with median closest gap 41.2 and 42.3 m: about the start gap again, as in round 4. Alpine at 20 s is the same (23/24, 20/24; 43 and 41 m) [B]. So this is a game-wide calibration, not a Whiteout defect, but "a competent player feels the chase" holds only for the less tidy competent player.
2. **Where competent catches happen.** On R5V, 5 of 9 Sprint catches are in the last 24–65 m before the line, all with no crash. The Yeti holds 17.5 m/s while the skier drops to 13–15 m/s on the shared 9° → 5° run-out, often after a sloppy turn there [B, trajectory R5V-14/18/19/21/23]. On my seeds it is 1 of 5. Being caught 30 m from the finish after leading all run is likely to read as cheap to a human. I cannot judge that feeling.

## Defect rows and round-4 findings

| Row | Tracker | My verdict | Evidence |
|---|---|---|---|
| **W-094** (B4-1) | CLAIMED | **PARTLY VERIFIED.** Whiteout at the range edges (met as objectives); Fjord inside; Alpine Sprint still above (88%, 76–94), Alpine Standard binary below (14%) | Table above; B5-3 |
| **W-095** (F4-1) | CLAIMED | **VERIFIED** for the developer's competent model, on my seeds too; sensitive to the model (B5-6) | Tables above |
| B4-2: no guard against an inevitable loss | **not in DEFECTS** | **OPEN, now an explicit owner requirement** (B5-2) | 12/32 Alpine Standard and 5/32 Whiteout Standard lost cleanly by all three techniques |
| B4-3 / W-059: stance barely pays | OPEN | **Not addressed** | No change to the stance or knocks. On Hard the knock's speed cost is still capped at Normal's (B5-7). |
| B4-4: false comments, docs | carried minor | **Not addressed** | `whiteout/hazards.ts:13` still says a cell "never knocks"; `obstacles.ts:303` still says "per-row seed" |
| B4-5: reading worth little to the expert on Normal | carried minor | **Improved** | Normal reader 24/24 and 24/24 against blind 21/24 and 15/24 [B] (round 4: +2 / +6) |
| B4-6: Fjord Normal harsh for the competent skier | **not in DEFECTS** | **Unchanged** | Fjord Normal competent 17/25 and 9/25 [dev] |
| W-092 docs | PARTLY FIXED | Unchanged | — |

## Findings

### B5-1 (Major, cat. 3 and 4): Whiteout Hard's storm build-up has no cue

- **Evidence:**
  - `intensityAt` is read only in `capabilities/environment.ts` (grep over `src`: no view, HUD, caption or audio reads it).
  - The blizzard's wind and visual terms do not scale with intensity (`hazards.ts:361-372`: `windX = dir * 9 * w`, visibility from `w` only). Drift rows look the same at every intensity.
  - So a cell or drift row at 9 km pushes and drags 1.5× harder than an identical-looking one at 2 km.
- **Why it matters:**
  - On R5T the build-up does nearly all the work on Hard Standard: 79% → 46% [dev].
  - Whiteout's role is weather reading. Its main Hard lever cannot be read.
  - The owner bans invisible *advantages*. A hidden *disadvantage* that grows mid-run is the same legibility problem in reverse.
- **Acceptance:** the build-up is perceptible in proportion to its effect. For example, gust audio and flake density, blizzard telegraph strength, or drift-plume height scaled by `intensityAt(z)`, or an explicit "the storm is building" beat at 3 km. Pin it with a test that the presentation's strength rises with `intensityAt`. Otherwise the owner explicitly accepts an un-cued ramp.

### B5-2 (Major, cat. 4): "a flawless descent must have a plausible path to victory" is not demonstrated; B4-2 not tracked

- **Evidence [B]:**
  - Hard, B5X-01…32, three expert techniques (progressive, narrow binary, wide binary).
  - **Alpine Standard:** 12 of 32 courses were lost by **all three** with 0 crashes, 0 knocks and 0 snowball hits (B5X-03, 04, 06, 10, 16, 21, 23, 24, 25, 27, 28, 29). Alpine Sprint: 2 of 32. Whiteout Standard: 5 of 32 (B5X-02, 15, 16, 25, 28). Whiteout Sprint: 1 of 32 (B5X-22).
- **Mechanism, from trajectories:**
  - Alpine B5X-03 / 10: an 8.5–9.3° basin of 500–800 m. The tucked skier runs 15–16.5 m/s; the Yeti's gentle-ground cap (`13 + 0.5 × slope`, independent of pace) is 17.3–17.6 m/s.
  - The roughly 80 m lead that catch-up allows against a 20.2 m/s Hard Yeti on the steeps is gone in about 40 s.
  - At round-4 pace (`PACE=alpine:0.9633`), 8 of those 12 are still lost, and the other 4 are won by 4–17 m. So the ×1.09 made this worse, but the structure predates it.
  - Whiteout B5X-15 / 02: storm-slowed stretches late in the course, with the skier at 15–17 m/s on 15–18° against 17.7 m/s.
- **Tracker:** B4-2 never became a DEFECTS row, and round 5 does not mention it.
- **Acceptance:** either of these:
  - A course-matrix check over at least 32 fresh Hard seeds per location and length, with at least 3 reference techniques, reporting clean losses, where each clean loss is shown to have a winning line.
  - A generation-time bound: no stretch slower than the Hard Yeti's sustainable pace that is longer than the lead catch-up allows. This covers basins and the finish run-out.
- Plus a DEFECTS row.

### B5-3 (Major, cat. 4): Alpine Hard is outside the owner's ranges on both ends

- **Evidence:** Sprint progressive 49/56 = 88% (76–94); wide binary 29/32 = 91%. Standard narrow binary 8/56 = 14% (7–26). (Round 4: Sprint 83%, 40 seeds.)
- The Yeti pace lever widens the Sprint–Standard spread instead of lowering Sprint. Most Alpine Hard losses are clean basin catches (B5-2).
- It was tuned on 12 seeds (R5T Sprint 58%).
- **Acceptance:** Alpine Hard Sprint inside or touching 50–75% for the expert techniques, on at least 40 fresh seeds with intervals, without pushing a keyboard-style technique below 25% on Standard. Or an explicit owner ruling that Alpine's numbers stand.

### B5-4 (minor, cat. 4): Whiteout Hard sits at the top edge; publish pooled intervals

- **Evidence:** Sprint 75–88% across techniques (progressive 79%, 66–87); Standard 38–53%.
- Acceptable as an objective. But the README reports one 24-seed draw and the binary-tuck numbers only on R5V.
- **Acceptance:** the README states the pooled multi-technique intervals.

### B5-5 (minor, cat. 4): the length explanation is partly wrong

- **Evidence:** see the length section. Round-4 Standard losses were spread over 1.9–9.7 km [dev data]. Standard was already harder than Sprint (25/25 against 17/25).
- **Acceptance:** the README says the "longer is easier" result was noise. It describes the build-up as a range-tuning lever, not a cure for "no risk per km".

### B5-6 (minor, cat. 4): W-095 pressure is model-sensitive, and catches cluster at the finish run-out on some seeds

- **Evidence:**
  - A competent skier with one slip every 20 s: Whiteout Normal 23/24 and 22/24, closest about 41 m [B]. Alpine is similar.
  - R5V Sprint catches: 5/9 within 65 m of the line.
- **Acceptance:**
  - Report tension across at least two competent error rates, and state which one the owner's "competent" means.
  - Report catch positions (last 300 m against the rest).
  - A human playtest of the Whiteout Normal finish.

### B5-7 (minor, cat. 3): intensity semantics and missing tests

- The knock's speed cost saturates at I = 0.8, so the README's "stronger blizzard knocks" is wrong.
- Wobble passes 1. Drift friction passes its documented "deepest" value (5.95× against 4×).
- No unit test covers `intensityAt` or `builds`: it should be position-only, 0 for z ≤ 3000, Hard-only, and identical for two different skier states at the same z.
- **Acceptance:** README and comments corrected, or `I` clamped where a full-strength design value is documented; a unit test for `builds`.

### B5-8 (minor, cat. 4): `difficultyPace` also multiplies Endless escalation (unmeasured)

- `speedMul` for Endless encounter k is min(1.3, 1 + 0.05k) × `yetiSpeedFor` (`profile.ts:766`, `GameSession.ts:788`).
- Alpine Hard reaches the 1.33 ceiling at encounter 3 instead of 5. Whiteout Normal goes past round 4's Normal from encounter 1, up to the ceiling.
- **Acceptance:** measured, or `difficultyPace` scoped to course encounters (≤ 1) as `encounterPace` is.

### B5-9 (minor, docs and tracker)

- B4-4 comments are still false for a fifth round (`hazards.ts:13`, `obstacles.ts:303`). B4-2 and B4-6 are missing from DEFECTS.
- README errors:
  - It says tuning used R5T-01…24, but the Alpine grid used 12.
  - Its Normal competent percentages do not all match its data (Whiteout Standard "56%" against 14/24 = 58% or 15/25 = 60%).
- **Acceptance:** corrected.

### B5-10 (minor, cat. 4 and 7): Classic Hard winnability depends on the tuck technique; Whiteout keyboard margins are about 7 m

- **Evidence:** the narrow binary tuck loses Alpine Standard, Fjord Sprint and both Whiteout Classic Hard courses. The wide binary wins all six, Whiteout by 7.6 and 7.2 m.
- **Acceptance:** report Classic Hard margins for at least one keyboard-reproducible technique. Ideally Whiteout's margin is not under about 10 m with every keyboard technique, or the owner accepts it.

## Not verified

- Anything visual or audible, including whether any cue of the build-up exists outside the code paths I searched.
- Real-time feel.
- Snowball dodge quality for a human. Many Hard outcomes still turn on it (round 4 note).
- Browser–sim parity (not re-run this round, by the developer or by me).
- Long modes (Endurance, Expedition, Endless) on the new settings.

## What would raise my scores to 9

- **Category 3:** a perceptible build-up cue (B5-1); the intensity semantics corrected and tested (B5-7); B4-3 resolved or restated, and the B4-4 comments fixed.
- **Category 4:**
  - B5-2 closed (a matrix or generation guard, plus a tracker row);
  - Alpine Hard brought to the ranges or ruled on by the owner (B5-3);
  - the length explanation corrected (B5-5);
  - the W-095 model sensitivity reported (B5-6).

## Commands (in `/tmp/revB5/tree`, the frozen source)

```
# Hard ladder, three techniques, fresh seeds
OUT=/tmp/revB5/expert.jsonl  BIOMES=alpine,fjord,whiteout LENS=sprint,standard DIFFS=hard SEEDS=CLASSIC,B5X:32 POLS_WHITEOUT=informed2NoLee POLE=1 FJORD_READ=1 XTUCK=0.3   TAG=expert  npx vitest run --config vitest.sim.config.ts tests/sim/ladder.measure.test.ts
#   … XTUCK=0 TAG=binary   … XTUCK=-0.15 TAG=widebin (wide binary: patched driver in the copy)
# Normal expert: BIOMES=alpine,whiteout DIFFS=normal SEEDS=CLASSIC,B5X:24 POLS_WHITEOUT=informed2NoLee,blind XTUCK=0.3
# Competent: SLOPPY=1 [SLOPPY_PERIOD=20] DIFFS=normal SEEDS=B5X:24; round-4 pace control: PACE=whiteout:0.943396
# Alpine round-4 pace control: PACE=alpine:0.96330 on the 12 lost-by-all seeds
# Tension: tests/sim/tension.measure.test.ts, BIOMES=whiteout,alpine LENS=sprint,standard DIFFS=normal SEEDS=CLASSIC,B5X-01..08
# Trajectories: tests/sim/traj.measure.test.ts (SPECS JSON)
```
