# W-079 / W-080 — Hard difficulty ladder (round 4, owner's decision A)

**Owner's decision A:** Hard is difficult but consistently winnable through exceptional skill. A clean expert must be able to win Classic Hard Sprint and Classic Hard Standard in Alpine, Fjord and Whiteout. The provisional held-out expert ranges are Hard Sprint 50–75% and Hard Standard 25–50%. Normal must be materially more forgiving than Hard, and Relaxed accessible without optimised skiing. No global Yeti speed increase, no rubber-banding, no forced close calls, and no invisible boosts. Whiteout is to be fixed through its environment, not by slowing the Yeti, and the advantage of reading the weather must be kept. W-089 (hazard streaming in the simulator) had to be fixed first.

All numbers are headless simulations (`tests/sim/ladder.measure.test.ts`) unless marked as browser. They are model measurements, not human play.

## 1. Measurement fixes, applied before any balance change

**W-089, hazard streaming.** The simulator now streams hazards from z − 80 to z + 400, as the game does (`simulate.ts`). Before, the next band's drift rows and blizzard cells were invisible to the driver. A unit test (`tests/unit/sim_streaming.test.ts`) checks this: 1,420 missed sightings before the fix, 0 after.

**Snowball dodge only on the snow.** The simulator's snowball dodge used to steer even in the air, and the landing that followed came down sideways. This was the expert's only crash on Alpine Classic Hard Standard, at 215.6 s, after leading by 96–132 m. A player doesn't steer hard into a landing.

**The expert driver** was frozen before the final candidate runs and used unchanged for every candidate and for validation (`balance.ts`, `whiteoutDriver.ts`, `readerDriver.ts`). It combines:
- the racing line, with the skilled autopilot's line following;
- a progressive tuck: full tuck below 0.16 rad of heading error, easing out over the next 0.3 rad (`XTUCK=0.3`). Round 3's driver dropped the tuck entirely the moment the error passed 0.16 rad;
- pole pushes on slow ground (`POLE=1`): grounded, not braking, below the speed where poles stop adding;
- on Fjord, the squall reader (`FJORD_READ=1`): wind gates, rock and alternate lines;
- on Whiteout, the weather reader (`informed2NoLee`), with a precise blizzard stance. It rises only for a gust that can knock it, inside the knock radius, at knock strength and above knock speed, looking 0.45 s ahead. Round 3's reader stood up for the whole cell;
- snowball dodging, on the snow only.

The Whiteout weather-blind comparison is the same driver with the weather ignored: lines always, drifts ploughed, blizzards ignored.

## 2. Baseline: what made Hard unwinnable

These runs use round 3's rules, with the tuning seeds Classic plus W2H-01…12 (`data/ladder_base.jsonl`, `data/ladder_expert.jsonl`):

- **Clean runs were caught.** With no crash and no knock, the expert was caught in:

  | Location | Hard Sprint | Hard Standard |
  |---|---|---|
  | Alpine | 5 | 8 |
  | Fjord | 1 | 6 |
  | Whiteout | 8 | 8 |

  That is an inevitable loss, which the owner ruled out.
- **The Hard Yeti's cruise is 16.5 × 1.07 = 17.7 m/s** (× the location's pace). On Fjord's and Whiteout's terrain, the expert's sustainable speed was about the same. Gentle ground is where the Yeti gains: on 9° slopes the expert does 15.4 m/s against the Yeti's 17.5 m/s cap (`data/abl4.jsonl`, `scratch` traces).
- **Whiteout ablation** (Hard, the expert reader, `data/abl4.jsonl`). The ablation still used round 3's stance-independent headwind. Over 12 held-out seeds:

  | Variant | Sprint wins | Standard wins | Classic Hard Sprint |
  |---|---|---|---|
  | Baseline | 8/12 | 2/12 | lost |
  | No headwind | 10/12 | 7/12 | lost |
  | No crosswind skid | 8/12 | 3/12 | lost |
  | No blizzards | 10/12 | 2/12 | lost |
  | Slopes ×1.1 | 8/12 | 5/12 | lost |
  | All weather off | 12/12 | 11/12 | won |

  The headwind was the largest single cost. It was charged at the upright skier's figure whatever the stance, so it was a flat tax that a perfect run could not reduce.
- **Whiteout Classic Hard Sprint** (traces): the whole chase runs inside the course's first storm (strength 0.8–0.97). Two things decided it:
  - Drift rows whose gap lay 17–21 m off the line. In a storm the gap shows only about 60 m ahead (W-075), about 3.5 s at Hard pace, and the reader hit three of them.
  - The "sheltered" main line was as exposed as the crest shortcut beside it, so the weather-blind crest line won the run while the reader was caught.

