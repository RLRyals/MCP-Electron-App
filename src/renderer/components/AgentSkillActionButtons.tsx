import React, { useState, useRef, useEffect } from 'react';

interface AgentSkillActionButtonsProps {
  type: 'agent' | 'skill';
  selectedName: string;
  installedOptions: string[];
  onEdit: () => void;
  onCreate: () => void;
  onImportFile: () => void;
  onImportFolder: () => void;
}

export const AgentSkillActionButtons: React.FC<AgentSkillActionButtonsProps> = ({
  type,
  selectedName,
  installedOptions,
  onEdit,
  onCreate,
  onImportFile,
  onImportFolder
}) => {
  const [showImportMenu, setShowImportMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const label = type === 'agent' ? 'Agent' : 'Skill';
  const exists = selectedName && installedOptions.includes(selectedName);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowImportMenu(false);
      }
    };

    if (showImportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }

    return undefined;
  }, [showImportMenu]);

  const styles = {
    container: {
      display: 'flex',
      gap: '8px',
      justifyContent: 'flex-end',
      marginTop: '8px'
    } as React.CSSProperties,
    button: {
      padding: '6px 12px',
      fontSize: '13px',
      fontWeight: 500,
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      background: 'white',
      color: '#374151',
      cursor: 'pointer',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    } as React.CSSProperties,
    buttonHover: {
      background: '#f9fafb',
      borderColor: '#9ca3af'
    } as React.CSSProperties,
    buttonDisabled: {
      padding: '6px 12px',
      fontSize: '13px',
      fontWeight: 500,
      border: '1px solid #e5e7eb',
      borderRadius: '6px',
      background: '#f3f4f6',
      color: '#9ca3af',
      cursor: 'not-allowed',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    } as React.CSSProperties,
    importButtonContainer: {
      position: 'relative'
    } as React.CSSProperties,
    importMenu: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: '4px',
      background: 'white',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      zIndex: 50,
      minWidth: '180px'
    } as React.CSSProperties,
    menuItem: {
      padding: '8px 12px',
      fontSize: '13px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      borderBottom: '1px solid #f3f4f6',
      transition: 'background 0.2s'
    } as React.CSSProperties,
    menuItemLast: {
      borderBottom: 'none'
    } as React.CSSProperties,
    menuItemHover: {
      background: '#f9fafb'
    } as React.CSSProperties
  };

  const [editHover, setEditHover] = useState(false);
  const [createHover, setCreateHover] = useState(false);
  const [importHover, setImportHover] = useState(false);
  const [fileMenuHover, setFileMenuHover] = useState(false);
  const [folderMenuHover, setFolderMenuHover] = useState(false);

  return (
    <div style={styles.container}>
      {/* Edit Button */}
      <button
        type="button"
        style={exists && editHover ? { ...styles.button, ...styles.buttonHover } : (exists ? styles.button : styles.buttonDisabled)}
        onClick={onEdit}
        disabled={!exists}
        title={exists ? `Edit ${label}` : `${label} not found on disk`}
        onMouseEnter={() => setEditHover(true)}
        onMouseLeave={() => setEditHover(false)}
        aria-label={`Edit ${label}`}
      >
        ✏️ Edit
      </button>

      {/* Create Button */}
      <button
        type="button"
        style={createHover ? { ...styles.button, ...styles.buttonHover } : styles.button}
        onClick={onCreate}
        title={`Create New ${label}`}
        onMouseEnter={() => setCreateHover(true)}
        onMouseLeave={() => setCreateHover(false)}
        aria-label={`Create new ${label}`}
      >
        ➕ Create
      </button>

      {/* Import Button with Menu */}
      <div style={styles.importButtonContainer} ref={menuRef}>
        <button
          type="button"
          style={importHover ? { ...styles.button, ...styles.buttonHover } : styles.button}
          onClick={() => setShowImportMenu(!showImportMenu)}
          title={`Import ${label}(s)`}
          onMouseEnter={() => setImportHover(true)}
          onMouseLeave={() => setImportHover(false)}
          aria-label={`Import ${label}`}
          aria-expanded={showImportMenu}
          aria-haspopup="menu"
        >
          📥 Import ▼
        </button>

        {showImportMenu && (
          <div style={styles.importMenu} role="menu">
            <div
              style={{
                ...styles.menuItem,
                ...(fileMenuHover ? styles.menuItemHover : {})
              }}
              onClick={() => {
                onImportFile();
                setShowImportMenu(false);
              }}
              onMouseEnter={() => setFileMenuHover(true)}
              onMouseLeave={() => setFileMenuHover(false)}
              role="menuitem"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onImportFile();
                  setShowImportMenu(false);
                }
              }}
            >
              📄 Import File...
            </div>
            <div
              style={{
                ...styles.menuItem,
                ...styles.menuItemLast,
                ...(folderMenuHover ? styles.menuItemHover : {})
              }}
              onClick={() => {
                onImportFolder();
                setShowImportMenu(false);
              }}
              onMouseEnter={() => setFolderMenuHover(true)}
              onMouseLeave={() => setFolderMenuHover(false)}
              role="menuitem"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onImportFolder();
                  setShowImportMenu(false);
                }
              }}
            >
              📁 Import Folder...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
