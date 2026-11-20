# Whiteout Ridge — review round 1

**Candidate:** frozen SHA recorded in `CANDIDATE.md`. Every report must name it. Evidence taken on any other build does not count.

**Reviewers:** six model-based reviewers. Each runs in a fresh, isolated context and receives the build, the source, this evidence and the brief, but not the developers' self-assessment or the other reviewers' reports. They are not human playtesters.

| Reviewer | Owns | Report |
|---|---|---|
| A | Visual art direction, environmental uniqueness | `REVIEW_A_art.md` |
| B | Skiing and hazard mechanics, difficulty and fairness | `REVIEW_B_physics.md` |
| C | Cinematics (cave encounter, storm pursuit, rescue-station victory) | `REVIEW_C_cinematic.md` |
| D | Performance and stability | `REVIEW_D_tech.md` |
| E | Accessibility and controls, QA | `REVIEW_E_qa.md` |
| F | Hostile critic: overall player experience | `REVIEW_F_critic.md` |

**Target:** 9/10 in every category, scored by the owning reviewer, with no unresolved critical or release-blocking major defect. Findings must be concrete: file and line, a screenshot name and region, or a measured number.

## Evidence (all on the candidate)
| What | Where |
|---|---|
| Visual suite: weather phases, vistas, cave encounter and leap, storm pursuit, Yeti silhouette, Hard snowball in fog, rescue station, lantern beat, Yeti at the light, final clearing | `evidence/*.png`; `evidence/manifest.json` records SHA, viewport, renderer, every camera pose and front phase, and the verified course id of every run (`runs[].verified`) |
| Balance re-measurement (W-034), weather-decision A/B, ablation, Alpine/Fjord comparison | `../balance/w034/README.md` and its `.jsonl` data |
| Course matrix: all lengths × difficulties, Classic/Custom, 7 Daily dates (code round-trip, determinism, finish, encounters, fronts, hazards to the finish / 60 km, skilled-autopilot outcome) | `courses.json` (`tests/sim/courses.measure.test.ts`) |
| Browser test suite | `e2e.txt` |
| CPU frame cost vs Alpine and Fjord (production bundle, V8). **GPU timing unavailable: SwiftShader software rendering** | `perf/` |
| Endless memory (heap and GPU resource counts per km) | `perf/endless_*.json` |
| Audio: output level clear vs storm, cue activity, clipping, errors | `audio.json` (`tools/audio_probe.mjs`) |
| Fjord double knock (shared engine, out of scope for Whiteout scoring) | `../../fjord/w036/README.md` |
| Defect tracker | `../DEFECTS.md` |

## Known limits of the evidence
- SwiftShader renders at about 1 fps. Real-time feel, motion and frame pacing are not visible, and no number here is a GPU time.
- The headless driver sees through fog, so the cost of low visibility to a human is not measured.
- The audio probe measures the Web Audio graph's output, not what a listener hears.
