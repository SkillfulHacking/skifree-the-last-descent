# Fjord Coast, Round 9: Reviewer E (QA and Accessibility)

## 1. Header

- **Reviewer:** E, QA and Accessibility.
- **Nature of review:** model-based reviewer (same model family as the developers; not external). I am not a human playtester and I did not play the game in a browser.
- **Build:** `3bf5a7e` (branch `pass4-fjord`). The worktree HEAD is `564cd5b` (evidence only). `git diff 3bf5a7e HEAD -- src tests` is empty, so every probe below ran on the candidate's source.
- **Date:** 2026-11-14.
- **Diff since my round-8 review (`d1f642b..3bf5a7e`):**
  - 16 files under `src/` changed. In my area these are `SkierPhysics.ts` (pin watchdog), `GameSession.ts` (notice pills), `styles.css` (`.hud-sub.notice`), `World.ts` (cave colliders), `presentation/cave.ts`, `seaCave.ts` and `caveTerrain.ts`.
  - **`tests/` has not changed at all.** `git diff --stat d1f642b 3bf5a7e -- tests` is empty.
  - `git diff c9ffd1b 3bf5a7e -- src` and `git diff e0e2eca 3bf5a7e -- src` touch only `src/world/caveTerrain.ts`, as claimed. That file feeds `course.ts` `heightAt`, so the change is physics-relevant at the cave jamb, not only visual (see Defect 6).

### Method

- **Type check:** `npx tsc --noEmit` is clean.
- **Unit tests:** I ran the same 14 files as in round 8 (`pin_rescue`, `ui_scale`, `input`, `achievements`, `cosmetics`, `fjord_scenic_schedule`, `fjord_gameplay`, `terrain_contact`, `review_regressions`, `game`, `snowballs`, `events`, `fjord_reveal`, `fjord_cornice`). **126/126 pass** (`scratch/review-e-r9/unit_out.txt`).
- **Not run (per the brief):** Playwright, the dev server and a build.
- **Headless probes:** all in `scratch/review-e-r9/`, run one at a time with `npx vitest run -c scratch/review-e-r9/vitest.config.ts <file> --silent=false`. Raw output sits next to each script.

| Script | Output | What it checks |
|---|---|---|
| `falsepin.test.ts` | `falsepin_out.txt` | Watchdog false positives on open snow. I extended it this round: three tuck policies (tuck+brake, tuck+full steer, tuck only), each from three starting headings (downhill, across, uphill). Seeds E8P1–3, Sprint and Standard. |
| `trap.test.ts` | `trap_out.txt`, `trap_nocols_out.txt` | My cave-mouth trap probe. **New this round:** it builds the real Fjord sea-cave dressing at high quality in Node (`dressSeaCave`) and feeds its round-9 boulder colliders to `SkierPhysics`. Seeds E4W1–3 and E8W1–2, 1,440 approaches per location, 5 recovery policies of 30 s each. Run with and without the colliders. |
| `boulders.test.ts` (new) | `boulders_out.txt` | Where the 275 cave-boulder colliders sit (8 seeds × Sprint/Standard × high/low quality). |
| `lengths.test.ts` | `lengths_out.txt`, `lengths_alpine.txt`, `lengths_expedition.txt`, `lengths_endless.txt`, `lengths_endless_alpine.txt` | 92 runs on fresh seeds E9L*, `simulateCourse` with streaming. |
| `capsim4.test.ts`, `guardw.test.ts` | `capsim_guard_out.txt` | Squall caption coverage (F-035) and the snowball clamp. |
| `gully3.test.ts`, `start.test.ts` | `gully_start_out.txt` | Slow gully drop-ins (F-015) and start stalls. |

**Images I viewed:**
- candidate: `09_pursuit`, `15_cornice_relocation`;
- `res-2560/`: `01_menu`, `02_summit`, `10b_finish_ground`;
- `res-1366/`: `01_menu`;
- `browser-shots/`: the Scenic Route toast.
- I measured the 1366 menu's small text with PIL (crops saved as `crop_*.png`).

