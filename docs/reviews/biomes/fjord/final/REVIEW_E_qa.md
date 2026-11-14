# Fjord Coast, Final Round (3): Reviewer E (QA & Accessibility Lead)

- **Reviewer:** E, QA & Accessibility Lead
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `aba21bc` (branch `pass4-fjord`)
- **Date:** 2026-11-10
- **Method:**
  - Source reading (`coast.ts`, `GameSession.ts`, `Hud.ts`, `styles.css`, `Snowballs.ts`, `fjord/hazards.ts`, `fjord/views/viewpoint.ts`, `fjord/views/hazardViews.ts`, `CourseConfig.ts`).
  - `npx tsc --noEmit` is clean. 9 unit files pass, 160/160 tests: `achievements`, `input`, `events`, `fjord`, `fjord_gameplay`, `fjord_r3`, `course`, `review_regressions`, `capabilities`.
  - I re-ran my round-1 and round-2 scratch tests and wrote new ones in `scratch/review-e-r3/`. Run them with `npx vitest run -c scratch/review-e-r3/vitest.config.ts <file> --silent=false`.
  - I viewed the final 1920×1080 shots, the 1366×768 shots, and the round-2 2560 menu for comparison.
  - I did not run Playwright, a browser or `vite build`.
- **Evidence gaps:**
  - `final/res-2560/` was still empty when I finished, so nothing at 2560×1440 was judged from this build.
  - No shot in the final set shows a viewpoint platform, a gap gully or its marker poles, a location caption, or the "VIEWPOINT DISCOVERED" / "GAP CLEARED" pops. I judged those from code and simulation only.

## 1. What I ran (all on seeds the developers did not use)

| Script | What it checks |
|---|---|
| `gen.test.ts` (output in `gen_out.txt`) | Generator sweep over 24 Sprint, 10 Standard, 3 Endurance, 2 Expedition and 2 Endless courses. Covers finish and quay, shelters, cornice guard, alternate lines, kickers, gullies, lookouts, lane clearance, rock, and band order (forward vs reverse). |
| `det.test.ts`, `vpstream.test.ts` | Viewpoint order independence: band-first, 256 m window walk, far window first. Also the game's streaming pattern: 40 m `checkLookouts` windows, obstacle bands and scenery chunks. |
| `vp.test.ts` | Viewpoint counts on 20 seeds per finite length. |
| `chasedetour.test.ts` (`chasedetour_sprint.txt`), `cdt0.test.ts` (`cdt0_out.txt`) | A bot that swerves to every viewpoint, compared with the same bot on the plain line. 6 Sprint seeds × 3 difficulties × skilled/intermediate. Also the cost of each viewpoint taken alone. |
| `recover.test.ts` | Whether a skier who stalls next to an uphill run-in viewpoint recovers. |
| `capsim2.test.ts` (`capsim2_out.txt`) | Exact model of the new caption rules: soft priority, per-kind 3 s throttle, hard Yeti captions. 8 Sprint runs and 1 Standard run. |
| `rockway.test.ts` | Clean way round each on-line rock. Now also stops at the cornice guard. |
| `gully2.test.ts`, `gully3.test.ts` (`gully3_out.txt`) | Gap gully approaches at 2–20 m/s with obstacles and environment on, including a line-following driver. |
| `markers.test.ts` | Every gully has a `gap-marker`. |
| `guardw.test.ts` | Width of the cornice guard zone, and the snowball landing clamp. |
| `start.test.ts` | No-input start stalls. |
| `codes.test.ts` | Course codes. |
| `sim.test.ts` (`sim_*_sprint.txt`) | Independent ladder check: 8 new seeds, Fjord vs Alpine, three difficulties, with the difficulty now passed in. |

## 2. Verdict: **FAIL** (narrow) against the 9/10 targets for my categories

Round 3 fixes both round-2 Majors in my area, and I verified each fix myself.

**Viewpoint generation.**
- Viewpoints no longer depend on query order. Every ordering I tried gives the same list on Standard, Endurance, Expedition and Endless, including a 40 m streamed walk.
- A streamed run now finds every designed viewpoint: Sprint 2–5, Standard 5–7, Endurance 12–15 and Expedition 24–33 on my four seeds.
- Counts by length (20 seeds each):

| Length | Min | Max | Mean |
|---|---:|---:|---:|
| Sprint | 1 | 5 | 2.9 |
| Standard | 4 | 13 | 7.5 |
| Endurance | 10 | 22 | 14.6 |

- Chase viewpoints are safe. A bot that swerves to every viewpoint reached 36/36 chase viewpoints with 0 crashes and no victory turned into a catch, on all three difficulties.

