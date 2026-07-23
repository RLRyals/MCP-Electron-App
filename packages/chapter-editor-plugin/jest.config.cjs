/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/*.test.ts'],
      testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/src/renderer/'],
    },
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/renderer/__tests__/**/*.test.tsx'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/tsconfig.jest.json',
          },
        ],
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        // @tiptap/markdown depends on `marked`, which ships ESM-only
        // (`export` syntax) under its default "main"/"module" entry --
        // ts-jest's CommonJS transform only covers our own .ts(x) sources,
        // so requiring it as-is throws "Unexpected token 'export'". marked
        // also ships a UMD build (its "browser" field) that loads fine
        // under Jest's CJS runtime; redirect there instead of pulling babel
        // in just for one dependency.
        '^marked$': '<rootDir>/node_modules/marked/lib/marked.umd.js',
      },
      setupFilesAfterEnv: ['<rootDir>/src/renderer/__tests__/jest.setup.ts'],
    },
  ],
};
