# Fjord Coast, Round 8: Reviewer E (QA and Accessibility)

## 1. Header

- **Reviewer:** E, QA and Accessibility.
- **Nature of review:** model-based reviewer (same model family as the developers; not external). I am not a human playtester and I did not play the game in a browser.
- **Build:** `d1f642b` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`). There were no tracked changes under `src/` or `tests/` while I worked.
- **Date:** 2026-11-13.
- **Last E review:** round 4, on `8d19542`.
  - I read the `8d19542..d1f642b` diff of every file in my area (37 commits): `SkierPhysics.ts`, `App.ts`, `GameSession.ts`, `styles.css`, `capabilities/environment.ts`, `capabilities/index.ts`, `course.ts` and `fjord/biome.ts`.
  - These are **unchanged since round 4**: `src/progression/`, `src/core/`, the input code, `Hud.ts`, `Menu.ts`, `scale.ts`, `src/yeti/` and `tests/e2e/`.

### Method

- **Type check:** `npx tsc --noEmit` is clean (exit 0).
- **Unit tests:** I ran 14 files and **126/126 pass**. The files: `pin_rescue`, `ui_scale`, `input`, `achievements`, `cosmetics`, `fjord_scenic_schedule`, `fjord_gameplay`, `terrain_contact`, `review_regressions`, `game`, `snowballs`, `events`, `fjord_reveal` and `fjord_cornice`. Output is in `scratch/review-e-r8/unit_out.txt`.
- **Not run (per the brief):** the full unit suite, Playwright and a build.
- **Headless scripts:** all in `scratch/review-e-r8/`, run one at a time with `npx vitest run -c scratch/review-e-r8/vitest.config.ts <file> --silent=false`. Raw output sits next to each script.

| Script | Output | What it checks |
|---|---|---|
| `trap.test.ts` | `trap_out.txt` | My round-4 cave-mouth trap probe, now also counting watchdog relocations. Seeds E4W1–3 (the round-4 seeds) plus fresh E8W1–2: **1,440 approaches per location**, with 5 recovery policies of 30 s each. |
| `falsepin.test.ts` (new) | `falsepin_out.txt` | False positives of the new `pinWatchdog`. The skier stops on open snow 12, 20 or 30 m off the line, or at every Fjord viewpoint (seeds E8P1–3, Sprint and Standard). Then it holds steer, brakes while steering, looks left and right, or gives no input. |
| `trace1.test.ts` (new) | `trace1_out.txt` | A per-second trace of the false positive at one Sprint viewpoint. |
| `lengths.test.ts` | `lengths_out.txt`, `lengths_alpine_hard.txt`, `lengths_fjord_hard_E4L.txt`, `lengths_alpine_hard_E4L.txt`, `lengths_expedition.txt`, `lengths_endless.txt`, `lengths_endless_alpine.txt` | 94 runs in all: <ul><li>every finite length × difficulty × {skilled, intermediate} autopilot, on fresh seeds E8L*;</li><li>Hard again on the round-4 seeds E4L*;</li><li>Alpine on the same seeds;</li><li>Expedition 50 km;</li><li>Endless to 30 km, 4 seeds per location.</li></ul> |
| `capsim4.test.ts`, `guardw.test.ts` | `capsim_guard_out.txt` | Squall caption coverage (F-035) and the snowball clamp against the cornice guard. |
| `gully3.test.ts`, `start.test.ts` | `gully_start_out.txt` | Slow gully drop-ins (F-015) and start stalls. |

**Images I viewed:**
- candidate: `01_menu`, `04_signature_hazard`, `09_pursuit`, `09c_hard_snowball_marker`, `12_wind_gate_gust`, `14_viewpoint` and `15_cornice_relocation`;
- `res-1366/`: `01_menu`, `09_pursuit` and `10_finish`;
- I cropped and measured `15` (crop saved as `scratch/review-e-r8/sub15.png`).

### Evidence gaps (final check 16:36 local, about 3 h after I started)

- **`round-8/TESTS.md` never appeared.** I waited and re-checked every 10 minutes for about 3 h. So there is **no browser-suite result for `d1f642b`**.
  - The last browser run on record is round 4, on `c0ea8ae`.
  - Since then `src/physics/SkierPhysics.ts`, `GameSession.ts`, `App.ts`, `environment.ts` and `course.ts` have all changed. The round-4 results therefore **do not carry over** the way they did last round.
- **`candidate/res-2560/` exists but is empty.** There is no 2560×1440 frame of any kind: no menu, no HUD and no rear view.
- **`candidate/standard/` was never delivered.**
- `res-1366/` has `01_menu`, `02_summit`, `09_pursuit`, `09d_pursuit_rim`, `10_finish` and `10b_finish_ground`.
- `candidate/perf/` has a `summary.json` (Reviewer D's area). I cite it only at low confidence.

## 2. Verdict: **FAIL** against the 9/10 target for my categories

**The round-4 Critical is fixed, and I verified it myself.**
- My own trap probe, on the round-4 seeds plus two fresh ones, now ends with **0/1,440 Fjord and 0/1,440 Alpine approaches unrecovered**. In round 4 it was 24/864 and 25/864. It also shows 0 frozen-with-velocity states.
- `pinWatchdog` rescues the pinned cases within 0–10 s.
- Every finite length is completable on Relaxed and Normal (Expedition 50 km included), and Endless streams with 6 resident bands for 30 km.
- The Hard step has improved a lot: on the round-4 seeds the skilled autopilot now wins 4/7 Hard runs in the Fjord, against 1/7.
- The rear-view window now scales with the UI.

**What fails the round in my area:**
1. **Major: the fix brought a new false positive.**
   - The watchdog's "stranded" rule does not need a wall. Any player who is stopped more than 10 m off the line and **holds a steer key for 4 s** is teleported to the piste with a crash, "WIPEOUT", a reset multiplier and the message "You were boxed in against the rock".
   - It fires at **30/37 Fjord viewpoints** and at 60–100 % of open-snow stop points, in both locations.
   - Reviewer B found the same thing independently (B defect 1).
2. **The functional gate cannot be shown met.**
   - No browser test has run on this candidate, and no 2560 frame exists.
   - Keyboard, controller, menus and saves are unchanged in code, but nothing has been verified in a browser on `d1f642b`.

**Smaller issues:**
- The relocation instruction text is close to invisible (about 1.1–1.5:1 contrast).
- Squalls entered mid-gust still get no caption, now 39 % of live entries.
- Several carried Minors are unfixed.

## 3. Scores (QA and accessibility point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 8 (low confidence) | The frames I viewed read clearly as a coast. The menu at 1366 and 1920 is clean. Defer to A. |
| Environmental uniqueness | 8.5 (low confidence) | Windsocks and wind gates, the sea, the UTSIKT viewpoint and the harbour finish. It plays differently from Alpine, as my caption and squall counts show. Defer to A and F. |
| Skiing and hazard mechanics | 7.5 | No unrecoverable state remains (0/2,880). Against that, the rescue misfires on a deliberate stop (Defect 1), and slow gully drop-ins still crash 24 times on 3 gaps (Defect 7). |
| Difficulty and fairness | 7.5 | Relaxed and Normal win 100 % at every finite length in both locations. The Hard step is much smaller than in round 4 but still clear: pooled over 14 seeds, skilled 7/14 Fjord against 11/14 Alpine, and intermediate 1/14 against 5/14. Endless Normal catches the skilled autopilot on 2/4 Fjord seeds against 0/4 Alpine (Defect 5). An unwarranted crash at viewpoints is also a fairness cost (Defect 1). |
| Cinematics | 8 (very low confidence) | Not reviewed. Caption priority is unchanged since round 4. Defer to C. |
| Performance and stability | 7.5 | No soft-lock, no timeout and no stuck streaming in 94 headless runs plus 2,880 trap approaches. Bands stay bounded at 6. Frame time is D's area: `perf/summary.json` shows Fjord with 55 frames over 16 ms and 7,694 "starved" frames, against Alpine's 4 and 136 (CPU-side, low confidence). |
| Accessibility and controls | 7 | **Up:** the rear view scales with the UI (code checked, and the 1366 shot is fine), and the controls need no secret input. **Down:** <ul><li>the relocation instruction has about 1.1–1.5:1 contrast (Defect 3);</li><li>39 % of live squall entries get no caption (Defect 4);</li><li>holding a direction while stopped is punished (Defect 1);</li><li>there is no keyboard, controller or menu browser verification on this build, and no 2560 frame (Defect 2).</li></ul> |
| Overall player experience | 7.5 | A fair, readable run on Relaxed and Normal with no way to lose a run to the terrain any more. But a player who stops at a viewpoint and turns to look at the fjord is told they were "boxed in against the rock" and is thrown down. |

## 4. Defects

### 1. Major (controls / fairness, engine-wide, new in this build): the pinned-skier watchdog relocates and crashes a player who is simply standing still and holding a direction

**Where:** `SkierPhysics.pinWatchdog`, `SkierPhysics.ts:1012–1034`.

```ts
const stranded = s.time - s.pushSince > PIN_WATCH.window && Math.abs(s.pos.x - rx) > PIN_WATCH.offPiste;
```

- The rule needs no wall contact. A held steer counts as "pushing".
- A stopped skier holding a steer pivots in place at under 1 m/s, so they never get 3 m away.
- `relocate()` then calls `crash(reason, 0.6)`. That crash resets the multiplier, shows "WIPEOUT!" and counts as a crash, and the HUD says "You were boxed in against the rock" (`GameSession.ts:597`).

**Evidence (mine, `falsepin_out.txt`):** stop points on open snow, seeds E8P1–3, Sprint and Standard, 144 stop points per location for each distance:

| Stop point | hold steer 8 s | brake + steer | look left/right/left (3 s each) | no input |
|---|---|---|---|---|
| Fjord viewpoints (37) | **29–30 / 37** | 35 / 37 | 34 / 37 | 0 |
| Fjord, 12 m off the line | 89–93 / 144 | 142 / 144 | 126 / 144 | 0 |
| Fjord, 20 m off the line | 126–127 / 144 | 144 / 144 | 143 / 144 | 0 |
| Fjord, 30 m off the line | 115–117 / 144 | 144 / 144 | 136 / 144 | 0 |
| Alpine, 12, 20 and 30 m off the line | 80–123 / 144 | 142–144 / 144 | 127–143 / 144 | 0 |

**Trace (`trace1_out.txt`):** at Sprint viewpoint `vp-…-805`, 17.3 m off the line, a skier standing still holds steer left from t = 2 s. The skier spins in place at 0.6–1.0 m/s. At **t = 6.00 s** the relocation fires: "relocate: pinned against the rock", then a crash. Tapping the key (0.3 s each second) does not trigger it.

**Why it matters:**
- The Fjord's viewpoints are designed to be stopped at.
- Turning the skier to face the sea is a natural thing to do there.
- This is a wrong message plus a penalty, in both locations, and Alpine is the shipped location.
- It is not a soft-lock, which is why I rate it Major, not Critical.

**Fix:**
1. Count only a forward push (tuck/skate held) as "trying to get going", not a steer alone.
2. Or require a wall contact within the window for the stranded rule too, and exclude heading rotation from "no progress".
3. Relocate a pinned skier without a crash: a `relocate(…, { crash: false })` path that keeps the multiplier and the crash count.
4. Add a regression test: stop at every lookout, hold steer for 10 s, and expect no relocation.

### 2. Major (gate evidence): no browser suite and no 2560 evidence for the candidate

- `round-8/TESTS.md` did not appear within about 3 h. `candidate/res-2560/` is empty, and `standard/` is absent.
- The physics and session code changed after the last browser run (round 4, `c0ea8ae`), so the round-4 results do not transfer.
- **Unverified in a browser on `d1f642b`:**
  - the full loop;
  - pause/resume and the gamepad hot-plug;
  - the menu at four sizes;
  - keyboard, mouse and gamepad course controls;
  - both migrations;
  - the Scenic Route journey.
- **Specifically at risk:** the watchdog can fire during the scripted Scenic journey's slow approach. `fjord_scenic_schedule.test.ts` passes headless, which is reassuring but is not the browser run.
- **Fix:** run `npx playwright test` on `d1f642b` (recording the worktree and commit), deliver `res-2560` (menu, a chase frame with the rear view and the Yeti bar, a caption, the toast, the summit), and add a 2560 frame at UI text 150 %.

### 3. Minor (accessibility): the relocation instruction is nearly invisible over snow and sky

- **Evidence:** `15_cornice_relocation.png`, the subtitle "You went over the cornice. Keep inside the cairns along the cliff." (crop: `sub15.png`). I measured the brightest text pixel against the median background as **1.45:1**. F measured about 1.1:1.
- **Cause:** `.hud-sub.intro` uses `--ink-dim` (`rgba(232,240,250,0.72)`) with no shadow (`styles.css:127, 133`). At full opacity over the snow (about `#c0c4c6`) that cannot exceed about 1.3:1.
- **Why it matters:** the caption carries only "back on the piste". The actionable rule (keep inside the cairns) lives only in this subtitle. The new "boxed in against the rock" subtitle uses the same class.
- **Fix:** pass `'intro scrim'` as the class for all three relocation titles (`GameSession.ts:597–606`). The `.hud-sub.scrim` halo already exists for this exact case. Or move the rule into the caption.

