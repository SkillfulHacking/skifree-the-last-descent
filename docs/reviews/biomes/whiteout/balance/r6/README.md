# Round 6 pursuit investigation (owner ruling 2) and Hard/Normal fixes (W-101, W-102)

Data: `data/`.
- `pursuit_curve.jsonl` holds the speed against the gap.
- `speed_slope.json` holds measured skier speed by grade.
- `catchup/*` holds the comparisons on tuning seeds `R6T-01…12` (Classic + 12 per cell).
- `tuning/*` holds Alpine Hard.

The runners are `tests/sim/ladder.measure.test.ts`, `tension.measure.test.ts`, `pursuitCurve.measure.test.ts` and `speedSlope.measure.test.ts`. Experiments use the `TUNE` target `yeti:YETI`.

## 1. What the shipped pursuit does (rounds 1–5)

Every speed term depends on where the Yeti is and where the skier is. **Three of them depend on the gap** (`YETI.pursuit` now names each one):

| Term | Effect |
|---|---|
| near boost | +9 m/s, ramping in from 60 m to 180 m behind |
| far boost | +7 m/s more, from 105 m to 170 m behind |
| far cap rise | his top-speed cap rises by up to +6 m/s over the same far range |
| gentle-ground cap | below 12°, at most 13 + 0.5 × grade m/s (not gap-dependent) |
| lunge | +7 m/s for 0.75 s within 13 m, with the grab animation (close range, shown) |
| slow-start cap | a chase that starts slowly ramps his pace up with the skier's (start only) |

**Measured settled speed** (Alpine, `pursuit_curve.jsonl`):
- **On 12–18° ground:** 16.5 m/s up to 60 m behind; 18.8 m/s at 100 m; 27 m/s at 140 m; 32.5 m/s from about 180 m.
- **On 9° ground:** 16.5 → 17.7 m/s, because the gentle-ground cap limits him.
- **With the three distance terms switched off:** 16.5 m/s at every gap.

So the shipped Yeti nearly doubles his speed when he falls far behind, and nothing tells the player. That is the rubber band in ruling 2.

## 2. Controlled comparisons (R6T seeds, three locations, Normal and Hard)

Two driving policies were used: the expert (progressive tuck, poles, Fjord reading, the Whiteout weather reader) and the competent driver (one sloppy turn every 12 s).

Each cell gives the win rate and the median peak gap during the chase. Codes are location (Al, Fj, Wh), difficulty (N, H) and length (spr, sta).

**Expert (progressive tuck)**: win rate / median peak gap over the chase (R6T-01…12)

| Config | Al N spr | Al N sta | Al H spr | Al H sta | Fj N spr | Fj N sta | Fj H spr | Fj H sta | Wh N spr | Wh N sta | Wh H spr | Wh H sta |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| legacy | 100% / 139 m | 100% / 161 m | 91% / 117 m | 58% / 138 m | 100% / 133 m | 91% / 141 m | 91% / 125 m | 58% / 128 m | 100% / 127 m | 100% / 143 m | 91% / 115 m | 75% / 136 m |
| off | 100% / 710 m | 100% / 2313 m | 100% / 329 m | 100% / 1186 m | 100% / 565 m | 100% / 1957 m | 100% / 371 m | 100% / 1272 m | 100% / 459 m | 100% / 1536 m | 100% / 328 m | 100% / 1213 m |
| sprint20 | 100% / 617 m | 100% / 1981 m | 91% / 196 m | 75% / 848 m | 100% / 472 m | 100% / 1590 m | 91% / 280 m | 66% / 779 m | 100% / 368 m | 100% / 1195 m | 66% / 177 m | 75% / 721 m |
| sprint15 | 100% / 538 m | 100% / 1713 m | 58% / 112 m | 58% / 488 m | 100% / 392 m | 100% / 1294 m | 75% / 212 m | 16% / 133 m | 91% / 289 m | 100% / 880 m | 33% / 107 m | 41% / 178 m |
| tline092 | 100% / 411 m | 100% / 1366 m | 100% / 127 m | 91% / 620 m | 100% / 385 m | 100% / 1145 m | 100% / 127 m | 41% / 106 m | 100% / 384 m | 100% / 1158 m | 41% / 89 m | 41% / 119 m |
| tline096 | 100% / 310 m | 100% / 1008 m | 66% / 80 m | 16% / 86 m | 100% / 288 m | 100% / 803 m | 33% / 79 m | 0% / 81 m | 100% / 287 m | 100% / 779 m | 25% / 82 m | 0% / 77 m |
| tline100 | 100% / 216 m | 100% / 653 m | 25% / 78 m | 0% / 84 m | 100% / 196 m | 100% / 480 m | 0% / 76 m | 0% / 79 m | 100% / 192 m | 91% / 447 m | 0% / 79 m | 0% / 76 m |
| ts92a | 100% / 329 m | 100% / 1042 m | 50% / 86 m | 25% / 95 m | 100% / 292 m | 100% / 797 m | 16% / 87 m | 0% / 84 m | 100% / 299 m | 100% / 783 m | 16% / 86 m | 0% / 79 m |
| gterm | 100% / 141 m | 100% / 167 m | 100% / 117 m | 100% / 141 m | 100% / 133 m | 91% / 141 m | 91% / 125 m | 58% / 128 m | 100% / 127 m | 100% / 143 m | 91% / 115 m | 75% / 136 m |

