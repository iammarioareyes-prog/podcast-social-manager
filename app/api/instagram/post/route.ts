import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GRAPH = "https://graph.facebook.com/v19.0";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const { postId, caption, videoUrl } = await req.json();

    // caption must be a non-empty string; videoUrl is the drive-proxy URL
    const effectiveCaption = caption || "";
    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    const { data: conn } = await supabase
      .from("platform_connections")
      .select("access_token, platform_user_id, metadata")
      .eq("platform", "instagram")
      .eq("is_connected", true)
      .single();

    if (!conn?.access_token) {
      return NextResponse.json({ error: "Instagram not connected" }, { status: 401 });
    }

    const igId = conn.metadata?.instagram_account_id || conn.platform_user_id;
    if (!igId) {
      return NextResponse.json({ error: "Instagram account ID not found in connection" }, { status: 400 });
    }

    const token = conn.access_token;

    // Append brand hashtags from voice_profile settings
    let finalCaption = effectiveCaption;
    const { data: vpData } = await supabase
      .from("voice_profile")
      .select("ig_hashtags")
      .limit(1)
      .maybeSingle();

    const brandHashtags: string[] = vpData?.ig_hashtags || [];
    if (brandHashtags.length > 0) {
      const tagString = brandHashtags
        .map((t) => (t.startsWith("#") ? t : `#${t}`))
        .join(" ");
      finalCaption = `${caption}\n\n${tagString}`;
    }

    // Step 1: Create media container
    // videoUrl is the drive-proxy URL which issues a 302 redirect to Google Drive.
    // Instagram's CDN follows the redirect and downloads from Google directly.
    const containerParams = new URLSearchParams({
      media_type: "REELS",
      video_url: videoUrl,
      caption: finalCaption,
      access_token: token,
    });
    if (coverUrl) containerParams.set("cover_url", coverUrl);

    const containerRes = await fetch(`${GRAPH}/${igId}/media`, {
      method: "POST",
      body: containerParams,
    });
    const containerData = await containerRes.json();

    if (!containerRes.ok || containerData.error) {
      console.error("Instagram container error:", containerData);
      return NextResponse.json(
        { error: containerData.error?.message || "Failed to create media container" },
        { status: 502 }
      );
    }

    const containerId = containerData.id;

    // Step 2: Poll until container is FINISHED processing
    let statusCode = "IN_PROGRESS";
    let attempts = 0;
    // Poll every 3s up to 10 times (30s max) — sub-function must complete well under 60s
    while (statusCode === "IN_PROGRESS" && attempts < 10) {
      await new Promise((r) => setTimeout(r, 3000));
      const statusRes = await fetch(
        `${GRAPH}/${containerId}?fields=status_code&access_token=${token}`
      );
      const statusData = await statusRes.json();
      statusCode = statusData.status_code ?? "ERROR";
      attempts++;
    }

    if (statusCode !== "FINISHED") {
      return NextResponse.json(
        { error: `Media processing ended with status: ${statusCode}` },
        { status: 502 }
      );
    }

    // Step 3: Publish
    const publishRes = await fetch(`${GRAPH}/${igId}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: containerId, access_token: token }),
    });
    const publishData = await publishRes.json();

    if (!publishRes.ok || publishData.error) {
      console.error("Instagram publish error:", publishData);
      return NextResponse.json(
        { error: publishData.error?.message || "Failed to publish" },
        { status: 502 }
      );
    }

    const mediaId = publishData.id;

    if (postId) {
      await supabase
        .from("posts")
        .update({
          platform_post_ids: { instagram: mediaId },
          status: "published",
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);
    }

    return NextResponse.json({
      success: true,
      mediaId,
      permalink: `https://www.instagram.com/reel/${mediaId}/`,
    });
  } catch (error) {
    console.error("Instagram post error:", error);
    return NextResponse.json({ error: "Failed to post to Instagram" }, { status: 500 });
  }
}
