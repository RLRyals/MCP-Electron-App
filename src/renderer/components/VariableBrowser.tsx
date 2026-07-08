/**
 * VariableBrowser Component
 * Tree view for browsing available variables from previous workflow nodes
 *
 * Features:
 * - Collapsible tree structure showing node outputs
 * - JSONPath display for each variable
 * - Data type indicators with icons
 * - Click to insert JSONPath into expressions
 * - Search/filter functionality
 * - Full keyboard navigation and accessibility
 * - Handles nested objects, arrays, and circular references
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { NodeOutput, WorkflowNode } from '../../types/workflow-nodes.js';

/**
 * Component props
 */
export interface VariableBrowserProps {
  currentNodeId: string;
  nodeOutputs: Map<string, NodeOutput>;
  globalVariables: Record<string, any>;
  onInsert: (path: string) => void;
}

/**
 * Tree item representing a variable in the tree
 */
interface TreeItem {
  id: string;
  label: string;
  path: string;
  value: any;
  type: string;
  icon: string;
  depth: number;
  hasChildren: boolean;
  children?: TreeItem[];
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
}

/**
 * Get icon for data type
 */
function getTypeIcon(type: string): string {
  switch (type) {
    case 'string':
      return '📄';
    case 'number':
      return '🔢';
    case 'boolean':
      return '✓';
    case 'array':
      return '[]';
    case 'object':
      return '{}';
    case 'null':
      return '∅';
    case 'undefined':
      return '?';
    default:
      return '•';
  }
}

/**
 * Get display type for value
 */
function getValueType(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Get node type icon
 */
function getNodeTypeIcon(nodeType: string): string {
  switch (nodeType) {
    case 'planning':
      return '📋';
    case 'writing':
      return '✍️';
    case 'gate':
      return '🚪';
    case 'user-input':
      return '👤';
    case 'code':
      return '💻';
    case 'http':
      return '🌐';
    case 'file':
      return '📁';
    case 'conditional':
      return '🔀';
    case 'loop':
      return '🔁';
    case 'subworkflow':
      return '📊';
    default:
      return '⚙️';
  }
}

/**
 * Format value for display (truncate long values)
 */
function formatValue(value: any, type: string): string {
  if (type === 'null') return 'null';
  if (type === 'undefined') return 'undefined';
  if (type === 'array') {
    return `Array(${value.length})`;
  }
  if (type === 'object') {
    const keys = Object.keys(value);
    return `Object(${keys.length} ${keys.length === 1 ? 'key' : 'keys'})`;
  }
  if (type === 'string') {
    const str = String(value);
    return str.length > 50 ? `"${str.substring(0, 50)}..."` : `"${str}"`;
  }
  if (type === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

/**
 * Build tree items from an object/value recursively
 */
function buildTreeItems(
  value: any,
  basePath: string,
  depth: number,
  maxDepth: number = 5,
  visited: WeakSet<object> = new WeakSet(),
  parentKey?: string
): TreeItem[] {
  const items: TreeItem[] = [];

  // Prevent infinite recursion from circular references
  if (depth > maxDepth) {
    return [{
      id: `${basePath}._deep`,
      label: '...',
      path: basePath,
      value: null,
      type: 'string',
      icon: '•',
      depth,
      hasChildren: false,
    }];
  }

  const valueType = getValueType(value);

  // Handle arrays
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemPath = `${basePath}[${index}]`;
      const itemType = getValueType(item);
      const hasChildren = (itemType === 'object' || itemType === 'array') && item !== null;

      const treeItem: TreeItem = {
        id: itemPath,
        label: `[${index}]`,
        path: itemPath,
        value: item,
        type: itemType,
        icon: getTypeIcon(itemType),
        depth,
        hasChildren,
      };

      if (hasChildren && typeof item === 'object' && item !== null) {
        // Check for circular reference
        if (visited.has(item)) {
          treeItem.children = [{
            id: `${itemPath}._circular`,
            label: '[Circular Reference]',
            path: itemPath,
            value: null,
            type: 'string',
            icon: '🔄',
            depth: depth + 1,
            hasChildren: false,
          }];
        } else {
          visited.add(item);
          treeItem.children = buildTreeItems(item, itemPath, depth + 1, maxDepth, visited);
        }
      }

      items.push(treeItem);
    });
  }
  // Handle objects
  else if (valueType === 'object' && value !== null) {
    Object.entries(value).forEach(([key, val]) => {
      const itemPath = basePath ? `${basePath}.${key}` : key;
      const itemType = getValueType(val);
      const hasChildren = (itemType === 'object' || itemType === 'array') && val !== null;

      const treeItem: TreeItem = {
        id: itemPath,
        label: key,
        path: itemPath,
        value: val,
        type: itemType,
        icon: getTypeIcon(itemType),
        depth,
        hasChildren,
      };

      if (hasChildren && typeof val === 'object' && val !== null) {
        // Check for circular reference
        if (visited.has(val)) {
          treeItem.children = [{
            id: `${itemPath}._circular`,
            label: '[Circular Reference]',
            path: itemPath,
            value: null,
            type: 'string',
            icon: '🔄',
            depth: depth + 1,
            hasChildren: false,
          }];
        } else {
          visited.add(val);
          treeItem.children = buildTreeItems(val, itemPath, depth + 1, maxDepth, visited);
        }
      }

      items.push(treeItem);
    });
  }

  return items;
}

