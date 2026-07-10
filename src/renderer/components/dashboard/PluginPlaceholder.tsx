/**
 * PluginPlaceholder
 * The cockpit's degraded-state idiom for a panel (or panel section) whose
 * data depends on a plugin that isn't installed/active. Mirrors
 * ViewRouter.showPluginRequiredView()'s "Plugin Required" copy/tone but as
 * an inline one-liner sized for a panel rather than a full-page takeover
 * (see issue #214's "Graceful degradation" section).
 */

import * as React from 'react';

export interface PluginPlaceholderProps {
  label: string;
}

export const PluginPlaceholder: React.FC<PluginPlaceholderProps> = ({ label }) => {
  const style: React.CSSProperties = {
    padding: '16px 12px',
    fontSize: '12px',
    color: 'var(--color-text-tertiary)',
    textAlign: 'center',
    border: '1px dashed var(--color-border)',
    borderRadius: '8px',
  };

  return <div style={style}>{label}</div>;
};

export default PluginPlaceholder;
