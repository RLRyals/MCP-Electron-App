-- Migration: Create workflows table
-- Description: Stores multi-step workflows for chaining plugins together
-- Version: 004
-- Date: 2025-12-12

-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Target entity (optional - which series/book this workflow operates on)
  target_type VARCHAR(50),  -- 'series', 'book', 'chapter', 'global'
  target_id UUID,           -- ID of the target entity

  -- Workflow definition (JSONB for flexibility)
  steps JSONB NOT NULL,     -- Array of workflow steps

  -- Workflow metadata
  status VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'active', 'archived'
  version INTEGER DEFAULT 1,

  -- Execution settings
  auto_run BOOLEAN DEFAULT FALSE,      -- Auto-execute on trigger
  schedule_cron VARCHAR(100),           -- Cron expression for scheduled runs

  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),

  -- Execution history
  last_run_at TIMESTAMP,
  last_run_status VARCHAR(50),  -- 'success', 'failed', 'cancelled'
  run_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0
);

-- Create workflow_runs table for execution history
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

  -- Execution details
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'running',  -- 'running', 'completed', 'failed', 'cancelled'

  -- Step execution tracking
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER NOT NULL,

  -- Execution log
  execution_log JSONB,  -- Array of step results

  -- Context/variables passed through the workflow
  context JSONB,        -- Variables available to all steps

  -- Error tracking
  error_message TEXT,
  error_step INTEGER,

  -- Metadata
  triggered_by VARCHAR(50),  -- 'manual', 'schedule', 'event', 'api'
  triggered_by_user VARCHAR(255)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_target ON workflows(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_workflows_updated_at ON workflows(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at DESC);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_update_workflows_updated_at ON workflows;
CREATE TRIGGER trigger_update_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_workflows_updated_at();

-- Insert sample workflow for testing
INSERT INTO workflows (name, description, target_type, status, steps) VALUES
(
  'New Series Creation Pipeline',
  'Complete workflow for creating a new book series: planning → outline → first draft → marketing plan',
  'series',
  'active',
  '[
    {
      "id": "step-1",
      "name": "Create Series",
      "pluginId": "bq-studio",
      "action": "new-series",
      "config": {},
      "outputMapping": {
        "seriesId": "$.result.seriesId",
        "seriesName": "$.result.name"
      }
    },
    {
      "id": "step-2",
      "name": "Generate Outline",
      "pluginId": "bq-studio",
      "action": "generate-outline",
      "config": {
        "seriesId": "{{step-1.seriesId}}",
        "bookCount": 3
      },
      "outputMapping": {
        "outlineId": "$.result.outlineId"
      }
    },
    {
      "id": "step-3",
      "name": "Draft First Chapter",
      "pluginId": "bq-studio",
      "action": "draft-chapter",
      "config": {
        "seriesId": "{{step-1.seriesId}}",
        "outlineId": "{{step-2.outlineId}}",
        "chapterNumber": 1
      },
      "outputMapping": {
        "draftId": "$.result.draftId"
      }
    }
  ]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE workflows IS 'Multi-step workflows for automating plugin chains';
COMMENT ON TABLE workflow_runs IS 'Execution history and logs for workflow runs';

COMMENT ON COLUMN workflows.steps IS 'JSONB array of workflow steps with plugin actions and variable mappings';
COMMENT ON COLUMN workflows.target_type IS 'Type of entity this workflow operates on (series, book, chapter, global)';
COMMENT ON COLUMN workflow_runs.execution_log IS 'JSONB array of step execution results with timestamps and outputs';
COMMENT ON COLUMN workflow_runs.context IS 'Runtime context with variables passed between steps';
