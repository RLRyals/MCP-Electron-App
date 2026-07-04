# [BUG] Application submenus stop working after plugins load — menu rebuilt from live MenuItem instances

**Labels:** bug, ui, main-window, priority: high, complexity: low

## Symptom
The application menu bar renders (File, Edit, View, Diagnostics, Help, Plugins), but clicking submenu items does nothing. `role:`-based items (Edit/View cut-copy-paste, zoom, quit) keep working, which makes the breakage look partial/intermittent.

## Root cause (verified — do not re-investigate)
The original menu built by `createMenu()` in `src/main/index.ts:86-250` is correct: all submenu items use main-process `click:` callbacks (Diagnostics → functions imported from `./diagnostics`; Help → `shell.openExternal`, `updater.checkForAllUpdates()`, etc.). It is installed once at startup (`index.ts:2789`).

The bug is in `updatePluginMenu()` at `src/main/plugin-manager.ts:179`, called on plugin load/activation (`plugin-manager.ts:112, 124, 148`). It rebuilds the menu like this:

```ts
const menu = Menu.getApplicationMenu();            // line 185 — live MenuItem instances
// ...
Menu.buildFromTemplate([...menu.items.slice(...), pluginsMenu, ...])  // lines 257-281
Menu.setApplicationMenu(newMenu);
```

`Menu.buildFromTemplate()` expects plain `MenuItemConstructorOptions`. Live `MenuItem` instances have `.submenu` as a `Menu` object (not an options array), and their `click` callbacks are NOT carried over when round-tripped. Result: top-level labels survive, every custom `click` handler in every submenu is silently dropped. `role:` items keep working because Electron handles them natively — that's the "partial" illusion.

Since plugins load during startup, the menu is effectively always broken by the time the user interacts with it.

## Implementation plan
1. In `src/main/index.ts`, refactor `createMenu()` so the template (the `MenuItemConstructorOptions[]` array it currently builds inline at lines ~86-247) is available to other modules — e.g. export a `getBaseMenuTemplate(): MenuItemConstructorOptions[]` that returns a fresh copy of the template, and have `createMenu()` use it.
2. In `src/main/plugin-manager.ts` `updatePluginMenu()` (line 179): stop reading `Menu.getApplicationMenu().items`. Instead:
   - Get the base template via `getBaseMenuTemplate()`.
   - Build the Plugins submenu as plain `MenuItemConstructorOptions` (the plugin entries it already constructs are fine — they're built as options, not instances).
   - Splice the Plugins menu into the base template at the desired position (currently it inserts before Help — preserve that position).
   - `Menu.setApplicationMenu(Menu.buildFromTemplate(fullTemplate))`.
3. Ensure repeated calls are idempotent (plugin load fires `updatePluginMenu` multiple times — at `plugin-manager.ts:112, 124, 148`). Rebuilding from the base template each time guarantees this; do NOT accumulate.
4. Remove the now-unused instance-slicing logic at `plugin-manager.ts:257-281`.

## Acceptance criteria
- [ ] With plugins loaded, every Diagnostics submenu item works (Open Log File, Open Logs Directory, Export Diagnostic Report, Test System — handlers in `src/main/diagnostics`).
- [ ] Help submenu items work (external links open, About dialog shows, Check for Updates runs).
- [ ] Plugins menu still lists loaded plugins and its items still work.
- [ ] Calling plugin activation repeatedly does not duplicate menus or grow the menu bar.
- [ ] `npm run build` passes; existing jest tests pass.

## Gotchas
- The `dist/` build currently matches source, so test with `npm run dev` after rebuilding — the bug reproduces only after plugin load, not at bare startup.
- Don't try to "fix" by mapping live MenuItems back to options objects — regenerating from the source template is simpler and idempotent.
