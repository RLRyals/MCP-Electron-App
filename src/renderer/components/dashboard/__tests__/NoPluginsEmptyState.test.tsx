/**
 * NoPluginsEmptyState render + affordance test (bead mea-cjl.1).
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoPluginsEmptyState } from '../NoPluginsEmptyState';

afterEach(() => {
  delete (window as any).__viewRouter__;
});

describe('NoPluginsEmptyState', () => {
  it('renders the pluginless empty-state copy', () => {
    render(<NoPluginsEmptyState />);
    expect(screen.getByText('No plugins installed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Install plugins' })).toBeInTheDocument();
  });

  it('clicking "Install plugins" navigates to the plugins view', async () => {
    const navigateTo = jest.fn();
    (window as any).__viewRouter__ = { navigateTo };

    render(<NoPluginsEmptyState />);
    await userEvent.click(screen.getByRole('button', { name: 'Install plugins' }));

    expect(navigateTo).toHaveBeenCalledWith('plugins');
  });

  it('does not throw when __viewRouter__ is unavailable', async () => {
    render(<NoPluginsEmptyState />);
    await userEvent.click(screen.getByRole('button', { name: 'Install plugins' }));
    // No assertion beyond "didn't throw" -- the click handler optionally chains.
  });
});