## 3. Candidates (isolated; same driver and seeds; Classic plus W2H-01…12)

| Candidate | Effect | Result |
|---|---|---|
| Alpine pace ×1.00 / ×1.05 / ×1.10 (`grid.jsonl`) | Hard Sprint 11/12, 10/12, 10/12; Standard 10/12, 8/12, 8/12; all Classic Hard courses won | Hard barely depends on the pace; Normal pressure decides (W-079, below) |
| Headwind follows the stance (`grid.jsonl` F_hw1 / W_hw1) | Fjord Hard Standard 0/12 → 4/12, Classic Hard Standard won; Whiteout Hard Standard 4/12 → 7/12 | **kept** (physics consistency, below) |
| + Fjord headwind 0.0010 (`fj.jsonl` F10) | Restores F-039 (the coast is slower than Alpine); Fjord Hard Sprint 7/12, Standard 4/12, Classic Hard won 7 m / 36 m | **kept**; 0.0012 lost Classic Hard Sprint |
| Whiteout slope floor 15° / 16° (`cands.jsonl`) | Classic Hard Standard won; Classic Hard Sprint still lost | 15 **kept** |
| Crest lee for the main line 0.75 / 0.60 (`cands3.jsonl`) | The reader wins Classic Hard Sprint; 0.60 wipes out the reading advantage on Normal | 0.75 **kept** — but its first version also lowered the exposure that hazard placement reads (fewer blizzard cells, part of its "win"). Fixed: the wind's grip only (`rf2.jsonl`, Classic Hard Sprint lost again) |
| Drift gaps 12–15 / 14–18 m from the line (`gap.jsonl`) | Classic Hard Sprint won 17 m / 20 m | 14–18 **kept** |
| Ablations of the package (`gap2.jsonl`) | Without the crest lee: Classic Hard Sprint lost; with a 14° floor: won by only 10 m | every part needed |
| **Rejected:** drift plough drag 0.30 (`dr.jsonl`) | Normal unchanged; Classic Hard Standard lost | rejected |
| **Rejected:** Whiteout headwind 0.0013 / 0.0016 / 0.0020 (`wh.jsonl`) | Does not restore the Normal Sprint reading gap; Classic Hard lost | rejected |
| **Rejected:** route swing 0.85, crosswind skid ×0.5, headwind 0.0008 (`cands2.jsonl`) | Classic Hard Sprint still lost by the reader | rejected |
| Never tried: slowing the Yeti (globally, on Hard, or in storms); catch-up changes; per-difficulty terrain | — | excluded by the owner's constraints |

## 4. Chosen changes

1. **Headwind follows the stance** (`physics/environment.ts` `HEADWIND_STANCE`, `world/capabilities/environment.ts`). The weather's headwind drag on a tucked skier is reduced by the tuck's own drag ratio, `dragTuck / dragUpright` (47%), like the skier's own air drag. This is the shared engine, so it applies to Fjord and Whiteout.
2. **Fjord headwind 0.0007 → 0.0010** (for an upright skier). This keeps F-039: the coast is the slower mountain. Over 8 seeds Fjord is slower than Alpine on 6, by 6.2 s on average (`tests/sim/scratch` F-039 runs).
3. **Whiteout slope floor 14° → 15°** (`minSlope`).
4. **Whiteout crest lee.** Where an alternate crest line runs beside the main line, the main line takes 75% of the segment's wind (`CREST_LEE.main`). This applies to the wind's grip only; hazard placement and the hardpack surface still use the ground's openness. The crest itself takes the full wind.
5. **Whiteout drift gaps 14–18 m from the line** (was 16–22; at least 12). A skier who ignores the flags still ploughs the row.
6. **W-079: Alpine pace ×1.10 → ×1.05.** Tension runs (`data/tension_r4.jsonl`, the W-077 drivers, Classic plus T4H-01…06), minimum gap where given:

   | Player | ×1.00 | ×1.05 | ×1.10 |
   |---|---|---|---|
   | Normal Sprint, crash | 4/7 caught | 6/7 caught | 7/7 caught |
   | Normal Sprint, late crash | 3/7 caught | 4/7 caught | 4/7 caught |
   | Normal Standard, crash | 0/7 caught, 22 m | 2/7 caught, 10.6 m | 6/7 caught |
   | Normal Standard, late crash | 0/7 caught, 45.5 m | 2/7 caught, 31.2 m | 3/7 caught, 14.6 m |
   | Normal, clean | never caught | never caught | never caught |
   | Hard Sprint, skilled (round-3 autopilot) | 0/7 caught | 2/7 caught | 4/7 caught |

   ×1.05 is the smallest change that gives graded pressure on Normal: a crash costs real ground, with a chance to recover. At ×1.10, every Sprint crash is a capture.