### 4. Minor (accessibility, F-035, open): squalls entered mid-gust get no cue and no caption

**Evidence:** `capsim_guard_out.txt`, 11 Normal runs.

| Live squall entries (telegraph or active) | Count |
|---|---:|
| All live entries | 82 |
| No caption in the previous 10 s | **32 (39 %)** |
| Of which: no telegraph event at all (22 gates, 6 jump squalls) | 28 |
| Of which: blocked by an equal-priority caption | 4 |

- In round 4 the figure was 23/71 (32 %).
- `environment.ts:266` still reports phase transitions only within 150 m ahead.
- **Fix:** as in round 4. Emit a late telegraph (cue plus caption) when a periodic hazard first comes into alert range already live.

### 5. Minor (fairness, F-022 partial): the Hard step is much improved but still clearly steeper than Normal's; Endless Normal still catches

**Evidence (mine, identical seeds in both locations):**

| Run | Fjord | Alpine |
|---|---|---|
| Hard, skilled, fresh seeds E8L* (Sprint ×4, Standard ×2, Endurance ×1) | 3 / 7 | 4 / 7 |
| Hard, skilled, round-4 seeds E4L* | **4 / 7** (was 1/7) | 7 / 7 |
| Hard, intermediate, both seed sets pooled | 1 / 14 | 5 / 14 |
| Relaxed and Normal, every finite length, both drivers | 100 % wins | 100 % wins |
| Endless Normal, skilled, to 30 km, 4 seeds | **2 / 4 caught** (25.8 and 29.3 km; round 4: 20.8 and 26.8 km) | 0 / 4 caught (minimum gap ≥ 39.8 m) |

