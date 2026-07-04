/**
 * IPC handler registry.
 *
 * `registerHandler` is a pure pass-through wrapper around `ipcMain.handle` — it registers
 * the handler exactly as `ipcMain.handle` would, with zero behavior change, and additionally
 * records `{ channel, description, source }` so the app's IPC surface can be introspected
 * at runtime (see the `help` channel registered in `setupIPC()` in `src/main/index.ts`).
 *
 * Electron does not expose a supported way to list already-registered `ipcMain` handlers,
 * so this registry is the source of truth for introspection. Anything registered directly
 * via `ipcMain.handle` (bypassing this module) will NOT show up in the registry.
 */
import { ipcMain, IpcMainInvokeEvent } from 'electron';

export const APP_SOURCE = 'app';

export interface IpcHandlerInfo {
  channel: string;
  description: string;
  source: string; // 'app' | `plugin:<id>`
}

type IpcHandler = (event: IpcMainInvokeEvent, ...args: any[]) => any;

const registry: IpcHandlerInfo[] = [];

/**
 * Register an ipcMain.handle handler and record it in the introspection registry.
 *
 * Pure pass-through: calling this is equivalent to calling `ipcMain.handle(channel, handler)`
 * directly, plus bookkeeping. It does not alter the handler's behavior in any way.
 */
export function registerHandler(
  channel: string,
  description: string,
  handler: IpcHandler,
  source: string = APP_SOURCE
): void {
  ipcMain.handle(channel, handler);
  recordHandler(channel, description, source);
}

/**
 * Record a channel in the introspection registry without registering it via ipcMain.handle.
 *
 * Used for handlers that are registered through another mechanism (e.g. the plugin IPC
 * bridge in `plugin-context.ts`, which calls `ipcMain.handle` itself) but should still be
 * discoverable via the `help` channel.
 */
export function recordHandler(channel: string, description: string, source: string = APP_SOURCE): void {
  registry.push({ channel, description, source });
}

/**
 * Remove a previously recorded channel from the introspection registry (does not touch
 * ipcMain — callers are responsible for calling ipcMain.removeHandler themselves). Used to
 * keep the registry accurate when a channel registered via recordHandler is torn down, e.g.
 * plugin deactivation/reload removing its `plugin:<id>:*` channels.
 */
export function unrecordHandler(channel: string): void {
  const index = registry.findIndex((entry) => entry.channel === channel);
  if (index > -1) {
    registry.splice(index, 1);
  }
}

/**
 * Return the registered IPC channels, sorted by channel name, optionally filtered to
 * channels whose name starts with `prefix`.
 */
export function getRegisteredHandlers(prefix?: string): IpcHandlerInfo[] {
  const entries =
    typeof prefix === 'string' ? registry.filter((entry) => entry.channel.startsWith(prefix)) : registry.slice();
  return entries.slice().sort((a, b) => a.channel.localeCompare(b.channel));
}

/**
 * Test-only helper: clears the registry. Not used by production code.
 */
export function __clearRegistryForTests(): void {
  registry.length = 0;
}
