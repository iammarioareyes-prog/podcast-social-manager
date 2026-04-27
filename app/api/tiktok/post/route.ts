import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIKTOK_API = "https://open.tiktokapis.com/v2";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const {
      postId,
      title,
      videoUrl,
      driveFileId,
      privacyLevel = "SELF_ONLY",
      disableDuet = false,
      disableComment = false,
      disableStitch = false,
    } = await req.json();

    if (!title || !videoUrl) {
      return NextResponse.json(
        { error: "title and videoUrl are required" },
        { status: 400 }
      );
    }

    // Get TikTok connection
    const { data: conn } = await supabase
      .from("platform_connections")
      .select("access_token, refresh_token, token_expires_at, platform_user_id")
      .eq("platform", "tiktok")
      .eq("is_connected", true)
      .single();

    if (!conn?.access_token) {
      return NextResponse.json({ error: "TikTok not connected" }, { status: 401 });
    }

    // Refresh token if needed
    let token = conn.access_token;
    if (conn.token_expires_at) {
      const expiresAt = new Date(conn.token_expires_at).getTime();
      if (Date.now() > expiresAt - 60000 && conn.refresh_token) {
        const refreshRes = await fetch(`${TIKTOK_API}/oauth/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_key: process.env.TIKTOK_CLIENT_ID!,
            client_secret: process.env.TIKTOK_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: conn.refresh_token,
          }),
        });
        const refreshed = await refreshRes.json();
        if (refreshed.data?.access_token) {
          token = refreshed.data.access_token;
          await supabase
            .from("platform_connections")
            .update({
              access_token: refreshed.data.access_token,
              refresh_token: refreshed.data.refresh_token || conn.refresh_token,
              token_expires_at: new Date(
                Date.now() + (refreshed.data.expires_in ?? 86400) * 1000
              ).toISOString(),
            })
            .eq("platform", "tiktok");
        }
      }
    }

    // Resolve the video URL — prefer direct Drive download over proxy
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
    const { data: vpData } = await supabase
      .from("voice_profile")
      .select("tiktok_hashtags")
      .limit(1)
      .maybeSingle();

    const brandHashtags: string[] = vpData?.tiktok_hashtags || [];
    let finalTitle = title;
    if (brandHashtags.length > 0) {
      const tagString = brandHashtags
        .map((t) => (t.startsWith("#") ? t : `#${t}`))
        .join(" ");
      finalTitle = `${title}\n\n${tagString}`;
    }

    // Step 1: Initialize the post with PULL_FROM_URL
    const initRes = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: finalTitle.slice(0, 2200), // TikTok description max 2200 chars
          privacy_level: privacyLevel,
          disable_duet: disableDuet,
          disable_comment: disableComment,
          disable_stitch: disableStitch,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: finalVideoUrl,
        },
      }),
    });

    const initData = await initRes.json();

    if (!initRes.ok || initData.error?.code !== "ok") {
      console.error("TikTok init error:", initData);
      return NextResponse.json(
        {
          error:
            initData.error?.message ||
            initData.error?.code ||
            "Failed to initialize TikTok post",
        },
        { status: 502 }
      );
    }

    const publishId = initData.data?.publish_id;
    if (!publishId) {
      return NextResponse.json(
        { error: "No publish_id returned from TikTok" },
        { status: 502 }
      );
    }

    // Step 2: Poll publish status (TikTok processes video asynchronously)
    // 4s × 8 = 32s max — keeps sub-function well under 60s limit
    let publishStatus = "PROCESSING_UPLOAD";
    let attempts = 0;
    while (
      (publishStatus === "PROCESSING_UPLOAD" || publishStatus === "PROCESSING_DOWNLOAD") &&
      attempts < 8
    ) {
      await new Promise((r) => setTimeout(r, 4000));
      const statusRes = await fetch(`${TIKTOK_API}/post/publish/status/fetch/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ publish_id: publishId }),
      });
      const statusData = await statusRes.json();
      publishStatus = statusData.data?.status ?? "FAILED";
      attempts++;
    }

    // If still processing after 60s, we return the publish_id and mark as pending
    // TikTok may still succeed asynchronously
    const isPublished = publishStatus === "PUBLISH_COMPLETE";
    const isFailed =
      publishStatus === "FAILED" || publishStatus === "ERROR";

    if (isFailed) {
      return NextResponse.json(
        { error: `TikTok publishing failed with status: ${publishStatus}` },
        { status: 502 }
      );
    }

    // Update Supabase post record
    if (postId) {
      await supabase
        .from("posts")
        .update({
          platform_post_ids: { tiktok: publishId },
          status: isPublished ? "published" : "scheduled",
          published_at: isPublished ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);
    }

    return NextResponse.json({
      success: true,
      publishId,
      status: publishStatus,
      message: isPublished
        ? "Video published to TikTok"
        : "Video is being processed by TikTok",
    });
  } catch (error) {
    console.error("TikTok post error:", error);
    return NextResponse.json({ error: "Failed to post to TikTok" }, { status: 500 });
  }
}