- **Reading:**
  - Normal shows no step on finite lengths, while Hard shows a large one. The ladder is uneven, but within noise for n = 14 (skilled 7/14 against 11/14).
  - The Endless catches now come later: the ×0.85 long-course factor helps.
- **Fix:** see B. Use a pooled-seed ladder assertion for Hard and Endless Normal, and widen the Normal step (F-039).

### 6. Minor (risk, carried): snowball landings can still be marked inside the cornice guard

`guardw`: the clamp limit sits inside the 36 m guard at **585/780** samples, unchanged (`src/yeti/` untouched). Fix as in round 4: clamp to the first x where `coast.guard(x, z) === 0`, plus 2 m.

### 7. Minor (fairness, F-015, accepted open): slow gully drop-ins still crash

- `gully_start_out.txt`: the same 24 "hard landing" crashes on GU7, GU8 and GU9 as in round 4.
- The 3 no-steer cases that used to stay in GU9 are now taken out by the watchdog, but each with a second crash ("pinned against the rock").
- Fix as in round 4.

### 8. Minor (wording, carried)

`GameSession.ts:10` still says viewpoints "sit outside the chases: exploring is free". This is not player-facing.

## 5. What works

- **No unrecoverable state at cave mouths.**
  - My trap probe: 0/1,440 unrecovered in each location (round 4: 24/864 and 25/864).
  - 108 Fjord and 106 Alpine cases are rescued by the watchdog, within 0–10 s.
  - 85 Fjord and 140 Alpine approaches are relocated during the approach itself.
  - 0 frozen-with-velocity states. `pin_rescue.test.ts` passes.
