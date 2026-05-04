-- Phase 9: Analytics, Visualization & Real-time Monitoring
-- Database schema for analytics tracking and system metrics

-- Analytics snapshots table for aggregated statistics
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('daily', 'weekly', 'monthly')),
  snapshot_date DATE NOT NULL,

  -- Message statistics
  total_messages INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,

  -- Model usage statistics
  model_usage JSONB DEFAULT '{}',
  most_used_model TEXT,

  -- Agent statistics
  total_agent_runs INTEGER DEFAULT 0,
  agent_success_rate DECIMAL(5,2),
  avg_agent_steps INTEGER,

  -- Workflow statistics
  total_workflow_executions INTEGER DEFAULT 0,
  workflow_success_rate DECIMAL(5,2),
  avg_workflow_duration_ms INTEGER,

  -- Ensemble statistics
  total_ensemble_runs INTEGER DEFAULT 0,
  ensemble_strategy_usage JSONB DEFAULT '{}',

  -- Benchmark statistics
  total_benchmarks INTEGER DEFAULT 0,
  benchmark_completion_rate DECIMAL(5,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, snapshot_type, snapshot_date)
);

-- System metrics table for performance monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('performance', 'error', 'usage')),
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(10,2),
  metric_unit TEXT,
  tags JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User activity log for tracking interactions
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification queue for push notifications
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'task_complete', 'workflow_complete', 'benchmark_complete',
    'agent_failed', 'system_alert'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user_date
  ON analytics_snapshots(user_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_type
  ON analytics_snapshots(snapshot_type, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_system_metrics_user_created
  ON system_metrics(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_metrics_type_name
  ON system_metrics(metric_type, metric_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_created
  ON user_activity_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_type
  ON user_activity_log(activity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_queue_user_sent
  ON notification_queue(user_id, sent, created_at DESC);

-- Additional indexes for existing tables to support analytics queries
CREATE INDEX IF NOT EXISTS idx_messages_user_created
  ON messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user_status_created
  ON agent_runs(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_status_started
  ON workflow_executions(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ensemble_results_user_created
  ON ensemble_results(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_comparisons_user_created
  ON model_comparisons(user_id, created_at DESC);

-- Row Level Security (RLS) policies

-- Analytics snapshots policies
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analytics snapshots"
  ON analytics_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics snapshots"
  ON analytics_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analytics snapshots"
  ON analytics_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

-- System metrics policies
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own system metrics"
  ON system_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own system metrics"
  ON system_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User activity log policies
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity log"
  ON user_activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity log"
  ON user_activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Notification queue policies
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notification_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notifications"
  ON notification_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notification_queue FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON notification_queue FOR DELETE
  USING (auth.uid() = user_id);
