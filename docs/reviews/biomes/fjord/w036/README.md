# W-036 — Fjord double knock (assessment, no production change)

**Build:** `pass5-whiteout` `0f04659` (= production hazard engine of `main` `e30cd33`).
**Probe:** `tests/sim/knock.measure.test.ts`; counts `hazard-hit` knocks per hazard per run.
**Counterfactual:** the same probe on a scratch copy where `BiomeEnvironment.sampleHazards` no longer clears `struck` when the skier leaves a footprint, i.e. one knock per hazard per approach. It was never committed.

**Courses:** 24 fresh seeds (`W034-01..24`), Sprint, Normal and Hard, with two drivers:
- the skilled autopilot;
- the weather-blind skilled driver.

Course ids are in every row.

## Findings
| Question | Answer |
|---|---|
| Reproducible? | Yes, deterministically. 16 of 96 Fjord runs have one sea-gust gate knocking twice: skilled Normal 6/24, blind Normal 3/24, skilled Hard 2/24, blind Hard 5/24. The second knock follows 0.1–1.0 s later (median 0.55 s), after the first knock pushes the skier out of the footprint edge and the line brings them back in. Same seeds, same runs, every time. |
| Changes intended difficulty? | Barely. Runs where both versions win are 0.2–0.5 s slower with the double knock. There are no win/loss flips in any of the 96 paired runs, and the median minimum Yeti gap is unchanged. |
| Avoidable? | Partly. It happens only when the post-knock trajectory re-crosses the footprint. A player who holds the brace or steers away after the first knock avoids it. The autopilot does neither. |
| Affects Whiteout? | No. There were 0 double knocks in 96 Whiteout runs: blizzard knocks happen deep inside a 58 m cell, so the skier never leaves and re-enters within one approach. Whiteout balance (W-034) is unaffected either way. |
| Affects existing Fjord records? | A fix would make some runs 0.2–0.5 s faster. Saved best times would stay valid (nothing is migrated), but new Fjord records would be marginally easier than old ones. |

## Recommendation
Treat one knock per approach as the intended rule. The pass-report rule PR #11 established already reports each hazard once per approach. That makes the re-arm on exit an inconsistency, not a design choice.

The fix is a one-line engine change: keep `struck` until the approach ends, i.e. reset it where the approach resets. Its blast radius is Fjord timing of tenths of a second, so it belongs in its own PR, with:
- a unit test that re-enters a knocked footprint and asserts one knock;
- the hazard-walk fixture regenerated with a justification;
- Gitar review;
- this measurement attached.

It is **not** folded into Whiteout visual work and **not** applied silently. It is proposed as a separate PR, to be scheduled by the project owner.
