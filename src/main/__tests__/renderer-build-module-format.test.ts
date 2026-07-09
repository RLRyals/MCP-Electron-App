/**
 * Regression test for the renderer boot crash (blank blue window, empty
 * sidebar, "no components mount"):
 *
 *   Uncaught SyntaxError: The requested module '../../../types/kanban.js'
 *   does not provide an export named 'PRIORITY_COLORS'
 *     (at KanbanCardTile.tsx:10:10)
 *
 * Root cause: `npm run build` runs two separate `tsc` programs into the SAME
 * `dist/` output directory:
 *   - tsconfig.renderer.json (module: ES2020) -- compiles src/renderer/**,
 *     which transitively pulls in shared `src/types/*.ts` files and emits
 *     them as real ES modules (`export const X = ...`), because that's what
 *     the renderer needs: it's loaded by Chromium as literal
 *     `<script type="module">` / `import` graphs, no bundler.
 *   - tsconfig.main.json (module: commonjs) -- compiles src/main/**,
 *     src/preload/**, src/services/**, and (transitively) whichever
 *     `src/types/*.ts` files THOSE actually import by value. It emits
 *     CommonJS (`exports.X = ...`).
 *
 * Both passes write to `dist/types/<name>.js` for any shared type file
 * consumed by both sides, and the build script runs main.json SECOND, so its
 * CommonJS output always wins on disk. A real browser ES module loader then
 * finds zero `export` bindings in that file and throws a link-time
 * SyntaxError before any renderer code ever executes. `tsc` typechecks
 * happily on both passes individually, so this class of bug is invisible to
 * typechecking; it only shows up in the built artifact.
 *
 * NOTE (fictionlab-workflow#8): the original crash's fixture files
 * (src/types/kanban.ts + the kanban renderer components) have since MOVED
 * into the fictionlab-kanban plugin's own renderer bundle, which is built by
 * esbuild into its own outDir precisely so it can never participate in this
 * clobber again. The general hazard remains for any FUTURE shared type file
 * with runtime exports consumed by value from the renderer, so the invariant
 * this test still enforces is the surviving half of the original fix:
 *
 * `src/types/identity.ts`'s `DEFAULT_CURRENT_USER` is needed by value on the
 * main-process side (src/main/app-settings.ts, via `require()` under Node),
 * so it must compile to CommonJS in dist/types/, and no renderer module may
 * import a runtime VALUE from it (only erasure-safe `import type`) -- there
 * is no way for one dist/types/*.js path to satisfy both a browser ES module
 * loader and Node's `require()` at the same time.
 *
 * This test builds the project (if `dist/` isn't already fresh) and asserts
 * the built artifacts have the module format each runtime actually needs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const repoRoot = path.join(__dirname, '..', '..', '..');
const distTypesIdentity = path.join(repoRoot, 'dist', 'types', 'identity.js');
const distAppSettings = path.join(repoRoot, 'dist', 'main', 'app-settings.js');
const distRendererDir = path.join(repoRoot, 'dist', 'renderer');

function ensureBuilt(): void {
  if (fs.existsSync(distTypesIdentity) && fs.existsSync(distAppSettings)) {
    return;
  }
  execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });
}

/** Recursively collect .js files under a directory. */
function collectJsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

describe('renderer/main shared-type build output (GH issue: renderer boot crash)', () => {
  beforeAll(() => {
    ensureBuilt();
  }, 180_000);

  it('compiles dist/types/identity.js as CommonJS (main-process consumer)', () => {
    // src/main/app-settings.ts does `require('../types/identity')` at
    // runtime under Node -- it needs the CommonJS emit.
    const source = fs.readFileSync(distTypesIdentity, 'utf8');
    expect(source).toMatch(/exports\.DEFAULT_CURRENT_USER/);
  });

  it('dist/main/app-settings.js can still require dist/types/identity.js', () => {
    // Guards against include-list surgery in tsconfig.main.json accidentally
    // breaking the main process' own real need for this file.
    expect(() => {
      delete require.cache[require.resolve(distAppSettings)];
      require(distAppSettings);
    }).not.toThrow();
  });

  it('no compiled renderer module imports a runtime value from identity.js', () => {
    // The renderer must never import a *value* (only `import type`, which
    // tsc erases entirely) from a shared types file that main also needs by
    // value in CommonJS form. A runtime import shows up in the compiled
    // output as `from '<...>/types/identity.js'`; type-only imports leave no
    // trace.
    const offenders = collectJsFiles(distRendererDir).filter((file) =>
      /from ['"][./]*[^'"]*types\/identity\.js['"]/.test(fs.readFileSync(file, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });
});