- **Finite lengths.** All complete on Relaxed and Normal, with both drivers, on fresh seeds, with 0 crashes:
  - Sprint ×4, Standard ×2 and Endurance;
  - Expedition 50 km: Normal 2,591 s, Relaxed 2,499 s.
  - No timeouts in 94 runs.
- **Endless streaming.** Peak resident obstacle bands stay at 6 to 30 km in both locations.
- **Rear view.** It now scales with `uiScale × autoUiScale` (`App.ts:857–862`), with the label in `calc(12px * var(--ui-scale))`.
  - The frame top is 78·ui against the Yeti bar's 56·ui (plus a 14·ui backdrop), so there is no overlap at any scale.
  - At 1366 (`res-1366/09_pursuit`) it is 408 px wide and clear of the bar.
- **Menu.** It is clean and fits at 1920 and 1366 (`01_menu`, `res-1366/01_menu`). The Location note is legible on its dark gradient.
- **Save compatibility by construction.** The progression, settings, course-config and input code are unchanged since round 4. The keys `skifree-tld.settings.v1`, `.records.v2` and `.progress` are intact.
- **Start stalls** are unchanged: no input 1/30 Fjord, 2/30 Alpine; tuck-only 0.
- **Captions.** The Yeti footstep caption and the relocation caption are on their dark pill and are legible (`09`, `15`).