**Other improvements.**
- The rear-view pill and the multiplier now read clearly in `09_pursuit`, `09c` and `09d`.
- Gullies are now marked: 23/23 have marker poles.
- Rock captions no longer mute squall warnings.

What keeps my categories just short of 9 is a set of Minor issues, three of them new or newly found:
- **Squall warnings still go uncaptioned.** About 11% of the squalls a skier actually enters still have no caption. The cause has moved: the per-kind throttle now lets one squall's warning mute the next squall's. The miss rate is about the same as round 2.
- **Slow gully drop-ins crash.** A slow drop into some gullies is a "hard landing" crash, on 3 of 28 gaps. The remediation claims "no crash".
- **Menu and HUD at 1440p.** They still do not scale at 1440p and above. This has been open since round 1, and no 2560 evidence exists for this build.
- **Missing visual evidence.** There are no screenshots of viewpoints, gully markers or captions.

None of these blocks shipping. Together they hold Accessibility and Fairness at 8.5 rather than 9.

## 3. Scores

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 8.5 (low confidence) | Reads unmistakably as a coast at 1920 and 1366 (`09d_pursuit_rim`, `10b_finish_ground`, `11c_victory_reveal`). Small floating snow shards are still in the menu backdrop (`01_menu.png` ≈ 770,990 and 375,1030; `res-1366/01_menu.png` ≈ 550,710). Defer to A. |
| Environmental uniqueness | 9 (low confidence) | The sea, rim, harbour, squall lanes, rock, spines and chase viewpoints together make a location that plays and looks unlike Alpine. Defer to A/F. |
| Skiing and hazard mechanics | 8.5 | All new mechanics are deterministic and safe in every sample: route guard 0, rock way round ≥ 5.4 m, gullies ≥ 8 m from the route and all marked. A slow drop into 3 of 28 gullies is a hard-landing crash (Defect 2). |
| Difficulty and fairness | 8.5 | Exploring is now real and safe inside chases. On my 8 Sprint seeds the Fjord ladder holds: Relaxed average 2/8, Normal 0/8, Hard intermediate 2/8. Against Alpine it sits at roughly parity to slightly harder, within seed noise (Alpine: 3/8, 1/8, 4/8). Defer the 2/5-vs-1/5 calibration to B. |
| Cinematics | 8.5 (low confidence) | From a readability view, the skip hint and the reveal subtitle are legible on bright snow (`11c_victory_reveal`). Defer to C. |
| Performance and stability | 8.5 (medium-low confidence) | `tsc` is clean and the suites pass. The determinism defect is fixed, and obstacle bands are identical forward and reverse on every sample. Frame time was not measured by me. |
| Accessibility and controls | 8.5 | The pill and multiplier are fixed, and caption priority is better. Remaining: one squall can mute the next squall's caption (Defect 1), the menu and HUD use fixed px at 1440p and above (Defect 3), and I could not see the new on-screen cues (Defect 5). Input is unchanged and complete. |
| Overall player experience | 8.5 | A fair, readable and varied run. Exploration is now worth doing on every length. What remains is polish. |

## 4. Defects

### 1. Minor (accessibility): one squall warning can mute the next squall's warning

**Evidence**

`GameSession.envCaption` (`GameSession.ts:789–793`) throttles per *kind*. Every squall is kind `'squall'`, and both squall warnings and viewpoint captions are priority 2, so equal-priority captions cannot replace each other (`Hud.ts:189`). Since round 3, lanes are planned at 3 per km and 70% of kickers carry a jump squall, so squalls now cluster.

In `capsim2_out.txt`, the squalls the skier actually entered broke down as follows:

| Outcome | Count |
|---|---:|
| A caption was shown for that squall | 63 |
| **No caption shown** | **8** |
| – muted by another squall's 3 s throttle | 5 |
| – blocked by another priority-2 caption on screen (a squall or a viewpoint) | 2 |
| – both reasons | 1 |

The overall rate (89%) is about the same as round 2 (88%). Rock captions no longer cause misses, which is fixed as claimed. In addition, 3 of 11 viewpoint captions were blocked by a squall caption, but the visual pop still appears.

**Fix**
- Throttle per hazard id (`'squall:' + e.hazard.id`), not per kind.
- Let a squall telegraph replace an on-screen squall caption for a *different* hazard that is further away, or queue it for up to about 1 s.
- Optionally drop the viewpoint caption to priority 1. It reports, it does not warn.

### 2. Minor (fairness / claim accuracy): a slow drop into some gullies is a "hard landing" crash

**Evidence**

