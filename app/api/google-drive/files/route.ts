import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listDriveFiles } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!connection?.is_connected || !connection?.access_token) {
      return NextResponse.json(
        { error: "not_connected", message: "Google Drive not connected", files: [] },
        { status: 401 }
      );
    }

    // Always attempt token refresh if expired (or if we got here with a stale token)
    let accessToken = connection.access_token;
    const isExpired = connection.token_expires_at
      ? Date.now() > new Date(connection.token_expires_at).getTime() - 60000
      : false;

    if (isExpired && connection.refresh_token) {
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

      if (!refreshRes.ok || !refreshed.access_token) {
        // Refresh failed — mark as disconnected so the UI prompts reconnect
        console.error("Google Drive token refresh failed:", refreshed);
        await supabase
          .from("platform_connections")
          .update({ is_connected: false })
          .eq("platform", "google_drive");

        return NextResponse.json(
          {
            error: "token_expired",
            message: "Google Drive session expired. Please reconnect in Settings.",
            files: [],
          },
          { status: 401 }
        );
      }

      accessToken = refreshed.access_token;
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
      { error: "server_error", message: "Failed to fetch Google Drive files", files: [] },
      { status: 500 }
    );
  }
}
