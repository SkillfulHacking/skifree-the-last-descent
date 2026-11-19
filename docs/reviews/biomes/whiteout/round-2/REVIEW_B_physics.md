# Whiteout Ridge, round 2: Review B (Physics and Gameplay Engineer)

- **Reviewer:** B, Physics and Gameplay Engineer. Owns category 3 (Skiing and hazard mechanics) and category 4 (Difficulty and fairness).
- **Nature:** model-based reviewer, **not a human playtester**. I did not play the game in real time. Every judgement about feel comes from code, headless simulation and still frames.
- **Build:** `b70a793` (branch `pass5-whiteout`, per `round-2/CANDIDATE.md`). I read `git diff 3f7bc45 b70a793 -- src tests`.
- **Examined:**
  - Source: `src/world/biomes/whiteout/{hazards,storm,biome}.ts`, `views/hazardViews.ts`, `src/world/capabilities/environment.ts`, `src/world/hazards/{field,hazard}.ts`, `src/physics/obstacles.ts` (clear zones), `src/physics/environment.ts` and `SkierPhysics.ts` (SLIP_EDGE, pop), `src/game/GameSession.ts` (captions).
  - Driver: `tests/sim/whiteoutDriver.ts`, `tests/sim/balance.ts`, `tests/sim/driftRow.measure.test.ts`.
  - Data: every `.jsonl` in `balance/round2/` (2,232 runs), which I recomputed and paired by seed myself. Also `round-2/courses.json` against `round-1/courses.json`, and frame `evidence/29_play_drift_row_storm.png`.
- **My own experiments** were run in `/tmp/expB2`, using copies of the harness with only the import paths changed. Before relying on them I checked them against the published data: **all 144 overlapping published rows reproduce exactly**, outcome and time. Numbers marked **[B]** are mine. Developer numbers are marked **[dev]**, and I re-derived them unless I say otherwise.
- **Measurement limit (unchanged):** the driver still sees through fog. In round 2 the storm fog density was raised from ×11 to ×21 (`storm.ts:33`), so this blind spot is now larger than it was in round 1.

## Verdict: **FAIL** (cat. 3 = 7, cat. 4 = 6; the target is 9)

| # | Category | R1 | R2 | One-line justification |
|---|---|---|---|---|
| 1 | Visual art direction | 7 (lc) | 7 (lc) | Only frame 29 viewed. The orange gap flags read, but the mounds do not show at about 50 m in a storm. |
| 2 | Environmental uniqueness | 7 (lc) | 7 (lc) | Not assessed in depth. |
| **3** | **Skiing and hazard mechanics** | **5** | **7** | Drift gaps now pay, reproducibly. The hop no longer dominates. Physics matches the drawn mound. But two of the four weather costs (blizzard, front headwind) still have no mitigation that pays, and a failed jump costs less than ploughing. |
| **4** | **Difficulty and fairness** | **4** | **6** | Hard ≥ Normal is fixed, and the Normal Sprint ladder is sensible for a weather reader. But the signature Classic Sprint on Normal is lost by every policy (worse than round 1), Normal Standard is still a cliff, 38% of blind blizzard knocks still get less than 3 s of warning (root-caused below), and the lee caption advises a losing move. |
| 5 | Cinematics | 7 (lc) | 7 (lc) | Not examined. |
| 6 | Performance and stability | 7 (lc) | 7 (lc) | About 2,600 simulated runs, all deterministic. No soft-locks and no timeouts. |
| 7 | Accessibility and controls | 6 (lc) | 6 (lc) | Blizzard captions now exist for active cells but often arrive under 3 s before the knock. A caption of about 90 characters cannot be read in that time. |
| 8 | Overall player experience | 6 (lc) | 7 (lc) | On Sprint, reading the drifts now visibly pays off. |

## Round 1 → round 2