## 6. Round-4 E defects and tracker items (my verification)

| Item | Status | My evidence |
|---|---|---|
| R4 E1 / F-021: cave-mouth trap (Critical) | **Fixed** | 0/1,440 + 0/1,440 unrecovered, 0 frozen (`trap_out.txt`). The fix itself causes Defect 1. |
| R4 E2 / F-022: Hard and long Normal too steep | **Partial** | Hard on the round-4 seeds: 1/7 → 4/7 wins (Alpine 7/7). Endless Normal is still caught on 2/4 seeds, though later (Defect 5). |
| R4 E3: 1366/2560 candidate sets missing | **Partial** | `res-1366` delivered (6 shots, fine). `res-2560` is empty. TESTS.md is missing (Defect 2). |
| R4 E4: rear view not scaled (was F-016 residual) | **Fixed (code + 1366 frame)** | `App.ts:857–862`, `styles.css:226`. Not seen at 2560 or UI 150 % because no frame exists. |
| R4 E5 / F-035: mid-gust squall entries uncaptioned | **Not fixed** | 32/82 (39 %), against 23/71 in round 4 (Defect 4). |
| R4 E6 / F-015: slow gully crashes | **Not fixed** (accepted) | 24 crashes. The stuck cases are now rescued (Defect 7). |
| R4 E7: snowball clamp inside the guard | **Not fixed** | 585/780 (Defect 6). |
| R4 E8: stale comment | **Not fixed** | `GameSession.ts:10`. |
| F-016: UI scale at 1440p | **Fixed in code**, not evidenced at 2560 this round | The menu was fixed in round 4. The rear view is fixed now. |
| F-017: per-squall caption throttle | **Still fixed** | The code is unchanged. |
| F-018: Relaxed intensity 0.5 | **Verified in code** (`biome.ts:229`) | Relaxed is 3–6 % faster than Normal in my runs (Sprint 151–157 s against 158–164 s; Standard 494–509 s against 523–529 s; Endurance 1,002 s against 1,037 s). Every mechanic stays active. |
| F-020: browser suite on the candidate | **Regressed (not run on `d1f642b`)** | Defect 2. |
| F-039: Sprint ladder within noise | **Not fixed** (open) | I did not re-measure Alpine on Normal. Defer to F and B. |

## 7. Public-preview gate (completion brief §10), my area

| Gate item | Status | Evidence |
|---|---|---|
| No critical gameplay or physics defects; no unrecoverable states | **Met** | 0/2,880 trap approaches unrecovered. No soft-lock found. Defect 1 is Major, not Critical. |
| All finite lengths completable | **Met** | §5: 100 % on Relaxed and Normal, including 50 km. |
| Endless streams reliably | **Met (headless)** | 6 bands to 30 km, 8 runs. GPU and texture memory are D's. |
| Saves compatible | **Met by code**, not browser-verified on this build | The save code is unchanged since round 4. The migration e2e has not been re-run (Defect 2). |
| Keyboard and controller work | **Not verified** | The input code is unchanged, but no browser run on `d1f642b`. |
| Menus work (1366 / 1920 / 2560) | **Partially met** | 1366 and 1920 shots are fine. 2560 was not delivered. No menu e2e on this build. |
| All automated tests pass | **Not met (not run)** | The unit tests I ran pass (126/126) and `tsc` is clean. There is no browser suite on the candidate. |

**Gate result for my area: NOT MET.** The cause is missing verification (no browser suite, no 2560 evidence), not a known failure. With `TESTS.md` green on `d1f642b` and the 2560 set delivered, my gate items would be met. Defect 1 should still be fixed before a public preview, because it punishes the Fjord's own viewpoint feature.
