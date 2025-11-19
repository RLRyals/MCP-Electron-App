/**
 * RelationshipDiagram Component
 * Interactive Entity-Relationship Diagram (ERD) visualization
 *
 * Features:
 * - SVG-based ERD rendering
 * - Shows tables with columns
 * - Visualizes relationships (foreign keys)
 * - Interactive zoom and pan controls
 * - Auto-layout algorithm
 */

export interface TableNode {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
  }>;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Relationship {
  from: {
    table: string;
    column: string;
  };
  to: {
    table: string;
    column: string;
  };
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export class RelationshipDiagram {
  private container: HTMLElement | null = null;
  private svgElement: SVGSVGElement | null = null;
  private tables: Map<string, TableNode> = new Map();
  private relationships: Relationship[] = [];
  private scale: number = 1;
  private translateX: number = 0;
  private translateY: number = 0;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private highlightedTable: string | null = null;

  // Layout constants
  private readonly TABLE_WIDTH = 200;
  private readonly ROW_HEIGHT = 25;
  private readonly HEADER_HEIGHT = 35;
  private readonly PADDING = 50;
  private readonly COLUMN_SPACING = 300;
  private readonly ROW_SPACING = 200;

  constructor() {}

  /**
   * Initialize the relationship diagram
   */
  public async initialize(containerId: string): Promise<void> {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    this.renderEmptyState();
    console.log('RelationshipDiagram initialized');
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="erd-empty">
        <div class="empty-icon">🔗</div>
        <h4>No Diagram</h4>
        <p>Select a table to view the entity-relationship diagram</p>
      </div>
    `;
  }

  /**
   * Display the ERD
   */
  public async displayDiagram(
    tableSchemas: Map<string, any>,
    relationships: any[],
    focusTable?: string
  ): Promise<void> {
    if (!this.container) return;

    // Parse relationships
    this.relationships = this.parseRelationships(relationships, tableSchemas);

    // Create table nodes
    this.tables = this.createTableNodes(tableSchemas);

    // Layout tables
    this.layoutTables(focusTable);

    // Render the diagram
    this.render();
  }

  /**
   * Parse relationships from database format
   */
  private parseRelationships(relationships: any[], tableSchemas: Map<string, any>): Relationship[] {
    const parsed: Relationship[] = [];

    // Parse from explicit relationships array
    if (Array.isArray(relationships)) {
      for (const rel of relationships) {
        parsed.push({
          from: {
            table: rel.from_table || rel.fromTable || rel.table || '',
            column: rel.from_column || rel.fromColumn || rel.column || '',
          },
          to: {
            table: rel.to_table || rel.toTable || rel.referenced_table || rel.referencedTable || '',
            column: rel.to_column || rel.toColumn || rel.referenced_column || rel.referencedColumn || '',
          },
          type: rel.type || 'one-to-many',
        });
      }
    }

    // Also extract from table schemas
    for (const [tableName, schema] of tableSchemas) {
      if (!schema?.columns) continue;

      for (const col of schema.columns) {
        if (col.isForeignKey || col.foreign_key) {
          const ref = col.foreignKeyRef || col.foreign_key_ref || {};
          if (ref.table && ref.column) {
            parsed.push({
              from: {
                table: tableName,
                column: col.name,
              },
              to: {
                table: ref.table,
                column: ref.column,
              },
              type: 'one-to-many',
            });
          }
        }
      }

      // Check constraints
      if (schema.constraints) {
        for (const constraint of schema.constraints) {
          if (constraint.type === 'FOREIGN KEY' || constraint.constraintType === 'FOREIGN KEY') {
            parsed.push({
              from: {
                table: tableName,
                column: constraint.column || constraint.columnName || '',
              },
              to: {
                table: constraint.referencedTable || constraint.referenced_table || '',
                column: constraint.referencedColumn || constraint.referenced_column || '',
              },
              type: 'one-to-many',
            });
          }
        }
      }
    }

    return parsed;
  }

  /**
   * Create table nodes from schemas
   */
  private createTableNodes(tableSchemas: Map<string, any>): Map<string, TableNode> {
    const nodes = new Map<string, TableNode>();

    for (const [tableName, schema] of tableSchemas) {
      const columns = (schema?.columns || []).map((col: any) => ({
        name: col.name || '',
        type: col.type || '',
        isPrimaryKey: col.isPrimaryKey || col.primary_key || false,
        isForeignKey: col.isForeignKey || col.foreign_key || false,
      }));

      const height = this.HEADER_HEIGHT + (columns.length * this.ROW_HEIGHT);

      nodes.set(tableName, {
        name: tableName,
        columns,
        x: 0,
        y: 0,
        width: this.TABLE_WIDTH,
        height,
      });
    }

    return nodes;
  }

  /**
   * Layout tables using a simple force-directed approach
   */
  private layoutTables(focusTable?: string): void {
    const tableNames = Array.from(this.tables.keys());

    if (tableNames.length === 0) return;

    // Simple grid layout
    const cols = Math.ceil(Math.sqrt(tableNames.length));
    let x = this.PADDING;
    let y = this.PADDING;
    let col = 0;

    // If we have a focus table, put it in the center
    if (focusTable && this.tables.has(focusTable)) {
      // Get related tables
      const relatedTables = this.getRelatedTables(focusTable);

      // Place focus table at center
      const focusNode = this.tables.get(focusTable)!;
      focusNode.x = this.PADDING;
      focusNode.y = this.PADDING;

      // Place related tables around it
      let angle = 0;
      const radius = 350;
      for (const relatedTable of relatedTables) {
        if (relatedTable === focusTable) continue;

        const node = this.tables.get(relatedTable);
        if (node) {
          node.x = this.PADDING + radius * Math.cos(angle);
          node.y = this.PADDING + radius * Math.sin(angle);
          angle += (2 * Math.PI) / relatedTables.length;
        }
      }

      // Place remaining tables in a grid below
      y = this.PADDING + 600;
      for (const tableName of tableNames) {
        if (relatedTables.includes(tableName)) continue;

        const node = this.tables.get(tableName);
        if (node) {
          node.x = x;
          node.y = y;

          col++;
          if (col >= cols) {
            col = 0;
            x = this.PADDING;
            y += this.ROW_SPACING;
          } else {
            x += this.COLUMN_SPACING;
          }
        }
      }
    } else {
      // Simple grid layout for all tables
      for (const tableName of tableNames) {
        const node = this.tables.get(tableName);
        if (node) {
          node.x = x;
          node.y = y;

          col++;
          if (col >= cols) {
            col = 0;
            x = this.PADDING;
            y += this.ROW_SPACING;
          } else {
            x += this.COLUMN_SPACING;
          }
        }
      }
    }
  }

  /**
   * Get tables related to a given table
   */
  private getRelatedTables(tableName: string): string[] {
    const related = new Set<string>([tableName]);

    for (const rel of this.relationships) {
      if (rel.from.table === tableName) {
        related.add(rel.to.table);
      }
      if (rel.to.table === tableName) {
        related.add(rel.from.table);
      }
    }

    return Array.from(related);
  }

  /**
   * Render the diagram
   */
  private render(): void {
    if (!this.container) return;

    // Calculate SVG viewBox
    let maxX = 0;
    let maxY = 0;

    for (const node of this.tables.values()) {
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    const viewBoxWidth = maxX + this.PADDING * 2;
    const viewBoxHeight = maxY + this.PADDING * 2;

    this.container.innerHTML = `
      <div class="erd-container">
        ${this.renderControls()}
        <svg id="erd-svg" class="erd-svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">
          <defs>
            ${this.renderArrowMarkers()}
          </defs>
          <g id="erd-main-group">
            ${this.renderRelationshipLines()}
            ${this.renderTables()}
          </g>
        </svg>
      </div>
    `;

    this.svgElement = document.getElementById('erd-svg') as SVGSVGElement;
    this.attachEventListeners();
    this.resetView();
  }

  /**
   * Render zoom/pan controls
   */
  private renderControls(): string {
    return `
      <div class="erd-controls">
        <button id="erd-zoom-in" class="erd-control-btn" title="Zoom In">+</button>
        <button id="erd-zoom-out" class="erd-control-btn" title="Zoom Out">−</button>
        <button id="erd-reset-view" class="erd-control-btn" title="Reset View">⟲</button>
      </div>
    `;
  }

  /**
   * Render arrow markers for relationships
   */
  private renderArrowMarkers(): string {
    return `
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#666" />
      </marker>
    `;
  }

  /**
   * Render relationship lines
   */
  private renderRelationshipLines(): string {
    return this.relationships.map(rel => {
      const fromNode = this.tables.get(rel.from.table);
      const toNode = this.tables.get(rel.to.table);

      if (!fromNode || !toNode) return '';

      // Calculate connection points
      const fromX = fromNode.x + fromNode.width;
      const fromY = fromNode.y + fromNode.height / 2;
      const toX = toNode.x;
      const toY = toNode.y + toNode.height / 2;

      // Create a curved path
      const midX = (fromX + toX) / 2;
      const path = `M ${fromX} ${fromY} Q ${midX} ${fromY}, ${midX} ${(fromY + toY) / 2} T ${toX} ${toY}`;

      return `
        <path
          class="relationship-line"
          d="${path}"
          stroke="#666"
          stroke-width="2"
          fill="none"
          marker-end="url(#arrow)"
          data-from="${this.escapeHtml(rel.from.table)}"
          data-to="${this.escapeHtml(rel.to.table)}"
        />
      `;
    }).join('');
  }

  /**
   * Render tables
   */
  private renderTables(): string {
    return Array.from(this.tables.values()).map(table => this.renderTable(table)).join('');
  }

  /**
   * Render a single table
   */
  private renderTable(table: TableNode): string {
    const isHighlighted = this.highlightedTable === table.name;

    return `
      <g class="table-node ${isHighlighted ? 'highlighted' : ''}" data-table="${this.escapeHtml(table.name)}">
        <!-- Table container -->
        <rect
          x="${table.x}"
          y="${table.y}"
          width="${table.width}"
          height="${table.height}"
          class="table-rect"
          fill="white"
          stroke="#2196F3"
          stroke-width="2"
          rx="4"
        />

        <!-- Table header -->
        <rect
          x="${table.x}"
          y="${table.y}"
          width="${table.width}"
          height="${this.HEADER_HEIGHT}"
          class="table-header"
          fill="#2196F3"
          rx="4"
        />
        <text
          x="${table.x + table.width / 2}"
          y="${table.y + this.HEADER_HEIGHT / 2 + 5}"
          class="table-name"
          text-anchor="middle"
          fill="white"
          font-weight="bold"
          font-size="14"
        >${this.escapeHtml(table.name)}</text>

        <!-- Columns -->
        ${table.columns.map((col, idx) => this.renderColumn(table, col, idx)).join('')}
      </g>
    `;
  }

  /**
   * Render a single column
   */
  private renderColumn(table: TableNode, column: any, index: number): string {
    const y = table.y + this.HEADER_HEIGHT + (index * this.ROW_HEIGHT);
    const icon = column.isPrimaryKey ? '🔑' : (column.isForeignKey ? '🔗' : '');

    return `
      <g class="column-row">
        ${index > 0 ? `
          <line
            x1="${table.x}"
            y1="${y}"
            x2="${table.x + table.width}"
            y2="${y}"
            stroke="#e0e0e0"
            stroke-width="1"
          />
        ` : ''}
        <text
          x="${table.x + 10}"
          y="${y + this.ROW_HEIGHT / 2 + 5}"
          class="column-name"
          font-size="12"
          fill="#333"
        >${icon} ${this.escapeHtml(column.name)}</text>
        <text
          x="${table.x + table.width - 10}"
          y="${y + this.ROW_HEIGHT / 2 + 5}"
          class="column-type"
          font-size="11"
          fill="#666"
          text-anchor="end"
        >${this.escapeHtml(this.formatType(column.type))}</text>
      </g>
    `;
  }

  /**
   * Format column type for display
   */
  private formatType(type: string): string {
    if (type.length > 15) {
      return type.substring(0, 12) + '...';
    }
    return type;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Zoom controls
    const zoomInBtn = document.getElementById('erd-zoom-in');
    const zoomOutBtn = document.getElementById('erd-zoom-out');
    const resetBtn = document.getElementById('erd-reset-view');

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => this.zoomIn());
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => this.zoomOut());
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetView());
    }

    // Pan functionality
    if (this.svgElement) {
      this.svgElement.addEventListener('mousedown', (e) => this.handleMouseDown(e));
      this.svgElement.addEventListener('mousemove', (e) => this.handleMouseMove(e));
      this.svgElement.addEventListener('mouseup', () => this.handleMouseUp());
      this.svgElement.addEventListener('mouseleave', () => this.handleMouseUp());

      // Scroll wheel zoom
      this.svgElement.addEventListener('wheel', (e) => this.handleWheel(e));
    }

    // Table hover
    const tableNodes = this.container?.querySelectorAll('.table-node');
    tableNodes?.forEach(node => {
      node.addEventListener('mouseenter', () => {
        const tableName = node.getAttribute('data-table');
        if (tableName) {
          this.highlightTable(tableName);
        }
      });

      node.addEventListener('mouseleave', () => {
        this.highlightTable(null);
      });
    });
  }

  /**
   * Handle mouse down for panning
   */
  private handleMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.dragStartX = e.clientX - this.translateX;
    this.dragStartY = e.clientY - this.translateY;
    if (this.svgElement) {
      this.svgElement.style.cursor = 'grabbing';
    }
  }

  /**
   * Handle mouse move for panning
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;

    this.translateX = e.clientX - this.dragStartX;
    this.translateY = e.clientY - this.dragStartY;
    this.updateTransform();
  }

  /**
   * Handle mouse up
   */
  private handleMouseUp(): void {
    this.isDragging = false;
    if (this.svgElement) {
      this.svgElement.style.cursor = 'grab';
    }
  }

  /**
   * Handle wheel for zooming
   */
  private handleWheel(e: WheelEvent): void {
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.scale *= delta;
    this.scale = Math.max(0.1, Math.min(5, this.scale));

    this.updateTransform();
  }

  /**
   * Zoom in
   */
  private zoomIn(): void {
    this.scale *= 1.2;
    this.scale = Math.min(5, this.scale);
    this.updateTransform();
  }

  /**
   * Zoom out
   */
  private zoomOut(): void {
    this.scale *= 0.8;
    this.scale = Math.max(0.1, this.scale);
    this.updateTransform();
  }

  /**
   * Reset view
   */
  private resetView(): void {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.updateTransform();
  }

  /**
   * Update transform
   */
  private updateTransform(): void {
    const mainGroup = document.getElementById('erd-main-group');
    if (mainGroup) {
      mainGroup.setAttribute('transform', `translate(${this.translateX}, ${this.translateY}) scale(${this.scale})`);
    }
  }

  /**
   * Highlight a table and its relationships
   */
  private highlightTable(tableName: string | null): void {
    this.highlightedTable = tableName;

    // Update relationship lines
    const lines = this.container?.querySelectorAll('.relationship-line');
    lines?.forEach(line => {
      const from = line.getAttribute('data-from');
      const to = line.getAttribute('data-to');

      if (tableName && (from === tableName || to === tableName)) {
        line.setAttribute('stroke', '#2196F3');
        line.setAttribute('stroke-width', '3');
      } else {
        line.setAttribute('stroke', '#666');
        line.setAttribute('stroke-width', '2');
      }
    });

    // Update table nodes
    const nodes = this.container?.querySelectorAll('.table-node');
    nodes?.forEach(node => {
      const nodeTable = node.getAttribute('data-table');
      if (tableName && nodeTable === tableName) {
        node.classList.add('highlighted');
      } else {
        node.classList.remove('highlighted');
      }
    });
  }

  /**
   * Escape HTML for safe display
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Destroy the component
   */
  public destroy(): void {
    this.tables.clear();
    this.relationships = [];
    this.svgElement = null;
    console.log('RelationshipDiagram destroyed');
  }
}
