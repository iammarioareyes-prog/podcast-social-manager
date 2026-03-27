-- ============================================================
-- Podcast Social Manager - Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- Posts table
-- ============================================================
create table if not exists posts (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  caption text,
  hashtags text[],
  platforms text[] not null,  -- ['youtube', 'instagram', 'tiktok']
  status text default 'draft' check (status in ('draft', 'scheduled', 'published', 'failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  content_url text,
  thumbnail_url text,
  platform_post_ids jsonb default '{}',  -- {youtube: 'abc', instagram: 'def', tiktok: 'ghi'}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger posts_updated_at
  before update on posts
  for each row execute procedure update_updated_at_column();

-- ============================================================
-- Analytics table (cached from platforms)
-- ============================================================
create table if not exists analytics (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade,
  platform text not null check (platform in ('youtube', 'instagram', 'tiktok')),
  platform_post_id text,
  views bigint default 0,
  likes bigint default 0,
  comments bigint default 0,
  shares bigint default 0,
  saves bigint default 0,
  watch_time_hours numeric default 0,
  click_through_rate numeric default 0,
  impressions bigint default 0,
  reach bigint default 0,
  engagement_rate numeric default 0,
  recorded_at timestamptz default now()
);

-- Index for fast queries
create index if not exists analytics_post_id_idx on analytics(post_id);
create index if not exists analytics_platform_idx on analytics(platform);
create index if not exists analytics_recorded_at_idx on analytics(recorded_at);

-- ============================================================
-- Platform connections table
-- ============================================================
create table if not exists platform_connections (
  id uuid default gen_random_uuid() primary key,
  platform text not null unique check (platform in ('youtube', 'instagram', 'tiktok', 'google_drive')),
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  platform_user_id text,
  platform_username text,
  is_connected boolean default false,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger platform_connections_updated_at
  before update on platform_connections
  for each row execute procedure update_updated_at_column();

-- Insert default platform connection records
insert into platform_connections (platform, is_connected)
values
  ('youtube', false),
  ('instagram', false),
  ('tiktok', false),
  ('google_drive', false)
on conflict (platform) do nothing;

-- ============================================================
-- Content items table (from Google Drive / Opus Clips)
-- ============================================================
create table if not exists content_items (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  type text not null check (type in ('full_episode', 'short', 'thumbnail', 'audio')),
  duration_seconds integer,
  file_url text,
  thumbnail_url text,
  google_drive_id text unique,
  supabase_storage_path text,
  file_size_bytes bigint,
  mime_type text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists content_items_type_idx on content_items(type);
create index if not exists content_items_google_drive_id_idx on content_items(google_drive_id);

-- ============================================================
-- RLS Policies (Row Level Security)
-- For single-user apps, allow all operations
-- Adjust these for multi-tenant use cases
-- ============================================================
alter table posts enable row level security;
alter table analytics enable row level security;
alter table platform_connections enable row level security;
alter table content_items enable row level security;

-- Allow all operations for authenticated and anonymous users
-- TODO: Replace with proper auth policies in production
create policy "Allow all on posts" on posts for all using (true);
create policy "Allow all on analytics" on analytics for all using (true);
create policy "Allow all on platform_connections" on platform_connections for all using (true);
create policy "Allow all on content_items" on content_items for all using (true);

-- ============================================================
-- Sample data for development
-- ============================================================
insert into posts (title, description, platforms, status, published_at, platform_post_ids) values
  (
    'Episode 47: The Future of AI in Podcasting',
    'Deep dive into how AI is transforming podcast creation and distribution',
    array['youtube', 'instagram', 'tiktok'],
    'published',
    now() - interval '5 days',
    '{"youtube": "yt_abc123", "instagram": "ig_def456", "tiktok": "tt_ghi789"}'::jsonb
  ),
  (
    'Episode 46 Highlights: Best Moments',
    'Top clips from our conversation about building in public',
    array['instagram', 'tiktok'],
    'published',
    now() - interval '8 days',
    '{"instagram": "ig_jkl012", "tiktok": "tt_mno345"}'::jsonb
  ),
  (
    'Episode 48: Behind the Scenes',
    'A behind-the-scenes look at how we produce the podcast',
    array['youtube', 'instagram'],
    'scheduled',
    null,
    '{}'::jsonb
  )
on conflict do nothing;
