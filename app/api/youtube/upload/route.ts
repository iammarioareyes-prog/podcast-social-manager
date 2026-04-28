import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function refreshYouTubeToken(refreshToken: string, supabase: SupabaseClient): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) return null;

  await supabase
    .from("platform_connections")
    .update({
      access_token: data.access_token,
      token_expires_at: new Date(
        Date.now() + (data.expires_in ?? 3600) * 1000
      ).toISOString(),
    })
    .eq("platform", "youtube");

  return data.access_token;
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const {
      postId,
      title,
      description = "",
      tags = [],
      privacyStatus = "public",
      videoUrl,
      driveFileId,
    } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (!videoUrl && !driveFileId) {
      return NextResponse.json(
        { error: "videoUrl or driveFileId is required" },
        { status: 400 }
      );
    }

    // Get YouTube connection
    const { data: conn } = await supabase
      .from("platform_connections")
      .select("access_token, refresh_token, token_expires_at")
      .eq("platform", "youtube")
      .eq("is_connected", true)
      .single();

    if (!conn?.access_token) {
      return NextResponse.json({ error: "YouTube not connected" }, { status: 401 });
    }

    // Refresh token if expired
    let token = conn.access_token;
    const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
    if (Date.now() > expiresAt - 120_000) {
      if (!conn.refresh_token) {
        return NextResponse.json({ error: "YouTube token expired — reconnect YouTube in Settings" }, { status: 401 });
      }
      const refreshed = await refreshYouTubeToken(conn.refresh_token, supabase);
      if (!refreshed) {
        return NextResponse.json({ error: "YouTube token refresh failed — reconnect YouTube in Settings" }, { status: 401 });
      }
      token = refreshed;
    }

    // Get Google Drive token — refresh it if expired
    const { data: driveConn } = await supabase
      .from("platform_connections")
      .select("access_token, refresh_token, token_expires_at")
      .eq("platform", "google_drive")
      .single();

    let driveToken = driveConn?.access_token || token;
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
          driveToken = refreshed.access_token;
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

    // Resolve the video source URL
    // If a Google Drive file ID is provided, use Drive API directly (faster, no proxy hop)
    let sourceUrl = videoUrl;
    let contentLength: number | undefined;
    let contentType = "video/mp4";

    if (driveFileId) {
      // Fetch file metadata using Drive token (not YouTube token)
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=size,mimeType,name`,
        { headers: { Authorization: `Bearer ${driveToken}` } }
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        contentLength = meta.size ? parseInt(meta.size) : undefined;
        contentType = meta.mimeType || "video/mp4";
      }
      // Bypass drive-proxy — fetch directly from Drive API
      sourceUrl = `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;
    }

    // Append brand hashtags from voice_profile settings
    const { data: vpData } = await supabase
      .from("voice_profile")
      .select("youtube_hashtags")
      .limit(1)
      .maybeSingle();

    const brandHashtags: string[] = vpData?.youtube_hashtags || [];
    let finalDescription = description;
    const finalTags = [...tags];
    if (brandHashtags.length > 0) {
      const tagString = brandHashtags
        .map((t) => (t.startsWith("#") ? t : `#${t}`))
        .join(" ");
      finalDescription = `${description}\n\n${tagString}`;
      // Also add to YouTube tags array (without #)
      for (const tag of brandHashtags) {
        const clean = tag.replace(/^#/, "");
        if (!finalTags.includes(clean)) finalTags.push(clean);
      }
    }

    // Step 1: Create a resumable upload session on YouTube
    const ytInitRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": contentType,
          ...(contentLength ? { "X-Upload-Content-Length": String(contentLength) } : {}),
        },
        body: JSON.stringify({
          snippet: {
            title: title.slice(0, 100),
            description: finalDescription.slice(0, 5000),
            tags: finalTags.slice(0, 500),
            categoryId: "22", // People & Blogs
          },
          status: {
            privacyStatus,
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );

    if (!ytInitRes.ok) {
      const errText = await ytInitRes.text();
      console.error("YouTube resumable init error:", errText);
      return NextResponse.json(
        { error: `YouTube init failed (${ytInitRes.status}): ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const uploadUri = ytInitRes.headers.get("Location");
    if (!uploadUri) {
      return NextResponse.json(
        { error: "No upload URI returned from YouTube" },
        { status: 502 }
      );
    }

    // Step 2: Fetch the video bytes and stream to YouTube
    const videoRes = await fetch(sourceUrl, {
      headers: driveFileId
        ? { Authorization: `Bearer ${driveToken}` }
        : {},
    });

    if (!videoRes.ok || !videoRes.body) {
      return NextResponse.json(
        { error: "Failed to fetch video from source" },
        { status: 502 }
      );
    }

    const videoBuffer = await videoRes.arrayBuffer();

    // Step 3: Upload to YouTube
    const uploadRes = await fetch(uploadUri, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(videoBuffer.byteLength),
      },
      body: videoBuffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("YouTube upload error:", errText);
      return NextResponse.json(
        { error: "Failed to upload video to YouTube" },
        { status: 502 }
      );
    }

    const uploadData = await uploadRes.json();
    const videoId = uploadData.id;

    // Update Supabase post record
    if (postId) {
      await supabase
        .from("posts")
        .update({
          platform_post_ids: { youtube: videoId },
          status: "published",
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);
    }

    return NextResponse.json({
      success: true,
      videoId,
      url: `https://youtube.com/shorts/${videoId}`,
    });
  } catch (error) {
    console.error("YouTube upload error:", error);
    return NextResponse.json({ error: "Failed to upload to YouTube" }, { status: 500 });
  }
}
