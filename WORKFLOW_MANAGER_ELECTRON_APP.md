# Workflow Manager - FictionLab Dashboard Integration

**Repository:** MCP-Electron-App
**Purpose:** React dashboard components for workflow visualization and analytics
**Version:** 3.1
**Last Updated:** 2025-12-03

---

## Overview

This document specifies the FictionLab UI components for displaying workflow state, production metrics, and analytics dashboards. These components integrate with the Workflow Manager MCP server to provide real-time visibility into the writing workflow.

**Implementation Path:** `MCP-Electron-App/src/components/workflow/`

---

## Component Structure

```
MCP-Electron-App/
└── src/
    ├── components/
    │   └── workflow/
    │       ├── WorkflowDashboard.tsx        # Main dashboard container
    │       ├── PhaseProgressBar.tsx         # 12-phase progress indicator
    │       ├── PhaseIndicator.tsx           # Current phase display
    │       ├── ApprovalQueue.tsx            # Pending approvals list
    │       ├── AnalyticsDashboard.tsx       # Production metrics dashboard
    │       ├── MetricsCards.tsx             # Stat cards (words, velocity, etc.)
    │       ├── ProductivityChart.tsx        # 30-day productivity chart
    │       ├── VelocityMetrics.tsx          # Writing velocity display
    │       ├── EfficiencyMetrics.tsx        # Efficiency indicators
    │       ├── BookProgressGrid.tsx         # Book 1-5 progress cards
    │       ├── PhasePerformanceTable.tsx    # Phase analytics table
    │       ├── ProjectionCards.tsx          # Completion projections
    │       └── QualityGatesTimeline.tsx     # Quality gate history
    ├── hooks/
    │   ├── useWorkflow.ts                   # Workflow state hook
    │   ├── useWorkflowMetrics.ts            # Production metrics hook
    │   └── useWorkflowVelocity.ts           # Velocity calculations hook
    ├── services/
    │   └── workflow-api.ts                  # MCP tool wrappers
    └── types/
        └── workflow.ts                       # TypeScript interfaces
```

---

## Main Dashboard Component

**File:** `src/components/workflow/WorkflowDashboard.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useWorkflow } from '../../hooks/useWorkflow';
import PhaseProgressBar from './PhaseProgressBar';
import PhaseIndicator from './PhaseIndicator';
import ApprovalQueue from './ApprovalQueue';

export const WorkflowDashboard: React.FC = () => {
  const { workflow, progress, loading, error } = useWorkflow();

  if (loading) return <div>Loading workflow...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!workflow) return <div>No active workflow</div>;

  return (
    <div className="workflow-dashboard">
      <header>
        <h1>Series Production Progress</h1>
        <p className="series-title">{workflow.series_title}</p>
      </header>

      <PhaseProgressBar
        totalPhases={12}
        currentPhase={workflow.current_phase}
        phaseStatus={workflow.phase_status}
      />

      <div className="dashboard-grid">
        <PhaseIndicator
          phase={workflow.current_phase}
          phaseName={workflow.phase_name}
          status={workflow.phase_status}
        />

        <div className="book-progress">
          <h3>Current Book</h3>
          <div className="book-indicator">
            Book {workflow.current_book} of 5
          </div>
          {workflow.current_chapter && (
            <div className="chapter-indicator">
              Chapter {workflow.current_chapter}
            </div>
          )}
        </div>

        <div className="series-progress">
          <h3>Series Progress</h3>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress?.percent_complete}%` }}
            />
          </div>
          <div className="progress-text">
            {progress?.books_completed} / 5 books completed
          </div>
        </div>
      </div>

      <ApprovalQueue workflowId={workflow.workflow_id} />
    </div>
  );
};
```

---

## Analytics Dashboard Component

**File:** `src/components/workflow/AnalyticsDashboard.tsx`

```typescript
import React from 'react';
import { useWorkflowMetrics } from '../../hooks/useWorkflowMetrics';
import { useWorkflowVelocity } from '../../hooks/useWorkflowVelocity';
import MetricsCards from './MetricsCards';
import ProductivityChart from './ProductivityChart';
import VelocityMetrics from './VelocityMetrics';
import EfficiencyMetrics from './EfficiencyMetrics';
import BookProgressGrid from './BookProgressGrid';
import PhasePerformanceTable from './PhasePerformanceTable';
import ProjectionCards from './ProjectionCards';
import QualityGatesTimeline from './QualityGatesTimeline';

