-- ============================================================
-- Migration 003: Agent autonomous posting tables
-- ============================================================

-- Add new columns to posts table for agent workflow
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS approval_token  text UNIQUE,
  ADD COLUMN IF NOT EXISTS drive_file_id   text,
  ADD COLUMN IF NOT EXISTS week_group_id   text,
  ADD COLUMN IF NOT EXISTS captions_json   jsonb DEFAULT '{}';

-- Extend status constraint to include agent statuses
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE posts ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft','pending_approval','scheduled','publishing','published','failed'));

-- Indexes for the run cron and approval webhook
CREATE INDEX IF NOT EXISTS posts_approval_token_idx ON posts(approval_token)
  WHERE approval_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_scheduled_due_idx  ON posts(scheduled_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS posts_week_group_idx     ON posts(week_group_id)
  WHERE week_group_id IS NOT NULL;

-- ============================================================
-- agent_config: key/value store for autonomous agent state
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_config (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO agent_config (key, value) VALUES
  ('week_pattern',     '"A"'),
  ('posted_drive_ids', '[]')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on agent_config" ON agent_config;
CREATE POLICY "Allow all on agent_config" ON agent_config FOR ALL USING (true);
