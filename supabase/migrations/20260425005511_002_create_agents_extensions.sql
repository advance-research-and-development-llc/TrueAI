/*
  # Create Agents and Extensions Tables

  Agents table stores AI agent configurations.
  Extensions table stores installed harnesses/add-ons.
*/

CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  system_prompt text,
  tools_enabled text[] DEFAULT '{}',
  harness_ids uuid[] DEFAULT '{}',
  config_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agents"
  ON agents
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  harness_type text NOT NULL,
  repo_url text,
  version text NOT NULL,
  installed_at timestamptz DEFAULT now(),
  enabled boolean DEFAULT true,
  manifest_json jsonb NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own extensions"
  ON extensions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS agents_user_id_idx ON agents(user_id);
CREATE INDEX IF NOT EXISTS extensions_user_id_idx ON extensions(user_id);
