/**
 * DashboardWidgetSlot mount/unmount test (bead mea-cjl.1).
 */

import * as React from 'react';
import { render, waitFor } from '@testing-library/react';
import { DashboardWidgetSlot } from '../DashboardWidgetSlot';
import type { DashboardWidget, DashboardWidgetClass } from '../../../services/dashboardWidgetLoader';

class FakeWidget implements DashboardWidget {
  static mountCalls: HTMLElement[] = [];
  static unmountCallCount = 0;

  async mount(container: HTMLElement): Promise<void> {
    FakeWidget.mountCalls.push(container);
    container.textContent = 'fake widget content';
  }

  async unmount(): Promise<void> {
    FakeWidget.unmountCallCount += 1;
  }
}

beforeEach(() => {
  FakeWidget.mountCalls = [];
  FakeWidget.unmountCallCount = 0;
});

describe('DashboardWidgetSlot', () => {
  it('instantiates the widget class and mounts it into the slot container', async () => {
    const { container } = render(
      <DashboardWidgetSlot WidgetClass={FakeWidget as DashboardWidgetClass} pluginId="fictionlab-workflow" />
    );

    await waitFor(() => expect(FakeWidget.mountCalls).toHaveLength(1));
    expect(container.querySelector('.dashboard-widget-slot')).toHaveTextContent('fake widget content');
    expect(container.querySelector('[data-plugin-id="fictionlab-workflow"]')).not.toBeNull();
  });

  it('calls unmount() on the widget when the slot unmounts', async () => {
    const { unmount } = render(
      <DashboardWidgetSlot WidgetClass={FakeWidget as DashboardWidgetClass} pluginId="fictionlab-workflow" />
    );
    await waitFor(() => expect(FakeWidget.mountCalls).toHaveLength(1));

    unmount();

    await waitFor(() => expect(FakeWidget.unmountCallCount).toBe(1));
  });

  it('logs rather than throws when mount() rejects', async () => {
    class ThrowingWidget implements DashboardWidget {
      async mount(): Promise<void> {
        throw new Error('boom');
      }
    }
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<DashboardWidgetSlot WidgetClass={ThrowingWidget as DashboardWidgetClass} pluginId="broken-plugin" />);

    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    errorSpy.mockRestore();
  });
});
