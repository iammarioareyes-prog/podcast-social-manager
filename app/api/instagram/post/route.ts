import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/instagram/post
 * Create an Instagram Reel post
 * TODO: Implement with Instagram Graph API
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postId, caption, videoUrl, coverUrl } = body;

    if (!postId || !caption) {
      return NextResponse.json(
        { error: "postId and caption are required" },
        { status: 400 }
      );
    }

    // TODO: Get access token from platform_connections
    const supabase = createServerSupabaseClient();
    const { data: connection } = await supabase
      .from("platform_connections")
      .select("access_token, platform_user_id")
      .eq("platform", "instagram")
      .eq("is_connected", true)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "Instagram is not connected. Please connect in Settings." },
        { status: 401 }
      );
    }

    // TODO: Step 1 - Create media container
    // POST https://graph.instagram.com/{ig-user-id}/media
    // {
    //   media_type: 'REELS',
    //   video_url: videoUrl,
    //   caption: caption,
    //   cover_url: coverUrl,
    //   access_token: connection.access_token
    // }

    // TODO: Step 2 - Publish the container
    // POST https://graph.instagram.com/{ig-user-id}/media_publish
    // { creation_id: containerId, access_token: connection.access_token }

    // Mock response
    const mockMediaId = `ig_${Date.now()}`;

    // Update post record
    await supabase
      .from("posts")
      .update({
        platform_post_ids: { instagram: mockMediaId },
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    return NextResponse.json({
      success: true,
      mediaId: mockMediaId,
      permalink: `https://www.instagram.com/reel/${mockMediaId}/`,
      message: "TODO: Replace with actual Instagram Graph API call",
    });
  } catch (error) {
    console.error("Instagram post error:", error);
    return NextResponse.json(
      { error: "Failed to post to Instagram" },
      { status: 500 }
    );
  }
}
