/**
 * Where browser tests write their screenshots.
 *
 * By default captures go to `test-results/e2e-shots/<the evidence path>` (git-ignored), so an
 * ordinary test run never overwrites committed review evidence. Re-capturing evidence on purpose:
 * `E2E_EVIDENCE=1 npx playwright test …` writes to the committed path itself.
 */
const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process;
export const EVIDENCE = proc.env.E2E_EVIDENCE === '1';
export function shotPath(p: string): string {
  return EVIDENCE ? p : `test-results/e2e-shots/${p}`;
}
