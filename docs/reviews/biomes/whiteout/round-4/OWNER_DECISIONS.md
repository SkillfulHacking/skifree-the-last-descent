# Round 4: product-owner decisions (from the owner's round-4 brief)

## A. Hard difficulty (W-079 / W-080)
- "Hard must be difficult but consistently winnable through exceptional skill."
- A clean expert must be able to win Classic Hard Sprint and Classic Hard Standard in Alpine, Fjord and Whiteout.
- Provisional ranges for an expert on held-out seeds:
  - Hard Sprint: 50–75% wins.
  - Hard Standard: 25–50% wins.
  - Classic Hard defaults: demonstrably winnable, with a meaningful margin.
  - Normal: materially more forgiving than Hard.
  - Relaxed: accessible without highly optimised skiing.
- "Do not overfit seeds or artificially force the numbers." "A perfect run must never become an inevitable loss."
- No global increase in the Yeti's speed. No rubber-banding. No forced close calls. No invisible player boosts.
- **Alpine (W-079):** re-evaluate ×1.05 and ×1.10 against Normal and Hard together. Pick the smallest predictable change.
- **Whiteout (W-080):** investigate the expert's speed against the Yeti's.
  - Adjust the environment, not the Yeti.
  - Preserve the advantage of reading the weather.
  - "Do not weaken Hard into Normal."
- Fix W-089 (hazard streaming in the simulator) first. Real browser-game verification, compared with the simulation.

## B. Per-location cinematic history
- `seenCave` is keyed by location. Seeing one location never marks another.
- Seed, length and difficulty do not reset a location's flag. Later encounters in the same location are skippable.
- Pausing, restarting or abandoning before the cinematic completes does not mark it seen.
- Migration must be backward compatible and idempotent:
  - Keep PBs, runs, wins and achievements.
  - Keep Alpine's history.
  - Infer other locations only from reliable evidence. "Do not automatically mark Whiteout seen based on the old global flag."
  - Keep unknown fields.
- Escape/Start behaviour and W-076 parity are unchanged. History must not alter the Yeti, pursuit timing or balance.

## Gate
9/10 in every owned category, with no critical or release-blocking major findings, from six isolated reviewers on one frozen SHA. Reviewers are model-based, not human playtesters.
