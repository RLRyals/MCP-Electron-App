/**
 * SetupActionsMenu
 * The strip's "⚙ Setup actions" overflow menu (design supplement item 2).
 * Configure Claude Desktop / Configure Typing Mind / Open Typing Mind /
 * Manage Clients are setup-time actions, not daily-cockpit ones -- they
 * move here instead of living as first-class buttons. Reuses the
 * underlying dashboard-handlers.ts logic (dialogs + IPC calls); only the
 * DOM-button wiring around them was replaced.
 *
 * Typing Mind: #216 removed its card from Settings > Services, but the
 * underlying client (electronAPI.typingMind.*, client-selection's
 * 'typingmind' option) is still real -- verified by grep across
 * src/main + src/renderer, 2026-07-10. Its two actions stay here, gated
 * the same way dashboard-handlers.ts's old updateDashboardButtons() gated
 * them: only shown when 'typingmind' is a selected client.
 */

import * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  handleOpenTypingMind,
  handleConfigureTypingMind,
  handleConfigureClaudeDesktop,
} from '../../dashboard-handlers.js';

export const SetupActionsMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadSelection = useCallback(async () => {
    try {
      const electronAPI = (window as any).electronAPI;
      const selection = await electronAPI?.clientSelection?.getSelection?.();
      setSelectedClients(selection?.clients || []);
    } catch (error) {
      console.error('[SetupActionsMenu] Failed to load client selection:', error);
    }
  }, []);

  useEffect(() => {
    loadSelection();
    window.addEventListener('clients-updated', loadSelection);
    return () => window.removeEventListener('clients-updated', loadSelection);
  }, [loadSelection]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const timeoutId = setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  const showTypingMind = selectedClients.includes('typingmind');
  const showClaudeDesktop = selectedClients.includes('claude-desktop');

  const buttonStyle: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'var(--color-bg-tertiary)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
  };

  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    padding: '4px',
    minWidth: '200px',
    zIndex: 1000,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  };

  const itemStyle: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
  };

  const handleManageClients = () => {
    setIsOpen(false);
    const clientManagementUI = (window as any).ClientManagementUI;
    if (clientManagementUI?.showClientManager) {
      clientManagementUI.showClientManager();
    } else {
      console.error('[SetupActionsMenu] ClientManagementUI not available on window');
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        type="button"
        style={buttonStyle}
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        ⚙ Setup actions
      </button>
      {isOpen && (
        <div style={menuStyle} role="menu">
          {showClaudeDesktop && (
            <div
              style={itemStyle}
              role="menuitem"
              onClick={() => { setIsOpen(false); handleConfigureClaudeDesktop(); }}
            >
              Configure Claude Desktop
            </div>
          )}
          {showTypingMind && (
            <div
              style={itemStyle}
              role="menuitem"
              onClick={() => { setIsOpen(false); handleOpenTypingMind(); }}
            >
              Open Typing Mind
            </div>
          )}
          {showTypingMind && (
            <div
              style={itemStyle}
              role="menuitem"
              onClick={() => { setIsOpen(false); handleConfigureTypingMind(); }}
            >
              Configure Typing Mind
            </div>
          )}
          <div style={itemStyle} role="menuitem" onClick={handleManageClients}>
            Manage Clients
          </div>
        </div>
      )}
    </div>
  );
};

export default SetupActionsMenu;
