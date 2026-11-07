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
