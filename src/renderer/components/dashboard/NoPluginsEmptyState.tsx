/**
 * NoPluginsEmptyState
 * The Dashboard's pluginless empty state (bead mea-cjl.1 / epic mea-cjl):
 * with zero plugins installed the core app is just service management, so
 * the cockpit's Running/Next/Blocked columns (which only ever show
 * plugin-gated placeholders anyway -- see PluginPlaceholder.tsx) are
 * replaced entirely by this affordance instead of three empty dashed boxes.
 */

import * as React from 'react';

export const NoPluginsEmptyState: React.FC = () => {
  const handleInstallClick = () => {
    (window as any).__viewRouter__?.navigateTo?.('plugins');
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '48px 24px',
    gap: '8px',
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '32px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--color-text-primary)',
  };

  const bodyStyle: React.CSSProperties = {
    fontSize: '13px',
    color: 'var(--color-text-tertiary)',
    maxWidth: '360px',
    margin: 0,
  };

  const buttonStyle: React.CSSProperties = {
    marginTop: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'var(--color-bg-tertiary)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
  };

  return (
    <div style={containerStyle} className="dashboard-no-plugins-empty-state">
      <div style={iconStyle}>🧩</div>
      <div style={titleStyle}>No plugins installed</div>
      <p style={bodyStyle}>
        This is the FictionLab core: service management for the MCP writing servers. Install a
        plugin to add workflows, boards, and agents to this dashboard.
      </p>
      <button type="button" style={buttonStyle} onClick={handleInstallClick}>
        Install plugins
      </button>
    </div>
  );
};

export default NoPluginsEmptyState;
