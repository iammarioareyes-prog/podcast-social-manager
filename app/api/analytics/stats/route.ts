import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GRAPH = "https://graph.facebook.com/v19.0";

// ── Token refresh helpers ──────────────────────────────────────────────────

async function getFreshYouTubeToken(conn: {
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
}): Promise<string> {
  // If token hasn't expired yet (with 2-min buffer), use it as-is
  if (conn.token_expires_at) {
    const expiresAt = new Date(conn.token_expires_at).getTime();
    if (Date.now() < expiresAt - 120_000) return conn.access_token;
  }

  if (!conn.refresh_token) return conn.access_token; // best effort

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (data.error || !data.access_token) {
    console.error("YouTube token refresh failed:", data);
    return conn.access_token; // fall back to old token
  }

  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await supabase
    .from("platform_connections")
    .update({
      access_token: data.access_token,
      token_expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("platform", "youtube");

  return data.access_token;
}

async function getFreshTikTokToken(conn: {
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
}): Promise<string> {
  if (conn.token_expires_at) {
    const expiresAt = new Date(conn.token_expires_at).getTime();
    if (Date.now() < expiresAt - 120_000) return conn.access_token;
  }

  if (!conn.refresh_token) return conn.access_token;

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (data.error || !data.access_token) {
    console.error("TikTok token refresh failed:", data);
    return conn.access_token;
  }

  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await supabase
    .from("platform_connections")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || conn.refresh_token,
      token_expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("platform", "tiktok");

  return data.access_token;
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function GET() {
  const stats = {
    instagram: { followers: 0, posts: 0, connected: false, error: "" },
    youtube:   { subscribers: 0, views: 0, videos: 0, connected: false, error: "" },
    tiktok:    { followers: 0, likes: 0, videos: 0, connected: false, error: "" },
    postsThisMonth: 0,
  };

  // Fetch all connected platform tokens
  const { data: connections } = await supabase
    .from("platform_connections")
    .select("platform, access_token, refresh_token, token_expires_at, platform_user_id, metadata")
    .eq("is_connected", true);

  const byPlatform = Object.fromEntries(
    (connections || []).map((c) => [c.platform, c])
  );

  // ── Instagram ──────────────────────────────────────────────────────────
  const ig = byPlatform["instagram"];
  if (ig?.access_token) {
    try {
      const igId = ig.metadata?.instagram_account_id || ig.platform_user_id;
      const res = await fetch(
        `${GRAPH}/${igId}?fields=followers_count,media_count&access_token=${ig.access_token}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      stats.instagram.followers = data.followers_count ?? 0;
      stats.instagram.posts     = data.media_count ?? 0;
      stats.instagram.connected = true;
    } catch (e: any) {
      stats.instagram.error = e.message;
    }
  }

  // ── YouTube (with auto-refresh) ────────────────────────────────────────
  const yt = byPlatform["youtube"];
  if (yt?.access_token) {
    try {
      const token = await getFreshYouTubeToken(yt);
      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const s = data.items?.[0]?.statistics ?? {};
      stats.youtube.subscribers = parseInt(s.subscriberCount ?? "0", 10);
      stats.youtube.views       = parseInt(s.viewCount ?? "0", 10);
      stats.youtube.videos      = parseInt(s.videoCount ?? "0", 10);
      stats.youtube.connected   = true;
    } catch (e: any) {
      stats.youtube.error = e.message;
    }
  }

  // ── TikTok (with auto-refresh) ─────────────────────────────────────────
  const tt = byPlatform["tiktok"];
  if (tt?.access_token) {
    try {
      const token = await getFreshTikTokToken(tt);
      const res = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,likes_count,video_count",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.error?.code && data.error.code !== "ok") throw new Error(data.error.message);
      const u = data.data?.user ?? {};
      stats.tiktok.followers = u.follower_count ?? 0;
      stats.tiktok.likes     = u.likes_count ?? 0;
      stats.tiktok.videos    = u.video_count ?? 0;
      stats.tiktok.connected = true;
    } catch (e: any) {
      stats.tiktok.error = e.message;
    }
  }

  // ── Posts this month (from Supabase) ───────────────────────────────────
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .gte("published_at", startOfMonth.toISOString());

  stats.postsThisMonth = count ?? 0;

  return NextResponse.json(stats);
}
