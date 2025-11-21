/**
 * QueryBuilder Component
 * Visual interface for building database queries with WHERE clauses, ORDER BY, and pagination
 */

import { databaseService, QueryParams } from '../../../services/databaseService.js';

export interface WhereClause {
  id: string;
  column: string;
  operator: string;
  value: string;
}

export interface OrderByClause {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface QueryBuilderEvents {
  onExecute?: (params: QueryParams) => void;
  onQueryChange?: (params: QueryParams) => void;
}

export class QueryBuilder {
  private container: HTMLElement;
  private events: QueryBuilderEvents;
  private tableName: string = '';
  private columns: any[] = [];
  private selectedColumns: string[] = [];
  private whereClauses: WhereClause[] = [];
  private orderBy: OrderByClause[] = [];
  private limit: number = 100;
  private offset: number = 0;
  private nextWhereId: number = 1;

  private readonly OPERATORS = [
    { value: '=', label: 'Equals (=)' },
    { value: '!=', label: 'Not Equals (!=)' },
    { value: '>', label: 'Greater Than (>)' },
    { value: '>=', label: 'Greater or Equal (>=)' },
    { value: '<', label: 'Less Than (<)' },
    { value: '<=', label: 'Less or Equal (<=)' },
    { value: 'LIKE', label: 'Like (LIKE)' },
    { value: 'NOT LIKE', label: 'Not Like (NOT LIKE)' },
    { value: 'IN', label: 'In (IN)' },
    { value: 'NOT IN', label: 'Not In (NOT IN)' },
    { value: 'IS NULL', label: 'Is Null' },
    { value: 'IS NOT NULL', label: 'Is Not Null' },
  ];

  constructor(container: HTMLElement, events: QueryBuilderEvents = {}) {
    this.container = container;
    this.events = events;
  }

  /**
   * Initialize query builder with table name
   */
  public async initialize(tableName: string): Promise<void> {
    this.tableName = tableName;
    await this.loadColumns();
    this.selectedColumns = []; // Select all by default
    this.whereClauses = [];
    this.orderBy = [];
    this.limit = 100;
    this.offset = 0;
    this.render();
  }

  /**
   * Load columns for the selected table
   */
  private async loadColumns(): Promise<void> {
    try {
      const result = await databaseService.listColumns(this.tableName);

      if (result.success && result.data) {
        this.columns = result.data.columns || result.data || [];
      } else {
        this.columns = [];
      }
    } catch (error) {
      console.error('Error loading columns:', error);
      this.columns = [];
    }
  }

