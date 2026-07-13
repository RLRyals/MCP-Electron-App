/**
 * CI-scoped Jest config -- issue #187.
 *
 * build.yml and release.yml previously ran no tests at all (npm run build ->
 * package straight through). Wiring the full jest.config.cjs suite in as a
 * *required*, blocking CI gate isn't viable yet: as of 2026-07-08 there were
 * 123 pre-existing failures across 12 of the repo's 22 suites (201 passed,
 * 3 skipped), tracked and triaged in issue #176. A gate that's already >1/3
 * red on day one would be meaningless -- every PR would need an override,
 * which trains reviewers to ignore it, which is the same "no real gate"
 * problem #187 is trying to fix, just moved one layer down.
 *
 * This config reuses the base jest.config.cjs projects but additionally
 * ignores exactly the suites that are currently red, so CI can be a real,
 * required, blocking gate on the rest of the suites *today* -- catching
 * regressions the moment they land -- rather than punting the whole gate
 * until #176 fully lands. As #176 fixes/deletes/quarantines each suite,
 * remove its line from `ignoredSuites` below so it rejoins the gate.
 *
 * Updated 2026-07-13 (#176 tranche 1 + tranche 2, mea-3): tranche 1 (PR #197)
 * fixed 6 of the original 12 suites (deleted 2 dead ones testing a removed
 * module, fixed 4 more) but this file's ignore list was never trimmed to
 * match -- it still hid all 12 original suites from the gate even after they
 * went green. Tranche 2 fixed 3 more (adapter-integration, openai-adapter,
 * VariableBrowser.a11y) and confirmed the remaining 4 are genuine deferrals.
 * Trimmed the list down to just those 4 -- see docs/test-triage.md for the
 * full per-suite triage (FIXED/DELETED/DEFERRED) backing every line below
 * and every line removed.
 *
 * Ignored suites and why (see docs/test-triage.md for full detail):
 *   - tests/main/build-orchestrator.test.ts (6 failing)
 *       ErrorHandler/RetryStrategy design tension: precondition checks
 *       (missing file/script/Dockerfile) reuse retryable error codes, so
 *       deterministic failures get retried 3x with backoff before failing,
 *       blowing past Jest's 5s default timeout; BuildError.message is
 *       always a fixed per-code string, never the specific originalError
 *       text the tests assert on. Real design questions, not fixture bugs.
 *   - src/main/llm/__tests__/provider-manager.test.ts (1 failing)
 *       loadAdapters() deliberately catches and logs (not propagates) a
 *       single adapter's load failure so the app can still start with the
 *       adapters that DID load -- test expects strict propagation. Which
 *       behavior is correct is a product call, not a bug.
 *   - tests/main/repository-manager.test.ts (6 failing, 3 skipped)
 *       Same ErrorHandler design tension as build-orchestrator (RepositoryError
 *       vs BuildError type-identity) PLUS several cases make real `git`
 *       subprocess calls against invalid/unreachable remotes -- genuinely
 *       network-bound, unsuited to a hermetic default run, compounded by the
 *       same retry-before-timeout amplification.
 *   - src/renderer/components/__tests__/ProviderSelector.a11y.test.tsx (2 failing)
 *       jsdom doesn't implement native keyboard-arrow stepping for
 *       range/number inputs -- no app code to fix; simulating it would just
 *       be testing a fake browser behavior.
 *
 * Do NOT add a new suite to this list just to make a red PR pass -- fix it,
 * or take it to #176/mea-3 if it's pre-existing rot unrelated to your change.
 */
const base = require('./jest.config.cjs');

const ignoredSuites = [
  '/node_modules/',
  'tests/main/build-orchestrator.test.ts',
  'src/main/llm/__tests__/provider-manager.test.ts',
  'tests/main/repository-manager.test.ts',
  'src/renderer/components/__tests__/ProviderSelector.a11y.test.tsx',
];

module.exports = {
  ...base,
  projects: base.projects.map((project) => ({
    ...project,
    testPathIgnorePatterns: ignoredSuites,
  })),
};