export const AnalyticsDashboard: React.FC<{ workflowId: string }> = ({ workflowId }) => {
  const { metrics, dailyStats, loading: metricsLoading } = useWorkflowMetrics(workflowId);
  const { velocity, loading: velocityLoading } = useWorkflowVelocity(workflowId, 'week');

  if (metricsLoading || velocityLoading) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div className="analytics-dashboard">
      {/* Header Stats */}
      <MetricsCards
        totalWords={metrics.total_words_written}
        velocity={velocity.words_per_hour}
        booksCompleted={metrics.books_completed}
        estimatedCompletion={velocity.projections.estimated_completion_date}
        hoursRemaining={velocity.projections.hours_remaining}
        dailyStats={dailyStats}
      />

      {/* 30-Day Productivity Chart */}
      <ProductivityChart data={dailyStats} />

      {/* Velocity Metrics */}
      <VelocityMetrics velocity={velocity.velocity} />

      {/* Efficiency Metrics */}
      <EfficiencyMetrics efficiency={velocity.efficiency} />

      {/* Book Progress Grid */}
      <BookProgressGrid books={metrics.by_book} />

      {/* Phase Performance Table */}
      <PhasePerformanceTable workflowId={workflowId} />

      {/* Completion Projections */}
      <ProjectionCards projections={velocity.projections} />

      {/* Quality Gates History */}
      <QualityGatesTimeline workflowId={workflowId} />
    </div>
  );
};
```

---

## Metrics Cards Component

**File:** `src/components/workflow/MetricsCards.tsx`

```typescript
import React from 'react';
import { formatNumber, formatDate, calculateTrend } from '../../utils/format';

