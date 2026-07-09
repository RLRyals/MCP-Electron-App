/**
 * Tests for the Services tab (issue #124): ServicesView markup + ServicesTab
 * behavior, exercised together the way ViewRouter mounts them.
 *
 * Covers the issue's acceptance criteria at the unit level:
 * - All services manageable from the tab (real per-service controls via
 *   mcpSystem.controlService, whole-system actions via the top-bar's
 *   services-start-all/-stop-all/-restart-all window events)
 * - Logs viewable per service (per-server View Logs buttons open the logs
 *   dialog, with credentials redacted)
 * - Resource monitoring works (real values from mcpSystem.getResourceUsage
 *   rendered into the cards, "Not running" when a container is down)
 * - Service actions functional (buttons call the IPC surface with the right
 *   service ids; control states follow each service's running state)
 *
 * Also guards the unmount contract: ServicesView.unmount() must call
 * ServicesTab.cleanup(), stopping the 5s auto-refresh interval and removing
 * the window-level top-bar action listeners (previously these leaked).
 */

import { ServicesView } from '../../views/ServicesView';

interface MockAPI {
  mcpSystem: {
    start: jest.Mock;
    stop: jest.Mock;
    restart: jest.Mock;
    getDetailedStatus: jest.Mock;
    getUrls: jest.Mock;
    getLogs: jest.Mock;
    controlService: jest.Mock;
    getResourceUsage: jest.Mock;
  };
  envConfig: {
    getConfig: jest.Mock;
    checkPort: jest.Mock;
  };
  docker: {
    healthCheck: jest.Mock;
    startAndWait: jest.Mock;
    stop: jest.Mock;
    restart: jest.Mock;
  };
  prerequisites: {
    getDockerVersion: jest.Mock;
  };
  typingMind: {
    openWindow: jest.Mock;
    autoConfigure: jest.Mock;
  };
}

const CONFIG_FIXTURE = {
  POSTGRES_DB: 'fictionlab',
  POSTGRES_USER: 'fictionlab_user',
  POSTGRES_PASSWORD: 'secretpw',
  POSTGRES_PORT: 5432,
  MCP_CONNECTOR_PORT: 50880,
  HTTP_SSE_PORT: 50881,
  DB_ADMIN_PORT: 8081,
  MCP_AUTH_TOKEN: 'token',
  PGBOUNCER_PORT: 6432,
  NPE_PORT: 8765,
  WORKFLOW_MANAGER_PORT: 8766,
};

/**
 * Default status: postgres + connector healthy, writing servers stopped.
 * Exercises both branches of every per-service state render.
 */
function makeDetailedStatusFixture() {
  return {
    overall: { running: true, healthy: false, ready: false, message: '2/3 services ready' },
    services: [
      {
        serviceName: 'PostgreSQL Database',
        containerName: 'fictionlab-postgres',
        status: 'healthy',
        health: 'healthy',
        port: 5432,
        url: 'postgres://fictionlab_user:****@localhost:5432/fictionlab',
        message: 'Service is healthy and ready',
      },
      {
        serviceName: 'MCP Connector',
        containerName: 'fictionlab-mcp-connector',
        status: 'healthy',
        health: 'healthy',
        port: 50880,
        url: 'http://localhost:50880',
        message: 'Service is healthy and ready',
      },
      {
        serviceName: 'MCP Writing Servers',
        containerName: 'fictionlab-mcp-servers',
        status: 'stopped',
        health: 'none',
        port: 3001,
        message: 'Service is stopped',
      },
    ],
    timestamp: new Date(),
  };
}