## 5. Validation on fresh held-out seeds: W4H-01…12 (never used in tuning) plus Classic

**"Before"** means round 3's rules (stance-independent headwind, Fjord 0.0007, 14° floor, no crest lee, gaps 16–22, Alpine ×1.10), measured with this round's simulator fixes and expert driver (`data/before_*.jsonl`). **"After"** is the round-4 rules (`data/val_*.jsonl`).

**Expert, before:**

| Location | Player | Length | Relaxed | Normal | Hard |
|---|---|---|---|---|---|
| Alpine | expert | sprint | 12/12 · Classic won 54 m | 12/12 · Classic won 54 m | 11/12 · Classic won 54 m |
| Alpine | expert | standard | 12/12 · Classic won 53 m | 12/12 · Classic won 53 m | 5/12 · Classic won 53 m |
| Fjord | expert | sprint | 12/12 · Classic won 42 m | 12/12 · Classic won 40 m | 5/12 · Classic won 14 m |
| Fjord | expert | standard | 11/12 · Classic won 46 m | 12/12 · Classic won 43 m | 4/12 · Classic **lost** |
| Whiteout | expert reader | sprint | 12/12 · Classic won 46 m | 12/12 · Classic won 36 m | 6/12 · Classic **lost** |
| Whiteout | expert reader | standard | 12/12 · Classic won 53 m | 12/12 · Classic won 51 m | 2/12 · Classic **lost** |
| Whiteout | expert, weather-blind | sprint | 12/12 · Classic won 44 m | 10/12 · Classic won 42 m | 0/12 · Classic **lost** |
| Whiteout | expert, weather-blind | standard | 12/12 · Classic won 53 m | 8/12 · Classic **lost** | 0/12 · Classic **lost** |

**Expert, after:**

| Location | Player | Length | Relaxed | Normal | Hard |
|---|---|---|---|---|---|
| Alpine | expert | sprint | 12/12 · Classic won 54 m | 12/12 · Classic won 54 m | 11/12 · Classic won 54 m |
| Alpine | expert | standard | 12/12 · Classic won 53 m | 12/12 · Classic won 53 m | 9/12 · Classic won 53 m |
| Fjord | expert | sprint | 12/12 · Classic won 42 m | 12/12 · Classic won 40 m | 9/12 · Classic won 7 m |
| Fjord | expert | standard | 11/12 · Classic won 46 m | 12/12 · Classic won 44 m | 6/12 · Classic won 36 m |
| Whiteout | expert reader | sprint | 12/12 · Classic won 46 m | 12/12 · Classic won 46 m | 9/12 · Classic won 20 m |
| Whiteout | expert reader | standard | 12/12 · Classic won 54 m | 12/12 · Classic won 52 m | 10/12 · Classic won 30 m |
| Whiteout | expert, weather-blind | sprint | 12/12 · Classic won 44 m | 12/12 · Classic won 43 m | 4/12 · Classic won 4 m |
| Whiteout | expert, weather-blind | standard | 12/12 · Classic won 54 m | 11/12 · Classic won 17 m | 0/12 · Classic **lost** |

