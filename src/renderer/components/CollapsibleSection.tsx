/**
 * CollapsibleSection Component
 * VS Code/Obsidian-style collapsible section with chevron, title, and count badge
 */

import * as React from 'react';

export interface CollapsibleSectionProps {
  title: string;
  count?: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  count,
  isExpanded,
  onToggle,
  children,
  className = '',
}) => {
  const sectionStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    userSelect: 'none',
    background: 'var(--color-bg-tertiary)',
    transition: 'background 0.15s ease',
  };

  const chevronStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--color-text-secondary, rgba(255, 255, 255, 0.7))',
    transition: 'transform 0.15s ease',
    transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
  };

  const titleStyle: React.CSSProperties = {
    flex: 1,
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-secondary, rgba(255, 255, 255, 0.7))',
  };

  const countStyle: React.CSSProperties = {
    background: 'var(--color-accent-dim, rgba(0, 212, 170, 0.1))',
    color: 'var(--color-accent)',
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '4px',
  };

  const contentStyle: React.CSSProperties = {
    maxHeight: isExpanded ? '1000px' : '0',
    overflow: 'hidden',
    transition: 'max-height 0.3s ease',
  };

  const innerContentStyle: React.CSSProperties = {
    padding: isExpanded ? '8px' : '0 8px',
    overflowY: 'auto',
  };

  return (
    <div style={sectionStyle} className={`collapsible-section ${isExpanded ? 'expanded' : 'collapsed'} ${className}`}>
      <div
        style={headerStyle}
        className="section-header"
        onClick={onToggle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--color-bg-tertiary)';
        }}
      >
        <span style={chevronStyle} className="chevron">
          {isExpanded ? '▼' : '▶'}
        </span>
        <span style={titleStyle} className="section-title">{title}</span>
        {count !== undefined && (
          <span style={countStyle} className="section-count">{count}</span>
        )}
      </div>
      <div style={contentStyle}>
        <div style={innerContentStyle} className="section-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