In `gully3_out.txt` (10 Standard seeds, 28 gaps × 6 speeds, obstacles and environment on), a line-following driver like the developers' own test crashed with reason `hard landing` on 3 gaps:
- GU7 z2432 and GU9 z8045: approaches at 2–8 m/s;
- GU9 z5465: approaches at 2–15 m/s.

In total, 24 approaches crashed, then recovered and skied out. Three no-steer approaches at 2–6 m/s on GU9 z5465 crashed and were still in the gully after 40 s, but a steering driver got out every time.

`REMEDIATION_gameplay.md` §4 says "No crash, everyone skis out (test)". The test (`fjord_r3.test.ts:115`) samples only 2 gaps per seed at 9 m/s, with no obstacles or environment. Rolling off a 1.5 m kicker at walking pace should not be a crash. It is also on the optional spine, which a cautious player is most likely to try slowly.

**Fix**
- Cap the landing impact for low entry speed, or soften the gully's upstream wall.
- Extend the test to every gap at 2–15 m/s with obstacles and environment on.

### 3. Minor (visibility, open since round 1 E4): menu and HUD do not scale at 1440p and above; no 2560 evidence for this build

**Evidence**
- `src/ui/` changed only in `Hud.ts` and in six lines of `styles.css`.
- The menu panel is still `min(460px, 86vw)`, with 11–12 px secondary text.
- The HUD labels are fixed px: the pill is 12 px and the multiplier 17 px.
- `final/res-2560/` is empty. In `round-2/res-2560/01_menu.png` (same UI code) the panel fills about 24% of the width, and the Location note is about 11 px on a 1440p screen.
- 1366 is fine (`final/res-1366/01_menu.png`). The Location note ends about 2 px from the row border, which is tight but not clipped.

**Fix**
- Scale the root font from 1440p up (for example `html { font-size: clamp(16px, 0.9vw + 4px, 22px) }` with rem-based menu and HUD sizes).
- Capture `res-2560` for this build.

### 4. Minor (polish / risk): snowball landings can still be marked in the cornice zone

**Evidence**

`clampToPiste` (`Snowballs.ts:195`) keeps landings 10 m inside the rim crest, but the cornice guard extends 36 m inside the crest (`guardw.test.ts`: min, median and max all 36 m). On 6 Sprint seeds, the sea-side clamp limit lies inside the guard zone at 585 of 780 samples. A player dodging seaward from a red marker can therefore be steered toward the cornice drag.

This is low impact: the route keeps at least 46 m from the crest, about 10 m clear of the guard zone.

**Fix**
- Clamp to the first x where `coast.guard(x, z) === 0`, plus about 2 m.

### 5. Minor (evidence / process): new player-facing cues are unverified on screen, and the menu e2e was not run

**Evidence**
- The manifest has no viewpoint, gully-marker, caption or score-pop shot.
- The viewpoint props (bench, sign, pole) are non-colliding batch geometry placed within the 14 m trigger radius (`viewpoint.ts`). A skier may visibly pass through them. I cannot confirm this either way without a capture.
- `REMEDIATION_gameplay.md` §8 says Playwright `menu.spec.ts` (the new un-forced `click()` helper) was **not run**. I could not run it either.

**Fix**
- Add 3 shots: a chase viewpoint approached from the line, a gully with its poles from about 60 m, and the squall caption on screen.
- Run `menu.spec.ts` once and record the result.

### 6. Minor (wording): stale comment

`GameSession.ts:10` says viewpoints "sit outside the chases: exploring is free". This is no longer true. It is not player-facing; fix the comment.

## 5. What works

**Determinism and streaming.**
- Lookouts are identical under every query order (`det.test.ts`, 12 configurations).
- A streamed run finds every designed viewpoint (`vpstream.test.ts`, 16 configurations).
- Obstacle bands are identical forward and reverse (no order failures in `gen_out.txt`).

