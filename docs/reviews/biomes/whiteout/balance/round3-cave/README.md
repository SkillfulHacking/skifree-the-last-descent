# Re-check after the cave sight-line clearing (1a2bdef, W-076 review C C11)

The obstacle field now leaves no tree or rock in the triangle from each cave's landing point to the route over the first 45 m after its trigger. The check below confirms the balance results in `../round3/` still hold.

- **Classic courses** (`classic.jsonl`): Alpine, Fjord and Whiteout, Sprint and Standard, Relaxed, Normal and Hard, with the blind, informed and informed + lee policies.
  - 54 runs; 0 changed outcome and no time moved by more than 0.5 s, compared with `../round3/classic.jsonl`.
  - `CLASSIC-SPR@WHITE` Normal is still caught: W-056 remains open.
- **Held-out W3H, Whiteout Normal Sprint** (`whiteout_sprint_normal_W3H.jsonl`), compared with `../round3/whiteout_sprint_W3H.jsonl`:

  | Policy | Before | After | Flips |
  |---|---|---|---|
  | Blind | 14/24 | 14/24 | 0 |
  | Informed | 24/24 | 24/24 | 0 |
