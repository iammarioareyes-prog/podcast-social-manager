import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

/**
 * POST /api/tiktok/post
 * Upload and publish a TikTok video
 * TODO: Implement with TikTok Content Posting API
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      postId,
      title,
      videoUrl,
      privacyLevel = "PUBLIC_TO_EVERYONE",
      disableDuet = false,
      disableComment = false,
      disableStitch = false,
    } = body;

    if (!postId || !title || !videoUrl) {
      return NextResponse.json(
        { error: "postId, title, and videoUrl are required" },
        { status: 400 }
      );
    }

    // TODO: Get access token from platform_connections
    const supabase = createServerSupabaseClient();
    const { data: connection } = await supabase
      .from("platform_connections")
      .select("access_token, platform_user_id")
      .eq("platform", "tiktok")
      .eq("is_connected", true)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "TikTok is not connected. Please connect in Settings." },
        { status: 401 }
      );
    }

    // TODO: Step 1 - Initialize post
    // POST https://open.tiktokapis.com/v2/post/publish/video/init/
    // {
    //   post_info: { title, privacy_level: privacyLevel, disable_duet, disable_comment, disable_stitch },
    //   source_info: { source: 'PULL_FROM_URL', video_url: videoUrl }
    // }

    // TODO: Step 2 - Check publish status
    // POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
    // { publish_id: publishId }

    // Mock response
    const mockPublishId = `tt_${Date.now()}`;

    // Update post record
    await supabase
      .from("posts")
      .update({
        platform_post_ids: { tiktok: mockPublishId },
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    return NextResponse.json({
      success: true,
      publishId: mockPublishId,
      message: "TODO: Replace with actual TikTok Content Posting API call",
    });
  } catch (error) {
    console.error("TikTok post error:", error);
    return NextResponse.json(
      { error: "Failed to post to TikTok" },
      { status: 500 }
    );
  }
}
