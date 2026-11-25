-- ============================================================
-- Migration 004: Multi-user support
-- Run in Supabase SQL Editor AFTER enabling Supabase Auth
-- and AFTER the first user (Mario) has signed up.
-- Then run the stamp script below to assign existing rows.
-- ============================================================

-- Step 1: Add user_id columns (nullable first so existing rows don't break)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE voice_profile
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE agent_config
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE analytics
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Fix platform_connections unique constraint (was globally unique per platform,
-- now must be unique per user+platform)
ALTER TABLE platform_connections
  DROP CONSTRAINT IF EXISTS platform_connections_platform_key;

ALTER TABLE platform_connections
  ADD CONSTRAINT IF NOT EXISTS platform_connections_user_platform_unique
  UNIQUE (user_id, platform);

-- Step 3: Fix agent_config primary key (was key-only, now user_id+key)
ALTER TABLE agent_config
  DROP CONSTRAINT IF EXISTS agent_config_pkey;

ALTER TABLE agent_config
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Make id the new PK, keep (user_id, key) unique
ALTER TABLE agent_config
  ADD CONSTRAINT agent_config_pkey PRIMARY KEY (id);

ALTER TABLE agent_config
  ADD CONSTRAINT IF NOT EXISTS agent_config_user_key_unique
  UNIQUE (user_id, key);

-- Step 4: Indexes for performance
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS platform_connections_user_id_idx ON platform_connections(user_id);
CREATE INDEX IF NOT EXISTS voice_profile_user_id_idx ON voice_profile(user_id);
CREATE INDEX IF NOT EXISTS agent_config_user_id_idx ON agent_config(user_id);

-- ============================================================
-- Step 5: Stamp existing rows with Mario's user_id
-- Replace <MARIO_USER_ID> with the uuid from auth.users after signup
-- ============================================================
-- UPDATE posts SET user_id = '<MARIO_USER_ID>' WHERE user_id IS NULL;
-- UPDATE platform_connections SET user_id = '<MARIO_USER_ID>' WHERE user_id IS NULL;
-- UPDATE voice_profile SET user_id = '<MARIO_USER_ID>' WHERE user_id IS NULL;
-- UPDATE agent_config SET user_id = '<MARIO_USER_ID>' WHERE user_id IS NULL;
-- UPDATE analytics SET user_id = '<MARIO_USER_ID>' WHERE user_id IS NULL;

-- ============================================================
-- Step 6: Update RLS policies
-- ============================================================

-- posts: drop blanket policy, add per-user + service-role bypass
DROP POLICY IF EXISTS "Allow all operations" ON posts;
DROP POLICY IF EXISTS "posts_all" ON posts;

CREATE POLICY "posts_own" ON posts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role (cron) can see all posts
CREATE POLICY "posts_service_role" ON posts
  FOR ALL USING (auth.role() = 'service_role');

-- platform_connections
DROP POLICY IF EXISTS "Allow all operations" ON platform_connections;
DROP POLICY IF EXISTS "platform_connections_all" ON platform_connections;

CREATE POLICY "platform_connections_own" ON platform_connections
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "platform_connections_service_role" ON platform_connections
  FOR ALL USING (auth.role() = 'service_role');

-- voice_profile
DROP POLICY IF EXISTS "Allow all operations" ON voice_profile;
DROP POLICY IF EXISTS "voice_profile_all" ON voice_profile;

CREATE POLICY "voice_profile_own" ON voice_profile
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "voice_profile_service_role" ON voice_profile
  FOR ALL USING (auth.role() = 'service_role');

-- agent_config
DROP POLICY IF EXISTS "Allow all operations" ON agent_config;
DROP POLICY IF EXISTS "agent_config_all" ON agent_config;

CREATE POLICY "agent_config_own" ON agent_config
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_config_service_role" ON agent_config
  FOR ALL USING (auth.role() = 'service_role');

-- analytics
DROP POLICY IF EXISTS "Allow all operations" ON analytics;

CREATE POLICY "analytics_own" ON analytics
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "analytics_service_role" ON analytics
  FOR ALL USING (auth.role() = 'service_role');
