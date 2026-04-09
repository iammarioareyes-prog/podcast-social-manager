-- Voice profile table for storing user's writing style and platform settings
CREATE TABLE IF NOT EXISTS voice_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  podcast_name TEXT DEFAULT 'I Am Mario Areyes',
  podcast_description TEXT DEFAULT '',
  voice_summary TEXT DEFAULT '',
  voice_examples TEXT[] DEFAULT '{}',
  tone_keywords TEXT[] DEFAULT '{}',
  emoji_style TEXT DEFAULT '',
  ig_tags TEXT[] DEFAULT '{"iammarioareyes","tamishaharris","mrchrisclassic","jermailshelton","undugubrotherhood"}',
  tiktok_tags TEXT[] DEFAULT '{}',
  youtube_tags TEXT[] DEFAULT '{}',
  ig_hashtags TEXT[] DEFAULT '{}',
  tiktok_hashtags TEXT[] DEFAULT '{}',
  youtube_hashtags TEXT[] DEFAULT '{}'
);