| R1 finding | Status | Evidence I checked |
|---|---|---|
| **F1** Weather decisions do not pay | **Partly fixed** | **Drifts: fixed.** Paired against blind, Normal Sprint, recomputed from the raw data: `driftsOnly` +7/−0 (W034) and +9/−0 (W2H); `informed2NoLee` +6/−0 and **+12/−0**, 6.4 s and 5.5 s faster when both win. That passes my round-1 bar (≥ +3 net, ≥ 2 s), and blind's own rate held (15/24 in round 1 → 14/24). **Blizzard stance: not fixed** (N3). **Front headwind: not fixed**; the lee does not pay (N3). **Skid drag** now scales with the stance (`environment.ts:272-273`): fixed. **Blizzard slip** still has no exposure term (`hazards.ts:251`). |
| **F2** Drift hop is dominant | **Fixed as a dominant strategy; residue remains (N4)** | `hopSpam` loses to blind on W034 (11/24 against 14/24). But on the held-out seeds it is **+3/−0 against blind** (13/24 against 10/24), so the README's "hopSpam ≤ blind" holds only on the tuning seeds. `hopTimed` is 14/24 against 14/24 (W034) and +4/−0 (W2H). Both stay well below gap reading. The mound is still not in the terrain height, so a grounded skier is still drawn inside a 1.7–2.2 m mesh. |
| **F3** Blizzard knocks without warning | **Partly fixed** | Cells already active are now captioned (`GameSession.ts:816`). **[B]** Of 47 blind knocks on Normal Sprint (W034 + W2H), 4 had no warning event at all and 14 were warned less than 3 s ahead. That is **62% warned ≥ 3 s, against my 90% bar** (round 1: about 41% had any warning). The root cause is in N1. |
| **F4** Ladder inverted / Normal cliff / Classic lost | **Partly fixed** | Hard intensity is 0.8 = Normal (`biome.ts:151`): fixed. Normal Sprint for an informed reader is 42/48, against Fjord 24/24: acceptable. Classic Standard on Normal is now won by the informed reader (553 s, gap 50 m). **Classic Sprint on Normal is still lost, now by every policy** (N2). **Normal Standard: still a cliff** (N2). |
| **F5** Relaxed knocked more than Normal | **Partly fixed** | Knock severity now scales with intensity: Relaxed keeps 0.74 of speed, against 0.58 on Normal. Knocks are still about 1.6–2.2× more frequent on Relaxed (blind Sprint 1.71 against 1.04; Standard 7.08 against 3.17). Speed lost to knocks per Sprint is now about equal (0.45 against 0.44 × v). Low impact, because Relaxed is won 48/48 by blind. |
| **F6** Drift view ≠ physics | **Fixed** | `driftProfile` is read by both the physics (`hazards.ts:76-93`) and the view (`hazardViews.ts:93-118`, the same formula). The gap is drawn at a 13 m half-span and kept clear of mounds (`hazards.ts:173`). Residue: the "plough" caption and audio cue still fire on the circle `dist < r` (`environment.ts:374`), while the mound reaches 2.1 r along the row. |
| **F7** Gap override can leave the piste | **Not fixed (latent)** | There is still no second clamp after `rx ± 12` (`hazards.ts:153`). **[B]** Across 406 rows on 48 Sprint seeds, 0 gaps reach the piste edge (minimum margin 12.7 m). Harmless today. |
| **F8** Terrain step beside the line | **Fixed in code (not re-verified per seed)** | `skiableAcross` checks the traverse and the gap (`storm.ts:193-219`, `hazards.ts:156-160`). No step crashes appear in the published crash logs. |
| **F9** Comments contradict code | **Not fixed** | `hazards.ts:13` still says the blizzard "never knocks". `hazards.ts:12` still says the slip is "more on exposed ground". `environment.ts:241` still says "upright skier". |
| **F10** No hazard frames | **Partly fixed** | A drift row in a storm is now shown (frame 29). There is still no frame of a blizzard cell in its telegraph or active phase. |

## Driver audit: does "informed" use only what a player has?