**Competent, unoptimised skier** (`SLOPPY=1`: round 3's all-or-nothing tuck, no poles, a sloppy turn every 12 s), before:

| Location | Player | Length | Relaxed | Normal | Hard |
|---|---|---|---|---|---|
| Alpine | competent | sprint | 11/12 · Classic won 51 m | 9/12 · Classic won 51 m | — |
| Alpine | competent | standard | 10/12 · Classic won 39 m | 6/12 · Classic won 19 m | — |
| Fjord | competent | sprint | 12/12 · Classic won 36 m | 5/12 · Classic **lost** | — |
| Fjord | competent | standard | 12/12 · Classic won 38 m | 0/12 · Classic **lost** | — |
| Whiteout | competent reader | sprint | 12/12 · Classic won 42 m | 10/12 · Classic won 17 m | — |
| Whiteout | competent reader | standard | 12/12 · Classic won 50 m | 6/12 · Classic won 36 m | — |
| Whiteout | competent, weather-blind | sprint | 12/12 · Classic won 41 m | 5/12 · Classic **lost** | — |
| Whiteout | competent, weather-blind | standard | 12/12 · Classic won 44 m | 0/12 · Classic **lost** | — |

**Competent skier, after:**

| Location | Player | Length | Relaxed | Normal | Hard |
|---|---|---|---|---|---|
| Alpine | competent | sprint | 11/12 · Classic won 51 m | 11/12 · Classic won 51 m | — |
| Alpine | competent | standard | 12/12 · Classic won 49 m | 9/12 · Classic won 31 m | — |
| Fjord | competent | sprint | 12/12 · Classic won 36 m | 6/12 · Classic **lost** | — |
| Fjord | competent | standard | 12/12 · Classic won 38 m | 2/12 · Classic **lost** | — |
| Whiteout | competent reader | sprint | 12/12 · Classic won 42 m | 12/12 · Classic won 41 m | — |
| Whiteout | competent reader | standard | 12/12 · Classic won 50 m | 12/12 · Classic won 50 m | — |
| Whiteout | competent, weather-blind | sprint | 12/12 · Classic won 41 m | 9/12 · Classic won 34 m | — |
| Whiteout | competent, weather-blind | standard | 12/12 · Classic won 51 m | 4/12 · Classic **lost** | — |

### Against the owner's targets

- **Classic Hard defaults are winnable in all three locations.** The expert wins every Classic Hard course:

  | Location | Classic Hard Sprint | Classic Hard Standard |
  |---|---|---|
  | Alpine | 54 m | 53 m |
  | Fjord | **7 m (thin)** | 36 m |
  | Whiteout | 20 m | 30 m |

  Before, Fjord Classic Hard Standard and both Whiteout Classic Hard courses were lost.
- **Held-out Hard ranges:**

  | Location | Hard Sprint (target 50–75%) | Hard Standard (target 25–50%) |
  |---|---|---|
  | Alpine | 92% — above the range | 75% — above the range |
  | Fjord | 75% — in range | 50% — in range |
  | Whiteout (reader) | 75% — in range | 83% — above the range |

  The ranges are provisional, and nothing was forced to fit them. Above the range means the expert driver (progressive tuck, poles, precise reading) beats the Hard Yeti more often than the targets. It is a strong driver, and no human playtest has calibrated it.
- **Normal is materially more forgiving than Hard** in every location, for the expert and for the competent skier.
- **Relaxed is accessible:** the competent skier wins 11–12 of 12 everywhere.
- **The weather-reading advantage** (Whiteout reader against weather-blind):
  - Hard: expert Sprint 9 against 4, Standard 10 against 0. Classic Hard Standard is lost by the weather-blind expert.
  - Normal, competent skier: Sprint 12 against 9, Standard 12 against 4.
  - Normal, expert: Sprint 12 against 12 (the reader keeps a few metres more margin), Standard 12 against 11. On the tuning seeds, every package that let a perfect run win Hard also let a weather-blind expert win Normal Sprint (`grid`, `wh`, `wh0`, `dr`, `gap2`). This is a property of the decision (Normal Yeti 16.5 m/s, Hard 17.7 m/s), not of one knob.
  - Round 3 measured +6/−0 on Normal Sprint with its own, weaker driver. That advantage now holds for the competent skier, not for the expert.
- **Fjord Normal for the competent skier** stays hard: Sprint 6/12, Standard 2/12, both Classic courses lost (before: 5/12 and 0/12). This was not targeted this round; it is noted for the owner and reviewers.

## 6. Browser game against the simulator

`tools/browser_parity.mjs` plays the Classic courses in the production build with the game's own 'skilled' autopilot. `tests/sim/parity.measure.test.ts` runs the same driver in the simulator (`data/parity_*.json`):

| Course | Browser | Simulator |
|---|---|---|
| Alpine Sprint Hard | won, minimum gap 35.9 m, 171.7 s | won, 35.5 m, 174.6 s |
| Fjord Sprint Hard | caught at z 1,620, 105.8 s | caught at z 1,620, 105.8 s |
| Whiteout Sprint Hard | won, 5.0 m | caught at z 2,976 (24 m before the finish) |
| Whiteout Standard Hard | caught at z 3,406, 206.2 s | caught at z 3,406, 206.1 s |
| Whiteout Sprint Normal | won, 41.5 m, 176.6 s | won, 41.4 m, 176.5 s |

- The gap logged every 10 s agrees to within about 1 m for most of each run.
- The Whiteout Hard Sprint pair split only in the last seconds (gap 21 m in the browser against 46 m in the simulator at 150 s, opposite results at the line). That is a near-tie at the finish, not a model gap.
- The plain autopilot is not the expert: it never dodges snowballs and holds a rigid tuck. That is why it loses Fjord Hard Sprint, which the expert wins.
- No page errors.

## 7. Open points

- **Fjord Classic Hard Sprint margin is thin** (7 m).
- **Hard is above the provisional ranges** on Alpine (Sprint and Standard) and on Whiteout Standard.
- **The Normal Sprint reading advantage** now holds for the competent skier, not for the expert.
- **Fjord Normal for a competent skier** is unchanged in kind (harsh).
- **Human calibration:** these are model drivers; a human playtest would calibrate "expert".