**Viewpoints.**
- They are never blocked by obstacles.
- Chase viewpoints sit 15–20 m off the line, on groomed and flat ground, outside the guard.
- A naive swerve bot loses 1.9–4.9 s per chase viewpoint (the developers' optimal line claims ≤ 0.3 s). It was never caught because of a swerve: minimum gap at least 40 m in every detour run.
- The run-in viewpoint (59–74 m out, 7–8 m above the line) costs 14–50 s with a crude bot, but it is outside any chase.
- A skier who stalls on the way recovers by skating or by turning downhill (`recover.test.ts`).

**Coast at every length** (`gen_out.txt`).
- The finish area is 2.2–18 m above the sea, and the quay is exactly 120 m past the finish.
- Route-to-rim minimum is 46 m. Route guard, alternate-line guard and kicker guard are all 0.
- Shelters stand 95–109 m inside the rim, with a foot spread of at most 0.58 m.
- Lane clearance is at least 6.3 m.
- Gullies are at least 8 m from the route, and the gully guard is at most 0.02.

**Rock.** The clean way round each on-line rock is at least 5.4 m (median 24.5 m, 264 rocks), measured to the nearest obstacle, the piste edge or the cornice guard.

**Start.** No-input start stalls: 1/30 on Fjord and 2/30 on Alpine, the same as the developers' figure. Tuck-only: 0/30.

**Course codes.**
- `%40`, spaces, mixed case, raw `@` in a URL, over-range seeds and future dates all behave as in round 2.
- The longest code is 28 characters.
- Daily Fjord has its own world seed.

**Captions and HUD.**
- Yeti captions are never hidden by location captions.
- Rock captions no longer suppress squall warnings.
- New per-run `GameSession`, so throttles cannot leak into a retry.
- The "BEHIND YOU" pill and the `×1.x` chip are clearly legible on bright sky and snow (`09_pursuit.png`, `09d_pursuit_rim.png`).

**Achievements and persistence.** Scenic Route is wired to `ScenicLocationDiscovered` with biome `fjord`, the ids are stable, and `achievements.test.ts` passes.

## 6. Round-2 E findings: my verification

| # | Round-2 finding | Status | My evidence |
|---|---|---|---|
| E1 (Major) | Lookouts depend on query order; only the first viewpoint exists in a streamed run | **Fixed** | `det.test.ts`: identical under all 3 orders × 12 configurations. `vpstream.test.ts`: streamed = designed at every length. |
| E2 (Major) | One viewpoint per finite run | **Fixed** | `vp.test.ts`: Sprint 1–5 (mean 2.9; 3/20 courses still have only 1), Standard 4–13, Endurance 10–22. `chasedetour`: 36/36 chase viewpoints reached safely. |
| E3 (Minor) | A rock caption suppresses squall warnings | **Partially fixed** | The rock cause is gone, but squall-on-squall muting now produces a similar miss rate (Defect 1). |
| E4 (Minor) | Rear-view label, multiplier, menu at 1440p | **Partially fixed** | The pill and the multiplier are fixed (`09_pursuit`, `09d`). Menu and HUD scaling at 1440p is not done, and no 2560 evidence exists (Defect 3). |
| E5 (Minor) | Gullies untelegraphed; standstill stick | **Fixed (telegraph) / new issue** | 23/23 gullies are marked, though I have no screenshot of them. A steering skier always gets out. A slow drop-in can crash (Defect 2). |
| E6 (Minor) | Test record and forced clicks | **Partially fixed** | The `force: true` click is replaced and the streamed-order tests were added, but the Playwright run is not recorded (Defect 5). |
| Round 1 E1–E8 | | Still fixed | E6 start stall 1/30 (the developers traded this deliberately). E5 codes and E7 ids are unchanged and correct. |

## 7. Brief compliance (Fjord items relevant to QA and accessibility)

| Brief item | Status | Evidence |
|---|---|---|
| Large open downhill runs | Done | Lane clearance ≥ 6.3 m; slope parity with Alpine |
| Scenic branching paths / optional ridgeline shortcuts | Done | Spines and gullies are clear of the cornice (guard ≤ 0.02) |
| Gentle coastal crosswinds | Done / Partial (captions) | Telegraphed by windsock, sound and caption. About 11% of the squalls a skier enters are uncaptioned (Defect 1). |
| Exposed coastal rocks | Done | Way round ≥ 5.4 m |
| Small terrain gaps and jumps | Done / Partial | Marked and always escapable; slow drop-ins can crash (Defect 2) |
| Optional exploration bonuses for viewpoints | **Done** | 1–5 per Sprint and 4–13 per Standard; safe in chases |
| Don't make bonuses mandatory or punish the fastest descent | Done | Off-line, and the fastest line is untouched |
| Finish near the shore; coastline at all lengths | Done | Finish 2.2–18 m above the sea; quay 120 m past the finish at all lengths |
| Coastal shelters as refuges | Done | 95–109 m inside the rim |
| Relaxed / Normal / Hard | Done | The ladder is monotonic within the Fjord on my seeds. Defer the calibration to Alpine to B. |
| Deterministic seeds | **Done** | §5 |
| Course codes, `@` suffix, back-compat, Daily | Done | `codes.test.ts` |
| Scenic Route achievement | Done | Wired; ids stable |
| Hazards supported by sound and visually recognisable | Partial | Code complete; no screenshots of the viewpoint, gully marker or captions (Defect 5) |
| 1366×768 and 2560×1440 verified | Partial | 1366 is fine. 2560 is not captured for this build, and the UI is unscaled (Defect 3). |