function makeMockAPI(): MockAPI {
  return {
    mcpSystem: {
      start: jest.fn().mockResolvedValue({ success: true, message: 'started' }),
      stop: jest.fn().mockResolvedValue({ success: true, message: 'stopped' }),
      restart: jest.fn().mockResolvedValue({ success: true, message: 'restarted' }),
      getDetailedStatus: jest.fn().mockResolvedValue(makeDetailedStatusFixture()),
      getUrls: jest.fn().mockResolvedValue({
        typingMind: 'https://www.typingmind.com',
        mcpConnector: 'http://localhost:50880',
        postgres: 'postgres://fictionlab_user:****@localhost:5432/fictionlab',
      }),
      getLogs: jest.fn().mockResolvedValue({
        success: true,
        logs: 'connecting to postgresql://admin:supersecret@localhost:5432/fictionlab',
      }),
      controlService: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
      getResourceUsage: jest.fn().mockResolvedValue({
        cpuPercent: '3.14%',
        memoryUsage: '150MiB / 8GiB',
        memoryPercent: '1.83%',
      }),
    },
    envConfig: {
      getConfig: jest.fn().mockResolvedValue(CONFIG_FIXTURE),
      checkPort: jest.fn().mockResolvedValue(true),
    },
    docker: {
      healthCheck: jest.fn().mockResolvedValue({ running: true, healthy: true, message: 'Docker is healthy' }),
      startAndWait: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
      stop: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
      restart: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
    },
    prerequisites: {
      getDockerVersion: jest.fn().mockResolvedValue({ installed: true, running: true, version: '27.4.0' }),
    },
    typingMind: {
      openWindow: jest.fn().mockResolvedValue({ success: true }),
      autoConfigure: jest.fn().mockResolvedValue({ success: true }),
    },
  };
}