interface MetricsCardsProps {
  totalWords: number;
  velocity: number;
  booksCompleted: number;
  estimatedCompletion: string;
  hoursRemaining: number;
  dailyStats: Array<{ stat_date: string; words_written: number }>;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  totalWords,
  velocity,
  booksCompleted,
  estimatedCompletion,
  hoursRemaining,
  dailyStats,
}) => {
  const wordsTrend = calculateTrend(dailyStats);

  return (
    <div className="metrics-grid">
      <StatCard
        title="Total Words Written"
        value={formatNumber(totalWords)}
        icon="📝"
        trend={wordsTrend}
      />

      <StatCard
        title="Current Velocity"
        value={`${velocity} words/hr`}
        icon="⚡"
        subtitle={`${Math.round(velocity * 8)} words/day`}
      />

      <StatCard
        title="Books Completed"
        value={`${booksCompleted} / 5`}
        icon="📚"
        progress={(booksCompleted / 5) * 100}
      />

      <StatCard
        title="Estimated Completion"
        value={formatDate(estimatedCompletion)}
        icon="🎯"
        subtitle={`${hoursRemaining} hours remaining`}
      />
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: string;
  trend?: number;
  subtitle?: string;
  progress?: number;
}> = ({ title, value, icon, trend, subtitle, progress }) => (
  <div className="stat-card">
    <div className="stat-icon">{icon}</div>
    <div className="stat-content">
      <h4>{title}</h4>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
      {progress !== undefined && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
      {trend !== undefined && (
        <div className={`trend ${trend >= 0 ? 'positive' : 'negative'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  </div>
);
```

---

## Productivity Chart Component

**File:** `src/components/workflow/ProductivityChart.tsx`

```typescript
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ProductivityChartProps {
  data: Array<{
    stat_date: string;
    words_written: number;
    chapters_completed: number;
  }>;
}

export const ProductivityChart: React.FC<ProductivityChartProps> = ({ data }) => {
  return (
    <div className="chart-section">
      <h3>30-Day Writing Productivity</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="stat_date" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="words_written"
            stroke="#4f46e5"
            name="Words Written"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="chapters_completed"
            stroke="#10b981"
            name="Chapters Completed"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
```

---

## Efficiency Metrics Component

**File:** `src/components/workflow/EfficiencyMetrics.tsx`

```typescript
import React from 'react';

interface EfficiencyMetricsProps {
  efficiency: {
    planning_to_writing_ratio: number;
    revision_rate: number;
    npe_pass_rate: number;
  };
}

export const EfficiencyMetrics: React.FC<EfficiencyMetricsProps> = ({ efficiency }) => {
  return (
    <div className="efficiency-section">
      <h3>Writing Efficiency</h3>
      <div className="efficiency-grid">
        <EfficiencyCard
          title="Planning to Writing Ratio"
          value={efficiency.planning_to_writing_ratio}
          format="ratio"
          optimal={0.3}
          description="Time spent planning vs. writing"
        />

        <EfficiencyCard
          title="NPE Pass Rate"
          value={efficiency.npe_pass_rate}
          format="percentage"
          optimal={85}
          description="Scenes passing validation first try"
        />

        <EfficiencyCard
          title="Revision Rate"
          value={efficiency.revision_rate}
          format="number"
          optimal={1.2}
          description="Average revision passes per chapter"
        />
      </div>
    </div>
  );
};

const EfficiencyCard: React.FC<{
  title: string;
  value: number;
  format: 'percentage' | 'ratio' | 'number';
  optimal: number;
  description: string;
}> = ({ title, value, format, optimal, description }) => {
  const formatted =
    format === 'percentage' ? `${value}%` :
    format === 'ratio' ? `${value.toFixed(2)}:1` :
    value.toFixed(1);

  const status =
    format === 'percentage' ? (value >= optimal ? 'good' : 'needs-improvement') :
    format === 'ratio' ? (value <= optimal ? 'good' : 'needs-improvement') :
    'neutral';

  return (
    <div className={`efficiency-card ${status}`}>
      <h4>{title}</h4>
      <div className="efficiency-value">{formatted}</div>
      <div className="efficiency-description">{description}</div>
      {status === 'needs-improvement' && (
        <div className="improvement-tip">
          Target: {format === 'percentage' ? `${optimal}%` : `${optimal}:1`}
        </div>
      )}
    </div>
  );
};
```

---

## Hooks

### useWorkflow Hook

**File:** `src/hooks/useWorkflow.ts`

```typescript
import { useState, useEffect } from 'react';
import { workflowApi } from '../services/workflow-api';

export const useWorkflow = () => {
  const [workflow, setWorkflow] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadWorkflow = async () => {
      try {
        setLoading(true);

        // Get active workflows for current user
        const workflows = await workflowApi.listActiveWorkflows({
          user_id: getCurrentUserId(),
        });

        if (workflows.length > 0) {
          const wf = workflows[0];
          setWorkflow(wf);

          // Get series progress
          const prog = await workflowApi.getSeriesProgress({
            workflow_id: wf.workflow_id,
          });
          setProgress(prog);
        }

        setLoading(false);
      } catch (err) {
        setError(err);
        setLoading(false);
      }
    };

    loadWorkflow();

    // Subscribe to real-time updates
    const unsubscribe = subscribeToWorkflowUpdates((data) => {
      if (data.workflow_id === workflow?.workflow_id) {
        setWorkflow(data.state);
      }
    });

    return () => unsubscribe();
  }, []);

  return { workflow, progress, loading, error };
};
```

### useWorkflowMetrics Hook

**File:** `src/hooks/useWorkflowMetrics.ts`

```typescript
import { useState, useEffect } from 'react';
import { workflowApi } from '../services/workflow-api';

export const useWorkflowMetrics = (workflowId: string) => {
  const [metrics, setMetrics] = useState(null);
  const [dailyStats, setDailyStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setLoading(true);

        const [metricsData, statsData] = await Promise.all([
          workflowApi.getWorkflowMetrics({ workflow_id: workflowId }),
          workflowApi.getDailyWritingStats({
            workflow_id: workflowId,
            date_range: {
              start: getDateDaysAgo(30),
              end: getTodayDate(),
            },
          }),
        ]);

        setMetrics(metricsData);
        setDailyStats(statsData);
        setLoading(false);
      } catch (err) {
        console.error('Error loading metrics:', err);
        setLoading(false);
      }
    };

    loadMetrics();

    // Refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, [workflowId]);

  return { metrics, dailyStats, loading };
};
```

---

## API Service

**File:** `src/services/workflow-api.ts`

```typescript
import { mcpClient } from './mcp-client';

export const workflowApi = {
  // Workflow Lifecycle
  async createWorkflow(params: {
    series_id: string;
    user_id: string;
    concept: string;
  }) {
    return await mcpClient.call('workflow-manager', 'create_workflow', params);
  },

  async getWorkflowState(params: { workflow_id: string }) {
    return await mcpClient.call('workflow-manager', 'get_workflow_state', params);
  },

  async listActiveWorkflows(params: { user_id: string }) {
    return await mcpClient.call('workflow-manager', 'list_active_workflows', params);
  },

  async getSeriesProgress(params: { workflow_id: string }) {
    return await mcpClient.call('workflow-manager', 'get_series_progress', params);
  },

  // Production Metrics
  async getWorkflowMetrics(params: { workflow_id: string }) {
    return await mcpClient.call('workflow-manager', 'get_workflow_metrics', params);
  },

  async getWorkflowVelocity(params: {
    workflow_id: string;
    time_window?: 'day' | 'week' | 'all';
  }) {
    return await mcpClient.call('workflow-manager', 'get_workflow_velocity', params);
  },

  async getDailyWritingStats(params: {
    workflow_id?: string;
    author_id?: string;
    date_range?: { start: string; end: string };
  }) {
    return await mcpClient.call('workflow-manager', 'get_daily_writing_stats', params);
  },

  // Approvals
  async getPendingApprovals(params: { workflow_id: string }) {
    return await mcpClient.call('workflow-manager', 'get_pending_approvals', params);
  },

  async submitApproval(params: {
    approval_id: string;
    decision: 'approved' | 'rejected' | 'revision_requested';
    feedback?: string;
  }) {
    return await mcpClient.call('workflow-manager', 'submit_approval', params);
  },
};
```

---

## Styling

**File:** `src/styles/workflow-dashboard.css`

```css
.workflow-dashboard {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
}

.stat-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.trend {
  font-size: 0.875rem;
  font-weight: 600;
  margin-top: 0.5rem;
}

.trend.positive {
  color: #10b981;
}

.trend.negative {
  color: #ef4444;
}

.efficiency-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #e5e7eb;
}

.efficiency-card.good {
  border-left-color: #10b981;
}

.efficiency-card.needs-improvement {
  border-left-color: #f59e0b;
}

.efficiency-value {
  font-size: 2rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0.5rem 0;
}

.efficiency-description {
  font-size: 0.875rem;
  color: #6b7280;
}

.improvement-tip {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #fef3c7;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #92400e;
}
```

---

## Real-Time Updates

**File:** `src/services/workflow-websocket.ts`

```typescript
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const subscribeToWorkflowUpdates = (callback: (data: any) => void) => {
  if (!socket) {
    socket = io('ws://localhost:3012', {
      path: '/workflow-updates',
    });
  }

  socket.on('workflow_updated', callback);

  return () => {
    socket?.off('workflow_updated', callback);
  };
};

export const subscribeToMetricsUpdates = (callback: (data: any) => void) => {
  if (!socket) {
    socket = io('ws://localhost:3012', {
      path: '/workflow-updates',
    });
  }

  socket.on('metrics_updated', callback);

  return () => {
    socket?.off('metrics_updated', callback);
  };
};
```

---

## Navigation Integration

**File:** `src/App.tsx`

```typescript
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { WorkflowDashboard } from './components/workflow/WorkflowDashboard';
import { AnalyticsDashboard } from './components/workflow/AnalyticsDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/workflow" element={<WorkflowDashboard />} />
        <Route path="/analytics/:workflowId" element={<AnalyticsDashboard />} />
      </Routes>
    </Router>
  );
}
```

---

## Testing

**File:** `src/components/workflow/__tests__/WorkflowDashboard.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { WorkflowDashboard } from '../WorkflowDashboard';
import { useWorkflow } from '../../../hooks/useWorkflow';

jest.mock('../../../hooks/useWorkflow');

describe('WorkflowDashboard', () => {
  it('should display workflow state', () => {
    (useWorkflow as jest.Mock).mockReturnValue({
      workflow: {
        workflow_id: 'wf-123',
        series_title: 'Test Series',
        current_phase: 9,
        phase_name: 'Chapter Planning',
        phase_status: 'in_progress',
        current_book: 1,
      },
      progress: {
        books_completed: 0,
        percent_complete: 10,
      },
      loading: false,
      error: null,
    });

    render(<WorkflowDashboard />);

    expect(screen.getByText('Test Series')).toBeInTheDocument();
    expect(screen.getByText('Chapter Planning')).toBeInTheDocument();
  });
});
```

---

## Related Documents

- [Workflow Manager Overview](../BQ-Studio/WORKFLOW_MANAGER_OVERVIEW.md) - System overview
- [BQ-Studio Integration](../BQ-Studio/WORKFLOW_MANAGER_BQ_STUDIO.md) - Claude Code integration
- [MCP Server Implementation](../BQ-Studio/WORKFLOW_MANAGER_MCP_SERVERS.md) - Server details

---

**Next Steps:**
1. Implement React components
2. Create hooks for data fetching
3. Add real-time WebSocket updates
4. Style components
5. Write unit and integration tests
6. Deploy to FictionLab UI
