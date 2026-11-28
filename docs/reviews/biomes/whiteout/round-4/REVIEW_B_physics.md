# Whiteout Ridge, round 4: Review B (Physics and Gameplay, Difficulty and Fairness)

- **Reviewer:** B. I own category 3 (Skiing and hazard mechanics) and category 4 (Difficulty and fairness).
- **What I am:** a model reviewer, **not a human playtester**. I did not play in real time. Every judgement about feel comes from code, headless simulation and the committed logs. I ran no browser and no Playwright.
- **Build:** frozen candidate `71c9ceb` (branch `pass5-whiteout`). The checkout is at `6ff50f9`; `git diff 71c9ceb HEAD -- src` is empty, so the source I measured is the frozen source.
- **Method:**
  - I read `git diff 46ed200 71c9ceb -- src tests`.
  - I re-ran the unit suite.
  - I re-ran my round-3 probes (edge probe, push direction) on the new tree.
  - I ran my own sim probes. They import the game's `simulateCourse` and the developer's frozen drivers, and vary only the driver's technique (re-aim interval, tuck rule, line policy, snowballs on or off).
  - I ran the developer's `ladder.measure.test.ts` on 40 fresh seeds (`B4R-01…40`) that nobody has used before, plus a competent-skier Hard ladder that the candidate does not report.
  - Scratch work and outputs are in `/tmp/revB4/` (`sim/*.measure.test.ts`, `*.json`, `*.jsonl`). Nothing under `src/` or `tests/` was modified.
- **Number labels:** **[B]** marks a number I produced. **[dev]** marks a developer number.

## Verdict: **FAIL** against the 9/10 gate (cat. 3 = 8.5, cat. 4 = 8). Owner's decision A: **partly met** (details below)

This round fixed every round-3 mechanics regression I raised, and fixed them cleanly:
- The drop-side edge crease is gone, and the bank is now more forgiving than it was before W-065.
- The blizzard push no longer flips mid-gust.
- The obstacle layout no longer depends on off-piste terrain.

Hard is now winnable on every Classic course, and in every clean held-out loss I sampled a winning line exists. Three things stop a 9:
- **Hard overshoots the owner's provisional ranges** for Whiteout and Alpine on a larger fresh sample (B4-1). Whiteout Hard is now easier than Fjord Hard for a weather reader. The "in range" claim for Whiteout Hard Sprint rests on 12 seeds and one driver.
- **Nothing guards "a perfect run is never an inevitable loss".** It holds in my sample only, and several wins hang on one technique choice (B4-2).
- **Category 3 residuals:** the blizzard stance still barely pays (B4-3), and false comments survive a fourth round (B4-4).

| # | Category | R3 | R4 | Confidence | One-line justification |
|---|---|---|---|---|---|
| 1 | Visual art direction | 7 (lc) | — | none | Not reviewed. |
| 2 | Environmental uniqueness | 7 (lc) | — | none | Not reviewed. |
| **3** | **Skiing and hazard mechanics** | **7** | **8.5** | owned | W-078 edge: 481 → 21 crashes of 1,422 [B] (pre-W-065: 154). W-081: 97 → 0 mid-gust flips of 728 [B]. Per-cell obstacle stream with a test. Stance-dependent headwind is physically consistent. Against: the stance gives +0/−0 on Normal (0.6 s) and +1/−0 on Hard [B]; `hazards.ts:13` still says a cell "never knocks". |
| **4** | **Difficulty and fairness** | **7** | **8** | owned | Every Classic Hard course is won. Normal is materially more forgiving than Hard for the expert and for the competent skier [B]. No Yeti or catch-up change. 15 of 15 sampled clean losses can be won by some line or technique [B]. Against: on 40 fresh seeds Whiteout reader Hard is 88% / 73% and Alpine 83% / 78%, above both ranges; Whiteout reader Hard is easier than Fjord Hard (65% / 50%); there is no generation-time guard against an unwinnable course. |
| 5 | Cinematics | 8 (lc) | — | none | Not reviewed. |
| 6 | Performance and stability | 8 (lc) | 8 (lc) | low | Unit 521/521 re-run [B]. About 1,000 headless runs, all deterministic: every developer row I re-ran reproduced exactly. |
| 7 | Accessibility and controls | 7 (lc) | 8 (lc) | low | The caption, push, wind and air push now share one latched direction (0 flips in 728 gusts). A keyboard's binary tuck is not a handicap: a digital tuck wins every Classic Hard course [B]. |
| 8 | Overall player experience | 7 (lc) | 8 (lc) | low | The round-3 "Hard on the default course is a guaranteed loss" is fixed. |

