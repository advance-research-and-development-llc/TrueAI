/*
  # Create Agent Runs Table

  Agent runs table stores execution history of agents with step traces and results.
*/

CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'stopped')),
  steps_json jsonb DEFAULT '[]',
  final_output text,
  error_message text,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  total_steps integer DEFAULT 0
);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent runs"
  ON agent_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = agent_runs.agent_id
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert agent runs"
  ON agent_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = agent_runs.agent_id
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own agent runs"
  ON agent_runs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = agent_runs.agent_id
      AND agents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = agent_runs.agent_id
      AND agents.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS agent_runs_agent_id_idx ON agent_runs(agent_id);
