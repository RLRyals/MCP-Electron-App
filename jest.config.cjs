/**
 * Jest configuration.
 *
 * ts-jest was already a devDependency (and package.json already defines
 * test / test:unit / test:a11y scripts) but no jest config existed, so
 * every *.test.ts(x) file failed at the parser stage with "Missing
 * semicolon" on plain TypeScript syntax (interfaces, generics, etc.) before
 * a single test could run. This wires up ts-jest so the existing test
 * suites -- including src/main/handlers/__tests__/genre-pack-handlers.test.ts
 * (issue #159) and src/main/workflow/__tests__/create-workflow.test.ts
 * (issue #166) -- can actually execute.
 *
 * .cjs (not .js) so it isn't caught by the repo's blanket `*.js` gitignore
 * rule (compiled TypeScript output), and .js (not .ts) so it doesn't need
 * ts-node, which isn't a project dependency.
 *
 * Two projects: main-process tests run under node, renderer tests run under
 * jsdom (React Testing Library / jest-axe are already devDependencies).
 *
 * The main project's testMatch also covers <rootDir>/tests, which holds
 * pre-existing suites (build-orchestrator, ipc-handlers, etc.) that predate
 * the src/.../__tests__ convention.
 *
 * isolatedModules is set in tsconfig.json's compilerOptions (not here, as a
 * ts-jest transform option) -- ts-jest's own "isolatedModules" transform
 * option is deprecated as of ts-jest v29 and slated for removal in v30, in
 * favor of the standard tsconfig flag ts-jest now reads directly (mea-3).
 * Same effect: skips full type-checking during the test transform for
 * faster runs; type errors are still caught by `npm run build` (tsc).
 *
 * moduleNameMapper strips a trailing `.js` off relative imports before
 * resolution. The source tree writes relative imports with an explicit
 * `.js` extension pointing at `.ts`/`.tsx` siblings (e.g.
 * `import { AgentSkillSelector } from '../AgentSkillSelector.js'` in
 * src/renderer/components/dialogs/NodeConfigDialog.tsx) -- standard
 * Node16/ESM-style TS authoring: `tsc` emits `AgentSkillSelector.js`
 * alongside it, so the specifier is valid post-build. ts-jest transforms
 * in-memory rather than from `dist`, so without this mapping Jest looks
 * for a literal `AgentSkillSelector.js` on disk, finds only the `.tsx`
 * source, and fails to resolve the module (issue #176 --
 * NodeConfigDialog.a11y.test.tsx).
 *
 * renderer's setupFilesAfterEnv wires up src/setupTests.ts, which already
 * existed (imports @testing-library/jest-dom, mocks matchMedia /
 * IntersectionObserver / ResizeObserver / local & sessionStorage /
 * window.electronAPI) but was never referenced by any jest config -- it
 * predates jest.config.cjs entirely. Without it, every renderer test that
 * uses a jest-dom matcher (toBeInTheDocument, toHaveAttribute, ...) throws
 * "is not a function", and components that touch window.matchMedia or
 * window.electronAPI at mount blow up on undefined. Root cause behind most
 * of the *.a11y.test.tsx failures catalogued in issue #176.
 */
module.exports = {
  projects: [
    {
      displayName: 'main',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/main/**/*.test.ts',
        '<rootDir>/tests/**/*.test.ts',
      ],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
    },
    {
      displayName: 'renderer',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/src/renderer/**/*.test.ts',
        '<rootDir>/src/renderer/**/*.test.tsx',
      ],
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
    },
  ],
};