## Owner's decision A: verdict, checked against the data

| Requirement | Verdict | Evidence |
|---|---|---|
| A clean expert wins Classic Hard Sprint and Standard in all three locations | **Met** | Candidate rows reproduced exactly (5 traces, same outcome and distance [B]). Whiteout Classic Hard Sprint, reader: won by 17–46 m with 6 of 9 driver techniques. It is lost with a 0.4 s re-aim interval, with round 3's narrow all-or-nothing tuck, and with a 6 Hz feathered tuck [B]. Fjord Classic Hard Sprint: 6.6 m with the candidate driver, but 38–40 m with a wider tuck rule [B]. Alpine: 54 m with every technique. |
| Hard Sprint 50–75% on held-out seeds | **Not met** for Whiteout and Alpine; met for Fjord | 40 fresh seeds [B], Wilson 95% intervals: Whiteout reader **35/40 = 88% (74–95)**; Alpine **33/40 = 83% (68–91)**; Fjord 26/40 = 65% (50–78). The candidate's 9/12 for Whiteout (47–91) is 12-seed noise. Four driver variants on the same 12 seeds give 9, 9, 11 and 11 of 12 [B]. |
| Hard Standard 25–50% | **Not met** for Whiteout and Alpine | 40 fresh seeds [B]: Whiteout reader **29/40 = 73% (57–84)**; Alpine **31/40 = 78% (62–88)**; Fjord 20/40 = 50%. |
| Normal materially more forgiving than Hard | **Met** | Expert, 40 seeds [B]: Normal 98–100% everywhere against Hard 50–88%. Competent skier (`SLOPPY`), Hard Sprint, held-out W4H plus Classic, which the candidate never measured [B]: Alpine 4/12 against Normal 11/12; Fjord 0/12 against 6/12; Whiteout reader 0/12 against 12/12. The README §5 asserted this for the competent skier without Hard data; it turns out true. |
| Relaxed accessible | **Met** [dev] | Competent skier 10–12/12 everywhere. Not re-run. |
| Whiteout fixed through the environment, not the Yeti; no rubber-banding, no forced close calls, no invisible boosts | **Met** | Diff: the Yeti's code changes only the lunge reset (W-092). `YETI` constants and catch-up are untouched. `encounterPace` stays 1 for Whiteout. The crest lee is a property of the ground for every skier, and it reaches the player through the exposure-driven wind bed (`GameSession.ts:1390`). It acts on the wind's grip only: hazard placement calls `whiteoutExposure` without a time (`hazards.ts:138`), so the cells are not thinned. |
| The weather-reading advantage is kept | **Met on Hard; thin for the expert on Normal** | Reader against weather-blind, paired, 40 seeds [B]: Hard Sprint **+17/−2**, Hard Standard **+23/−0**; Normal Sprint +2/−0, Normal Standard +6/−1. Blind Whiteout Hard Sprint is 50%, inside the range the owner set for an expert. |
| Not overfit, not forced | **Not seed-overfit, but tuned to one course's outcome** | See below. |
| A perfect run never becomes an inevitable loss | **No counter-example found; not guaranteed** | See below and B4-2. |

### Overfitting and forcing

