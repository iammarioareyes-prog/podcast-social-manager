# Podcast Social Manager

AI-powered social media management suite for podcasters. Schedule, publish, and analyze content across YouTube Shorts, Instagram Reels, and TikTok — with Claude AI generating platform-optimized captions and content strategy.

## Features

- **Dashboard** — Overview analytics across all platforms with charts
- **Content Library** — Browse Google Drive files, Opus Clips shorts, drag-and-drop upload
- **Post Scheduler** — Calendar view, multi-platform posting, AI caption generation
- **Analytics** — Detailed metrics, trend charts, best posting times heatmap
- **AI Strategy** — Claude-powered weekly content strategy, caption templates, trending topics
- **Settings** — Connect YouTube, Instagram, TikTok, Google Drive

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **UI**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **AI**: Claude API (claude-opus-4-5) with streaming
- **Charts**: Recharts
- **Deployment**: Vercel (free tier)

## Quick Start

### 1. Install dependencies

```bash
cd podcast-social-manager
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys (see Configuration section below).

### 3. Set up Supabase database

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run the contents of `supabase/migrations/schema.sql`

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Configuration

### Required: Anthropic API Key

1. Get your API key at [console.anthropic.com](https://console.anthropic.com)
2. Add to `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...`

### Required: Supabase

1. Create project at [supabase.com](https://app.supabase.com)
2. Get your project URL and keys from Settings > API
3. Run `supabase/migrations/schema.sql` in the SQL Editor

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Optional: YouTube (Google OAuth)

1. Create project at [Google Cloud Console](https://console.cloud.google.com)
2. Enable YouTube Data API v3 and YouTube Analytics API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URI: `http://localhost:3000/api/auth/youtube/callback`

```
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/auth/youtube/callback
```

### Optional: Instagram (Facebook Graph API)

1. Create app at [Meta for Developers](https://developers.facebook.com/apps)
2. Add Instagram Graph API product
3. Your Instagram account must be a Business or Creator account

```
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
INSTAGRAM_REDIRECT_URI=http://localhost:3000/api/auth/instagram/callback
```

### Optional: TikTok Content Posting API

1. Apply for developer access at [TikTok for Developers](https://developers.tiktok.com)
2. Create an app and request Content Posting API access

```
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
TIKTOK_REDIRECT_URI=http://localhost:3000/api/auth/tiktok/callback
```

### Optional: Google Drive

1. Use the same Google Cloud project as YouTube
2. Enable Google Drive API
3. Add drive.readonly scope to your OAuth credentials

```
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/auth/google-drive/callback
```

## Deployment to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel Dashboard:
# Settings > Environment Variables
```

Analytics sync runs automatically every 6 hours via Vercel Cron Jobs (configured in `vercel.json`).

## Project Structure

```
podcast-social-manager/
├── app/
│   ├── layout.tsx              # Root layout with sidebar
│   ├── page.tsx                # Redirects to /dashboard
│   ├── dashboard/page.tsx      # Main dashboard
│   ├── content/page.tsx        # Content library
│   ├── schedule/page.tsx       # Post scheduler + calendar
│   ├── analytics/page.tsx      # Analytics with charts
│   ├── strategy/page.tsx       # AI strategy (Claude)
│   ├── settings/page.tsx       # Platform connections
│   └── api/
│       ├── claude/strategy/    # Caption generation + strategy streaming
│       ├── posts/              # CRUD for posts
│       ├── youtube/            # YouTube API routes
│       ├── instagram/          # Instagram Graph API routes
│       ├── tiktok/             # TikTok API routes
│       ├── google-drive/       # Google Drive API routes
│       └── analytics/sync/     # Analytics sync (used by cron)
├── components/
│   ├── layout/                 # Sidebar, Header
│   ├── dashboard/              # MetricCard, PlatformChart, etc.
│   ├── schedule/               # PostCreator, CalendarView
│   ├── analytics/              # TrendChart, MetricsTable
│   ├── content/                # ContentGrid
│   └── ui/                     # shadcn/ui base components
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── claude.ts               # Anthropic SDK wrapper
│   ├── youtube.ts              # YouTube API helpers
│   ├── instagram.ts            # Instagram API helpers
│   ├── tiktok.ts               # TikTok API helpers
│   ├── google-drive.ts         # Google Drive helpers
│   └── utils.ts                # Shared utilities
├── types/index.ts              # TypeScript types
└── supabase/migrations/
    └── schema.sql              # Database schema
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/posts` | GET, POST | List/create posts |
| `/api/posts/[id]` | GET, PUT, DELETE | Single post CRUD |
| `/api/claude/strategy` | POST | Generate captions or strategy |
| `/api/youtube/upload` | POST | Upload to YouTube Shorts |
| `/api/youtube/analytics` | GET | YouTube analytics |
| `/api/youtube/channels` | GET | Channel info |
| `/api/instagram/post` | POST | Post Instagram Reel |
| `/api/instagram/insights` | GET | Instagram insights |
| `/api/tiktok/post` | POST | Post TikTok video |
| `/api/tiktok/analytics` | GET | TikTok analytics |
| `/api/google-drive/files` | GET | List Drive files |
| `/api/analytics/sync` | POST | Sync all platform analytics |

## Development Notes

- Platform API calls use **mock data** until OAuth tokens are configured
- Each platform lib file (`lib/youtube.ts`, etc.) has clear `// TODO:` comments marking where to add real API calls
- The app works fully with mock data for UI development
- Claude API calls are real — just add `ANTHROPIC_API_KEY` to test AI features
