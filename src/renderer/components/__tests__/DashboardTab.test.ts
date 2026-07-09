/**
 * Tests for DashboardTab (issue #132: Migrate Dashboard Card to Dashboard Tab).
 *
 * DashboardTab is the content component DashboardView.ts mounts inside the
 * ViewRouter's `dashboard` view slot. These tests guard the four sections
 * issue #132 specifies plus its acceptance criteria:
 *  - Status Bar (top) with a system status indicator
 *  - Quick Actions grid, with "Open Typing Mind" prominent
 *  - Service Status Summary cards (PostgreSQL, MCP Servers, Typing Mind)
 *  - Recent Activity (last 5 events)
 *  - Auto-refresh runs on a timer
 */

import { DashboardTab } from '../DashboardTab';

describe('DashboardTab', () => {
  let dashboard: DashboardTab;

  beforeEach(() => {
    document.body.innerHTML = '<div id="dashboard-card"></div>';
    dashboard = new DashboardTab();
  });

  afterEach(() => {
    dashboard.destroy();
    document.body.innerHTML = '';
  });

  describe('initial render', () => {
    beforeEach(() => {
      dashboard.initialize();
    });

    it('renders the status bar with a system status indicator', () => {
      const indicator = document.getElementById('dashboard-status-indicator');
      const text = document.getElementById('dashboard-status-text');
      expect(indicator).not.toBeNull();
      expect(indicator!.classList.contains('status-red')).toBe(true);
      expect(text!.textContent).toBe('System Offline');
    });

    it('renders the quick actions grid with system controls', () => {
      expect(document.getElementById('dashboard-start-system')).not.toBeNull();
      expect(document.getElementById('dashboard-stop-system')).not.toBeNull();
      expect(document.getElementById('dashboard-restart-system')).not.toBeNull();
      expect(document.getElementById('dashboard-refresh-status')).not.toBeNull();
    });

    it('renders the "Open Typing Mind" button as prominent', () => {
      const button = document.getElementById('dashboard-open-typing-mind');
      expect(button).not.toBeNull();
      expect(button!.classList.contains('prominent')).toBe(true);
    });

    it('renders service status summary cards for PostgreSQL and MCP servers', () => {
      const postgresCard = document.getElementById('postgres-card');
      const mcpCard = document.getElementById('mcp-servers-card');
      expect(postgresCard).not.toBeNull();
      expect(postgresCard!.querySelector('h4')!.textContent).toBe('PostgreSQL');
      expect(mcpCard).not.toBeNull();
    });

    it('renders an "Open Browser" action on the Typing Mind card', () => {
      const typingMindCard = document.getElementById('typing-mind-card');
      expect(typingMindCard).not.toBeNull();
      expect(typingMindCard!.querySelector('.open-browser-btn')).not.toBeNull();
    });

    it('renders an empty Recent Activity section with no events', () => {
      const activityList = document.getElementById('activity-list');
      expect(activityList).not.toBeNull();
      expect(activityList!.querySelector('.activity-empty')).not.toBeNull();
    });
  });

  describe('recent activity (last 5 events)', () => {
    beforeEach(() => {
      dashboard.initialize();
    });

    it('adds an event to the activity list', () => {
      dashboard.addEvent('success', 'System started');

      const activityList = document.getElementById('activity-list')!;
      expect(activityList.querySelector('.activity-empty')).toBeNull();
      expect(activityList.textContent).toContain('System started');
      expect(dashboard.getRecentEvents()).toHaveLength(1);
    });

    it('keeps only the most recent 5 events, newest first', () => {
      for (let i = 1; i <= 7; i++) {
        dashboard.addEvent('info', `Event ${i}`);
      }

      const events = dashboard.getRecentEvents();
      expect(events).toHaveLength(5);
      expect(events[0].message).toBe('Event 7');
      expect(events[4].message).toBe('Event 3');
    });

    it('escapes HTML in event messages', () => {
      dashboard.addEvent('error', '<img src=x onerror=alert(1)>');

      const activityList = document.getElementById('activity-list')!;
      expect(activityList.querySelector('img')).toBeNull();
      expect(activityList.innerHTML).toContain('&lt;img');
    });

    it('clearActivity() empties the list back to the empty state', () => {
      dashboard.addEvent('info', 'Something happened');
      dashboard.clearActivity();

      expect(dashboard.getRecentEvents()).toHaveLength(0);
      expect(document.getElementById('activity-list')!.querySelector('.activity-empty')).not.toBeNull();
    });
  });

  describe('updateStatusIndicator', () => {
    beforeEach(() => {
      dashboard.initialize();
    });

    it.each([
      ['online', 'status-green'],
      ['degraded', 'status-yellow'],
      ['starting', 'status-yellow'],
      ['offline', 'status-red'],
    ] as const)('sets %s status to the %s indicator class', (status, expectedClass) => {
      dashboard.updateStatusIndicator(status, 'Some text');

      const indicator = document.getElementById('dashboard-status-indicator')!;
      expect(indicator.classList.contains(expectedClass)).toBe(true);
      expect(document.getElementById('dashboard-status-text')!.textContent).toBe('Some text');
    });
  });

  describe('auto-refresh', () => {
    it('starts a 10-second refresh timer on initialize', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      dashboard.initialize();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
      setIntervalSpy.mockRestore();
    });

    it('clears the refresh timer on destroy', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      dashboard.initialize();
      dashboard.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });
});