**Competent (one sloppy turn every 12 s)**: win rate / median peak gap over the chase (R6T-01…12)

| Config | Al N spr | Al N sta | Al H spr | Al H sta | Fj N spr | Fj N sta | Fj H spr | Fj H sta | Wh N spr | Wh N sta | Wh H spr | Wh H sta |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| legacy | 91% / 132 m | 83% / 152 m | 8% / 68 m | 0% / 73 m | 58% / 124 m | 33% / 127 m | 0% / 68 m | 0% / 63 m | 83% / 105 m | 50% / 120 m | 8% / 75 m | 0% / 70 m |
| off | 100% / 492 m | 100% / 1559 m | 8% / 68 m | 33% / 75 m | 100% / 260 m | 91% / 823 m | 0% / 68 m | 8% / 63 m | 83% / 183 m | 75% / 512 m | 25% / 76 m | 16% / 70 m |
| sprint20 | 91% / 392 m | 100% / 1208 m | 8% / 68 m | 0% / 71 m | 75% / 189 m | 41% / 203 m | 0% / 65 m | 0% / 63 m | 50% / 127 m | 33% / 130 m | 8% / 70 m | 8% / 63 m |
| sprint15 | 91% / 310 m | 83% / 886 m | 8% / 68 m | 0% / 69 m | 50% / 135 m | 8% / 114 m | 0% / 65 m | 0% / 65 m | 33% / 98 m | 25% / 85 m | 0% / 68 m | 0% / 63 m |
| tline092 | 100% / 173 m | 100% / 480 m | 0% / 66 m | 0% / 69 m | 58% / 92 m | 8% / 72 m | 0% / 64 m | 0% / 62 m | 83% / 165 m | 66% / 285 m | 0% / 66 m | 0% / 61 m |
| tline096 | 75% / 80 m | 66% / 132 m | 0% / 66 m | 0% / 69 m | 0% / 67 m | 0% / 64 m | 0% / 63 m | 0% / 62 m | 58% / 79 m | 16% / 87 m | 0% / 65 m | 0% / 61 m |
| tline100 | 8% / 69 m | 0% / 69 m | 0% / 66 m | 0% / 69 m | 0% / 65 m | 0% / 64 m | 0% / 63 m | 0% / 62 m | 8% / 70 m | 0% / 64 m | 0% / 65 m | 0% / 61 m |
| ts92a | 83% / 94 m | 75% / 165 m | 0% / 66 m | 0% / 69 m | 0% / 68 m | 0% / 67 m | 0% / 64 m | 0% / 62 m | 58% / 85 m | 16% / 93 m | 0% / 66 m | 0% / 61 m |
| gterm | 100% / 132 m | 91% / 152 m | 8% / 68 m | 0% / 73 m | 66% / 124 m | 33% / 127 m | 0% / 68 m | 0% / 63 m | 83% / 105 m | 50% / 120 m | 16% / 75 m | 0% / 70 m |

**First 1.5 km of the chase, by behaviour** (`catchup/tension_*.jsonl`, Classic plus 8 seeds, Normal, both lengths): times caught.

| Behaviour | Shipped | Distance terms off | Terrain-paced 0.92 |
|---|---|---|---|
| Early crash, Alpine / Fjord / Whiteout | 3, 4, 9 of 18 | 2, 4, 9 | 17, 18, 17 |
| Late crash | 4, 1, 5 | 1, 1, 2 | 5, 17, 5 |
| Clean skier | never | never | never |

## 3. Findings

1. **Switching the distance terms off removes the pursuit.**
   - A clean expert's lead grows without limit: 330–710 m median peak on Sprint, 1.2–2.3 km on Standard. The Yeti leaves the screen and the rear-view inset for most of the run.
   - Hard Standard goes from 58–75% to 100% everywhere.
   - Mistakes made after a lead has built cost nothing that matters. This is the "significant regression" ruling 2 anticipates.