/**
 * Main VariableBrowser component
 */
export const VariableBrowser: React.FC<VariableBrowserProps> = ({
  currentNodeId,
  nodeOutputs,
  globalVariables,
  onInsert,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [clickFeedback, setClickFeedback] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  /**
   * Build node sections from nodeOutputs
   */
  const nodeSections = useMemo(() => {
    const sections: Array<{
      nodeId: string;
      nodeName: string;
      nodeType: string;
      icon: string;
      items: TreeItem[];
    }> = [];

    nodeOutputs.forEach((output, nodeId) => {
      // Skip current node and future nodes
      if (nodeId === currentNodeId) return;

      const basePath = `$.${nodeId}`;
      const items = buildTreeItems(output.output, `${basePath}.output`, 1);

      sections.push({
        nodeId,
        nodeName: output.nodeName,
        nodeType: output.status, // TODO: Get actual node type from workflow definition
        icon: getNodeTypeIcon('planning'), // TODO: Get from actual node type
        items,
      });
    });

    return sections;
  }, [nodeOutputs, currentNodeId]);

  /**
   * Build global variables section
   */
  const globalSection = useMemo(() => {
    const basePath = '$.variables';
    const items = buildTreeItems(globalVariables || {}, basePath, 1);

    return {
      nodeId: '_global',
      nodeName: 'Global Variables',
      nodeType: 'global',
      icon: '🌐',
      items,
    };
  }, [globalVariables]);

  /**
   * Flatten all items for keyboard navigation
   */
  const flattenedItems = useMemo(() => {
    const items: Array<{ id: string; path: string; type: 'section' | 'item' }> = [];

    // Add node sections
    nodeSections.forEach(section => {
      items.push({ id: section.nodeId, path: '', type: 'section' });

      if (expandedNodes.has(section.nodeId)) {
        const addItems = (treeItems: TreeItem[]) => {
          treeItems.forEach(item => {
            items.push({ id: item.id, path: item.path, type: 'item' });
            if (item.hasChildren && item.children && expandedNodes.has(item.id)) {
              addItems(item.children);
            }
          });
        };
        addItems(section.items);
      }
    });

    // Add global section
    items.push({ id: globalSection.nodeId, path: '', type: 'section' });
    if (expandedNodes.has(globalSection.nodeId)) {
      const addItems = (treeItems: TreeItem[]) => {
        treeItems.forEach(item => {
          items.push({ id: item.id, path: item.path, type: 'item' });
          if (item.hasChildren && item.children && expandedNodes.has(item.id)) {
            addItems(item.children);
          }
        });
      };
      addItems(globalSection.items);
    }

    return items;
  }, [nodeSections, globalSection, expandedNodes]);

  /**
   * Filter items based on search query
   */
  const matchesSearch = useCallback((item: TreeItem): boolean => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      item.label.toLowerCase().includes(query) ||
      item.path.toLowerCase().includes(query) ||
      formatValue(item.value, item.type).toLowerCase().includes(query)
    );
  }, [searchQuery]);

  /**
   * Toggle node expansion
   */
  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  /**
   * Handle item click - insert JSONPath
   */
  const handleInsert = useCallback((path: string) => {
    onInsert(path);

    // Visual feedback
    setClickFeedback(path);
    setTimeout(() => setClickFeedback(null), 300);

    // Announce to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = `Inserted variable: ${path}`;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, [onInsert]);

  /**
   * Keyboard navigation
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent, itemId: string, itemType: 'section' | 'item', path?: string) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (itemType === 'section' || !path) {
          toggleExpanded(itemId);
        } else {
          handleInsert(path);
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (!expandedNodes.has(itemId)) {
          toggleExpanded(itemId);
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (expandedNodes.has(itemId)) {
          toggleExpanded(itemId);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        {
          const currentIndex = flattenedItems.findIndex(item => item.id === itemId);
          if (currentIndex < flattenedItems.length - 1) {
            setFocusedItemId(flattenedItems[currentIndex + 1].id);
          }
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        {
          const currentIndex = flattenedItems.findIndex(item => item.id === itemId);
          if (currentIndex > 0) {
            setFocusedItemId(flattenedItems[currentIndex - 1].id);
          }
        }
        break;
    }
  }, [expandedNodes, toggleExpanded, handleInsert, flattenedItems]);

  /**
   * Focus management - scroll to focused item
   */
  useEffect(() => {
    if (focusedItemId) {
      const element = document.getElementById(`tree-item-${focusedItemId}`);
      if (element) {
        element.focus();
        element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedItemId]);

  /**
   * Render tree item
   */
  const renderTreeItem = (item: TreeItem, sectionId: string) => {
    const isExpanded = expandedNodes.has(item.id);
    const isFocused = focusedItemId === item.id;
    const hasClickFeedback = clickFeedback === item.path;
    const matches = matchesSearch(item);

    if (!matches && !searchQuery) return null;
    if (!matches && searchQuery) {
      // Check if any children match
      const hasMatchingChild = (treeItem: TreeItem): boolean => {
        if (matchesSearch(treeItem)) return true;
        if (treeItem.children) {
          return treeItem.children.some(hasMatchingChild);
        }
        return false;
      };

      if (!hasMatchingChild(item)) return null;
    }

    const indentStyle = { paddingLeft: `${item.depth * 16}px` };
    const displayValue = formatValue(item.value, item.type);

    return (
      <div key={item.id}>
        <div
          id={`tree-item-${item.id}`}
          role="treeitem"
          aria-expanded={item.hasChildren ? isExpanded : undefined}
          aria-label={`${item.label}, ${item.type}, ${displayValue}`}
          tabIndex={isFocused ? 0 : -1}
          className={`tree-item ${hasClickFeedback ? 'tree-item-feedback' : ''} ${isFocused ? 'tree-item-focused' : ''}`}
          style={indentStyle}
          onClick={() => {
            if (item.hasChildren) {
              toggleExpanded(item.id);
            }
            handleInsert(item.path);
          }}
          onKeyDown={(e) => handleKeyDown(e, item.id, 'item', item.path)}
        >
          {item.hasChildren && (
            <span className="tree-expand-icon" aria-hidden="true">
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          <span className="tree-item-icon" aria-hidden="true">{item.icon}</span>
          <span className="tree-item-label">{item.label}</span>
          {item.type !== 'object' && item.type !== 'array' && (
            <span className="tree-item-value">: {displayValue}</span>
          )}
          {(item.type === 'object' || item.type === 'array') && (
            <span className="tree-item-type">: {displayValue}</span>
          )}
        </div>

        {item.hasChildren && isExpanded && item.children && (
          <div role="group">
            {item.children.map(child => renderTreeItem(child, sectionId))}
          </div>
        )}
      </div>
    );
  };

  /**
   * Render section (node or global)
   */
  const renderSection = (section: typeof nodeSections[0] | typeof globalSection) => {
    const isExpanded = expandedNodes.has(section.nodeId);
    const isFocused = focusedItemId === section.nodeId;

    return (
      <div key={section.nodeId} className="tree-section">
        <div
          id={`tree-item-${section.nodeId}`}
          role="treeitem"
          aria-expanded={isExpanded}
          aria-label={`${section.nodeName} section`}
          tabIndex={isFocused ? 0 : -1}
          className={`tree-section-header ${isFocused ? 'tree-item-focused' : ''}`}
          onClick={() => toggleExpanded(section.nodeId)}
          onKeyDown={(e) => handleKeyDown(e, section.nodeId, 'section')}
        >
          <span className="tree-expand-icon" aria-hidden="true">
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="tree-section-icon" aria-hidden="true">{section.icon}</span>
          <span className="tree-section-name">{section.nodeName}</span>
          {section.nodeType !== 'global' && (
            <span className="tree-section-type">({section.nodeType})</span>
          )}
        </div>

        {isExpanded && (
          <div role="group">
            {section.items.map(item => renderTreeItem(item, section.nodeId))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="variable-browser">
      {/* Search input */}
      <div className="variable-browser-search">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="🔍 Search variables..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="variable-browser-search-input"
          aria-label="Search variables"
        />
        {searchQuery && (
          <button
            className="variable-browser-search-clear"
            onClick={() => {
              setSearchQuery('');
              searchInputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tree view */}
      <div
        ref={treeContainerRef}
        role="tree"
        aria-label="Available variables"
        className="variable-browser-tree"
      >
        {nodeSections.length === 0 && Object.keys(globalVariables).length === 0 ? (
          <div className="variable-browser-empty">
            <p>No variables available yet.</p>
            <p>Execute previous workflow nodes to see their outputs here.</p>
          </div>
        ) : (
          <>
            {nodeSections.map(section => renderSection(section))}
            {Object.keys(globalVariables).length > 0 && renderSection(globalSection)}
          </>
        )}
      </div>

      {/* Screen reader only announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {searchQuery && `Searching for: ${searchQuery}`}
      </div>

      {/* Inline styles for the component */}
      <style>{`
        .variable-browser {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e1e1e;
          color: #d4d4d4;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 13px;
        }

        .variable-browser-search {
          position: relative;
          padding: 8px;
          border-bottom: 1px solid #3e3e3e;
        }

        .variable-browser-search-input {
          width: 100%;
          padding: 6px 28px 6px 8px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #d4d4d4;
          font-size: 13px;
          outline: none;
        }

        .variable-browser-search-input:focus {
          border-color: #007acc;
          box-shadow: 0 0 0 1px #007acc;
        }

        .variable-browser-search-clear {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #858585;
          cursor: pointer;
          padding: 4px;
          font-size: 14px;
          line-height: 1;
        }

        .variable-browser-search-clear:hover {
          color: #d4d4d4;
        }

        .variable-browser-tree {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 4px 0;
        }

        .variable-browser-tree::-webkit-scrollbar {
          width: 10px;
        }

        .variable-browser-tree::-webkit-scrollbar-track {
          background: #1e1e1e;
        }

        .variable-browser-tree::-webkit-scrollbar-thumb {
          background: #424242;
          border-radius: 5px;
        }

        .variable-browser-tree::-webkit-scrollbar-thumb:hover {
          background: #4e4e4e;
        }

        .variable-browser-empty {
          padding: 32px 16px;
          text-align: center;
          color: #858585;
        }

        .variable-browser-empty p {
          margin: 8px 0;
        }

        .tree-section {
          margin: 4px 0;
        }

        .tree-section-header {
          display: flex;
          align-items: center;
          padding: 6px 8px;
          cursor: pointer;
          user-select: none;
          border-radius: 4px;
        }

        .tree-section-header:hover {
          background: #2a2a2a;
        }

        .tree-section-header:focus {
          outline: 2px solid #007acc;
          outline-offset: -2px;
        }

        .tree-section-icon {
          margin: 0 6px;
          font-size: 16px;
        }

        .tree-section-name {
          font-weight: 600;
          color: #4fc3f7;
        }

        .tree-section-type {
          margin-left: 8px;
          color: #858585;
          font-size: 11px;
        }

        .tree-item {
          display: flex;
          align-items: center;
          padding: 4px 8px;
          cursor: pointer;
          user-select: none;
          border-radius: 4px;
          white-space: nowrap;
        }

        .tree-item:hover {
          background: #2a2a2a;
        }

        .tree-item:focus {
          outline: 2px solid #007acc;
          outline-offset: -2px;
        }

        .tree-item-focused {
          background: #094771;
        }

        .tree-item-feedback {
          animation: clickFeedback 0.3s ease;
        }

        @keyframes clickFeedback {
          0%, 100% { background: #2a2a2a; }
          50% { background: #0e639c; }
        }

        .tree-expand-icon {
          width: 16px;
          display: inline-block;
          text-align: center;
          color: #858585;
          font-size: 10px;
        }

        .tree-item-icon {
          margin: 0 6px;
          font-size: 14px;
        }

        .tree-item-label {
          color: #9cdcfe;
          font-weight: 500;
        }

        .tree-item-value,
        .tree-item-type {
          margin-left: 4px;
          color: #ce9178;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
      `}</style>
    </div>
  );
};
