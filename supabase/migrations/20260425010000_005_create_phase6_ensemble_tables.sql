/*
  # Create Phase 6 Ensemble and Model Comparison Tables

  Creates tables for:
  - ensemble_results: Multi-model ensemble execution results
  - model_comparisons: Model comparison benchmarks
  - model_benchmarks: Individual model benchmark results
*/

-- Ensemble Results Table
CREATE TABLE IF NOT EXISTS ensemble_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy text NOT NULL CHECK (strategy IN ('parallel', 'sequential', 'voting', 'weighted', 'best-of-n')),
  models text[] NOT NULL,
  prompt text NOT NULL,
  individual_responses jsonb[] NOT NULL,
  combined_response text NOT NULL,
  total_duration integer NOT NULL,
  total_tokens integer NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ensemble_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ensemble results"
  ON ensemble_results FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ensemble_results_user_id_idx ON ensemble_results(user_id);
CREATE INDEX IF NOT EXISTS ensemble_results_strategy_idx ON ensemble_results(strategy);
CREATE INDEX IF NOT EXISTS ensemble_results_created_at_idx ON ensemble_results(created_at DESC);

-- Model Comparisons Table
CREATE TABLE IF NOT EXISTS model_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  models text[] NOT NULL,
  task jsonb NOT NULL,
  benchmarks jsonb[] NOT NULL,
  winner text,
  summary text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE model_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own model comparisons"
  ON model_comparisons FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS model_comparisons_user_id_idx ON model_comparisons(user_id);
CREATE INDEX IF NOT EXISTS model_comparisons_created_at_idx ON model_comparisons(created_at DESC);

-- Model Benchmarks Table
CREATE TABLE IF NOT EXISTS model_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  model text NOT NULL,
  task text NOT NULL,
  prompt text NOT NULL,
  response text NOT NULL,
  metrics jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE model_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own model benchmarks"
  ON model_benchmarks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS model_benchmarks_user_id_idx ON model_benchmarks(user_id);
CREATE INDEX IF NOT EXISTS model_benchmarks_model_idx ON model_benchmarks(model);
CREATE INDEX IF NOT EXISTS model_benchmarks_task_idx ON model_benchmarks(task);
CREATE INDEX IF NOT EXISTS model_benchmarks_created_at_idx ON model_benchmarks(created_at DESC);
