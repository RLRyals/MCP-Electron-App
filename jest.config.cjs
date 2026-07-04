/**
 * Minimal Jest configuration.
 *
 * ts-jest was already a devDependency (and package.json already defines
 * test / test:unit / test:a11y scripts) but no jest config existed, so
 * every *.test.ts(x) file failed at the parser stage with "Missing
 * semicolon" on plain TypeScript syntax (interfaces, generics, etc.) before
 * a single test could run. This wires up ts-jest so the existing test
 * suites -- and the new src/main/handlers/__tests__/genre-pack-handlers.test.ts
 * added for issue #159 -- can actually execute.
 *
 * .cjs (not .js) so it isn't caught by the repo's blanket `*.js` gitignore
 * rule (compiled TypeScript output), and .js (not .ts) so it doesn't need
 * ts-node, which isn't a project dependency.
 *
 * Two projects: main-process tests run under node, renderer tests run under
 * jsdom (React Testing Library / jest-axe are already devDependencies).
 */
module.exports = {
  projects: [
    {
      displayName: 'main',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/main/**/*.test.ts'],
    },
    {
      displayName: 'renderer',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/src/renderer/**/*.test.ts',
        '<rootDir>/src/renderer/**/*.test.tsx',
      ],
    },
  ],
};
