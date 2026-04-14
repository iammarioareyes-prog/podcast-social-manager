import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshYouTubeToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
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
    if (conn.token_expires_at) {
      const expiresAt = new Date(conn.token_expires_at).getTime();
      if (Date.now() > expiresAt - 60000 && conn.refresh_token) {
        const refreshed = await refreshYouTubeToken(conn.refresh_token);
        if (refreshed) token = refreshed;
      }
    }

    // Resolve the video source URL
    // If a Google Drive file ID is provided, get a direct download link
    let sourceUrl = videoUrl;
    let contentLength: number | undefined;
    let contentType = "video/mp4";

    if (driveFileId) {
      // Get Drive file metadata
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=size,mimeType,name`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        contentLength = meta.size ? parseInt(meta.size) : undefined;
        contentType = meta.mimeType || "video/mp4";
      }
      // Use the Drive download URL
      sourceUrl = `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;
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
            description: description.slice(0, 5000),
            tags: tags.slice(0, 500),
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
        { error: "Failed to create YouTube upload session" },
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
    // Determine the access token for Drive (same Google account)
    const { data: driveConn } = await supabase
      .from("platform_connections")
      .select("access_token")
      .eq("platform", "google_drive")
      .single();

    const driveToken = driveConn?.access_token || token;

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
