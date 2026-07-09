/**
 * CI-scoped Jest config -- issue #187.
 *
 * build.yml and release.yml previously ran no tests at all (npm run build ->
 * package straight through). Wiring the full jest.config.cjs suite in as a
 * *required*, blocking CI gate isn't viable yet: as of 2026-07-08 there are
 * 123 pre-existing failures across 12 of the repo's 22 suites (201 passed,
 * 3 skipped), tracked and triaged in issue #176. A gate that's already >1/3
 * red on day one would be meaningless -- every PR would need an override,
 * which trains reviewers to ignore it, which is the same "no real gate"
 * problem #187 is trying to fix, just moved one layer down.
 *
 * This config reuses the base jest.config.cjs projects but additionally
 * ignores exactly the suites that are currently red, so CI can be a real,
 * required, blocking gate on the other 10 suites (201 tests) *today* --
 * catching regressions the moment they land -- rather than punting the
 * whole gate until #176 fully lands. As #176 fixes/deletes/quarantines each
 * suite, remove its line from `ignoredSuites` below so it rejoins the gate.
 *
 * Ignored suites and why (see issue #176 for full triage detail):
 *   - src/main/workflow/__tests__/workflow-executor-integration.test.ts
 *   - src/main/workflow/__tests__/multi-node-workflow.test.ts
 *       Both import '../workflow-executor', a module that no longer
 *       exists. Dead suites (0 tests collected), not flaky/regressable code.
 *   - tests/main/build-orchestrator.test.ts
 *       Fails at parse time: its own header docblock contains the literal
 *       substring '**\/' inside an example testMatch glob, which closes the
 *       enclosing /** ... *\/ comment early and turns the rest of the
 *       docblock into invalid TS. A bug in the test file's comment, not in
 *       app code.
 *   - src/main/llm/adapters/__tests__/adapter-integration.test.ts
 *       `describe.each(adapters)` is called with an empty array at
 *       suite-collection time -- fails before any test runs.
 *   - src/renderer/components/dialogs/__tests__/NodeConfigDialog.a11y.test.tsx
 *       Fails to even import its component: NodeConfigDialog.tsx requires
 *       '../AgentSkillSelector.js', which doesn't exist on disk. Stale
 *       suite relative to a since-renamed/removed component.
 *   - src/main/llm/adapters/__tests__/openai-adapter.test.ts (2 failing)
 *   - src/main/llm/__tests__/provider-manager.test.ts (2 failing)
 *   - tests/main/build-pipeline-orchestrator.test.ts (20 failing)
 *   - tests/main/repository-manager.test.ts (13 failing, 3 skipped --
 *       several cases make real network calls to github.com/gitlab.com and
 *       an invalid domain; see #176's "network-timeout-prone" note)
 *   - src/renderer/components/dialogs/config-panels/__tests__/panels.a11y.test.tsx (28 failing)
 *   - src/renderer/components/__tests__/VariableBrowser.a11y.test.tsx (23 failing)
 *   - src/renderer/components/__tests__/ProviderSelector.a11y.test.tsx (35 failing)
 *       These six have real assertion failures (stale fixtures / prop
 *       drift per #176), not suite-collection errors.
 *
 * Do NOT add a new suite to this list just to make a red PR pass -- fix it,
 * or take it to #176 if it's pre-existing rot unrelated to your change.
 */
const base = require('./jest.config.cjs');

const ignoredSuites = [
  '/node_modules/',
  'src/main/workflow/__tests__/workflow-executor-integration.test.ts',
  'src/main/workflow/__tests__/multi-node-workflow.test.ts',
  'tests/main/build-orchestrator.test.ts',
  'src/main/llm/adapters/__tests__/adapter-integration.test.ts',
  'src/renderer/components/dialogs/__tests__/NodeConfigDialog.a11y.test.tsx',
  'src/main/llm/adapters/__tests__/openai-adapter.test.ts',
  'src/main/llm/__tests__/provider-manager.test.ts',
  'tests/main/build-pipeline-orchestrator.test.ts',
  'tests/main/repository-manager.test.ts',
  'src/renderer/components/dialogs/config-panels/__tests__/panels.a11y.test.tsx',
  'src/renderer/components/__tests__/VariableBrowser.a11y.test.tsx',
  'src/renderer/components/__tests__/ProviderSelector.a11y.test.tsx',
];

module.exports = {
  ...base,
  projects: base.projects.map((project) => ({
    ...project,
    testPathIgnorePatterns: ignoredSuites,
  })),
};
