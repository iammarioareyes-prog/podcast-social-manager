import { NextRequest, NextResponse } from "next/server";
import { createAgentSupabaseClient, getDriveAccessToken } from "@/lib/agent-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/drive-proxy/[fileId]
 *
 * Returns a 302 redirect to the direct Google Drive download URL.
 * Instagram and TikTok CDNs follow the redirect and download straight
 * from Google — no Vercel streaming timeout, no large-file issues.
 * getDriveAccessToken auto-refreshes the token if it's expired.
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

  // Redirect Instagram/TikTok CDN directly to Google Drive.
  // The CDN follows the 302 and downloads from Google without touching Vercel.
  return NextResponse.redirect(
    `https://www.googleapis.com/drive/v3/files/${params.fileId}?alt=media&access_token=${token}`,
    { status: 302 }
  );
}
