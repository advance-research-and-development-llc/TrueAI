/*
  # Create Phase 6 Advanced Agent Workflow Tables

  Creates tables for:
  - agent_workflows: Configuration for complex multi-step workflows
  - workflow_executions: Execution history and state of workflow runs
*/

-- Agent Workflows Table
CREATE TABLE IF NOT EXISTS agent_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  steps jsonb[] NOT NULL,
  start_step text NOT NULL,
  variables jsonb DEFAULT '{}',
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agent_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workflows"
  ON agent_workflows FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS agent_workflows_user_id_idx ON agent_workflows(user_id);
CREATE INDEX IF NOT EXISTS agent_workflows_enabled_idx ON agent_workflows(enabled);
CREATE INDEX IF NOT EXISTS agent_workflows_created_at_idx ON agent_workflows(created_at DESC);

-- Workflow Executions Table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES agent_workflows(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'paused')),
  input jsonb,
  output jsonb,
  current_step text,
  step_results jsonb DEFAULT '{}',
  variables jsonb DEFAULT '{}',
  error text,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  duration integer DEFAULT 0
);

ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workflow executions"
  ON workflow_executions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS workflow_executions_user_id_idx ON workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS workflow_executions_workflow_id_idx ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS workflow_executions_status_idx ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS workflow_executions_started_at_idx ON workflow_executions(started_at DESC);
