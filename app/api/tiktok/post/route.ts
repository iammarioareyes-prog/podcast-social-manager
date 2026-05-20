import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAgentSupabaseClient, getDriveAccessToken } from "@/lib/agent-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIKTOK_API = "https://open.tiktokapis.com/v2";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  let ttPermissionId: string | null = null;
  let ttPermFileId: string | null = null;

  try {
    const {
      postId,
      title,
      videoUrl,
      driveFileId,
      privacyLevel = "PUBLIC_TO_EVERYONE",
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
            client_key: process.env.TIKTOK_CLIENT_KEY!,
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

    // ── Resolve video URL (Drive public permission) ───────────────────────────
    // TikTok's servers pull the video via PULL_FROM_URL. They can't reach our
    // Vercel drive-proxy (cold-start timeout). Same fix as Instagram: grant a
    // temporary anyone/reader permission on the Drive file and pass the direct
    // usercontent URL. Permission is revoked after the init call succeeds.
    let ttVideoUrl = videoUrl;
    const fileId = videoUrl.includes("/api/drive-proxy/")
      ? videoUrl.split("/api/drive-proxy/")[1]?.split("?")[0]
      : null;

    if (fileId) {
      const agentSupabase = createAgentSupabaseClient();
      const driveToken = await getDriveAccessToken(agentSupabase);
      if (driveToken) {
        const permRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${driveToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ role: "reader", type: "anyone" }),
          }
        );
        if (permRes.ok) {
          const permData = await permRes.json();
          ttPermissionId = permData.id as string;
          ttPermFileId = fileId;
          ttVideoUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`;
          console.log(`[TT] Drive public URL: ${ttVideoUrl}`);
        } else {
          console.warn(`[TT] Drive permission grant failed — using proxy URL`);
        }
      }
    }

    // Step 1: Initialize the post with PULL_FROM_URL
    // post_mode: MEDIA_UPLOAD uses video.upload scope (uploads to inbox/drafts).
    // Switch to DIRECT_POST once video.publish scope is approved by TikTok.
    const initRes = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: finalTitle.slice(0, 2200),
          privacy_level: privacyLevel,
          disable_duet: disableDuet,
          disable_comment: disableComment,
          disable_stitch: disableStitch,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: ttVideoUrl,
        },
        post_mode: "MEDIA_UPLOAD",
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

    // Revoke Drive public permission (non-blocking)
    if (ttPermFileId && ttPermissionId) {
      const agentSupabase2 = createAgentSupabaseClient();
      getDriveAccessToken(agentSupabase2).then((tok) => {
        if (!tok) return;
        fetch(
          `https://www.googleapis.com/drive/v3/files/${ttPermFileId}/permissions/${ttPermissionId}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${tok}` } }
        ).catch(() => {});
      }).catch(() => {});
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
    // Revoke Drive permission on error too
    if (ttPermFileId && ttPermissionId) {
      const agentSupabase3 = createAgentSupabaseClient();
      getDriveAccessToken(agentSupabase3).then((tok) => {
        if (!tok) return;
        fetch(
          `https://www.googleapis.com/drive/v3/files/${ttPermFileId}/permissions/${ttPermissionId}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${tok}` } }
        ).catch(() => {});
      }).catch(() => {});
    }
    return NextResponse.json({ error: "Failed to post to TikTok" }, { status: 500 });
  }
}
