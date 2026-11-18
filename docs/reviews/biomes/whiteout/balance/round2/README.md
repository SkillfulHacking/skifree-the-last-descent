# Round 2 — weather-reading skill (W-035, W-037, W-045, W-051)

**Build:** `pass5-whiteout` through `ad77fde` + rim change `see git log` (same physics as the round-2 candidate). Raw rows, one JSON object per run with the exact `courseId`, are in this folder (`whiteout_*`, `compare_*`).

**Seeds.**
- **Tuning:** `W034-01..24` (Sprint) and `W034-01..12` (Standard), the round-1 set used while tuning.
- **Held out:** `W2H-01..24` and `W2H-01..12`, never looked at until the final run.

**Driver.** The same skilled path follower for every policy (`tests/sim/whiteoutDriver.ts`, 0.25 s reaction). It only uses what the game shows: drift mounds and their marked gaps, the front's HUD/sky state and the storm wall on the horizon, blizzard telegraphs, and the lee side named by the caption and wind. It sees through fog, so visibility is **not** modelled; human playtesting is still needed.

## What a player can now do about each weather cost
| Cost | What mitigates it (round 2) | Measured value |
|---|---|---|
| Drift rows (deep snow) | Take the marked gap: the physics follows the drawn mound, and the gap and the line into it are kept clear of rock | Per row (`driftRow.measure.test.ts`, 50 rows): a line through the gap bent over 70–100 m gains **+0.35–0.48 s** and ~2.5 m/s exit speed over ploughing (faster in 38–40/50 rows). In round 1 ploughing won. |
| Drift hop exploit (W-045) | A jump must clear the snow; one that does not catches the skis (knock) | Timed full jump: +0.17 s/row, faster in 32/50 rows. Repeated hops: −0.10 s/row and ~5 knocks per Sprint; on full runs hopSpam ≤ blind (e.g. W034 Normal Sprint 11/24 vs 14/24). |
| Blizzard knock | Stand up out of the tuck while the cell blows (every cell is now captioned) | Knocks ~0.6–0.9 vs ~1.0–1.2 per Sprint; on its own ±0 wins |
| Exposure slip / skid drag | Rise onto the edges (skid now follows the slip that takes hold); shelter | Folded into the informed policies |
| Headwind / slip in a front | The lee shoulder, 3–12 m downwind of the line (up to −50% wind), kept clear of rock | **Not yet a net win for this driver:** leeOnly is ±0 to −3 wins vs blind, and informed2 with the lee is 17/24 vs 22/24 without it on W2H. The lee crosses drift rows (the snow settles there). Open (W-055). |
| Storm line vs exposed crest line | Take the crest line only in clear weather, never with the storm wall in sight | linesOnly +2 (tuning) / +4 net (held-out) on Normal Sprint |

## Results (wins · median minimum Yeti gap · mean speed · knocks per run)
`informed2NoLee` reads the storm line, drift gaps and blizzard stance; `informed2` adds the lee shoulder. Both see only what the game shows.

