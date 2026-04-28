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

  // Follow Google's internal redirect chain so the caller (Instagram/TikTok CDN)
  // only needs to follow ONE hop — to the final storage.googleapis.com signed URL.
  // googleapis.com itself returns a 302 to storage.googleapis.com; stopping at that
  // intermediate URL causes Instagram to receive a redirect body rather than video bytes.
  const probeRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${params.fileId}?alt=media&access_token=${token}`,
    { redirect: "follow" }
  );

  // Cancel the response body — we only needed the final resolved URL
  try { await probeRes.body?.cancel(); } catch { /* ignore */ }

  if (!probeRes.ok && probeRes.url === `https://www.googleapis.com/drive/v3/files/${params.fileId}?alt=media&access_token=${token}`) {
    return NextResponse.json({ error: "Google Drive file not accessible" }, { status: 502 });
  }

  // probeRes.url is the fully resolved CDN URL — redirect the caller there directly
  return NextResponse.redirect(probeRes.url, { status: 302 });
}
