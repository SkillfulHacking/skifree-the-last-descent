# Pass 2 — consolidated defect tracker

An issue can only be closed by a reviewer who has checked new evidence (screenshot, test or measurement) against the previous evidence. A developer's statement that something is fixed does not close it. The Status column moves through:

- `open`: logged, nothing done yet
- `fixed-unverified`: a change has been made
- `verified`: a reviewer checked new evidence and closed it
- `wontfix (reason)`: deliberately left, with the reason given

Severity: **C** = critical/blocking · **M** = major · **m** = minor.

| ID | Sev | Area | Source | Defect | Evidence (before) | Status |
|---|---|---|---|---|---|---|
| U1 | M | Menu | User | The main menu scrolls on a 1080p desktop. Cause: `.menu-panel` (460 px wide, `overflow-y:auto`, `max-height:88vh`) is narrower than the 132 px title, so the panel overflows sideways and gets a scrollbar. Headless Chrome hides overlay scrollbars; Windows draws them. | `before/menu_1920x1080.png` | fixed-unverified (4873ba5+: hero title outside the panel; dev metrics in `menu/` show panelScroll 0 at 4 sizes; `tests/e2e/menu.spec.ts`) |
| U2 | M | Menu | User | The SKIFREE title is clipped to "SKIFRI" at desktop widths (same cause as U1). | `before/menu_1920x1080.png` | fixed-unverified (see U1) |
| U3 | C | Cave | User | The cave looks artificial: a half-tube tunnel in a terrain notch, with rows of instanced boulders as the roof and an arch of boulders round the mouth. | `../../screenshots/final/cave_c01_1_4.png`, `cave_c03_5_1.png` | open |
| U4 | C | Yeti/cinematic | User | The Yeti first appears partly below the visible floor, then rises. Cause: during lurk/grip its root is placed at `heightAt(mouthX+4)`, but the dark floor plane sits at +0.32 m and the terrain under the root differs. Emergence then snaps `y` to `heightAt` at each step. | code: `CaveCinematic.ts` lurk/grip/emerge placement | open |
| U5 | M | Course | User | The 3 km course is too short. | — | fixed-unverified (4873ba5: Standard 10 km default; 20/50 km/Endless; headless completion tests in `tests/unit/course.test.ts`) |
| U6 | M | Course | User | Course distance is not a configurable option. | — | fixed-unverified (Length selector in the main menu, persisted in settings) |
| U7 | M | Daily | User | Daily Mountain needs verifying. Audit: it only reseeds noise, trees and kickers. The course shape, slope profile, cave and finish are identical on every date (all fixed tables in `course.ts`). Records are not split by mode. No custom seed. The date label is UTC but this isn't stated. | code audit | fixed-unverified (daily seed → whole generated course: segment plan, route, slopes, cave; UTC rollover stated; per-course records; custom seed; course codes; past-day replay) |
| U8 | M | Visual | User | Overall visual presentation needs meaningful artistic improvement. | pass-1 reviews A, F | open |
| P1 | M | Yeti | Review A (pass 1) | A hard edge where the fur meets the face, which reads as a mask; one eye can read dead. | `../../screenshots/yeti_face_front.png` | open |
| P2 | M | Chase | Review F (pass 1) | The Yeti only reads in the main view at very close range. | `../../screenshots/final/cave_chase_rear_30m.png` | open |
| P3 | M | Terrain | Review A (pass 1) | A repetitive valley shape; the trees are stacked cones. | `../../screenshots/final/gameplay_z560.png` | open |
| P4 | M | Perf | Review D (pass 1) | GPU frame rate has never been measured on real hardware. | — | open (environment has no GPU) |
| P5 | m | Controls | Review E (pass 1) | Controller buttons can't be remapped; D-pad buttons don't auto-repeat in menus. | — | open |
| P6 | m | Cinematic | Review C (pass 1) | The victory sequence (about 18 s) can't be skipped or paused. | — | fixed-unverified (skip to results after 1.2 s, victory and defeat) |

### Round 1 — Reviewer B (internal), commit 0631c26 (`round1/B_systems.md`)

