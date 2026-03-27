import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

/**
 * POST /api/analytics/sync
 * Sync analytics from all connected platforms to Supabase
 * This should be called periodically (e.g., via Vercel Cron Jobs)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // Get all connected platforms
    const { data: connections } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("is_connected", true);

    const results: Record<string, { success: boolean; message: string; count?: number }> = {};

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        message: "No platforms connected",
        results: {},
      });
    }

    for (const connection of connections) {
      try {
        if (connection.platform === "youtube") {
          // TODO: Fetch from YouTube Analytics API
          // const analytics = await getYouTubeVideoAnalytics(...)
          results.youtube = {
            success: true,
            message: "TODO: Sync YouTube analytics",
            count: 0,
          };
        } else if (connection.platform === "instagram") {
          // TODO: Fetch from Instagram Graph API
          results.instagram = {
            success: true,
            message: "TODO: Sync Instagram insights",
            count: 0,
          };
        } else if (connection.platform === "tiktok") {
          // TODO: Fetch from TikTok API
          results.tiktok = {
            success: true,
            message: "TODO: Sync TikTok analytics",
            count: 0,
          };
        }
      } catch (err) {
        results[connection.platform] = {
          success: false,
          message: err instanceof Error ? err.message : "Sync failed",
        };
      }
    }

    // Insert mock analytics data for demo
    const { data: posts } = await supabase
      .from("posts")
      .select("id, platforms")
      .eq("status", "published")
      .limit(10);

    if (posts && posts.length > 0) {
      const analyticsRecords = posts.flatMap((post) =>
        (post.platforms as string[]).map((platform) => ({
          post_id: post.id,
          platform,
          views: Math.floor(Math.random() * 50000) + 1000,
          likes: Math.floor(Math.random() * 3000) + 100,
          comments: Math.floor(Math.random() * 300) + 10,
          shares: Math.floor(Math.random() * 1000) + 50,
          saves: Math.floor(Math.random() * 500) + 20,
          watch_time_hours: Math.random() * 200 + 10,
          click_through_rate: Math.random() * 8 + 2,
          impressions: Math.floor(Math.random() * 200000) + 10000,
          reach: Math.floor(Math.random() * 150000) + 8000,
          engagement_rate: Math.random() * 10 + 3,
          recorded_at: new Date().toISOString(),
        }))
      );

      await supabase.from("analytics").insert(analyticsRecords);
    }

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error("Analytics sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync analytics" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/sync
 * Get the last sync status
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    lastSyncedAt: new Date(Date.now() - 3600000).toISOString(),
    nextSyncAt: new Date(Date.now() + 3600000).toISOString(),
    status: "healthy",
    message: "Configure Vercel Cron Jobs to auto-sync analytics",
  });
}
