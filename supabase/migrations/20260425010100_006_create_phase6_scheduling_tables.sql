/*
  # Create Phase 6 Agent Scheduling Tables

  Creates tables for:
  - scheduled_agent_tasks: Configuration for scheduled agent tasks
  - scheduled_task_executions: Execution history of scheduled tasks
*/

-- Scheduled Agent Tasks Table
CREATE TABLE IF NOT EXISTS scheduled_agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  schedule_type text NOT NULL CHECK (schedule_type IN ('once', 'interval', 'cron', 'daily', 'weekly', 'monthly')),
  schedule_config jsonb NOT NULL,
  task_input text NOT NULL,
  model_name text NOT NULL,
  enabled boolean DEFAULT true,
  last_run timestamptz,
  next_run timestamptz,
  run_count integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'disabled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE scheduled_agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scheduled tasks"
  ON scheduled_agent_tasks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS scheduled_agent_tasks_user_id_idx ON scheduled_agent_tasks(user_id);
CREATE INDEX IF NOT EXISTS scheduled_agent_tasks_agent_id_idx ON scheduled_agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS scheduled_agent_tasks_next_run_idx ON scheduled_agent_tasks(next_run);
CREATE INDEX IF NOT EXISTS scheduled_agent_tasks_enabled_idx ON scheduled_agent_tasks(enabled);
CREATE INDEX IF NOT EXISTS scheduled_agent_tasks_status_idx ON scheduled_agent_tasks(status);

-- Scheduled Task Executions Table
CREATE TABLE IF NOT EXISTS scheduled_task_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_task_id uuid REFERENCES scheduled_agent_tasks(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id),
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'timeout')),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  output text,
  error text,
  steps_count integer DEFAULT 0,
  duration integer DEFAULT 0
);

ALTER TABLE scheduled_task_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task executions"
  ON scheduled_task_executions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_agent_tasks
      WHERE scheduled_agent_tasks.id = scheduled_task_executions.scheduled_task_id
      AND scheduled_agent_tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert task executions"
  ON scheduled_task_executions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scheduled_agent_tasks
      WHERE scheduled_agent_tasks.id = scheduled_task_executions.scheduled_task_id
      AND scheduled_agent_tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update task executions"
  ON scheduled_task_executions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_agent_tasks
      WHERE scheduled_agent_tasks.id = scheduled_task_executions.scheduled_task_id
      AND scheduled_agent_tasks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scheduled_agent_tasks
      WHERE scheduled_agent_tasks.id = scheduled_task_executions.scheduled_task_id
      AND scheduled_agent_tasks.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS scheduled_task_executions_task_id_idx ON scheduled_task_executions(scheduled_task_id);
CREATE INDEX IF NOT EXISTS scheduled_task_executions_agent_id_idx ON scheduled_task_executions(agent_id);
CREATE INDEX IF NOT EXISTS scheduled_task_executions_status_idx ON scheduled_task_executions(status);
CREATE INDEX IF NOT EXISTS scheduled_task_executions_started_at_idx ON scheduled_task_executions(started_at DESC);
