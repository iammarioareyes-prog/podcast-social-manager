import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAgentSupabaseClient, getDriveAccessToken } from "@/lib/agent-utils";

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

    // Pull Drive file ID from proxy URL (if applicable)
    const fileId = videoUrl.includes("/api/drive-proxy/")
      ? videoUrl.split("/api/drive-proxy/")[1]?.split("?")[0]
      : null;

    // ── Load Instagram connection ────────────────────────────────────────────
    const { data: conn } = await supabase
      .from("platform_connections")
      .select("access_token, platform_user_id, metadata, token_expires_at")
      .eq("platform", "instagram")
      .eq("is_connected", true)
      .single();

    if (!conn?.access_token) {
      return NextResponse.json({ error: "Instagram not connected" }, { status: 401 });
    }

    if (conn.token_expires_at) {
      if (Date.now() >= new Date(conn.token_expires_at).getTime()) {
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

    // ── Build caption with brand hashtags ────────────────────────────────────
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

    // ── Create media container ────────────────────────────────────────────────
    // When we have a Drive file ID we use the resumable-upload path — we push
    // the bytes directly from our server to Facebook (same pattern as YouTube).
    // This eliminates the "can Instagram CDN reach our Vercel function?" problem
    // that caused every previous ERROR.
    let containerId: string;

    if (fileId) {
      const agentSupabase = createAgentSupabaseClient();
      const driveToken = await getDriveAccessToken(agentSupabase);

      if (!driveToken) {
        return NextResponse.json(
          { error: "Google Drive not connected — cannot fetch video for Instagram upload" },
          { status: 503 }
        );
      }

      // 1a. Fire container creation and Drive metadata fetch in parallel to save time
      console.log(`[IG] Creating resumable container + fetching Drive metadata in parallel…`);
      const [containerRes, metaRes] = await Promise.all([
        fetch(`${GRAPH}/${igId}/media`, {
          method: "POST",
          body: new URLSearchParams({
            media_type: "REELS",
            upload_type: "resumable",
            caption: finalCaption,
            access_token: token,
          }),
        }),
        fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=size,mimeType`,
          { headers: { Authorization: `Bearer ${driveToken}` } }
        ),
      ]);

      const containerData = await containerRes.json();
      if (!containerRes.ok || containerData.error) {
        console.error("[IG] Container creation error:", JSON.stringify(containerData));
        return NextResponse.json(
          { error: `Instagram container error: ${containerData.error?.message || JSON.stringify(containerData)}` },
          { status: 502 }
        );
      }

      containerId = containerData.id;
      const uploadUri: string | undefined = containerData.uri;

      if (!uploadUri) {
        console.error("[IG] No upload URI in container response:", JSON.stringify(containerData));
        return NextResponse.json(
          { error: "Instagram did not return an upload URI — account may not support resumable uploads" },
          { status: 502 }
        );
      }

      const meta = metaRes.ok ? await metaRes.json() : {};
      const contentType: string = meta.mimeType || "video/mp4";
      console.log(`[IG] Container ${containerId} ready, uploadUri obtained. Downloading video from Drive…`);

      // 1b. Download video bytes from Drive into a buffer.
      // Using arrayBuffer() instead of streaming — Vercel's Next.js fetch wrapper does
      // not support piping Response.body directly into another fetch body (throws TypeError).
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
      console.log(`[IG] Downloaded ${videoBytes.byteLength} bytes (${contentType}). Uploading to Facebook…`);

      // 1c. Push the buffered bytes to Facebook's upload endpoint
      const uploadRes = await fetch(uploadUri, {
        method: "POST",
        headers: {
          Authorization: `OAuth ${token}`,
          "Content-Type": contentType,
          offset: "0",
          file_size: String(videoBytes.byteLength),
        },
        body: videoBytes,
      });

      if (!uploadRes.ok) {
        const uploadErr = await uploadRes.text().catch(() => "");
        console.error(`[IG] Upload failed ${uploadRes.status}: ${uploadErr.slice(0, 300)}`);
        return NextResponse.json(
          { error: `Instagram video upload failed (${uploadRes.status}): ${uploadErr.slice(0, 200)}` },
          { status: 502 }
        );
      }

      console.log(`[IG] Video uploaded successfully to Facebook`);

    } else {
      // Non-Drive URL: fall back to URL-based container creation
      console.log(`[IG] Non-Drive URL, using video_url approach: ${videoUrl}`);
      const containerRes = await fetch(`${GRAPH}/${igId}/media`, {
        method: "POST",
        body: new URLSearchParams({
          media_type: "REELS",
          video_url: videoUrl,
          caption: finalCaption,
          access_token: token,
        }),
      });
      const containerData = await containerRes.json();

      if (!containerRes.ok || containerData.error) {
        console.error("[IG] Container error (url-based):", JSON.stringify(containerData));
        return NextResponse.json(
          { error: `Instagram container error: ${containerData.error?.message || JSON.stringify(containerData)}` },
          { status: 502 }
        );
      }
      containerId = containerData.id;
      console.log(`[IG] Container ${containerId} created (url-based)`);
    }

    // ── Poll until FINISHED ───────────────────────────────────────────────────
    // Use the `status` field — this is the correct Instagram field for error details.
    // Poll up to 15 times at 3s each (45s window), leaving ~15s buffer for upload overhead.
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
      console.log(`[IG] Poll ${attempts + 1}: status_code=${statusCode}, status=${lastStatus}`);
      attempts++;
      if (statusCode === "FINISHED") break;
    }

    if (statusCode !== "FINISHED") {
      const detail = lastStatus || `no status detail after ${attempts} polls`;
      console.error(`[IG] Container ${containerId} not finished: ${statusCode} — ${detail}`);
      return NextResponse.json(
        { error: `Instagram processing ended with status: ${statusCode} — ${detail}` },
        { status: 502 }
      );
    }

    // ── Publish ───────────────────────────────────────────────────────────────
    console.log(`[IG] Publishing container ${containerId}`);
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

    return NextResponse.json({
      success: true,
      mediaId,
      permalink: `https://www.instagram.com/reel/${mediaId}/`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Instagram post unhandled error:", msg, error);
    return NextResponse.json({ error: `Instagram internal error: ${msg}` }, { status: 500 });
  }
}