2. **A telegraphed sprint on a fixed clock** (every 15–20 s, +6–8 m/s for 4 s) restores danger only for a player who is already near. A clean expert still escapes by kilometres. A sprint frequent enough to threaten Standard catches competent players on Fjord almost every time.
3. **Terrain-paced pursuit** paces the Yeti at a competent skier's measured speed for the grade under him, with no gap term.
   - It is predictable and the same for every player. But the outcome becomes a knife edge decided by the sign of (player's average speed − Yeti's): 4% of pace takes Alpine Hard expert Sprint from 100% to 66% to 25%, and competent Normal from 100% to 75% to 8%.
   - Each policy either always escapes or is always reeled in, because nothing pulls the gap back toward a middle.
   - Crashes become nearly always fatal (17–18 of 18), because the Yeti is already at cruise pace while the skier gets up.
   - The model drivers vary their speed far less than people do, so real players would spread more. But the knife edge is structural, not an artefact.
4. **What the distance terms were doing** was holding the gap near an equilibrium of about 100–140 m. That is why mistakes, rather than small average-speed differences, decided outcomes, and why the Yeti stayed in view. Any replacement has to do that job in a way the player can see and understand, or the pursuit turns into either a lost Yeti or a deterministic catch.

**Recommendation (owner decision):** keep the shipped pursuit in the round-6 candidate. Replacing it in a round without a human playtest would swap a known, measured balance for a knife edge. For round 7 there are two honest options:
- **(a)** Keep a gap-holding term but make it visible and explained. For example, the inset and HUD show the Yeti "hunting at full pace" when he is far back, and audio and animation tell him apart from a close chase.
- **(b)** Accept terrain pacing, tune it against the human playtest, and give crashes a recovery allowance.

Neither restores the old catch-up silently; both need playtest data.

## 4. Changes in this round

### W-101 and W-102: gentle-ground cap
**The cause of the crash-free losses on Hard Standard (W-101):** on long gentle basins (8–9°) the Yeti's gentle-ground cap (13 + 0.5° = 17.3–17.6 m/s) was faster than a tucked skier can go there. The tucked terminal speed is 14.0–15.4 m/s, gravity against snow friction and tuck drag.

**What was tried first:** three expert techniques (progressive tuck, binary tuck, poles) all lost those basins in round 5 (review B5-2). No skiing line could win them.

**The same cap caused the finish trap (W-102):** on the 5° finish run-outs the Yeti could run 15.5 m/s while a skier coasts toward 8–9 m/s.

**The change:**
- Below 12°, the Yeti is now also never faster than a tucked skier settles on that grade, with a 9 m/s floor.
- That is the rule's own stated intent: "not much faster than a gliding skier".
- It is not gap-dependent, not hidden from the terrain, and lowers his speed only.
- Pinned by `yeti_pursuit.test.ts`.

**Effect on R6T seeds (`catchup/gterm_*` against `legacy_*`):**

| Case | Before | After |
|---|---|---|
| Alpine Hard Standard, expert | 58% | 100% (the basins no longer decide it) |
| Whiteout Normal competent: where the closest point falls in the chase | 1.0 (the finish) | 0.5 Sprint, 0.8 Standard |
| Whiteout Normal competent: gap won back after the closest point (median) | 0 m | 33 m |

- Whiteout Normal competent win rates are unchanged (83% / 50%).
- Fjord and Whiteout Hard are unchanged.

### Alpine Hard pace
The basin trap had been holding Alpine Hard down. With it gone, Alpine Hard needed more pace: `difficultyPace.hard` 1.09 → 1.135. On R6T-01…24, the two expert techniques diverge:

| Technique | Sprint | Standard | Classic Hard |
|---|---|---|---|
| Progressive tuck | 88% | 63% | won |
| Binary (keyboard) tuck | 63% | 21% | lost |
| Pooled | 75% | 42% | |

The gap between the two techniques is W-101's "tuck sensitivity".

#### Alternative keyboard strategies (`keyboard/tol*.jsonl`, R6T-01…24, Alpine Hard)
The binary driver above is a cautious keyboard player: it drops the tuck whenever its heading is more than 0.16 rad off the line. A keyboard player can instead hold the full tuck through moderate turns (the tuck halves the turn rate, so the turn is wider). Before changing the course or the controls, the brief asks whether another strategy wins:

| Keyboard tuck held up to | Sprint | Standard | Classic Hard |
|---|---|---|---|
| 0.16 rad (the cautious driver) | 63% | 21% | lost |
| 0.30 rad | 92% | 58% | won |
| 0.45 rad | 92% | 88% | won |
| 0.70 rad | 96% | 83% | won |

A winning keyboard strategy exists: hold the tuck through the gentle turns and drop it only for the sharp ones. So the course is not unwinnable on a keyboard, and nothing in the terrain or controls was changed for it. Two points stay open for round 7:
- whether players find this technique without being told (a playtest question; the tutorial never mentions it);
- with it, Alpine Hard Standard is above the 25–50% target. Hard is now bounded by technique rather than by a hidden pace.

