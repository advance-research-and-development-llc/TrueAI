/*
  # Create Models Table

  Models table stores all available LLM models from Ollama, HuggingFace, or local sources.
*/

CREATE TABLE IF NOT EXISTS models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  source text NOT NULL CHECK (source IN ('ollama', 'huggingface', 'local')),
  model_type text DEFAULT 'llm',
  size_bytes bigint,
  status text DEFAULT 'available' CHECK (status IN ('available', 'downloading', 'error')),
  local_path text,
  remote_url text,
  quantization text,
  context_length integer DEFAULT 2048,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own models"
  ON models
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS models_user_id_idx ON models(user_id);
