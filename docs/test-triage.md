# Test suite triage (issue #176 / bead mea-3)

Tracks the full triage of the ~123 pre-existing test failures that became
visible once `jest.config.cjs` first landed (2026-07-04). Two tranches:

- **Tranche 1** (PR #197, merged 2026-07-09): fixed structural blockers and
  stale fixtures. 12 failed suites -> 7, 116 failed tests -> 25.
- **Tranche 2** (this change, mea-3): re-validated tranche 1 against current
  `develop`, fixed 3 more suites outright, and confirmed/documented the
  remaining 4 as genuine deferrals. 7 failed suites -> 4, 25 failed tests -> 15.
  Also trimmed `jest.config.ci.cjs`'s `ignoredSuites` list, which tranche 1's
  own PR body flagged as follow-up but was never done -- it was still hiding
  8 suites that had already gone green, so CI wasn't gating on ~185 tests it
  could have been. CI gate: 38 suites/384 tests -> 44 suites/569 tests, all
  green.

Baseline for this doc: `npx jest` (full, default config) on current
`develop` plus this branch's fixes: **4 failed suites, 15 failed tests, 3
skipped, 676 passed, 694 total** (was 7 suites / 25 tests failed before this
tranche).

## FIXED (tranche 2)

| Suite | What was wrong | Fix |
|---|---|---|
| `tests/main/build-orchestrator.test.ts` (1 test: "should clean node_modules if clean option is true") | `(fs.rmSync as jest.Mock) = mockRmSync` threw `TypeError: Cannot set property rmSync of #<Object> which has only a getter` -- under the current Node/Jest automock, `fs`'s exports are getter-backed and not directly reassignable. | Use `jest.spyOn(fs, 'rmSync').mockImplementation(...)` instead of direct property reassignment. |
| `src/main/llm/adapters/__tests__/openai-adapter.test.ts` (2 tests) | `OpenAIAdapter.execute()` always injected a `{ role: 'system', content: 'Context: {}' }` message even when `request.context` was an empty object -- pure noise sent to the model, and what tranche 1 flagged as a "context-message-injection behavior question." | Added an `Object.keys(request.context).length > 0` check in `src/main/llm/adapters/openai-adapter.ts` so an empty context object is skipped, matching the (correct) test expectation. |
| `src/main/llm/adapters/__tests__/adapter-integration.test.ts` (5 tests) | Two independent bugs in the test file, not the adapters:<br>1. `@anthropic-ai/sdk` and `openai` both set `__esModule: true`, so the adapters' `import Anthropic from '@anthropic-ai/sdk'` / `import OpenAI from 'openai'` resolve to the module's `.default` export -- a distinct object from the raw `require('@anthropic-ai/sdk')` the test was calling `.mockImplementation()` on. The mock never reached the constructor the adapters actually call, so `new Anthropic()`/`new OpenAI()` hit the unconfigured automock (`messages`/`chat` undefined).<br>2. "should maintain provider-specific configurations" read `Anthropic.mock.results[0]` directly, but the `Anthropic` constructor mock's call history isn't cleared between tests in that `describe` block, so `results[0]` was actually a leftover call from an earlier test. | 1. Mock `require(...).default` instead of the raw `require(...)` result, everywhere in the file (4 call sites).<br>2. Hoisted the per-test `mockAnthropicCreate` fn to a `describe`-scoped variable set fresh in `beforeEach` and asserted on it directly, instead of indexing into the constructor mock's accumulated `.mock.results`. |
| `src/renderer/components/__tests__/VariableBrowser.a11y.test.tsx` (2 tests) | 1. "should have no violations with empty data": the tree container always rendered `role="tree"`, including for the empty state, which renders neither `treeitem` nor `group` children -- a real axe `aria-required-children` violation.<br>2. "should update tabindex when focus moves": the roving-tabindex model had no `onFocus` handler syncing DOM focus back to the `focusedItemId` state, so calling `.focus()` on an item never updated its `tabindex`; separately, the test called the raw `firstItem.focus()` (not wrapped in `act()`) and asserted synchronously right after, before React's state update could flush. | 1. `src/renderer/components/VariableBrowser.tsx`: made `role`/`aria-label` on the tree container conditional -- `undefined` when both `nodeSections` and `globalVariables` are empty, `'tree'`/`'Available variables'` otherwise.<br>2. Added `onFocus={() => setFocusedItemId(item.id)}` to both the tree-item and tree-section-header elements (standard roving-tabindex completion: DOM focus, from any source, syncs back to the tracked focused id).<br>3. Test: swapped the raw `firstItem.focus()` for `fireEvent.focus(firstItem)` (wraps dispatch in `act()`), so the state update is flushed before the next assertion. |

10 tests fixed in total (2 + 5 + 1 + 2, matching the 25 -> 15 drop).

## FIXED (CI flake, post-tranche-2)

While validating this branch's CI run, `VariableBrowser.a11y.test.tsx`
started failing on `ubuntu-latest` and `windows-latest` (passed on
`macos-latest`) with an uncaught-exception error attributed to `Tree Item
Labels > should include data type and value in aria-label` -- a test with no
apparent connection to the actual assertion failure (`expect(leafNodes.length
).toBeGreaterThan(0)` received `0`).

Root cause: the *previous* test, `Tree Structure > should not have
aria-expanded for leaf nodes`, ran its assertion inside a bare
`setTimeout(..., 100)` callback that Jest never awaited -- the test function
was synchronous and returned before the timeout fired, so Jest reported it
"passed" immediately. The callback (and its assertion) kept running in the
background and fired later, during whichever test happened to be executing
100ms after -- landing mid-test on the more contended ubuntu/windows CI
runners (macOS's runner was fast enough that the callback consistently fired
inside the *original* test's window, so it never surfaced there). jsdom
reports an unhandled callback exception as an "Uncaught exception" against
the currently-running test, which is why the error appeared attached to an
unrelated test name.

Fix (`src/renderer/components/__tests__/VariableBrowser.a11y.test.tsx`):
made the test `async`, `await`ed `user.click(firstSection)` instead of the
unawaited `userEvent.click(firstSection)`, and replaced the bare `setTimeout`
with `waitFor(...)` (imported from `@testing-library/react`) so the
assertion is bounded by Jest's own test lifecycle instead of leaking into
whatever runs next. Verified locally with 3 back-to-back full
`jest.config.ci.cjs` runs (599/599 passing each time) and a full default
`npx jest` run (matches the documented 4-failed-suite/15-failed-test
baseline exactly, all in the already-DEFERRED suites below).

## DELETED

None in tranche 2 -- tranche 1 already deleted the only dead suites found
(`src/main/workflow/__tests__/multi-node-workflow.test.ts` and
`workflow-executor-integration.test.ts`, both testing `workflow-executor.ts`,
a module removed in a deliberate refactor to the `@fictionlab/workflow-runner`
package). No new dead suites were found on re-triage.

## DEFERRED (4 suites, 15 tests)

| Suite | Failing | Why deferred |
|---|---|---|
| `tests/main/build-orchestrator.test.ts` | 6 tests | Two intertwined root causes in `src/utils/error-handler.ts` / `src/utils/retry-strategy.ts`, both genuine design questions rather than fixture bugs:<br>1. **Retry-timeout amplification**: precondition checks (missing repo path / `package.json` / build script / Dockerfile) are deterministic, permanent failures, but `executeNpmInstall`/`executeNpmBuild`/`executeDockerBuild` wrap them in the *same* `retryStrategy.execute()` call as the actual command execution, and the error codes used for those preconditions (e.g. `NPM_INSTALL_FAILED`, shared with real transient npm failures) carry `retryBehavior: RETRY_WITH_BACKOFF`. Jest's default 5s test timeout gets hit mid-retry-backoff before the operation ever finishes failing. Fixing this cleanly means either giving precondition checks their own non-retryable error codes or moving precondition validation outside the retry wrapper -- a real behavior/architecture change, not a one-line fix, and it also improves production behavior (users currently wait ~3s longer than necessary for an instant, deterministic failure).<br>2. **Error message identity**: `BuildError`'s `.message` is always the fixed, generic `userMessage` string from `ERROR_METADATA_REGISTRY` for its error code (`super(metadata.userMessage)` in `BuildError`'s constructor) -- it never surfaces the specific `originalError.message` text. Several tests assert `.rejects.toThrow('Repository path does not exist: ...')` expecting the specific text; by design, `ErrorHandler.createError()`/`.classify()` never puts it there. Whether `BuildError.message` *should* carry technical detail or stay a fixed user-facing string is a genuine product decision (the metadata registry was clearly built for user-facing error dialogs), and changing it touches every error code's presentation, not just these tests. Pre-existing per #193.<br>Already documented as deferred by tranche 1; re-confirmed with a more specific root cause on re-triage. |
| `src/main/llm/__tests__/provider-manager.test.ts` | 1 test | `LLMProviderManager.loadAdapters()` deliberately catches and *logs* (not propagates) a failure loading any single adapter, so `initialize()` still succeeds and registers whatever adapters DID load -- resilient-by-design for a desktop app where one broken provider SDK shouldn't prevent using the others. The test ("should handle adapter loading errors gracefully") expects strict propagation (`initialize()` rejects). Which behavior is correct is a product call, not a bug; changing it either breaks the resilience guarantee or requires rewriting the test's intent. Deferred per tranche 1, re-confirmed. |
| `tests/main/repository-manager.test.ts` | 6 tests, 3 skipped | Same `BuildError`/`RepositoryError` type-identity issue as build-orchestrator (`RepositoryManager.executeClone`/`executeCheckout` route through `ErrorHandler.classify()`, which returns generic `BuildError`, but tests expect the repository-manager-specific `RepositoryError`), *plus* several cases (`ftp://invalid.com`, nonexistent GitHub/GitLab remotes) make real `git` subprocess calls against unreachable network targets, and hit the same retry-before-timeout amplification described above -- genuinely network-bound and unsuited to a hermetic default `npm test` run. The original issue's acceptance criteria calls for quarantining network/integration tests behind a dedicated script (`test:integration` already exists in `package.json` but is scoped by path pattern `integration`, which this suite's path doesn't match) -- recommended as a follow-up rather than done here, to avoid restructuring test infra as a side effect of triage. Deferred per tranche 1, re-confirmed. |
| `src/renderer/components/__tests__/ProviderSelector.a11y.test.tsx` | 2 tests | jsdom does not implement native keyboard-arrow stepping for `<input type="range">`/`<input type="number">` -- there is no application code driving that behavior (it's the browser's native input handling), so there's nothing to fix; simulating it in the component would just be testing a fake. Deferred per tranche 1, re-confirmed. |

## Recommended follow-ups (not done here, out of scope for a triage pass)

1. Give build-orchestrator's precondition-check errors dedicated non-retryable
   error codes (or move precondition validation outside `retryStrategy.execute()`)
   so deterministic failures fail fast instead of retrying into a timeout --
   fixes both the test timeouts and a real user-facing delay.
2. Decide whether `BuildError.message` should ever surface `originalError`
   detail, and whether `RepositoryManager` should throw `RepositoryError` or
   `BuildError` (currently inconsistent with the tests' expectations).
3. Decide whether `LLMProviderManager.initialize()` should propagate a single
   adapter's load failure or stay resilient-by-design; update either the code
   or the test to match the decision.
4. Quarantine `tests/main/repository-manager.test.ts`'s real-network cases
   behind `npm run test:integration` (or widen that script's path pattern)
   per the original issue's acceptance criteria.
