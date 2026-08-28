/**
 * Jest config for scripts/*.test.js (mea-36t).
 *
 * jest.config.cjs's `projects` only match `.test.ts`/`.test.tsx` under
 * src/main, src/renderer, and tests/ (ts-jest transform) -- it does not
 * pick up plain CommonJS *.test.js under scripts/, so
 * scripts/auto-tag-release.test.js needs its own config, run via
 * `npm run test:scripts`. Mirrors fictionlab-workflow's
 * jest.config.js (roots: ['<rootDir>/scripts']).
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/scripts'],
  testMatch: ['**/*.test.js'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/'],
};