Mostly yes, with four idealisations:
1. **Drift gaps** come from `params.gapX`. These are the orange flags, which are drawn (`hazardViews.ts:174-186`), so this is legitimate. But the driver reads a row from 110 m, while in a storm the mounds fade at about 60 m (code comment). In frame 29, at about 50–57 m, **the mounds are not visible at all**; only two small flags are. **[B]** I limited reading in storms to 60 m and to 45 m (`informedFog60`, `informedFog45`). The advantage survives: +4/−0 and +5/−0 on W034, **+11/−0 on W2H**. The drift result is robust to late reading.
2. **Blizzard stance** uses the cell's exact phase strength and radius. A human sees only a curtain, so this flatters the driver. It does not change conclusions, because the stance has no payoff anyway (N3).
3. **The lee shoulder** uses `leeLaneAt`, the exact position of a cleared, skiable shoulder. The lee is **not marked** in the world: no view code references `LEE`. A human only gets "the left shoulder is the lee". The driver is therefore better informed than a player, and the lee still does not pay.
4. Obstacle avoidance sees through fog (unchanged).

**Driver defect (measurement):** `whiteoutDriver.ts:176` stops considering a cell once the skier is 10 m past its centre. But a knock can occur up to about 51 m from the centre (`edge` > 0.7). So the published `blizzOnly` re-tucks inside the knock zone and still takes 0.67 knocks per run. **[B]** With the window fixed (`blizFix`), knocks fall to 0.42 and 0.25, but wins do not rise: 12/24 (−2) and 11/24 (+1). See N3.

## New findings

### N1 (Major): Blizzard alerts are silently consumed between 150 m and 233 m

`environment.ts:363-370`: a cell is *tracked* once `near()` includes it, which for r = 58 is up to 75 + 100 + 58 ≈ 233 m ahead. A *transition* is emitted only if the cell is under 150 m ahead (`HAZARD_ALERT_RANGE`), yet `tr.phase = ph.phase` is updated at any range. Consequences:
- A telegraph that starts 150–233 m out is never reported. The first report is the `active` transition, which typically comes 55–100 m out.
- A cell already active when it is first tracked, and still active on arrival, is never reported at all.

**[B]** I instrumented 48 blind Normal Sprint runs: 47 blizzard knocks, of which 4 were never warned and 14 were warned 0.2–2.4 s ahead (example: W2H-14, active reported 55.7 m out, knock 0.24 s later). The caption is about 90 characters (`GameSession.ts:820`), which cannot be read in 2 s. In a ×21 storm the curtain is not visible beyond about 120 m either. Deaf and hard-of-hearing players, and players in a storm, are still knocked without a usable warning.

**Fix:** update `tr.phase` only inside the alert range. On entering the range, emit the cell's current phase if it is telegraph or active. Or base the range on arrival time: speed × (telegraph + 2 s). Shorten the active-cell caption to fewer than 40 characters ("[blizzard ahead — stand up]").

### N2 (Major): The signature Classic Sprint on Normal is lost by every policy, and Normal Standard is still a cliff

**[B] `CLASSIC-SPR@WHITE`, Normal:**
- Caught: blind (583 m), `informed2NoLee` (1,173 m), `informed2` (615 m), `informedFix` (1,173 m), `driftsOnly` (720 m), `linesOnly` (584 m), `hopTimed` (623 m).
- `courses.json` agrees: caught at 84.6 s.
- Round 1's blind won this course with a 19.6 m gap, so it got harder.
- Alpine and Fjord Classic Sprint on Normal: won, with gaps of 54 m and 39 m.
- **[B] Ablation on this course:** without headwind, the informed reader wins (gap 33 m). Without drifts, blind wins.
- **Trace:** the first chase starts at z 260 while a front builds. The informed skier slows from 19.6 to 13.6 m/s across the basin (z 890–1050, storm 0.85, no drift involved), then must cross 21 m to the row-4 gap at z 1123 and is caught at 1,169 m.

The first Whiteout run most players start therefore cannot be won on Normal, even with every decision read correctly.

**Normal Standard (re-derived):** informed 13/24 (54%), blind 3/24, against Fjord 22/24 and Alpine 24/24. Hard Standard is 0/48 for **every** policy (Fjord Hard Standard is also 0/24, so this is partly an engine issue). The developers say the same (W-037 open).