The five changes are general rules, not per-seed tweaks:
- headwind by stance (physically motivated: the tuck's drag ratio);
- the 15° floor;
- the crest lee;
- drift-gap offsets of 14–18 m;
- Alpine ×1.05.

The fresh-seed improvement is broad, not concentrated. Whiteout reader Hard Standard went from 2/12 before to 10/12 after [dev], and is 29/40 on my unused seeds [B]. So the numbers are not forced into the ranges. If anything, they overshoot them.

**The selection criterion was one course.** In `balance/w080/README.md §3`, three of the kept changes (crest lee, gaps, floor) were accepted, and three alternatives rejected, on whether **Classic Hard Sprint** flipped. The package ablation (`gap2.jsonl`) was read the same way.
- Choosing "the minimum package that wins the default course" sets the strength of the whole package by one course's margin. The rest of the distribution lands where it lands: above range on Whiteout.
- This is not a hack, but it explains why the result misses the owner's ranges in the easy direction.
- The Classic result itself is technique-sensitive, which supports the same reading: the Whiteout reader's Classic margin spans "caught 6 m from the line" to "won by 46 m" across reasonable tuck rules [B].

### A perfect run and an inevitable loss

**Clean losses in the candidate data.** The candidate's held-out data has 12 expert losses with 0 crashes, 0 knocks and 0 direct snowball hits [B]: Whiteout reader 5, Whiteout blind 6 (a weather-blind run ploughs drift rows, and these counters do not record that) and Alpine 3. The README does not report them. On my 40 fresh seeds the Whiteout reader has 9 more.

**Do they flip?** I re-drove 15 of them with technique variants: re-aim 0 / 0.25 / 0.4 s; tuck rule narrow / progressive / binary-wide / feathered; line policy reader / main-line-only / storm line with ploughing.

**Every one has a winning variant [B]:**
- Whiteout W4H-02, 03, 12 and W4H-10 Standard: instant re-aim or a wider tuck.
- Alpine W4H-05: the main line instead of the alternate line wins by 14–16 m. It is caught in every variant on the alternate line, which crosses a 430 m 8.4° basin 200 m into the chase.
- B4R-15, 25, 26, 27, 28, 35, 05, 20: one variant or more.
- **B4R-32 Sprint:** caught in 8 of 9 variants, all in the last 300 m. It is won only by `linesOnly`, which ploughs the drift rows instead of steering for the gaps (13.3 m). With snowballs off, every reader variant wins by 45 m.

So within the model no perfect run is an inevitable loss in my sample. But:
- several wins hang on a single technique choice;
- the structural cause is untouched (B4-2): catch-up caps the lead at about 90–130 m, and the Whiteout finish is a 15° → 9° run-out where the Hard Yeti gains 25–55 m.

## Round 3 → round 4 (my round-3 findings)

| R3 | Status | Evidence on `71c9ceb` |
|---|---|---|
| B3-1 / W-078: drop-side edge crease | **VERIFIED** | My round-3 edge probe, unchanged: 1,422 cases (Classic Sprint, W3H-06 Standard, W3H-01 Sprint; 18 m/s, 8/15/25° toward the drop, steer back after 0.4 or 0.8 s). Results by build: pre-W-065 154 crashes; round 3 481; **round 4 21 (1.5%)** [B]. By distance past the edge: 0–1 m: 0/196; 1–3 m: 2/345; 3–6 m: 2/355; 6–10 m: 2/169; ≥ 10 m: 10/46. The cross-section is C¹ at the edge (`course.ts:350`, slope 0.0032·w eased over 8 m). It changes only for `ad > w`, so the piste and the line are untouched. Unit `w078_edge` passes. The tracker's figure (19) is within probe variation. |
| B3-2: on-piste obstacles re-rolled by off-piste terrain | **VERIFIED for Whiteout** | `cellStream` gives each cell its own stream (`obstacles.ts:305`). `obstacle_stream.test.ts` perturbs only the off-piste ground and asserts an identical on-piste layout. Alpine and Fjord keep the band stream (deliberate: their Classic layouts are released). |
| B3-3 / W-079: Alpine pace on Hard | **VERIFIED as measured** | ×1.05 chosen against Normal and Hard together (`tension_r4.jsonl`, `grid.jsonl`). Hard skilled 2/7 caught at ×1.05 against 4/7 at ×1.10. Alpine Hard is now above range (B4-1), so the pace is not what holds Alpine Hard down. |
| B3-4 / W-080: Classic Hard Sprint lost by every policy | **VERIFIED fixed** | Reader won by 19.6 m (reproduced exactly). Blind won by 4.2 m. Robustness in the decision-A table. |
| B3-5 / W-059: stance pays nothing | **Still weak** (B4-3) | Expert reader with and without the stance, same everything else, W4H-01…12 [B]: Normal Sprint +0/−0, 0.63 s faster when both win; Hard Sprint +1/−0. |
| B3-6 / W-081: caption direction | **VERIFIED** | Round-3 probe re-run: **0 of 728** gust cycles change direction between telegraph and active (round 3: 97 of 727). The caption (`GameSession.ts:890`) and the effect (`hazards.ts:359`) call the same latched `blizzardPushDir`. Unit `w081_blizzard_dir` passes. |
| B3-7 / W-089: sim does not stream hazards | **VERIFIED** | `simulate.ts:122` calls `env?.stream(z)` every step; unit `sim_streaming`. |
| B3-8: the W-056 rule drops ~30% of cells, undocumented | **Not addressed** | `hazards.ts:343` still drops the cell. No README states it (B4-4). |
| B3-9: docs, lunge reset | Lunge reset **VERIFIED** (`YetiAI.ts:128-131`, test). Docs: partly (B4-4). | |

## Findings

### B4-1 (Major, cat. 4): Hard overshoots the owner's provisional ranges; Whiteout reader Hard is easier than Fjord Hard; the "in range" claim is 12-seed noise

**Evidence [B]:** `ladder.measure.test.ts`, the expert configuration as published (`POLE=1 FJORD_READ=1 XTUCK=0.3`, policies `informed2NoLee` and `blind`), on `B4R-01…40` (never used). Output: `/tmp/revB4/b4r_expert.final.jsonl`.

| Location | Hard Sprint (target 50–75%) | Hard Standard (target 25–50%) | Normal Sprint / Standard |
|---|---|---|---|
| Alpine | 33/40, 83% (68–91) | 31/40, 78% (62–88) | 40/40 · 40/40 |
| Fjord | 26/40, 65% (50–78) | 20/40, 50% (35–65) | 39/40 · 38/40 |
| Whiteout, reader | **35/40, 88% (74–95)** | **29/40, 73% (57–84)** | 40/40 · 39/40 |
| Whiteout, weather-blind | 20/40, 50% (35–65) | 6/40, 15% (7–29) | 38/40 · 34/40 |

- The candidate's "Whiteout Hard Sprint 75%, in range" is 9/12 (95% interval 47–91%). On the same 12 seeds four driver variants give 9, 9, 11 and 11 of 12 [B]. The figure cannot separate "in range" from "above range".
- For a reader, the location ladder is now Fjord (hardest) → Whiteout ≈ Alpine. Whiteout Hard Sprint for the reader (88%) approaches Whiteout Normal (100%). The owner said "do not weaken Hard into Normal".
- The ranges are provisional, and the owner also said not to force numbers. So this is an owner call, not a measurement error. It is Major because two of the owner's four numeric Hard targets are missed in two of three locations, and the published table hides it behind a small sample.

**Direction:**
1. Ask the owner whether the provisional ranges hold.
2. If they do, pull Whiteout Hard back with a general rule, never the Yeti. Examples: crest lee 0.8–0.85, drift gaps 15–19 m, or let the stance-scaled headwind apply only on Hard's storm segments. Accept a candidate on the distribution, not on Classic alone.
3. Validate on at least 40 fresh seeds with at least 2 driver variants, and publish intervals. Keep Classic Hard won as a constraint, not as the objective.
4. Alpine needs the same decision. Its Hard is above range even at ×1.00–×1.10 (`grid.jsonl`), so the pace is the wrong lever there.

### B4-2 (minor, cat. 4): nothing guards "a perfect run never becomes an inevitable loss"; the Hard run-out is still Yeti-favoured

**Mechanism (code):**
- Beyond `catchUpGap` 60 m the Yeti adds up to +9 m/s, plus +7 m/s beyond 105–170 m (`YetiAI.ts:233`). So a clean lead is held at about 90–130 m (every trace: `gapAt` ≈ 80–110 m).
- Any stretch where the expert is slower than the Yeti for long enough to lose that lead is a loss, whatever happened before.
- Such stretches exist:
  - Alpine W4H-05: 430 m at 8.4° right after the cave. The skier's tucked terminal speed is about 15.6 m/s against the gentle-slope cap of 17.2.
  - Whiteout: 15° basins under storm.
  - Every Whiteout Sprint finish: 15° → 9°. Classic reader 100 → 75 m over the last 300 m; W4H-12 caught at z 2,828; B4R-32 caught at z 2,727–2,998 in 8 of 9 variants [B].

**What I found:** every one of the 15 clean losses I re-drove has a winning variant (decision-A section). So I record no inevitable loss. But the owner's "never" rests on sampling, and B4R-32 survives only by ploughing drift rows instead of reading them. The developer's own baseline (§2) identified clean catches as the problem; the validation section does not report the 12 clean held-out catches in its own data.

**Direction:**
- Add a course-matrix check: over N fresh Hard seeds, a small family of reference experts (2–3 techniques) wins each course with at least one technique. Report the clean losses.
- Or bound the Yeti-favoured stretches at generation time, in the spirit of W-056's fair opening: no stretch below the Hard Yeti's sustainable pace longer than the lead the catch-up allows. That covers post-cave basins and the final run-out.
- Re-examine the 12–15° finish run-out on Hard (my round-1 M5): the gentle cap starts only below 12°.

### B4-3 (minor, cat. 3): the blizzard stance still barely pays in outcomes; W-059 stays open

- **[B]** Expert reader with the precise stance against the same driver with `blizzard: 'ignore'`, W4H-01…12: Normal Sprint 12/12 against 12/12, 0.63 s faster when both win; Hard Sprint 9/12 against 8/12 (+1/−0, W4H-07).
- Better than round 3 (+0/−0, 0.0 s) but short of my round-3 bar (at least +2 net wins or at least 2 s).
- Because the headwind now follows the stance, standing up costs more than before, which works against this decision.

**Direction:** as in round 3. Make a knock cost more than standing up, or restate W-059 as a comfort and safety choice (knocks about 4× fewer) with no outcome claim.

### B4-4 (minor, documentation and comments)

- `whiteout/hazards.ts:13`: "It never knocks or crashes by itself". A cell knocks. Fourth round unfixed.
- `obstacles.ts:303`: "per-row seed". This is true only with `cellStream` (Whiteout). Alpine and Fjord still use the band stream.
- B3-8 (the W-056 rule drops about 30% of cells) is still undocumented.
- Tracker W-092 says the docs were corrected in `balance/w080/README.md` (824 rows, flip causes). Neither appears there or in any round-4 document.
- `w080/README.md` §5:
  - It asserts that Normal is materially more forgiving than Hard "for the competent skier" with no competent Hard rows (my run confirms it).
  - It does not report the 12 clean held-out catches.
- `CANDIDATE.md`: "identical row for row". The content is identical in every field; only the row order differs [B].

### B4-5 (minor, cat. 4): reading the weather is worth little to the expert on Normal, and steering for gaps can lose to ploughing

- **[B]** Paired over 40 seeds: Normal Sprint +2/−0, Normal Standard +6/−1. The owner's "preserve the advantage" holds on Hard (+17/−2, +23/−0) and for the competent skier [dev: +3, +8].
- On B4R-32 Hard Sprint the gap-steering reader is caught while ploughing wins.
- Acceptable, but the round-3 claim that reading wins Normal Sprint (+6/−0) no longer describes an expert.

**Direction:** record it in the README as the trade-off the owner accepted, or move the expert's Normal advantage back with drift-plough cost on Normal only.

### B4-6 (minor, cross-location, for the owner): Fjord Normal is harsh for a competent skier

- [dev, re-tabulated] Competent skier on Fjord Normal: Sprint 6/12, Standard 2/12. **Both Fjord Classic Normal courses are lost.**
- Not Whiteout's defect. Recorded because decision A asks for "Normal materially more forgiving", and a lost default course on Normal is the W-056 class of problem.

## Notes

**Unit suite.** Re-run on the frozen source with `--maxWorkers=1`: **61 files, 521/521** (`/tmp/revB4/unit.txt`).

**Reproduction.** These match the candidate rows exactly in outcome, distance and minimum gap:
- Whiteout W4H-02, 03, 12 and Classic Hard Sprint (reader);
- Alpine W4H-05 Hard Sprint;
- the stance runs' 9/12.

`candidate/balance/*.jsonl` matches `balance/w080/data/val_*.jsonl` field for field (312 and 208 rows).

**Browser–sim parity [dev].** I re-tabulated `parity_*.json`:
- The gap agrees within about 2 m for most of each run.
- Late divergences: Alpine 14–19 m and Whiteout Hard Sprint 25 m in the last 20 s.
- The one split outcome is a near-tie in the run-out.

**Keyboard and gamepad.** Keyboard tuck is binary (`Input.ts:247`). A binary tuck with a wider heading tolerance (tuck while the error is under 0.31 rad) wins every Classic Hard course, Whiteout Sprint by 45.7 m [B]. So the expert driver's progressive tuck is not a gamepad-only advantage. A 10 Hz feathered tuck also wins everything.

**Snowballs decide many Hard outcomes.**
- The sim's dodge allows near hits (radius 4 m, `nearKeep` 0.97). These are not counted in `snowballHits`.
- B4R-32 and Alpine W4H-05 both flip to wins with snowballs off.
- A human's dodge quality will move Hard rates more than any weather knob.

**Not verified:**
- anything visual (rim, cloud sea, drift mounds);
- real-time feel;
- audio;
- whether the crest lee is legible to a player (only that it drives the wind bed);
- human calibration of "expert" (all drivers are models);
- the warning-lead figures after W-089 (accepted from round 3's measurement with my own streaming wrapper).

**What would raise my scores to 9:**
- **Category 3:** stance payoff or an honest W-059 restatement (B4-3); the comments in B4-4 corrected.
- **Category 4:**
  - an owner ruling on the ranges. If they hold, Whiteout Hard re-tuned toward them and validated on at least 40 fresh seeds with intervals and at least 2 driver variants (B4-1).
  - a generation-time or matrix guard for B4-2, covering post-cave basins and the Hard run-out.
