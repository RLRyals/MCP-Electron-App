/**
 * Application State Management
 *
 * Manages global application state including active project/series selection
 * State is persisted to localStorage
 * NOTE: Series management has moved to MCP-Writing-Servers
 */

import type { Project } from '../../types/project';

// Temporary stub - series management is now in MCP-Writing-Servers
interface Series {
  id: number;
  name: string;
  description?: string;
  project_id?: number | null;
}

const STORAGE_KEY = 'fictionlab_app_state';

export interface AppState {
  activeProjectId: number | null;
  activeSeriesId: number | null;
  projects: Project[];
  series: Series[];
}

class AppStateManager {
  private state: AppState;
  private listeners: Set<(state: AppState) => void> = new Set();

  constructor() {
    // Load from localStorage or use defaults
    this.state = this.loadState();
  }

  /**
   * Load state from localStorage
   */
  private loadState(): AppState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          activeProjectId: parsed.activeProjectId || null,
          activeSeriesId: parsed.activeSeriesId || null,
          projects: parsed.projects || [],
          series: parsed.series || [],
        };
      }
    } catch (error) {
      console.error('[AppState] Failed to load state from localStorage:', error);
    }

    return {
      activeProjectId: null,
      activeSeriesId: null,
      projects: [],
      series: [],
    };
  }

  /**
   * Save state to localStorage
   */
  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.error('[AppState] Failed to save state to localStorage:', error);
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current state (read-only)
   */
  getState(): Readonly<AppState> {
    return { ...this.state };
  }

  /**
   * Set active project
   */
  setActiveProject(projectId: number | null): void {
    this.state.activeProjectId = projectId;

    // Clear active series if changing projects
    if (projectId !== this.state.activeProjectId) {
      this.state.activeSeriesId = null;
    }

    this.saveState();
    this.notifyListeners();
  }

  /**
   * Set active series
   */
  setActiveSeries(seriesId: number | null): void {
    this.state.activeSeriesId = seriesId;

    // If setting a series, find its project and set that too
    if (seriesId) {
      const series = this.state.series.find(s => s.id === seriesId);
      if (series && series.project_id) {
        this.state.activeProjectId = series.project_id;
      }
    }

    this.saveState();
    this.notifyListeners();
  }

  /**
   * Get active project ID
   */
  getActiveProjectId(): number | null {
    return this.state.activeProjectId;
  }

  /**
   * Get active series ID
   */
  getActiveSeriesId(): number | null {
    return this.state.activeSeriesId;
  }

  /**
   * Get active project
   */
  getActiveProject(): Project | null {
    if (!this.state.activeProjectId) return null;
    return this.state.projects.find(p => p.id === this.state.activeProjectId) || null;
  }

  /**
   * Get active series
   */
  getActiveSeries(): Series | null {
    if (!this.state.activeSeriesId) return null;
    return this.state.series.find(s => s.id === this.state.activeSeriesId) || null;
  }

  /**
   * Update projects cache
   */
  setProjects(projects: Project[]): void {
    this.state.projects = projects;
    this.saveState();
    this.notifyListeners();
  }

  /**
   * Update series cache
   */
  setSeries(series: Series[]): void {
    this.state.series = series;
    this.saveState();
    this.notifyListeners();
  }

  /**
   * Add a project to cache
   */
  addProject(project: Project): void {
    this.state.projects = [...this.state.projects, project];
    this.saveState();
    this.notifyListeners();
  }

  /**
   * Add a series to cache
   */
  addSeries(series: Series): void {
    this.state.series = [...this.state.series, series];
    this.saveState();
    this.notifyListeners();
  }

  /**
   * Remove a project from cache
   */
  removeProject(projectId: number): void {
    this.state.projects = this.state.projects.filter(p => p.id !== projectId);

    // Clear active project if it was deleted
    if (this.state.activeProjectId === projectId) {
      this.state.activeProjectId = null;
      this.state.activeSeriesId = null;
    }

    // Remove all series in this project
    this.state.series = this.state.series.filter(s => s.project_id !== projectId);

    this.saveState();
    this.notifyListeners();
  }

  /**
   * Remove a series from cache
   */
  removeSeries(seriesId: number): void {
    this.state.series = this.state.series.filter(s => s.id !== seriesId);

    // Clear active series if it was deleted
    if (this.state.activeSeriesId === seriesId) {
      this.state.activeSeriesId = null;
    }

    this.saveState();
    this.notifyListeners();
  }

  /**
   * Refresh projects from backend
   * NOTE: Series management moved to MCP-Writing-Servers, no longer fetched here
   */
  async refresh(): Promise<void> {
    try {
      const electronAPI = (window as any).electronAPI;

      // Fetch projects
      const projects = await electronAPI.invoke('project:list');
      this.state.projects = projects;

      // NOTE: Series are managed by MCP-Writing-Servers now, not fetched here
      // Keep series state as-is for now

      // Validate active project still exists
      if (this.state.activeProjectId) {
        const projectExists = projects.some((p: Project) => p.id === this.state.activeProjectId);
        if (!projectExists) {
          this.state.activeProjectId = null;
          this.state.activeSeriesId = null;
        }
      }

      // NOTE: Cannot validate series existence without MCP server query
      // Series validation would need to be done separately if needed

      this.saveState();
      this.notifyListeners();
    } catch (error) {
      console.error('[AppState] Failed to refresh projects:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const appState = new AppStateManager();

// Export helper functions for convenience
export function getActiveProjectId(): number | null {
  return appState.getActiveProjectId();
}

export function getActiveSeriesId(): number | null {
  return appState.getActiveSeriesId();
}

export function getActiveProject(): Project | null {
  return appState.getActiveProject();
}

export function getActiveSeries(): Series | null {
  return appState.getActiveSeries();
}

export function setActiveProject(projectId: number | null): void {
  appState.setActiveProject(projectId);
}

export function setActiveSeries(seriesId: number | null): void {
  appState.setActiveSeries(seriesId);
}

export function subscribeToState(listener: (state: AppState) => void): () => void {
  return appState.subscribe(listener);
}

export function refreshProjects(): Promise<void> {
  return appState.refresh();
}