// jsdom has no setImmediate; a zero-delay macrotask lets all pending
// microtask chains (async click handlers) settle first.
const flushPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('Services tab (issue #124)', () => {
  let container: HTMLElement;
  let view: ServicesView;
  let api: MockAPI;
  let mounted: boolean;

  beforeEach(() => {
    api = makeMockAPI();
    (window as any).electronAPI = api;

    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);

    view = new ServicesView();
    mounted = false;
  });

  afterEach(async () => {
    if (mounted) {
      await view.unmount();
    }
    document.body.innerHTML = '';
  });

  async function mountView(): Promise<void> {
    await view.mount(container);
    mounted = true;
    await flushPromises();
  }

  function text(id: string): string {
    const el = document.getElementById(id);
    return el ? (el.textContent || '') : '';
  }

  function button(id: string): HTMLButtonElement {
    const el = document.getElementById(id) as HTMLButtonElement | null;
    if (!el) throw new Error(`Button #${id} not found`);
    return el;
  }

  it('renders all four service cards, both MCP server rows, and the ports table', async () => {
    await mountView();

    expect(container.textContent).toContain('PostgreSQL Database');
    expect(container.textContent).toContain('MCP Servers');
    expect(container.textContent).toContain('MCP Connector');
    expect(container.textContent).toContain('MCP Writing Servers');
    expect(container.textContent).toContain('Typing Mind');
    expect(container.textContent).toContain('Docker Desktop');

    const portRows = document.querySelectorAll('#ports-table-body tr');
    expect(portRows.length).toBe(7);
  });

  it('shows PostgreSQL connection info (host, port, database) from the env config', async () => {
    await mountView();

    expect(text('postgres-host-info')).toBe('Host: localhost');
    expect(text('postgres-port-info')).toBe('Port: 5432');
    expect(text('postgres-database-info')).toBe('Database: fictionlab');
  });

  it('renders real resource usage for running services and "Not running" for stopped ones', async () => {
    await mountView();

    // Running services show live docker stats values
    expect(text('postgres-resource-usage')).toContain('3.14%');
    expect(text('postgres-resource-usage')).toContain('150MiB / 8GiB');
    expect(text('mcp-connector-resource-usage')).toContain('3.14%');

    // Stopped service shows no fabricated numbers
    expect(text('mcp-writing-servers-resource-usage')).toContain('Not running');

    // Stats were only fetched for the running services
    const requested = api.mcpSystem.getResourceUsage.mock.calls.map(c => c[0]);
    expect(requested).toContain('postgres');
    expect(requested).toContain('mcp-connector');
    expect(requested).not.toContain('mcp-writing-servers');
  });

  it('shows individual status and port per MCP server, with a Degraded aggregate badge', async () => {
    await mountView();

    expect(text('mcp-connector-status-badge')).toBe('Healthy');
    expect(text('mcp-connector-port-info')).toBe('Port: 50880');

    expect(text('mcp-writing-servers-status-badge')).toBe('Offline');
    expect(text('mcp-writing-servers-port-info')).toBe('Port: 3001');

    expect(text('mcp-servers-status-badge')).toBe('Degraded');
  });

  it('enables/disables each service\'s controls according to its own running state', async () => {
    await mountView();

    // Connector is up: cannot start again, can stop/restart
    expect(button('mcp-connector-start').disabled).toBe(true);
    expect(button('mcp-connector-stop').disabled).toBe(false);
    expect(button('mcp-connector-restart').disabled).toBe(false);

    // Writing servers are stopped: can start, cannot stop/restart
    expect(button('mcp-writing-servers-start').disabled).toBe(false);
    expect(button('mcp-writing-servers-stop').disabled).toBe(true);
    expect(button('mcp-writing-servers-restart').disabled).toBe(true);

    // Postgres is up
    expect(button('postgres-start').disabled).toBe(true);
    expect(button('postgres-stop').disabled).toBe(false);
  });

  it('wires per-service buttons to mcpSystem.controlService with the right service id', async () => {
    await mountView();

    button('postgres-restart').click();
    await flushPromises();
    expect(api.mcpSystem.controlService).toHaveBeenCalledWith('postgres', 'restart');

    button('mcp-writing-servers-start').click();
    await flushPromises();
    expect(api.mcpSystem.controlService).toHaveBeenCalledWith('mcp-writing-servers', 'start');

    button('mcp-connector-stop').click();
    await flushPromises();
    expect(api.mcpSystem.controlService).toHaveBeenCalledWith('mcp-connector', 'stop');

    // Typing Mind's lifecycle buttons act on its local MCP Connector dependency
    button('typing-mind-restart').click();
    await flushPromises();
    expect(api.mcpSystem.controlService).toHaveBeenCalledWith('mcp-connector', 'restart');
  });

  it('opens a per-server logs dialog with credentials redacted', async () => {
    await mountView();

    button('mcp-connector-view-logs').click();
    await flushPromises();

    expect(api.mcpSystem.getLogs).toHaveBeenCalledWith('mcp-connector', 100);

    const dialog = document.querySelector('.logs-dialog');
    expect(dialog).not.toBeNull();

    const body = dialog!.querySelector('.logs-dialog-body pre');
    expect(body!.textContent).toContain('postgresql://admin:********@');
    expect(body!.textContent).not.toContain('supersecret');

    (dialog!.querySelector('.logs-dialog-close-btn') as HTMLButtonElement).click();
    expect(document.querySelector('.logs-dialog')).toBeNull();
  });

  it('shows the real Docker version instead of a hardcoded label', async () => {
    await mountView();

    expect(api.prerequisites.getDockerVersion).toHaveBeenCalled();
    expect(text('docker-version-info')).toBe('Version: Docker 27.4.0');
  });

  it('reflects the MCP Connector state on the Typing Mind card and opens the browser', async () => {
    await mountView();

    expect(text('typing-mind-status-badge')).toBe('Ready');
    expect(text('typing-mind-port-info')).toBe('Connector Port: 50880');

    button('typing-mind-open-browser').click();
    await flushPromises();
    expect(api.typingMind.openWindow).toHaveBeenCalledWith('https://www.typingmind.com');
  });

  it('handles the top bar Start All / Stop All / Restart All window events', async () => {
    await mountView();

    window.dispatchEvent(new CustomEvent('services-start-all'));
    await flushPromises();
    expect(api.mcpSystem.start).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new CustomEvent('services-stop-all'));
    await flushPromises();
    expect(api.mcpSystem.stop).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new CustomEvent('services-restart-all'));
    await flushPromises();
    expect(api.mcpSystem.restart).toHaveBeenCalledTimes(1);
  });

  it('auto-refreshes every 5s and stops refreshing + listening after unmount', async () => {
    jest.useFakeTimers();
    try {
      await view.mount(container);
      mounted = true;

      const callsAfterMount = api.mcpSystem.getDetailedStatus.mock.calls.length;

      // Interval fires -> another refresh
      await jest.advanceTimersByTimeAsync(5000);
      expect(api.mcpSystem.getDetailedStatus.mock.calls.length).toBeGreaterThan(callsAfterMount);

      await view.unmount();
      mounted = false;

      const callsAfterUnmount = api.mcpSystem.getDetailedStatus.mock.calls.length;

      // No further refreshes after cleanup
      await jest.advanceTimersByTimeAsync(15000);
      expect(api.mcpSystem.getDetailedStatus.mock.calls.length).toBe(callsAfterUnmount);

      // Window listeners removed: top-bar events no longer reach the tab
      window.dispatchEvent(new CustomEvent('services-start-all'));
      await jest.advanceTimersByTimeAsync(0);
      expect(api.mcpSystem.start).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