| Seeds | Length | Difficulty | blind | informed (no lee) | informed (+ lee) | hopSpam |
|---|---|---|---|---|---|---|
| W034 | sprint | relaxed | 24/24 · gap 45 m · 18.2 m/s · knocks 1.71 | 23/24 · gap 44 m · 18.8 m/s · knocks 0.96 | 24/24 · gap 44 m · 18.8 m/s · knocks 0.75 | 23/24 · gap 44 m · 17.9 m/s · knocks 6.50 |
| W034 | sprint | normal | 14/24 · gap 26 m · 16.0 m/s · knocks 1.04 | 20/24 · gap 42 m · 17.7 m/s · knocks 0.71 | 21/24 · gap 43 m · 17.8 m/s · knocks 0.62 | 11/24 · gap 3 m · 15.7 m/s · knocks 5.08 |
| W034 | sprint | hard | 1/24 · gap 3 m · 14.0 m/s · knocks 0.42 | 6/24 · gap 3 m · 16.0 m/s · knocks 0.42 | 5/24 · gap 3 m · 15.4 m/s · knocks 0.33 | 0/24 · gap 3 m · 13.6 m/s · knocks 2.25 |
| W034 | standard | relaxed | 12/12 · gap 45 m · 19.9 m/s · knocks 7.08 | 12/12 · gap 47 m · 20.2 m/s · knocks 4.25 | 12/12 · gap 46 m · 20.2 m/s · knocks 4.58 | 12/12 · gap 43 m · 19.6 m/s · knocks 25.75 |
| W034 | standard | normal | 2/12 · gap 3 m · 17.3 m/s · knocks 3.17 | 6/12 · gap 17 m · 18.4 m/s · knocks 2.33 | 5/12 · gap 3 m · 18.7 m/s · knocks 2.75 | 3/12 · gap 3 m · 16.7 m/s · knocks 10.25 |
| W034 | standard | hard | 0/12 · gap 3 m · 15.7 m/s · knocks 1.25 | 0/12 · gap 3 m · 16.7 m/s · knocks 1.08 | 0/12 · gap 3 m · 16.9 m/s · knocks 1.50 | 0/12 · gap 3 m · 15.4 m/s · knocks 5.25 |
| W2H | sprint | relaxed | 24/24 · gap 47 m · 18.4 m/s · knocks 1.58 | 24/24 · gap 48 m · 19.0 m/s · knocks 1.00 | 23/24 · gap 49 m · 18.7 m/s · knocks 1.25 | 24/24 · gap 47 m · 18.2 m/s · knocks 7.21 |
| W2H | sprint | normal | 10/24 · gap 3 m · 15.9 m/s · knocks 1.17 | 22/24 · gap 43 m · 17.8 m/s · knocks 0.79 | 17/24 · gap 42 m · 17.3 m/s · knocks 0.92 | 13/24 · gap 7 m · 16.0 m/s · knocks 5.42 |
| W2H | sprint | hard | 1/24 · gap 3 m · 14.2 m/s · knocks 0.62 | 4/24 · gap 3 m · 15.8 m/s · knocks 0.29 | 5/24 · gap 3 m · 15.6 m/s · knocks 0.33 | 0/24 · gap 3 m · 13.9 m/s · knocks 2.12 |
| W2H | standard | relaxed | 12/12 · gap 45 m · 19.4 m/s · knocks 6.42 | 12/12 · gap 52 m · 20.0 m/s · knocks 4.25 | 12/12 · gap 56 m · 20.0 m/s · knocks 3.83 | 11/12 · gap 48 m · 19.4 m/s · knocks 24.75 |
| W2H | standard | normal | 1/12 · gap 3 m · 16.5 m/s · knocks 3.08 | 7/12 · gap 9 m · 18.3 m/s · knocks 3.92 | 5/12 · gap 3 m · 18.2 m/s · knocks 2.67 | 1/12 · gap 3 m · 16.4 m/s · knocks 11.67 |
| W2H | standard | hard | 0/12 · gap 3 m · 15.3 m/s · knocks 1.50 | 0/12 · gap 3 m · 16.7 m/s · knocks 0.83 | 0/12 · gap 3 m · 16.7 m/s · knocks 0.75 | 0/12 · gap 3 m · 14.8 m/s · knocks 4.75 |

**The weather-reading advantage is reproducible on held-out seeds.** W2H Normal Sprint, paired by seed:
- the informed player (no lee) wins **22/24 vs 10/24**: 12 gained, 0 lost;
- median minimum Yeti gap **43 m vs 3 m**;
- 5.5 s faster when both win.

On the tuning seeds the same comparison is 20/24 vs 14/24 (+6/−0).

## Difficulty ladder (same driver: blind on Alpine/Fjord, where the decisions do nothing)
| | Relaxed Sprint | Normal Sprint | Hard Sprint | Relaxed Std | Normal Std | Hard Std |
|---|---|---|---|---|---|---|
| Alpine (48 seeds) | 24/24 | 24/24 | 16/24 | 24/24 | 24/24 | 12/24 |
| Fjord (48 seeds) | 24/24 | 24/24 | 8/24 | 24/24 | 22/24 | 0/24 |
| Whiteout blind (W034 + W2H) | 48/48 | 24/48 | 2/48 | 24/24 | 3/24 | 0/24 |
| Whiteout informed, no lee (W034 + W2H) | 47/48 | 42/48 | 10/48 | 24/24 | 13/24 | 0/24 |

**Reading:**
- **Relaxed:** effectively safe for everyone.
- **Normal Sprint:** a skilled weather reader is about where a Fjord player is (88% vs 100%); a weather-blind one is caught half the time. Learning the weather is the step.
- **Normal Standard (10 km) — still too steep, W-037 open:** even the skilled reader wins only 54%, against 92% on Fjord.
- **Hard — still too steep, W-037 open:** Sprint 21% skilled / 4% blind; Standard 0% (Fjord Hard Standard is also 0%).
- Hard's weather intensity now equals Normal's (0.8, was 0.65). Hard's extra difficulty is the Yeti's speed and snowballs, as in every location.
- The Yeti's speed rules are unchanged.
- **What caught skilled readers on Standard:** mostly the later chases, where the encounter speed multiplier is higher, after cumulative weather costs. Not crashes.

## Course matrix gate (W-051)
`tests/sim/courses.measure.test.ts` now asserts outcome bands per difficulty. *(Measured in the round-2 evidence: `round-2/courses.json`.)*
