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
    const { postId, caption, videoUrl, coverUrl, driveFileId } = await req.json();

    if (!caption || !videoUrl) {
      return NextResponse.json({ error: "caption and videoUrl are required" }, { status: 400 });
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

    // Resolve the video URL — prefer direct Drive download over proxy
    // Instagram's CDN needs to pull from a fast, reliable URL.
    // Direct Drive URL (with access token) is much faster than streaming through the proxy.
    let finalVideoUrl = videoUrl;
    if (driveFileId) {
      const { data: driveConn } = await supabase
        .from("platform_connections")
        .select("access_token, refresh_token, token_expires_at")
        .eq("platform", "google_drive")
        .single();
      let driveAccessToken = driveConn?.access_token;
      // Refresh Drive token if expired
      if (driveConn?.refresh_token) {
        const driveExpiry = driveConn.token_expires_at
          ? new Date(driveConn.token_expires_at).getTime()
          : 0;
        if (Date.now() > driveExpiry - 120_000) {
          const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              refresh_token: driveConn.refresh_token,
              client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
              grant_type: "refresh_token",
            }),
          });
          const refreshed = await refreshRes.json();
          if (refreshed.access_token) {
            driveAccessToken = refreshed.access_token;
            await supabase
              .from("platform_connections")
              .update({
                access_token: refreshed.access_token,
                token_expires_at: new Date(
                  Date.now() + (refreshed.expires_in ?? 3600) * 1000
                ).toISOString(),
              })
              .eq("platform", "google_drive");
          }
        }
      }
      if (driveAccessToken) {
        finalVideoUrl = `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media&access_token=${encodeURIComponent(driveAccessToken)}`;
      }
    }

    // Append brand hashtags from voice_profile settings
    let finalCaption = caption;
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
    const containerParams = new URLSearchParams({
      media_type: "REELS",
      video_url: finalVideoUrl,
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
