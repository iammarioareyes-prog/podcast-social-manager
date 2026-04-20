import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GRAPH = "https://graph.facebook.com/v19.0";

export async function GET() {
  const stats = {
    instagram: { followers: 0, posts: 0, connected: false, error: "" },
    youtube:   { subscribers: 0, views: 0, videos: 0, connected: false, error: "" },
    tiktok:    { followers: 0, likes: 0, videos: 0, connected: false, error: "" },
    postsThisMonth: 0,
  };

  // ── Fetch all connected platform tokens ────────────────────────────────
  const { data: connections } = await supabase
    .from("platform_connections")
    .select("platform, access_token, platform_user_id, metadata")
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

  // ── YouTube ────────────────────────────────────────────────────────────
  const yt = byPlatform["youtube"];
  if (yt?.access_token) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true`,
        { headers: { Authorization: `Bearer ${yt.access_token}` } }
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

  // ── TikTok ─────────────────────────────────────────────────────────────
  const tt = byPlatform["tiktok"];
  if (tt?.access_token) {
    try {
      const res = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,likes_count,video_count",
        { headers: { Authorization: `Bearer ${tt.access_token}` } }
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