  /**
   * Render the query builder
   */
  public render(): void {
    if (!this.tableName) {
      this.container.innerHTML = `
        <div class="query-builder-empty">
          Please select a table to build queries
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="query-builder">
        <div class="query-builder-header">
          <h4>Query Builder - ${this.escapeHtml(this.tableName)}</h4>
          <button id="execute-query" class="action-button primary">
            Execute Query
          </button>
        </div>

        ${this.renderColumnSelector()}
        ${this.renderWhereClauseBuilder()}
        ${this.renderOrderByBuilder()}
        ${this.renderPaginationControls()}
        ${this.renderSqlPreview()}
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render column selector
   */
  private renderColumnSelector(): string {
    return `
      <div class="query-section">
        <div class="section-header">
          <h5>SELECT Columns</h5>
          <div class="section-actions">
            <button id="select-all-columns" class="text-button">Select All</button>
            <button id="deselect-all-columns" class="text-button">Deselect All</button>
          </div>
        </div>
        <div class="column-selector">
          ${this.columns.length === 0 ? '<div class="empty-message">No columns available</div>' : `
            <div class="column-checkboxes">
              ${this.columns.map(col => {
                const colName = col.name || col;
                const isSelected = this.selectedColumns.length === 0 || this.selectedColumns.includes(colName);
                return `
                  <label class="column-checkbox">
                    <input
                      type="checkbox"
                      class="column-check"
                      data-column="${this.escapeHtml(colName)}"
                      ${isSelected ? 'checked' : ''}
                    />
                    <span>${this.escapeHtml(colName)}</span>
                  </label>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Render WHERE clause builder
   */
  private renderWhereClauseBuilder(): string {
    return `
      <div class="query-section">
        <div class="section-header">
          <h5>WHERE Conditions</h5>
          <button id="add-where-clause" class="text-button">+ Add Condition</button>
        </div>
        <div class="where-clauses" id="where-clauses-container">
          ${this.whereClauses.length === 0 ? '<div class="empty-message">No conditions. Add a condition to filter results.</div>' : ''}
          ${this.whereClauses.map(clause => this.renderWhereClause(clause)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render a single WHERE clause
   */
  private renderWhereClause(clause: WhereClause): string {
    const needsValue = !['IS NULL', 'IS NOT NULL'].includes(clause.operator);

    return `
      <div class="where-clause" data-id="${clause.id}">
        <select class="where-column" data-id="${clause.id}">
          <option value="">-- Column --</option>
          ${this.columns.map(col => {
            const colName = col.name || col;
            const selected = colName === clause.column ? 'selected' : '';
            return `<option value="${this.escapeHtml(colName)}" ${selected}>${this.escapeHtml(colName)}</option>`;
          }).join('')}
        </select>

        <select class="where-operator" data-id="${clause.id}">
          ${this.OPERATORS.map(op => {
            const selected = op.value === clause.operator ? 'selected' : '';
            return `<option value="${this.escapeHtml(op.value)}" ${selected}>${this.escapeHtml(op.label)}</option>`;
          }).join('')}
        </select>

        ${needsValue ? `
          <input
            type="text"
            class="where-value"
            data-id="${clause.id}"
            value="${this.escapeHtml(clause.value)}"
            placeholder="Value"
          />
        ` : '<span class="where-no-value">--</span>'}

        <button class="remove-where" data-id="${clause.id}" title="Remove condition">✕</button>
      </div>
    `;
  }

  /**
   * Render ORDER BY builder
   */
  private renderOrderByBuilder(): string {
    return `
      <div class="query-section">
        <div class="section-header">
          <h5>ORDER BY</h5>
          <button id="add-order-by" class="text-button">+ Add Sort</button>
        </div>
        <div class="order-by-clauses" id="order-by-container">
          ${this.orderBy.length === 0 ? '<div class="empty-message">No sorting applied</div>' : ''}
          ${this.orderBy.map((order, index) => this.renderOrderByClause(order, index)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render a single ORDER BY clause
   */
  private renderOrderByClause(order: OrderByClause, index: number): string {
    return `
      <div class="order-by-clause" data-index="${index}">
        <select class="order-column" data-index="${index}">
          <option value="">-- Column --</option>
          ${this.columns.map(col => {
            const colName = col.name || col;
            const selected = colName === order.column ? 'selected' : '';
            return `<option value="${this.escapeHtml(colName)}" ${selected}>${this.escapeHtml(colName)}</option>`;
          }).join('')}
        </select>

        <select class="order-direction" data-index="${index}">
          <option value="ASC" ${order.direction === 'ASC' ? 'selected' : ''}>Ascending</option>
          <option value="DESC" ${order.direction === 'DESC' ? 'selected' : ''}>Descending</option>
        </select>

        <button class="remove-order" data-index="${index}" title="Remove sort">✕</button>
      </div>
    `;
  }

  /**
   * Render pagination controls
   */
  private renderPaginationControls(): string {
    return `
      <div class="query-section">
        <div class="section-header">
          <h5>Pagination</h5>
        </div>
        <div class="pagination-controls">
          <div class="control-group">
            <label>Limit:</label>
            <input
              type="number"
              id="query-limit"
              class="number-input"
              value="${this.limit}"
              min="1"
              max="10000"
            />
          </div>
          <div class="control-group">
            <label>Offset:</label>
            <input
              type="number"
              id="query-offset"
              class="number-input"
              value="${this.offset}"
              min="0"
            />
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render SQL preview
   */
  private renderSqlPreview(): string {
    const params = this.buildQueryParams();
    const sql = this.generateSqlPreview(params);

    return `
      <div class="query-section">
        <div class="section-header">
          <h5>SQL Preview</h5>
        </div>
        <div class="sql-preview">
          <code>${this.escapeHtml(sql)}</code>
        </div>
      </div>
    `;
  }

  /**
   * Generate SQL preview from query parameters
   */
  private generateSqlPreview(params: QueryParams): string {
    let sql = 'SELECT ';

    // Columns
    if (params.columns && params.columns.length > 0) {
      sql += params.columns.join(', ');
    } else {
      sql += '*';
    }

    // Table
    sql += ` FROM ${params.table}`;

    // WHERE
    if (params.where && Object.keys(params.where).length > 0) {
      const conditions = Object.entries(params.where).map(([key, value]) => {
        if (value === null) return `${key} IS NULL`;
        if (typeof value === 'string') return `${key} = '${value}'`;
        return `${key} = ${value}`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // ORDER BY
    if (params.orderBy && params.orderBy.length > 0) {
      const orderClauses = params.orderBy.map(o => `${o.column} ${o.direction}`);
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // LIMIT/OFFSET
    if (params.limit) {
      sql += ` LIMIT ${params.limit}`;
    }
    if (params.offset) {
      sql += ` OFFSET ${params.offset}`;
    }

    return sql;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Execute query button
    const executeBtn = this.container.querySelector('#execute-query');
    if (executeBtn) {
      executeBtn.addEventListener('click', () => this.executeQuery());
    }

    // Column selection
    const columnChecks = this.container.querySelectorAll('.column-check');
    columnChecks.forEach(check => {
      check.addEventListener('change', () => this.handleColumnSelectionChange());
    });

    // Select/Deselect all columns
    const selectAllBtn = this.container.querySelector('#select-all-columns');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => this.selectAllColumns());
    }

    const deselectAllBtn = this.container.querySelector('#deselect-all-columns');
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener('click', () => this.deselectAllColumns());
    }

    // Add WHERE clause
    const addWhereBtn = this.container.querySelector('#add-where-clause');
    if (addWhereBtn) {
      addWhereBtn.addEventListener('click', () => this.addWhereClause());
    }

    // WHERE clause controls
    this.attachWhereClauseListeners();

    // Add ORDER BY
    const addOrderBtn = this.container.querySelector('#add-order-by');
    if (addOrderBtn) {
      addOrderBtn.addEventListener('click', () => this.addOrderBy());
    }

    // ORDER BY controls
    this.attachOrderByListeners();

    // Pagination inputs
    const limitInput = this.container.querySelector('#query-limit') as HTMLInputElement;
    if (limitInput) {
      limitInput.addEventListener('change', () => {
        this.limit = parseInt(limitInput.value) || 100;
        this.render();
      });
    }

    const offsetInput = this.container.querySelector('#query-offset') as HTMLInputElement;
    if (offsetInput) {
      offsetInput.addEventListener('change', () => {
        this.offset = parseInt(offsetInput.value) || 0;
        this.render();
      });
    }
  }

  /**
   * Attach WHERE clause event listeners
   */
  private attachWhereClauseListeners(): void {
    // Column selectors
    const columnSelects = this.container.querySelectorAll('.where-column');
    columnSelects.forEach(select => {
      select.addEventListener('change', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-id');
        const clause = this.whereClauses.find(c => c.id === id);
        if (clause) {
          clause.column = (e.target as HTMLSelectElement).value;
          this.render();
        }
      });
    });

    // Operator selectors
    const operatorSelects = this.container.querySelectorAll('.where-operator');
    operatorSelects.forEach(select => {
      select.addEventListener('change', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-id');
        const clause = this.whereClauses.find(c => c.id === id);
        if (clause) {
          clause.operator = (e.target as HTMLSelectElement).value;
          this.render();
        }
      });
    });

    // Value inputs
    const valueInputs = this.container.querySelectorAll('.where-value');
    valueInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-id');
        const clause = this.whereClauses.find(c => c.id === id);
        if (clause) {
          clause.value = (e.target as HTMLInputElement).value;
          this.render();
        }
      });
    });

    // Remove buttons
    const removeButtons = this.container.querySelectorAll('.remove-where');
    removeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-id');
        this.removeWhereClause(id!);
      });
    });
  }

  /**
   * Attach ORDER BY event listeners
   */
  private attachOrderByListeners(): void {
    // Column selectors
    const columnSelects = this.container.querySelectorAll('.order-column');
    columnSelects.forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt((e.target as HTMLElement).getAttribute('data-index')!);
        if (this.orderBy[index]) {
          this.orderBy[index].column = (e.target as HTMLSelectElement).value;
          this.render();
        }
      });
    });

    // Direction selectors
    const directionSelects = this.container.querySelectorAll('.order-direction');
    directionSelects.forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt((e.target as HTMLElement).getAttribute('data-index')!);
        if (this.orderBy[index]) {
          this.orderBy[index].direction = (e.target as HTMLSelectElement).value as 'ASC' | 'DESC';
          this.render();
        }
      });
    });

    // Remove buttons
    const removeButtons = this.container.querySelectorAll('.remove-order');
    removeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const index = parseInt((e.target as HTMLElement).getAttribute('data-index')!);
        this.removeOrderBy(index);
      });
    });
  }

  /**
   * Handle column selection change
   */
  private handleColumnSelectionChange(): void {
    const checkboxes = this.container.querySelectorAll('.column-check') as NodeListOf<HTMLInputElement>;
    this.selectedColumns = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.getAttribute('data-column')!);

    this.render();
  }

  /**
   * Select all columns
   */
  private selectAllColumns(): void {
    this.selectedColumns = [];
    this.render();
  }

  /**
   * Deselect all columns
   */
  private deselectAllColumns(): void {
    this.selectedColumns = this.columns.map(col => col.name || col);
    const checkboxes = this.container.querySelectorAll('.column-check') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(cb => cb.checked = false);
    this.render();
  }

  /**
   * Add a WHERE clause
   */
  private addWhereClause(): void {
    this.whereClauses.push({
      id: `where-${this.nextWhereId++}`,
      column: '',
      operator: '=',
      value: '',
    });
    this.render();
  }

  /**
   * Remove a WHERE clause
   */
  private removeWhereClause(id: string): void {
    this.whereClauses = this.whereClauses.filter(c => c.id !== id);
    this.render();
  }

  /**
   * Add an ORDER BY clause
   */
  private addOrderBy(): void {
    this.orderBy.push({
      column: '',
      direction: 'ASC',
    });
    this.render();
  }

  /**
   * Remove an ORDER BY clause
   */
  private removeOrderBy(index: number): void {
    this.orderBy.splice(index, 1);
    this.render();
  }

  /**
   * Build query parameters from current state
   */
  public buildQueryParams(): QueryParams {
    const params: QueryParams = {
      table: this.tableName,
    };

    // Columns
    if (this.selectedColumns.length > 0) {
      params.columns = this.selectedColumns;
    }

    // WHERE
    const where: Record<string, any> = {};
    this.whereClauses.forEach(clause => {
      if (clause.column && clause.operator) {
        if (clause.operator === 'IS NULL') {
          where[clause.column] = null;
        } else if (clause.operator === 'IS NOT NULL') {
          // Handle NOT NULL differently
          where[clause.column] = { operator: 'IS NOT NULL' };
        } else if (clause.value) {
          where[clause.column] = clause.value;
        }
      }
    });

    if (Object.keys(where).length > 0) {
      params.where = where;
    }

    // ORDER BY
    const validOrderBy = this.orderBy.filter(o => o.column);
    if (validOrderBy.length > 0) {
      params.orderBy = validOrderBy;
    }

    // Pagination
    if (this.limit > 0) {
      params.limit = this.limit;
    }
    if (this.offset > 0) {
      params.offset = this.offset;
    }

    return params;
  }

  /**
   * Execute the query
   */
  private executeQuery(): void {
    const params = this.buildQueryParams();

    if (this.events.onExecute) {
      this.events.onExecute(params);
    }
  }

  /**
   * Reset query builder
   */
  public reset(): void {
    this.selectedColumns = [];
    this.whereClauses = [];
    this.orderBy = [];
    this.limit = 100;
    this.offset = 0;
    this.render();
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
