/**
 * Structural copy of the FictionLab host (MCP-Electron-App) renderer
 * contract this plugin view plugs into. TYPE-ONLY mirror — nothing here is
 * imported from the app at runtime; the host duck-types the default export
 * of this plugin's renderer bundle against its own `View` interface
 * (MCP-Electron-App `src/renderer/components/ViewRouter.ts`) and reads
 * `getTopBarConfig()` against its `TopBarConfig`
 * (`src/renderer/components/TopBar.ts`). Mirrors agent-factory-plugin's /
 * kanban-plugin's `src/renderer/types/host.ts`.
 */

export interface View {
  mount(container: HTMLElement, params?: any): Promise<void>;
  unmount?(): Promise<void>;
  handleAction?(actionId: string): void;
  getTopBarConfig?(): TopBarConfig;
}

export interface TopBarAction {
  id: string;
  label: string;
  icon?: string;
}

export interface TopBarConfig {
  title?: string;
  breadcrumb?: string[];
  actions?: TopBarAction[];
  global?: {
    projectSelector?: boolean;
    environmentIndicator?: boolean;
    userMenu?: boolean;
  };
}