### Fjord and Whiteout Hard pace (`tuning/wfH*.jsonl`, R6T-01…24)
Before this round, Whiteout Hard Sprint was too easy for the weather reader (100%). Fjord Hard Standard was at 62–71%. Both locations' `difficultyPace.hard` were swept:

| Hard pace | Fjord Sprint (expert / keyboard) | Fjord Standard | Whiteout Sprint | Whiteout Standard | Classic Hard Standard, expert (Fjord, Whiteout) |
|---|---|---|---|---|---|
| 1.00 | 92 / 83 | 50 / 33 | 92 / 88 | 71 / 46 | won, won |
| 1.02 | 79 / 62 | 50 / 33 | 67 / 58 | 54 / 33 | won, won |
| 1.04 | 83 / 62 | 21 / 25 | 50 / 50 | 29 / 4 | lost, won |
| 1.07 | 58 / 50 | 17 / 25 | 29 / 21 | 12 / 0 | lost, lost |

The response is steep: 2% of Yeti pace moves Whiteout Hard Standard keyboard wins from 33% to 4%. Both locations now use **1.02**, the largest value that keeps Classic Hard winnable and both techniques inside or near the bands. Held-out validation on R6V is in `validate2/`.

### Storm build-up cue (review B5-1)
Whiteout Hard's storms strengthen past 3 km (×1.5 by 8 km), and until now nothing told the player. A caption now appears when the build-up begins and again when it peaks (`GameSession`, test `storm_build_cue`).

### Labels (ruling 1)
`difficultySummary()` (see `CourseConfig.ts`).

Validation on fresh held-out seeds (`R6V-…`) is in the round-6 candidate.

### Watch and skip parity with the gentle-ground cap (`catchup/skip_gterm.json`)
- **Coverage:** every location; Normal and Hard; skilled and cautious arrivals; all six skip moments.
- **Result:** the Yeti's hand-off position is identical whether the cinematic is watched or skipped (spread 0.0 m), and so is the gap 3 s into the chase.

### Endless with the gentle-ground cap (`catchup/endless_{legacy,gterm}.jsonl`)
- **Coverage:** all three locations; Classic plus 3 seeds; encounters 0–3; Normal and Hard; skilled, competent and early-crash drivers.
- **Normal:** unchanged.
- **Hard:** a skilled skier's second encounter is caught 5/12, against 10/12 before. That is the basins again. Encounters 3 and later are unchanged: 11/12 and 12/12 caught, as Endless escalation intends.

## 5. Held-out validation of the Hard pace (R6V-01…24, `validate2/`)
Fresh seeds that were not used for tuning, with the shipped 1.02 pace. Wilson 95% intervals; n = 24 per cell.

| Location | Technique | Sprint | Standard | Classic Hard Standard |
|---|---|---|---|---|
| Fjord | progressive tuck | 71% [51–85] | 42% [24–61] | won |
| Fjord | cautious keyboard | 75% [55–88] | 29% [15–49] | won |
| Fjord | keyboard, tuck held to 0.45 rad | 75% [55–88] | 29% [15–49] | won |
| Whiteout | weather reader, progressive | 92% [74–98] | 38% [21–57] | won |
| Whiteout | weather reader, cautious keyboard | 83% [64–93] | 42% [24–61] | lost |
| Whiteout | keyboard, tuck held to 0.45 rad | 88% [69–96] | 38% [21–57] | lost |
| Whiteout | does not read the weather | 21% | 0% | lost |
| Alpine | keyboard, tuck held to 0.45 rad | 92% [74–98] | 58% [39–76] | won |
| Fjord / Whiteout | sloppy (mistakes) | 4% / 12% | 0% / 0% | lost |

- Fjord is inside both bands.
- Whiteout Standard is inside its band.
- **Whiteout Hard Sprint is above its band on R6V (83–92%), though it was inside it on R6T (58–67%).** Pooled over both seed sets the reader wins 79%. The pace was not re-tuned on the validation seeds, because that would fit those seeds. Record this as uncertain, slightly above target.
- Classic Hard Standard is won in every location by the progressive tuck. In Whiteout the keyboard drivers lose it.
- A skier who does not read the weather cannot win Whiteout Hard. That is by design: Hard is about reading the storm. It is also why the playtest asks whether players can see the next hazard.

Single-encounter tension on Hard (`validate2/tension.jsonl`, 9 seeds; summarise with `tools/tension_summary.py`):
- the skilled skier is caught 0–4 times in 9;
- crashing, a poor route and caution are each caught in most runs;
- a competent skier is caught 5–8 times in 9.