| ID | Sev | Area | Defect | Status |
|---|---|---|---|---|
| B1 | C | Build | The committed `Cave.ts` is still the pass-1 version, so `tsc` and `vite build` fail on the branch. | open (the cave specialist's rebuild is still uncommitted; it lands together with the cinematic integration) |
| B2 | M | Chase | The rear-view camera is broken once the floating origin shifts. | fixed-unverified (the rear pose is computed before the shift; both cameras shift together) |
| B3 | M | Course | Alternate lines are shortcuts in name only. | fixed-unverified (a hard-packed, icy, slightly sunken chute: faster but low grip; trail markers; still only a few metres shorter) |
| B4 | M | Pacing | Long courses have one encounter, at the end. | fixed-unverified (Endurance adds 1 skirmish, Expedition 3. Each ends at a refuge; the main chase is still last) |
| B5 | m | Endless | Sampling past the generated frontier gives stale values. | fixed-unverified (queries near the frontier extend the plan first) |
| B6 | m | Endless | Plan arrays (keys, segments, encounters) grow with distance. | wontfix for now: about 1.5–1.7× slower lookups at 1,000 km; documented in KNOWN_ISSUES |
| B7 | m | Endless | Escalation stops early and is barely measurable. | fixed-unverified (+5 % per encounter up to +30 %) |
| B8 | m | Daily | Retrying after 00:00 UTC silently switches to the new day's course. | fixed-unverified (retry reuses the world's course) |
| B9 | m | Records | Corrupt record values are not cleaned; `dailyDate` is checked only by regex. | fixed-unverified (`cleanRecords`; real date validation) |
| B10 | m | Codes | Future-day codes are accepted; numeric seeds wrap. | fixed-unverified (future days rejected; numbers above 2³²−1 are hashed). A word seed still shows as its number after a code round-trip (by design, documented) |
| B11 | m | Config | The serialisable config has no difficulty field and the segment plan can't be exported. | fixed-unverified (Relaxed/Normal/Hard Yeti difficulty in config, menu, course id and records; `courseSpec()` exports the derived plan as JSON) |
| B12 | m | Precision | Particles, tracks and instances store absolute float32 positions. | wontfix (under 4 mm at 50 km; about 3 cm beyond 250 km of Endless; documented) |

### Round 1: Reviewer A, visual (internal; commit 41ceb7a; see `round1/A_visual.md`). Rejected: 5 of 8 areas fail

| IDs | Area | Severity | Status |
|---|---|---|---|
| A1–A8, A10, A13 | Cave geology and integration: box or loaf on the slope, door-like jambs, smears, shard facets, black void, floor disc seam, preview cameras | C/M | open (round-2 cave engineer assigned) |
| A6 | Footprint decals render as line art | m | open (cave engineer) |
| A9, A12 | The Yeti looks stage-lit in the dark; a bright orb near the floor | M | partial: `setShade` (89d7ef6); the creature engineer is checking every light term; the orb is being investigated by the cave engineer |
| A11 | Wall brightness jumps between beats | M | open (to be re-checked once the cave and shading are fixed) |
| A14–A19, A21 | Yeti fur reads as confetti or ice shards; small head, no neck; glove-like hands and feet; gallop and crawl pose; splayed leap | M/m | open (round-2 creature engineer assigned) |
| A20 | `rootAboveFloor` reads 0 by construction; the count of 438 visible frames is unclear | m | fixed-unverified: the capture tool now also measures hands and the per-frame root step (see C3) |
| A22–A24, A29 | Tree tops are four-pointed stars; flat radial whorls; trees on vertical rock; uniform pebble rocks | M/m | open (round-2 terrain/trees engineer assigned) |
| A25 | Contour-line artefacts on mid-distance slopes | C | partial: distance fade (9584cbd); fwidth anti-aliasing assigned |
| A26–A28, A30, A31 | Speckle, cardboard wall slabs, straight strata, egg-crate noise, flat distant ranges | M/m | open (terrain engineer) |
| A32 | Styles clash | M | open (terrain engineer: smooth-shaded trees and start gate) |
| A33 | Menu view crops the START banner and hides the skier | m | open (terrain engineer: StartArea) |

