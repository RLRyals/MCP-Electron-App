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
 * CommonJs output always wins on disk. A real browser ES module loader (no
 * bundler, no cjs-module-lexer interop like Node's `require`/`import` has)
 * then finds zero `export` bindings in that file and throws a link-time
 * SyntaxError before any renderer code -- including the vanilla-DOM sidebar
 * -- ever executes. `tsc` typechecks happily on both passes individually
 * (there's no missing export in the source), so this class of bug is
 * invisible to typechecking; it only shows up in the built artifact.
 *
 * `src/types/kanban.ts` is the first shared type file with runtime
 * (non-type-only) exports consumed by value from the renderer
 * (`CARD_STATUSES`, `STATUS_LABELS`, `PRIORITY_COLORS`) that main/preload/
 * services never reference at all -- so the fix removed the blanket
 * `"src/types/**\/*"` entry from tsconfig.main.json's `include` (it was
 * force-compiling files main never needed, per commit c2a5440) and left
 * kanban.ts to transitive resolution, which only tsconfig.renderer.json ever
 * triggers for it.
 *
 * `src/types/identity.ts`'s `DEFAULT_CURRENT_USER` IS needed by value on
 * both sides (src/main/app-settings.ts and, until this fix,
 * KanbanViewReact.tsx), so it can never safely be "renderer wins" or "main
 * wins" by include-list surgery alone -- the renderer instead stopped
 * importing it by value (kept only the erasure-safe `import type
 * { CurrentUserSetting }`) and defines its own transient placeholder.
 *
 * This test builds the project (if `dist/` isn't already fresh) and asserts
 * the built artifacts have the module format each runtime actually needs.
 * It fails on the pre-fix source (kanban.ts ends up CommonJS in dist/,
 * because main.json's blanket types include recompiles it last) and passes
 * after.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const repoRoot = path.join(__dirname, '..', '..', '..');
const distTypesKanban = path.join(repoRoot, 'dist', 'types', 'kanban.js');
const distTypesIdentity = path.join(repoRoot, 'dist', 'types', 'identity.js');
const distKanbanCardTile = path.join(
  repoRoot,
  'dist',
  'renderer',
  'components',
  'kanban',
  'KanbanCardTile.js'
);
const distKanbanViewReact = path.join(
  repoRoot,
  'dist',
  'renderer',
  'views',
  'KanbanViewReact.js'
);
const distAppSettings = path.join(repoRoot, 'dist', 'main', 'app-settings.js');

function ensureBuilt(): void {
  if (fs.existsSync(distTypesKanban) && fs.existsSync(distAppSettings)) {
    return;
  }
  execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });
}

describe('renderer/main shared-type build output (GH issue: renderer boot crash)', () => {
  beforeAll(() => {
    ensureBuilt();
  }, 180_000);

  it('compiles dist/types/kanban.js as a real ES module (renderer-only consumer)', () => {
    const source = fs.readFileSync(distTypesKanban, 'utf8');

    // Real ESM: has literal `export const` bindings the browser's module
    // loader can see statically.
    expect(source).toMatch(/export const PRIORITY_COLORS/);
    expect(source).toMatch(/export const CARD_STATUSES/);
    expect(source).toMatch(/export const STATUS_LABELS/);

    // Must NOT have been clobbered by a later CommonJS compile pass.
    expect(source).not.toMatch(/exports\.PRIORITY_COLORS/);
    expect(source).not.toMatch(/Object\.defineProperty\(exports, "__esModule"/);
  });

  it('compiles dist/types/identity.js as CommonJS (main-process consumer)', () => {
    // src/main/app-settings.ts does `require('../types/identity')` at
    // runtime under Node -- it needs the CommonJS emit, unlike kanban.ts.
    const source = fs.readFileSync(distTypesIdentity, 'utf8');
    expect(source).toMatch(/exports\.DEFAULT_CURRENT_USER/);
  });

  it('dist/main/app-settings.js can still require dist/types/identity.js', () => {
    // Guards against "fix" #1 (narrowing tsconfig.main.json's include)
    // accidentally breaking the main process' own real need for this file.
    expect(() => {
      delete require.cache[require.resolve(distAppSettings)];
      require(distAppSettings);
    }).not.toThrow();
  });

  it('the compiled KanbanCardTile.js imports PRIORITY_COLORS from the (now ESM-safe) kanban.js', () => {
    const source = fs.readFileSync(distKanbanCardTile, 'utf8');
    expect(source).toMatch(
      /import\s*\{\s*PRIORITY_COLORS\s*\}\s*from\s*['"]\.\.\/\.\.\/\.\.\/types\/kanban\.js['"]/
    );
  });

  it('the compiled KanbanViewReact.js no longer imports a runtime value from identity.js', () => {
    // The renderer must never import a *value* (only `import type`, which
    // tsc erases entirely) from a shared types file that main also needs by
    // value in CommonJS form -- there is no way to make one dist/types/*.js
    // path satisfy both a browser ES module loader and Node's `require()`
    // at the same time.
    const source = fs.readFileSync(distKanbanViewReact, 'utf8');
    expect(source).not.toMatch(/from ['"]\.\.\/\.\.\/types\/identity\.js['"]/);
  });
});
