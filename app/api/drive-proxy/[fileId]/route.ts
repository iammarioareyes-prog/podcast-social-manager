import { NextRequest, NextResponse } from "next/server";
import { createAgentSupabaseClient, getDriveAccessToken } from "@/lib/agent-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/drive-proxy/[fileId]
 *
 * Streams a Google Drive file through this server so Instagram, TikTok,
 * and YouTube can fetch it without needing a Google OAuth token.
 * The URL https://your-app.vercel.app/api/drive-proxy/<fileId> is the
 * public video URL passed to all three posting APIs.
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
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!driveRes.ok) {
    const err = await driveRes.text();
    console.error("Drive proxy fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch file from Drive" }, { status: driveRes.status });
  }

  return new NextResponse(driveRes.body, {
    status: 200,
    headers: {
      "Content-Type": driveRes.headers.get("Content-Type") || "video/mp4",
      "Content-Length": driveRes.headers.get("Content-Length") || "",
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
    },
  });
}