**Evidence present this round:**
- `round-9/TESTS.md`: 19/19 browser tests across `e0e2eca` and `3bf5a7e`, and 311/311 unit tests on `3bf5a7e`.
- `res-2560/` and `res-1366/`: menu, summit and finish.
- `standard/`.
- `perf/` (Reviewer D's area; I cite it at low confidence).

## 2. Verdict: **FAIL** against the 9/10 target for my categories. Public-preview gate in my area: **MET**.

**This round closes the two Majors I raised in round 8.**

1. **The watchdog false positive is fixed.**
   - A stopped player who steers, looks around, brakes plus steers, or gives no input is never relocated. That is 0 of 901 stop points per policy (37 Fjord viewpoints plus 432 open-snow points in each location) (round 8: 29–30 of 37 viewpoints).
   - The pin rescue no longer counts as a crash.
2. **The functional gate is now evidenced.**
   - The full browser suite is green on the candidate's code. That includes keyboard, mouse and gamepad menu control, both save migrations, the no-debug Scenic Route journey and a real keyboard unlock.
   - The menu fits at 1366, 1920 and 2560, including at zoom 125 % and UI scale 150 %.
   - 2560 frames exist.
3. **The relocation instruction is legible.** It now sits on a dark pill (`15`).

**Other results:**
- **No unrecoverable state remains**, even with the new solid cave boulders: 0 of 2,880 approaches unrecovered.
- **Every finite length is completable** on Relaxed and Normal, Expedition 50 km included.
- **Endless streams** with 6 resident bands up to 30 km.

**Why this is still not a 9 in Accessibility and controls:**
- The new cave-boulder colliders identify themselves as **trees**: the "hit a tree" crash, a wooden thud with branch-snow audio, and a branch snap on light contact. For a player who relies on audio cues, the cue is wrong. On my cave-curious approaches they cause a crash 16 % of the time.
- 39 % of live squall entries still get no caption (F-035, unchanged).
- The stranded rule still teleports a player who holds forward while stopped facing uphill, with the wrong message.
- The Location description in the 1366 menu falls to about 2.5:1 contrast over the snow.
- There is still no in-game HUD frame at 1366 or 2560.

**On fairness:** the Hard step for the intermediate driver remains steep (0/7 Fjord against 4/7 Alpine).

## 3. Scores (QA and accessibility point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 8 (low confidence) | The 2560 menu, 2560 summit and finish read clearly as a cold coast. Defer to A. |
| Environmental uniqueness | 8.5 (low confidence) | Wind gates, the sea, the viewpoints and the harbour finish. It plays differently from Alpine (squall and caption counts). Defer to A and F. |
| Skiing and hazard mechanics | 8 | Better than round 8: no steer-only false positive, and the rescue is not a crash. Against that: <ul><li>solid cave boulders that crash and sound like trees (Defect 1);</li><li>a residual "stranded" teleport while holding forward uphill (Defect 2);</li><li>slow gully drop-ins still crash (F-015).</li></ul> |
| Difficulty and fairness | 7.5 | Relaxed and Normal win 100 % at every finite length. Hard, skilled: 5/7 Fjord against 6/7 Alpine (good). Hard, intermediate: **0/7 against 4/7**. Endless Normal: 2/4 Fjord seeds caught (17.4 and 27.2 km) against 0/4 Alpine. These are the same shapes as in round 8. |
| Cinematics | 8 (very low confidence) | Not reviewed. Defer to C. |
| Performance and stability | 8 | <ul><li>No soft-lock, timeout or stuck streaming in 92 runs plus 2,880 trap approaches. Bands stay bounded at 6.</li><li>The production-bundle CPU p99 is 11.9 ms Fjord against 8.2 ms Alpine, with 0 frames over 33 ms (`perf/`). That is D's area; I cite it at low confidence.</li></ul> |
| Accessibility and controls | 8 | **Up:** <ul><li>the browser suite covers keyboard, mouse and gamepad, pause and gamepad hot-plug;</li><li>menus pass at 4 sizes plus zoom and UI scale;</li><li>the instruction pills fix F-047;</li><li>held steer is no longer punished.</li></ul> **Down:** Defects 1, 2, 4 and 7, plus the HUD at 2560 not evidenced (Defect 6). |
| Overall player experience | 8 | A fair, readable and recoverable run. The round-8 viewpoint penalty is gone. Remaining rough edges are small and mostly cue- or wording-level. |

## 4. Defects

### 1. Minor (accessibility / audio cue, new in this build): the sea-cave boulders collide, crash and sound as trees

**Where:**
- `World.extraColliders` (`World.ts:426–442`) now includes `seaCave.ts`'s `solids` (`seaCave.ts:401`).
- `SkierPhysics.collide` treats every extra collider as `'tree-heavy'` (`SkierPhysics.ts:864`). As a result:
  - a hard hit is a crash with reason **"hit a tree"** (`solidHit`);
  - the impact plays the `tree-heavy` sound, which is a wooden modal thud plus "snow dumped from the branches" (`sfx.ts:486–495`);
  - a light contact emits `kind: 'branch'`, so `GameSession.ts:578` plays a **branch snap** and throws particles at 1.8 m height.

**Evidence (mine):**
- `boulders_out.txt`: 275 colliders (r 0.94–2.15 m), all **before the cave trigger** and 20–50 m off the line, right where a curious player approaches the mouth. None is within 12 m of the line, so they do not touch the race line.
- `trap_out.txt` against `trap_nocols_out.txt` (same 1,440 Fjord approaches):

| | With colliders | Without colliders |
|---|---:|---|
| "hit a tree" crashes | **232** | 0 |
| Approaches that reach the trigger | 17 | 85 |
| Watchdog rescues | **242** | 111 |
| Unrecovered | 0 | 0 |

**Why it matters:**
- A player who relies on sound hears a tree on bare rock and snow.
- The "Crashed" telemetry event carries the wrong reason (`telemetry.ts:96`).
- There is no unit test for the colliders: `tests/` is unchanged.

**Fix:**
1. Give extra colliders a `kind`: `{ x, z, r, kind: 'boulder' }` from `seaCave.ts`. In `collide()` pass `'rock-heavy'` (crash "hit a boulder") for them, and `'rock-light'` rather than `'branch'` on glancing contact.
2. Add a unit test: a skier driven into a cave boulder gets a boulder impact, not a tree impact, and is never pinned.

### 2. Minor (controls / wording): the "stranded" rescue still fires on a deliberate stop when the player holds forward without moving, and says "boxed in against the rock" with no rock in sight

**Where:** `SkierPhysics.pinWatchdog` (`SkierPhysics.ts:1014–1037`).
- Round 9 counts only tuck-without-brake as pushing (good).
- But the stranded rule still needs no wall. A stopped player holding forward who does not get 3 m in 4 s, more than 10 m off the line, is teleported to the piste.
- `GameSession.ts:597` then shows "You were boxed in against the rock".

**Evidence (`falsepin_out.txt`, seeds E8P1–3, Sprint and Standard):**
- **Fixed policies:** every steer, look, brake and no-input policy gives 0 relocations at every stop point, in both locations.
- **Residual policies (relocations; the denominator is 37 viewpoints or 144 open-snow points):**

| Policy | Fjord viewpoints | Fjord off-piste 12–30 m | Alpine off-piste 12–30 m |
|---|---|---|---|
| tuck, facing uphill | 6 / 37 | 58–97 / 144 | 62–77 / 144 |
| tuck + full steer (skating a tight turn) | 8 / 37 | 33–55 / 144 | 47–55 / 144 |

- There are **0 crashes** after these relocations, so the cost is a surprise teleport plus a false message, not a penalty.
- A plausible trigger is a player who overshoots a viewpoint and tries to skate back up to it.

**Fix:**
- Require wall contact (or a terrain wall within 2 m) for the stranded rule too. Uphill-facing pushing on open snow is not a pocket.
- Alternatively, use a neutral title for a stranded rescue with no wall ("Back to the run").
- Add the regression test I asked for in round 8 (stop at every lookout, hold steer / brake+steer / tuck uphill for 10 s, expect no relocation). It still does not exist: `tests/` is unchanged since `d1f642b`, and the tracker's "pin_rescue.test.ts 17/17" for F-046 is the same pre-existing test, which does not exercise standing still.

### 3. Minor (accessibility, F-035, open): squalls entered mid-gust get no caption

- **Evidence:** `capsim_guard_out.txt` gives the same counts as round 8: **32 of 82** live entries have no caption in the previous 10 s.
  - 22 gate entries and 6 jump entries have no telegraph event at all.
  - 4 are blocked by an equal-priority caption.
- **Fix:** emit a late telegraph (cue plus caption) when a periodic hazard first comes into alert range already live (`environment.ts`).

### 4. Minor (fairness, F-022 partial): the Hard step is steep for an intermediate driver; Endless Normal still catches

**Evidence (mine, fresh seeds E9L*, identical in both locations):**

| Run | Fjord | Alpine |
|---|---|---|
| Hard, skilled (Sprint ×4, Standard ×2, Endurance) | 5 / 7 | 6 / 7 |
| Hard, intermediate | **0 / 7** (caught at 572–1,911 m) | 4 / 7 |
| Pooled with round 8 (E8L + E4L + E9L), Hard, intermediate | 1 / 21 | 9 / 21 |
| Relaxed and Normal, every finite length, both drivers | 100 % wins, 0 crashes | 100 % |
| Endless Normal, skilled, to 30 km | **2 / 4 caught** (17.4 and 27.2 km) | 0 / 4 (minimum gap ≥ 44.8 m) |

**Fix:** see B. Use a pooled-seed ladder assertion for Hard (intermediate) and for Endless Normal.

### 5. Minor (accessibility): the 1366 menu's Location description drops to about 2.5:1 over the snow ridge

- **Evidence:** `res-1366/01_menu.png`. "…harbour finish by the open sea." runs over the bright snow ridge behind the menu (crop `crop_desc_right.png`).
  - I measured the brightest text against the median background: **2.5:1**.
  - The left half of the same line measures 4.1:1. The seed and record lines measure 5.0–5.4:1.
  - At 2560 the same line sits lower on the ridge and is fine.
- **Fix:** give `.loc-note` (or the focused row) the same dark backing as the row, or a text shadow, or extend the menu's left gradient under the focused row.

### 6. Minor (gate evidence): no in-game HUD frame at 1366 or 2560; the run-time e2e ran on a build whose cave-mouth physics terrain differs

- **No HUD frame:** `res-1366/` and `res-2560/` hold only menu, summit (free camera, no HUD) and finish shots. Round 8's `res-1366/09_pursuit` was not redone. The HUD scale at 2560 (rear view, Yeti bar, captions, notice pill) rests on `ui_scale.test.ts` and code reading only.
- **Older build for the run-time e2e:**
  - `game.spec.ts` (full loop with the cave cinematic, pause/resume and gamepad hot-plug) and the release, migration and scenic specs ran on `e0e2eca`.
  - The only change to `3bf5a7e` is in `caveTerrain.ts`, and `caveTerrainOffset` feeds `course.ts` `heightAt` (physics), not only the mesh.
  - My headless trap probe covers that change on `3bf5a7e` (0 unrecovered), so I accept the gate, with this caveat recorded.
- **Fix:** add a chase frame with the rear view, a caption and the notice pill to `res-2560` and `res-1366`. Re-run `game.spec.ts` on the exact candidate when the machine is idle.

### 7. Minor (risk, carried): snowball landings can be marked inside the cornice guard

`guardw`: **585 of 780** samples, unchanged. Fix: clamp to the first x where `coast.guard(x, z) === 0`, plus 2 m.

### 8. Minor (fairness, F-015, accepted open): slow gully drop-ins still crash

- 24 "hard landing" crashes on GU7–GU9, the same as before.
- The 3 no-steer GU9 cases are now rescued **without** the second "pinned" crash they took in round 8, because the rescue is no longer a crash.

### 9. Minor (wording, carried)

`GameSession.ts:10` still says viewpoints "sit outside the chases: exploring is free". This is not player-facing.

## 5. What works

- **Watchdog false positive fixed** (F-046):
  - 0 relocations for steer, look, brake+steer and no input, at all 37 Fjord viewpoints and all 432 open-snow stop points in each location.
  - The rescue is no longer a crash (`relocate(…, false)`), so the multiplier and crash count are kept.
- **No unrecoverable state at cave mouths, including the new solid boulders:**
  - 0 of 1,440 Fjord and 0 of 1,440 Alpine approaches unrecovered.
  - 0 frozen-with-velocity states.
  - Rescues within 0–12.8 s.
- **Instruction pills (F-047):**
  - `15_cornice_relocation`: the cornice instruction is white on `rgba(8,14,22,0.72)`, plainly legible over sky and snow, and scales with `--ui-scale`.
  - The goal, refuge and rescue titles use the same `notice` class.
  - Only the "RUN." flash and the scrimmed victory title do not.
- **Browser suite (TESTS.md):** 19/19 on the candidate's code.
  - Keyboard, mouse and gamepad course controls, re-run and passing on `3bf5a7e` itself.
  - Course code entry and the Location row.
  - Menu fit at 1366×768, 1920×900, 1920×1080 and 2560×1440, plus zoom 125 % and UI scale 150 %.
  - Pass-3 and v1-progress migrations.
  - The no-debug Scenic Route journey; the toast frame is clean, and its caption is on its pill.
  - A real keyboard unlock that persists.
- **Finite lengths:** 100 % on Relaxed and Normal, both drivers, 0 crashes. Sprint, Standard and Endurance on fresh seeds; Expedition 50 km takes 2,473 s on Relaxed and 2,565 s on Normal. No timeouts.
- **Endless:** peak resident bands 6 to 30 km in all 8 runs.
- **Menu at 2560:** clean and in proportion. The Location note is legible.
- **Start stalls:** unchanged (no input: 1/30 Fjord, 2/30 Alpine; tuck-only: 0).
- **Save compatibility by construction:** `src/progression/`, the settings code and the input code are unchanged since round 4. The migration e2e passes.

## 6. Round-8 E defects and tracker items (my verification)

| Item | Status | My evidence |
|---|---|---|
| R8 E1 / F-046 / B r8 #1: watchdog relocates and crashes a player holding steer | **Fixed** (residual: Defect 2) | `falsepin_out.txt`: 0/901 stop points for every steer, brake and no-input policy. The relocation is no longer a crash. A residual teleport remains for tuck facing uphill or tuck in a tight turn. No regression test was added. |
| R8 E2 / F-020: no browser suite or 2560 evidence | **Fixed** (caveat: Defect 6) | TESTS.md 19/19; `res-2560/` has 4 frames, but no HUD frame. |
| R8 E3 / F-047: relocation subtitle about 1.1–1.5:1 | **Fixed** | `15`: dark pill, plainly legible; `styles.css:136`. |
| R8 E4 / F-035: mid-gust squall entries uncaptioned | **Not fixed** | 32/82 (Defect 3). |
| R8 E5 / F-022: Hard step and Endless Normal | **Partial** | Skilled Hard 5/7 against 6/7 (fine). Intermediate Hard 0/7 against 4/7. Endless Normal 2/4 caught (Defect 4). |
| R8 E6: snowball clamp inside the guard | **Not fixed** | 585/780. |
| R8 E7 / F-015: slow gully crashes | **Not fixed** (accepted) | 24 crashes; no second crash from the rescue. |
| R8 E8: stale comment | **Not fixed** | `GameSession.ts:10`. |
| F-021: cave-mouth trap (Critical) | **Fixed** (verified again on `3bf5a7e`, with the boulders) | 0/2,880 unrecovered. |
| F-040: cave boulders without collision | **Fixed functionally**; new defect | The boulders now collide, but as trees (Defect 1). Visual bedding is A's and C's area. |
| F-016: UI scale at 1440p | **Fixed for the menu** (e2e and frame); HUD not evidenced | Defect 6. |
| F-017: per-squall caption throttle | **Still fixed** | Code unchanged. |
| F-018: Relaxed intensity 0.5 | **Verified** | Relaxed is 3–6 % faster than Normal (Sprint 150–160 s against 156–164 s), and all mechanics stay active. |
| F-039: Sprint ladder within noise | **Open** | Normal Sprint: Fjord 156–164 s against Alpine 143–161 s on the same seeds, so Fjord is slower on 4/4. Defer to B and F. |

## 7. Public-preview gate (completion brief §10), my area

| Gate item | Status | Evidence |
|---|---|---|
| No critical gameplay or physics defects; no unrecoverable states | **Met** | 0/2,880 trap approaches unrecovered, with the cave colliders. No soft-lock in 92 runs. |
| All finite lengths completable | **Met** | §5: 100 % on Relaxed and Normal, including 50 km. |
| Endless streams reliably | **Met (headless)** | 6 bands to 30 km, 8 runs. GPU and texture memory are D's area. |
| Saves compatible | **Met** | `migration.spec` #12 and #13 pass. The save code is unchanged. |
| Keyboard and controller work | **Met** | `menu.spec:116` passes on `3bf5a7e`. `game.spec:190` (gamepad hot-plug) and `release.spec:112` (keyboard play) pass on `e0e2eca`. |
| Menus work (1366 / 1920 / 2560) | **Met** | `menu.spec` passes on `3bf5a7e` at all four sizes plus zoom and UI scale. 2560 and 1366 frames viewed. Contrast nit: Defect 5. |
| All automated tests pass | **Met** | 311/311 unit (developers' run; my 126/126 subset), `tsc` clean, 19/19 browser (caveat: Defect 6). |

**Gate result for my area: MET.** No defect I found is Critical or Major. Full approval (9/10 in Accessibility and controls) needs:
- Defect 1 (boulders as trees);
- F-035 (Defect 3);
- the stranded-rule wording and the regression tests (Defect 2);
- a HUD frame at 2560.
