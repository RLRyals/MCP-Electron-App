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
 * isolatedModules: true on both projects' ts-jest transform skips full
 * type-checking during the test transform for faster runs; type errors are
 * still caught by `npm run build` (tsc).
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
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            isolatedModules: true,
          },
        ],
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
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            isolatedModules: true,
          },
        ],
      },
    },
  ],
};
