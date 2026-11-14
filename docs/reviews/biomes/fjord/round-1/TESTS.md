# Fjord Coast — round-1 test record (build `f8519ca`)

- `npx tsc --noEmit`: clean (reviewers B, D, E re-ran it).
- `npx vitest run`: 241 tests, all passing (reviewer D).
- Playwright `tests/e2e/menu.spec.ts` (PW_PORT=4471, SwiftShader): 5 passed; 1 failed —
  "keyboard, mouse and gamepad drive the course controls": the test still assumes Length is two
  rows below Start, but the new Location row (shown now that there are two locations) sits in
  between (`Received: "Location●○○○○ Beginner · …"`). Test needs updating; 2 tests did not run
  after the failure. Log excerpt kept in the round-2 remediation notes.
- Headless balance and hazard measurements: see reviewer B (`scratch/review-b/out/`, not
  committed) and reviewer E's tables in their reports; reviewer F's on/off environment comparison.
