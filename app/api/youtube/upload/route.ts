import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/youtube/upload
 * Upload a video to YouTube Shorts
 * TODO: Implement actual YouTube Data API v3 upload
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postId, title, description, tags, privacyStatus = "public" } = body;

    if (!postId || !title) {
      return NextResponse.json(
        { error: "postId and title are required" },
        { status: 400 }
      );
    }

    // TODO: Get access token from platform_connections table
    const supabase = createServerSupabaseClient();
    const { data: connection } = await supabase
      .from("platform_connections")
      .select("access_token, refresh_token, token_expires_at")
      .eq("platform", "youtube")
      .eq("is_connected", true)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "YouTube is not connected. Please connect in Settings." },
        { status: 401 }
      );
    }

    // TODO: Check if token needs refresh
    // if (new Date(connection.token_expires_at) < new Date()) {
    //   const refreshed = await refreshYouTubeToken(connection.refresh_token);
    //   // update token in DB
    // }

    // TODO: Implement actual YouTube upload
    // const youtube = google.youtube({ version: 'v3' });
    // const response = await youtube.videos.insert({...})

    // Mock response for now
    const mockVideoId = `yt_${Date.now()}`;

    // Update post with YouTube video ID
    await supabase
      .from("posts")
      .update({
        platform_post_ids: { youtube: mockVideoId },
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    return NextResponse.json({
      success: true,
      videoId: mockVideoId,
      url: `https://youtube.com/shorts/${mockVideoId}`,
      message: "TODO: Replace with actual YouTube API upload",
    });
  } catch (error) {
    console.error("YouTube upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload to YouTube" },
      { status: 500 }
    );
  }
}
