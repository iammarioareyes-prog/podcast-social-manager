import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listDriveFiles } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId") || undefined;
    const query = searchParams.get("q") || undefined;
    const mimeType = searchParams.get("mimeType") || undefined;
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const pageToken = searchParams.get("pageToken") || undefined;

    // Get stored access token from Supabase
    const { data: connection } = await supabase
      .from("platform_connections")
      .select("access_token, refresh_token, token_expires_at, is_connected")
      .eq("platform", "google_drive")
      .single();

    if (!connection?.is_connected || !connection?.access_token) {
      return NextResponse.json(
        { error: "Google Drive not connected", files: [] },
        { status: 401 }
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = connection.access_token;
    if (connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at).getTime();
      if (Date.now() > expiresAt - 60000 && connection.refresh_token) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            refresh_token: connection.refresh_token,
            client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
            grant_type: "refresh_token",
          }),
        });
        const refreshed = await refreshRes.json();
        if (refreshed.access_token) {
          accessToken = refreshed.access_token;
          await supabase
            .from("platform_connections")
            .update({
              access_token: refreshed.access_token,
              token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            })
            .eq("platform", "google_drive");
        }
      }
    }

    const result = await listDriveFiles({
      folderId,
      query,
      mimeType,
      pageSize,
      pageToken,
      accessToken,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Google Drive files error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Google Drive files" },
      { status: 500 }
    );
  }
}
