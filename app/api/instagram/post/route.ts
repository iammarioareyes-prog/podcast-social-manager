import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAgentSupabaseClient, getDriveAccessToken } from "@/lib/agent-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GRAPH = "https://graph.facebook.com/v21.0";
const TEMP_BUCKET = "ig-temp";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  let tempStorageKey: string | null = null;

  try {
    const { postId, caption, videoUrl } = await req.json();

    const effectiveCaption = caption || "";
    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    const fileId = videoUrl.includes("/api/drive-proxy/")
      ? videoUrl.split("/api/drive-proxy/")[1]?.split("?")[0]
      : null;

    // ── Instagram connection ─────────────────────────────────────────────────
    const { data: conn } = await supabase
      .from("platform_connections")
      .select("access_token, platform_user_id, metadata, token_expires_at")
      .eq("platform", "instagram")
      .eq("is_connected", true)
      .single();

    if (!conn?.access_token) {
      return NextResponse.json({ error: "Instagram not connected" }, { status: 401 });
    }
    if (conn.token_expires_at && Date.now() >= new Date(conn.token_expires_at).getTime()) {
      return NextResponse.json(
        { error: "Instagram token expired — please reconnect Instagram in Settings" },
        { status: 401 }
      );
    }

    const igId = conn.metadata?.instagram_account_id || conn.platform_user_id;
    if (!igId) {
      return NextResponse.json(
        { error: "Instagram account ID not found — please reconnect Instagram in Settings" },
        { status: 400 }
      );
    }

    const token = conn.access_token;

    // ── Caption + hashtags ────────────────────────────────────────────────────
    let finalCaption = effectiveCaption;
    const { data: vpData } = await supabase
      .from("voice_profile")
      .select("ig_hashtags")
      .limit(1)
      .maybeSingle();
    const brandHashtags: string[] = vpData?.ig_hashtags || [];
    if (brandHashtags.length > 0) {
      const tagString = brandHashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
      finalCaption = `${effectiveCaption}\n\n${tagString}`;
    }

    // ── Resolve video URL ─────────────────────────────────────────────────────
    // When the video is a Drive file: download bytes server-side, stage them in
    // Supabase Storage (public bucket), then hand Instagram a stable CDN URL.
    //
    // Why not use the drive-proxy URL directly? Instagram's CDN times out
    // waiting for a cold-start Vercel function to begin streaming.
    //
    // Why not use Facebook's resumable-upload API? Returns 400
    // ProcessingFailedError due to undocumented format constraints.
    //
    // Supabase Storage CDN is always fast and publicly accessible — Instagram
    // downloads it without issues.
    let igVideoUrl = videoUrl;

    if (fileId) {
      const agentSupabase = createAgentSupabaseClient();
      const driveToken = await getDriveAccessToken(agentSupabase);

      if (!driveToken) {
        return NextResponse.json(
          { error: "Google Drive not connected — cannot fetch video for Instagram upload" },
          { status: 503 }
        );
      }

      // Download video bytes from Drive
      console.log(`[IG] Downloading Drive file ${fileId}…`);
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${driveToken}` }, redirect: "follow" }
      );

      if (!driveRes.ok) {
        const errText = await driveRes.text().catch(() => "");
        console.error(`[IG] Drive fetch failed ${driveRes.status}: ${errText.slice(0, 200)}`);
        return NextResponse.json(
          { error: `Failed to fetch video from Google Drive (${driveRes.status})` },
          { status: 502 }
        );
      }

      const videoBytes = await driveRes.arrayBuffer();
      const contentType = driveRes.headers.get("content-type") || "video/mp4";
      console.log(`[IG] Downloaded ${videoBytes.byteLength} bytes (${contentType})`);

      // Stage in Supabase Storage — creates a stable public CDN URL for Instagram
      await supabase.storage.createBucket(TEMP_BUCKET, { public: true }).catch(() => {});
      tempStorageKey = `${fileId}-${Date.now()}.mp4`;

      const { error: storageErr } = await supabase.storage
        .from(TEMP_BUCKET)
        .upload(tempStorageKey, videoBytes, { contentType: "video/mp4", upsert: true });

      if (storageErr) {
        console.error(`[IG] Supabase Storage upload failed:`, storageErr);
        return NextResponse.json(
          { error: `Staging upload failed: ${storageErr.message}` },
          { status: 502 }
        );
      }

      const { data: urlData } = supabase.storage.from(TEMP_BUCKET).getPublicUrl(tempStorageKey);
      igVideoUrl = urlData.publicUrl;
      console.log(`[IG] Staged at: ${igVideoUrl}`);
    }

    // ── Create media container (standard video_url approach) ─────────────────
    console.log(`[IG] Creating container for account ${igId}…`);
    const containerRes = await fetch(`${GRAPH}/${igId}/media`, {
      method: "POST",
      body: new URLSearchParams({
        media_type: "REELS",
        video_url: igVideoUrl,
        caption: finalCaption,
        access_token: token,
      }),
    });
    const containerData = await containerRes.json();

    if (!containerRes.ok || containerData.error) {
      console.error("[IG] Container error:", JSON.stringify(containerData));
      return NextResponse.json(
        { error: `Instagram container error: ${containerData.error?.message || JSON.stringify(containerData)}` },
        { status: 502 }
      );
    }

    const containerId = containerData.id;
    console.log(`[IG] Container ${containerId} created`);

    // ── Poll until FINISHED ───────────────────────────────────────────────────
    let statusCode = "IN_PROGRESS";
    let lastStatus = "";
    let attempts = 0;

    while (statusCode === "IN_PROGRESS" && attempts < 15) {
      await new Promise((r) => setTimeout(r, 3000));
      const statusRes = await fetch(
        `${GRAPH}/${containerId}?fields=status_code,status&access_token=${token}`
      );
      const statusData = await statusRes.json();
      statusCode = (statusData.status_code as string) ?? "ERROR";
      lastStatus = (statusData.status as string) ?? "";
      console.log(`[IG] Poll ${attempts + 1}: ${statusCode} — ${lastStatus}`);
      attempts++;
      if (statusCode === "FINISHED") break;
    }

    if (statusCode !== "FINISHED") {
      const detail = lastStatus || `no detail after ${attempts} polls`;
      console.error(`[IG] Not finished: ${statusCode} — ${detail}`);
      return NextResponse.json(
        { error: `Instagram processing ended with status: ${statusCode} — ${detail}` },
        { status: 502 }
      );
    }

    // ── Publish ───────────────────────────────────────────────────────────────
    console.log(`[IG] Publishing container ${containerId}…`);
    const publishRes = await fetch(`${GRAPH}/${igId}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: containerId, access_token: token }),
    });
    const publishData = await publishRes.json();

    if (!publishRes.ok || publishData.error) {
      console.error("[IG] Publish error:", JSON.stringify(publishData));
      return NextResponse.json(
        { error: `Instagram publish failed: ${publishData.error?.message || JSON.stringify(publishData)}` },
        { status: 502 }
      );
    }

    const mediaId = publishData.id;
    console.log(`[IG] Published — mediaId=${mediaId}`);

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

    // Clean up staging file (non-blocking — don't fail the request if this errors)
    if (tempStorageKey) {
      supabase.storage.from(TEMP_BUCKET).remove([tempStorageKey]).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      mediaId,
      permalink: `https://www.instagram.com/reel/${mediaId}/`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[IG] Unhandled error:", msg, error);
    // Clean up staging file on error too
    if (tempStorageKey) {
      supabase.storage.from(TEMP_BUCKET).remove([tempStorageKey]).catch(() => {});
    }
    return NextResponse.json({ error: `Instagram internal error: ${msg}` }, { status: 500 });
  }
}
