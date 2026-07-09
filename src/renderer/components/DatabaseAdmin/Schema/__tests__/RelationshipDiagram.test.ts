/**
 * Tests for RelationshipDiagram (Issue #129: Database Schema Explorer UI).
 *
 * Covers the ERD acceptance criteria: table nodes render, relationships
 * (derived from foreign keys) render as connecting lines, and zoom/pan
 * controls are interactive. Also covers the display fix for long
 * schema-qualified table names (e.g. "fictionlab.workflow_definitions")
 * so they don't overflow the node header -- the full name must still be
 * recoverable (via the SVG <title> tooltip), only the on-node label is
 * shortened.
 */

import { RelationshipDiagram } from '../RelationshipDiagram';

const TABLE_SCHEMAS = new Map<string, any>([
  [
    'fictionlab.workflow_definitions',
    {
      columns: [
        { name: 'workflow_id', type: 'uuid', isPrimaryKey: true },
        {
          name: 'created_by',
          type: 'uuid',
          isForeignKey: true,
          foreignKeyRef: { table: 'authors', column: 'id' },
        },
      ],
    },
  ],
  [
    'authors',
    {
      columns: [{ name: 'id', type: 'uuid', isPrimaryKey: true }],
    },
  ],
]);

describe('RelationshipDiagram', () => {
  let diagram: RelationshipDiagram;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="erd-root"></div>';
    diagram = new RelationshipDiagram();
    await diagram.initialize('erd-root');
  });

  afterEach(() => {
    diagram.destroy();
    document.body.innerHTML = '';
  });

  it('shows an empty state before a diagram is displayed', () => {
    expect(document.querySelector('.erd-empty')).not.toBeNull();
  });

  describe('after displaying a diagram', () => {
    beforeEach(async () => {
      await diagram.displayDiagram(TABLE_SCHEMAS, [], 'fictionlab.workflow_definitions');
    });

    it('renders a table node for every table', () => {
      expect(document.querySelectorAll('.table-node')).toHaveLength(2);
    });

    it('derives a relationship line from the foreign key and renders it', () => {
      const line = document.querySelector('.relationship-line');
      expect(line).not.toBeNull();
      expect(line!.getAttribute('data-from')).toBe('fictionlab.workflow_definitions');
      expect(line!.getAttribute('data-to')).toBe('authors');
    });

    it('truncates a long schema-qualified name on the node but keeps the full name recoverable via tooltip', () => {
      const nameEl = document.querySelector('g[data-table="fictionlab.workflow_definitions"] text.table-name')!;
      const titleEl = nameEl.querySelector('title')!;
      expect(titleEl.textContent).toBe('fictionlab.workflow_definitions');

      const visibleText = Array.from(nameEl.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
      expect(visibleText?.textContent).toBe('fictionlab.workflow...');
      expect(visibleText?.textContent!.length).toBeLessThan('fictionlab.workflow_definitions'.length);
    });

    it('does not truncate a short table name', () => {
      const nameEl = document.querySelector('g[data-table="authors"] text.table-name')!;
      const visibleText = Array.from(nameEl.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
      expect(visibleText?.textContent).toBe('authors');
    });

    it('supports zoom in/out via the control buttons', () => {
      const mainGroup = document.getElementById('erd-main-group')!;
      expect(mainGroup.getAttribute('transform')).toBe('translate(0, 0) scale(1)');

      (document.getElementById('erd-zoom-in') as HTMLElement).click();
      expect(mainGroup.getAttribute('transform')).toBe('translate(0, 0) scale(1.2)');

      (document.getElementById('erd-reset-view') as HTMLElement).click();
      expect(mainGroup.getAttribute('transform')).toBe('translate(0, 0) scale(1)');
    });

    it('highlights a table and its relationship lines on hover', () => {
      const node = document.querySelector('g[data-table="authors"]') as HTMLElement;
      node.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      expect(node.classList.contains('highlighted')).toBe(true);
      const line = document.querySelector('.relationship-line')!;
      expect(line.getAttribute('stroke')).toBe('#2196F3');
    });
  });
});