### Round 1: Reviewer C/E, cinematic and UI (internal; commit 41ceb7a; see `round1/CE_cinematic_ui.md`). Rejected: both 7/10, pass mark 8

| ID | Sev | Defect | Status |
|---|---|---|---|
| C1 | C | The leap ignores an ~11 m drop, so the Yeti may still be airborne at hand-off and get reset to the ledge (a teleport) | fixed-unverified: ballistic flight time solved from the drop; an in-flight hand-off keeps position and velocity |
| C2 | M | 0.6 m jump at t=6.2 | fixed-unverified: the crawl eases out exactly to the grip point |
| C3 | M | Report misses 15.8–17 s and the hand-off; no hands, head or step checks | fixed-unverified: the capture runs to 18 s and records hands, head and max root step per frame |
| C4 | m | The Yeti is fully lit in the 3.8 s "shadow" beat | partial (`setShade`); creature engineer |
| C5 | m | A stale caption at t=0.1 | fixed-unverified: captions cleared at the start of the cinematic |
| C6 | m | Feet cropped at 9.5 s | fixed-unverified: emerge shot reframed |
| C7 | m | Skier not in frame for the over-the-shoulder leap | fixed-unverified: the camera sits behind the skier on the line to the cave |
| C8 | m | At 15.8 s the Yeti looks as if it's above the cave roof | fixed-unverified (via C1 and C7) |
| C9 | m | A white blob between the hands | open (see A12) |
| E1 | M | An invalid code is reported through the hidden HUD and the text is wiped | fixed-unverified: inline error in the course card; the text is kept |
| E2 | M | Clicking Start after typing loses the click (blur triggers a re-render) | fixed-unverified: typed text becomes a draft; buttons commit drafts first; e2e test added |
| E3 | M | Padding is a % of width, so little headroom at 1366×768 with the Yeti row | fixed-unverified: vh padding; tests and screenshots must be re-run |
| E4 | M | The 150 % UI-scale test may never apply its setting | fixed-unverified: a fresh page with one init script, and `--ui-scale` asserted |
| E5 | M | The code test is not re-run and `fill()` sends no keys | fixed-unverified: `keyboard.type` with real key events; to be re-run |
| E6 | m | No code entry for gamepad-only users | wontfix for now (codes are optional; every other control is reachable by gamepad) |
| E7 | m | Hard-coded placeholder date | fixed-unverified: today's date |
| E8 | m | The Start hint shows only the length | fixed-unverified: mountain · length · difficulty |
| E9 | m | Retire has no confirmation | fixed-unverified: two-step confirmation |
| E10 | m | Text is small at 2560×1440 | fixed-unverified: larger caps and a large-screen rule |
| E11 | m | `fmtDistance(999.6)` shows "1000 m" | fixed-unverified |

### Round 2: internal reviews on commit 79f95d2 (`round2/`)

**Reviewer A (visual), rejected; 5 of 8 areas fail.**
- Scores: cave geology 6, cave interior 5, Yeti model 6, grounding 8 ✔, trees 7 ✔, terrain shading 6, atmosphere 7 ✔, cohesion 6.
- Verified fixed by the reviewer: A4, A7, A14, A16, A18, A19, A22, A23, A25, A26, A28, A33.

| ID | Sev | Defect | Status |
|---|---|---|---|
| A9 | M | The Yeti looks lit in the "dark" beats (regressed) | fixed-unverified (0380d2b/77c2735): darkening now follows the dark beats wherever he stands, not only his depth in the cave |
| A12 / C9 | M | Bright orbs at hand contacts | fixed-unverified: no snow-puff particles inside the cave; glints and flakes are off in the dark beats |
| A38 / C11 | m | The landing is never on screen; the letterbox drops at 15.8 s | fixed-unverified: the leap shot holds to 16.95 s; letterbox until the swing |
| A39 / C7 | m | Only the top of the skier's helmet is in the over-the-shoulder shot | fixed-unverified: camera lowered and the look point moved toward the skier |
| A34, A29, A10, A37, A40, A6, A2, A3, A30, A31 | M/m | Quilted rock creases, pancake rocks, floor lip, snow facets, sticker claw marks, footprints, smears, spiky hills, flat distant ranges | open (round-3 environment engineer) |
| A35, A36, A15, A17 | M | Fur cards across the open mouth, rubber-mask face with a "helmet" edge, piano-key teeth, fur look at mid distance | open (round-3 creature engineer) |
| A8, A11, A13, A20, A21, A24, A27, A32 | M/m | Partial or no evidence | open |

