# Pass 2 — consolidated defect tracker

An issue can only be closed by a reviewer who has checked new evidence (screenshot, test or measurement) against the previous evidence. A developer's statement that something is fixed does not close it. The Status column moves through:

- `open`: logged, nothing done yet
- `fixed-unverified`: a change has been made
- `verified`: a reviewer checked new evidence and closed it
- `wontfix (reason)`: deliberately left, with the reason given

Severity: **C** = critical/blocking · **M** = major · **m** = minor.

| ID | Sev | Area | Source | Defect | Evidence (before) | Status |
|---|---|---|---|---|---|---|
| U1 | M | Menu | User | The main menu scrolls on a 1080p desktop. Cause: `.menu-panel` (460 px wide, `overflow-y:auto`, `max-height:88vh`) is narrower than the 132 px title, so the panel overflows sideways and gets a scrollbar. Headless Chrome hides overlay scrollbars; Windows draws them. | `before/menu_1920x1080.png` | open |
| U2 | M | Menu | User | The SKIFREE title is clipped to "SKIFRI" at desktop widths (same cause as U1). | `before/menu_1920x1080.png` | open |
| U3 | C | Cave | User | The cave looks artificial: a half-tube tunnel in a terrain notch, with rows of instanced boulders as the roof and an arch of boulders round the mouth. | `../../screenshots/final/cave_c01_1_4.png`, `cave_c03_5_1.png` | open |
| U4 | C | Yeti/cinematic | User | The Yeti first appears partly below the visible floor, then rises. Cause: during lurk/grip its root is placed at `heightAt(mouthX+4)`, but the dark floor plane sits at +0.32 m and the terrain under the root differs. Emergence then snaps `y` to `heightAt` at each step. | code: `CaveCinematic.ts` lurk/grip/emerge placement | open |
| U5 | M | Course | User | The 3 km course is too short. | — | open |
| U6 | M | Course | User | Course distance is not a configurable option. | — | open |
| U7 | M | Daily | User | Daily Mountain needs verifying. Audit: it only reseeds noise, trees and kickers. The course shape, slope profile, cave and finish are identical on every date (all fixed tables in `course.ts`). Records are not split by mode. No custom seed. The date label is UTC but this isn't stated. | code audit | open |
| U8 | M | Visual | User | Overall visual presentation needs meaningful artistic improvement. | pass-1 reviews A, F | open |
| P1 | M | Yeti | Review A (pass 1) | A hard edge where the fur meets the face, which reads as a mask; one eye can read dead. | `../../screenshots/yeti_face_front.png` | open |
| P2 | M | Chase | Review F (pass 1) | The Yeti only reads in the main view at very close range. | `../../screenshots/final/cave_chase_rear_30m.png` | open |
| P3 | M | Terrain | Review A (pass 1) | A repetitive valley shape; the trees are stacked cones. | `../../screenshots/final/gameplay_z560.png` | open |
| P4 | M | Perf | Review D (pass 1) | GPU frame rate has never been measured on real hardware. | — | open (environment has no GPU) |
| P5 | m | Controls | Review E (pass 1) | Controller buttons can't be remapped; D-pad buttons don't auto-repeat in menus. | — | open |
| P6 | m | Cinematic | Review C (pass 1) | The victory sequence (about 18 s) can't be skipped or paused. | — | open |