**Fix direction (within the owner's constraints):** do not touch the Yeti and do not weaken the storm.
- The Classic seed is fixed, so author it: put the first front's schedule offset (timing, not strength) after the first chase is under way, or give the basin segment real shelter that the player can earn (see N3).
- For Standard, make the late-chase cost mitigable rather than lower.

### N3 (Major): Two of the four weather costs still have no mitigation that pays, and the lee caption advises a losing move

**Weather costs and their mitigations (Normal Sprint, paired against blind, W034 / W2H):**

| Cost | Mitigation | Wins | Time when both win |
|---|---|---|---|
| Drift rows | take the gap | **+7/−0 / +9/−0** | 7 s faster |
| Crest line in a storm | storm line | +2/−0 / +5/−1 | 0 s |
| Blizzard knock | stand up | +0/−0 / +2/−0 | −0.3 to −0.2 s |
| Blizzard knock, my window fix [B] | stand up | +0/−2 / +1/−0 | |
| Front headwind and slip | lee shoulder (`leeOnly`) | +3/−3 / +3/−1 | |

- **Blizzard:** a knock keeps 58% of speed, and riding it out upright costs about as much. Avoiding the knock is an even trade, not a skill payoff.
- **Front:** the headwind is a flat `0.001 × gustK` drag on the main line, whatever the tuck or heading (`environment.ts:242`). The only thing that reduces it is the lee, and **[B] adding the lee to the full reader costs runs in 12 paired cells: +5/−12 in total, −5 on W2H Normal Sprint** (`informed2` 17/24 against `informed2NoLee` 22/24). It is about 1 s faster when both win, but riskier, because the lee lies in the drift rows. **The front caption now tells every player "the left shoulder is the lee"** (`GameSession.ts:1194`), which steers them onto a line the measurement says loses.
- Skid drag (now stance-scaled) applies only at exposure ≥ 0.86, so it is almost never felt on the main line.

**Fix direction:**
- **Blizzard:** make standing up cheap and the knock expensive, for example by scaling the upright drag penalty down while the cell blows, or by making a check below `knockSpeed` cost less than the knock. The knock strength itself is unchanged.
- **Front:** scale headwind by stance and heading, so a skier who rises and carves across the wind in a storm pays less than one tucked on the crest. Keep the lee clear of drift rows (don't place mounds where `leeLaneAt` is true), mark it (wands), and only then caption it. Until then, remove "the … shoulder is the lee" from the caption.

### N4 (Minor): A jump that fails to clear a drift costs less than ploughing it, and the stagger is unexplained

**[B] Rerun of `driftRow.measure.test.ts` with N = 24 (102 covered rows; the developers used 50):**

| Line | Gain over ploughing | Faster than plough in |
|---|---|---|
| bend over 40 m | +0.28 s | 69/102 rows |
| bend over 70 m | +0.46 s | 77/102 |
| bend over 100 m | +0.56 s | 80/102 |
| `hopTimed` | +0.21 s | 70/102 |
| `hopSpam` | −0.08 s | |

- `hopTimed` clips the drift (an extra knock) in **76 of 102 rows**, yet is still faster than ploughing in 70 rows. A clip keeps 0.72 of speed and skips the drag while in the air; ploughing keeps about 0.65.
- A clean clear (no extra knock) happens in about 25 rows, gaining 0.3–1.2 s where it works. So a well-timed jump can sometimes win cleanly, and `hopTimed` still beats gap100 in 32 rows.
- The clip has no caption or cue (only blizzard hits are captioned, `GameSession.ts:823`). The player feels punished but was in fact rewarded relative to ploughing.

**Fix:** make a clip cost at least what ploughing costs: `clipKeep` at or below the plough's kept share, then the normal drift drag on landing. Caption it: "[skis catch the drift crest]".

### N5 (Minor): Opposite-side gaps in close succession punish gap reading

**[B]** On W034-05, Relaxed, rows at z 1990 and z 2095 have gaps 16.8 m left and 16.8 m right of the line. The reader cannot cross 33 m in about 100 m, ploughs row 8's flank at 7.6 m/s and is caught, while blind wins. This is the only Relaxed Sprint loss for a gap reader. It is rare: 2 of 48 seeds (W034-05, W2H-18). **Fix:** when two covering rows are less than about 150 m apart, put both gaps on the same side.

### N6 (Minor): Drift readability and teaching

- Frame 29 (gameplay camera, storm, row about 50–57 m ahead): no mound is visible. Two orange panels about 8 px across (x ≈ 408 and 537, y ≈ 390) are the only cue. They sit next to an orange rim wand (x ≈ 400, y 430–470) that reads similarly.
- Nothing in the game says that orange flags mark a drift gap, or that ploughing is slow. The only drift text is "[skis plough into a deep drift]", shown after the fact.
- The grounded skier still passes inside a 1.7–2.2 m mound, because the mound is not in `heightAt` (inferred from code; no frame shows it).

**Fix:** give the flags a distinct shape (a gate pair with a cross-banner), add a one-time hint, and let the skier's rendered height follow `driftDepth` while ploughing (sunk and sprayed), or draw a trench.

### N7 (Minor): Comments and documents

- The F9 comments are unchanged.
- The README calls the advantage "reproducible on held-out seeds". That is true for the drift decision (verified). It is not true for the lee, and the hop policies do better on held-out seeds than on tuning seeds (hopSpam +3/−0, hopTimed +4/−0 against blind on W2H).

## Answers to the brief

- **Every weather cost mitigable?** No. Drifts and the crest line in a storm: yes. Blizzard knock: an even trade. Front headwind: no mitigation that pays, and the lee loses on the held-out seeds (N3).
- **Drift gap worth taking without an arbitrary boost?** Yes. The gap gets no speed bonus. Its value comes from the plough now costing about 35% of speed (drag 0.22, friction 4). It is worth 0.3–0.56 s and about 3 m/s of exit speed per covered row, and it survives reading at 45 m.
- **Hop:** it no longer dominates. A timed jump sometimes wins cleanly, but a failed jump is still rewarded (N4).
- **Held-out reproducibility:** yes for the full reader without the lee: W2H +12/−0, gap 43 m against 3 m (verified). No for the lee.
- **Ladder:** Relaxed is safe. Normal Sprint is sensible for a reader (88% against Fjord 100%) and harsh for a blind skier (50%). Normal Standard and the Classic Sprint are too steep. Hard is distinct through Yeti ×1.07 and snowballs (8 hits in 5,463 throws with a perfect dodge), with weather equal to Normal: acceptable.
- **Soft-locks:** none. The 2,232 published runs and my roughly 400 end in victory or caught. Drift friction fades below 5 m/s (`hazards.ts:213`), so a bogged skier can pole out.

## What would raise my scores to 9

**Category 3:**
- **N3:** the blizzard stance and a front mitigation each show a paired benefit on Normal Sprint on both seed sets: at least +2 net wins, or at least 2 s when both win, with no net loss. The lee is either made to pay or dropped from the caption.
- **N4:** a clipped jump costs at least as much as ploughing, and the clip is captioned.
- **F2 / N6:** the skier no longer renders inside the mound.
- **F9 / N7:** the comments are corrected.

**Category 4:**
- **N2:** `CLASSIC-SPR@WHITE` on Normal is won by the informed reader with a gap above 15 m, and blind still often loses. Normal Standard for the informed reader is at least 75%.
- **N1:** at least 90% of blind blizzard knocks are preceded by a caption at least 3 s earlier, measured with the listener method (`/tmp/expB2/sim/leads.measure.test.ts`).
- **N5:** paired opposite-side rows are fixed.
- **Evidence:** a fog-limited driver (perception capped at the rendered visibility) or human playtest data, plus a frame of a blizzard cell.

My experiment files (driver copies with `blizFix` and `fogRead`, plus the leads, classic, trace and rows probes) are in `/tmp/expB2/sim/`, and the results are in `/tmp/expB2/*.json` and `*.jsonl`.
