import { NextRequest, NextResponse } from "next/server";
import { createAgentSupabaseClient, getDriveAccessToken } from "@/lib/agent-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/drive-proxy/[fileId]
 *
 * Streams the Google Drive file bytes directly through our server.
 * This gives Instagram / TikTok / YouTube a STABLE URL that serves
 * real video bytes on every request — no short-lived signed URLs, no
 * redirect chains, no expiry races.
 *
 * getDriveAccessToken auto-refreshes the Google OAuth token when needed.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const supabase = createAgentSupabaseClient();
  const token = await getDriveAccessToken(supabase);

  if (!token) {
    return NextResponse.json({ error: "Google Drive not connected" }, { status: 401 });
  }

  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${params.fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow",
    }
  );

  if (!driveRes.ok) {
    const errText = await driveRes.text().catch(() => "");
    console.error(`Drive proxy error ${driveRes.status} for ${params.fileId}: ${errText.slice(0, 200)}`);
    return NextResponse.json(
      { error: `Google Drive fetch failed (${driveRes.status})` },
      { status: 502 }
    );
  }

  // Forward the video bytes and relevant headers to the caller
  const resHeaders = new Headers();
  const contentType = driveRes.headers.get("content-type") || "video/mp4";
  const contentLength = driveRes.headers.get("content-length");
  resHeaders.set("content-type", contentType);
  if (contentLength) resHeaders.set("content-length", contentLength);
  resHeaders.set("cache-control", "public, max-age=3600");
  resHeaders.set("accept-ranges", "bytes");

  return new NextResponse(driveRes.body, { status: 200, headers: resHeaders });
}