**Reviewers B/C/E (systems, cinematic, UI): P4 8 ✔, P5 9 ✔, cinematic 8 ✔ (conditional on C10), menu 7.5 ✘.**
- Verified: B1, B2, B4, B5, B9, B10, B11, C1, C2, C3 (with caveats), C5, C6, C8, E3, E8, E9, E11 (and E10, partly).

| ID | Sev | Defect | Status |
|---|---|---|---|
| C10 | M | The Yeti freezes for about 0.9 s after landing; speed is lost at the hand-off | fixed-unverified: he keeps running after touchdown, and speed and velocity carry into the AI (no start delay) |
| C12 | m | The hand insert crops the planted hand | fixed-unverified (reframed) |
| E12 | M | An invalid typed code plus Start starts the old course | fixed-unverified: a text field can reject its value, which aborts the button; unit test plus e2e assertion |
| E13 | m | A stale draft and error survive | fixed-unverified (cleared when a run starts) |
| E14 | m | The RUN banner overlaps the rear view | fixed-unverified (moved down) |
| B8 | m | The menu card goes stale across a UTC rollover | fixed-unverified (refreshes at the day change) |
| B13 | m | Hard on Endless reaches ×1.39 | fixed-unverified: a documented ceiling of ×1.33 in the game and the simulation |
| B14 | m | No repo tests for the B2 and B3 fixes | B3 and E12 ported to `tests/unit/review_regressions.test.ts`; B2 verified by the reviewer's probe and the `final/game_chase.png` capture |
| E7 | m | Placeholder contrast | fixed-unverified (0.58) |
| B3, B7 | m | No risk on alternate lines; escalation is speed-only | partial / wontfix (documented) |
| E4, E5 | M | e2e evidence pending | the run is in progress (`/tmp/menu_e2e3.log`) |

### Final round 3: internal Reviewers A and C/E (commit 820b280; see `final/FINAL_REVIEW_A_CE.md`)

**Scores:**
- Passing: cave geology 7 ✔, grounding 8 ✔, trees 7 ✔, terrain shading 7 ✔, atmosphere 7 ✔, cohesion 7 ✔, cinematic and grounding 8 ✔, menu and UX 8 ✔.
- Failing: **cave interior 6.5 ✘** and **Yeti model 6.5 ✘**.

**Verified in round 3:** A3, A6, A21, A30, A34, A38, A39, A40, C7, C10 (with caveats), C11, C12, E1, E2, E4, E5, E7, E12, E14.

**Changed after round 3, not re-reviewed:**
- C4/A9: dimming now starts before the 3.8 s cut. The re-capture `final/cine_check/cine_t3_8.png` shows the Yeti as a dark shape.
- C13: no double move on the hand-off frame.
- E15: the UI-scale test now checks a row in the middle of the list.
- Post-landing speed is gentler, and the AI's start beat is kept (the reviewer's note on the 9 m chase start).

**Still open:**
- **Cave interior:** A8, A10, A11, A12 (grey orbs near the head), A13.
- **Yeti:** A15, A17, A35 (fur fills the mouth at the close-up roar angle), A36 (forehead "brim"), A42 (forehead whorl), A44 (ruff reads as a feather boa).
- **Environment:** A2, A24, A29, A31, A37, A41, A43, A45.
- **Systems:** B3, B6, B7, B12, E6 and E13 (partial).

All open items are listed in `docs/KNOWN_ISSUES.md`.

**End-to-end runs on the final build:**
- `game.spec.ts`: 3/3 pass (menu; the full loop of cave, caught, retry, victory; pause and hot-plug).
- `menu.spec.ts`: 7/7 pass across runs.
- Unit tests: 109/109.
