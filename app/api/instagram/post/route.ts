import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GRAPH = "https://graph.facebook.com/v21.0";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const { postId, caption, videoUrl } = await req.json();

    const effectiveCaption = caption || "";
    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    const { data: conn } = await supabase
      .from("platform_connections")
      .select("access_token, platform_user_id, metadata, token_expires_at")
      .eq("platform", "instagram")
      .eq("is_connected", true)
      .single();

    if (!conn?.access_token) {
      return NextResponse.json({ error: "Instagram not connected" }, { status: 401 });
    }

    // Guard: surface a clear error if the token is expired so the UI shows
    // "reconnect Instagram" rather than a cryptic API error.
    if (conn.token_expires_at) {
      const expiresAt = new Date(conn.token_expires_at).getTime();
      if (Date.now() >= expiresAt) {
        return NextResponse.json(
          { error: "Instagram token expired — please reconnect Instagram in Settings" },
          { status: 401 }
        );
      }
    }

    const igId = conn.metadata?.instagram_account_id || conn.platform_user_id;
    if (!igId) {
      return NextResponse.json(
        { error: "Instagram account ID not found — please reconnect Instagram in Settings" },
        { status: 400 }
      );
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
      finalCaption = `${effectiveCaption}\n\n${tagString}`;
    }

    // Step 1: Create media container.
    // videoUrl points to our drive-proxy which streams video bytes directly —
    // no redirect chains, no short-lived signed URLs.
    const containerParams = new URLSearchParams({
      media_type: "REELS",
      video_url: videoUrl,
      caption: finalCaption,
      access_token: token,
    });

    console.log(`[IG] Creating container for IG account ${igId}, videoUrl=${videoUrl}`);
    const containerRes = await fetch(`${GRAPH}/${igId}/media`, {
      method: "POST",
      body: containerParams,
    });
    const containerData = await containerRes.json();

    if (!containerRes.ok || containerData.error) {
      const errMsg = containerData.error?.message || JSON.stringify(containerData);
      console.error("[IG] Container creation failed:", JSON.stringify(containerData));
      return NextResponse.json(
        { error: `Instagram container error: ${errMsg}` },
        { status: 502 }
      );
    }

    const containerId = containerData.id;
    console.log(`[IG] Container created: ${containerId}`);

    // Step 2: Poll until container is FINISHED processing.
    // Poll up to 20 times (every 3s = 60s max) to give Vercel's 60s limit
    // the best chance of capturing FINISHED before timeout.
    let statusCode = "IN_PROGRESS";
    let lastStatusData: Record<string, unknown> = {};
    let attempts = 0;

    while ((statusCode === "IN_PROGRESS" || statusCode === "PUBLISHED") && attempts < 20) {
      await new Promise((r) => setTimeout(r, 3000));
      const statusRes = await fetch(
        `${GRAPH}/${containerId}?fields=status_code,error_code,error_message,video_status&access_token=${token}`
      );
      lastStatusData = await statusRes.json();
      statusCode = (lastStatusData.status_code as string) ?? "ERROR";
      console.log(`[IG] Container ${containerId} poll ${attempts + 1}: ${statusCode}`, JSON.stringify(lastStatusData));
      attempts++;
      if (statusCode === "FINISHED") break;
    }

    if (statusCode !== "FINISHED") {
      const detail = lastStatusData.error_code
        ? `error_code=${lastStatusData.error_code}, error_message=${lastStatusData.error_message ?? "none"}`
        : `video_status=${lastStatusData.video_status ?? "none"}`;
      console.error("[IG] Container not finished:", JSON.stringify(lastStatusData));
      return NextResponse.json(
        { error: `Instagram processing ended with status: ${statusCode} — ${detail}` },
        { status: 502 }
      );
    }

    // Step 3: Publish
    console.log(`[IG] Publishing container ${containerId}`);
    const publishRes = await fetch(`${GRAPH}/${igId}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: containerId, access_token: token }),
    });
    const publishData = await publishRes.json();

    if (!publishRes.ok || publishData.error) {
      const errMsg = publishData.error?.message || JSON.stringify(publishData);
      console.error("[IG] Publish failed:", JSON.stringify(publishData));
      return NextResponse.json(
        { error: `Instagram publish failed: ${errMsg}` },
        { status: 502 }
      );
    }

    const mediaId = publishData.id;
    console.log(`[IG] Published successfully: mediaId=${mediaId}`);

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
