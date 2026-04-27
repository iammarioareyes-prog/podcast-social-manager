import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  // Show ALL rows for google_drive in platform_connections
  const { data: allRows, error: rowError } = await supabase
    .from("platform_connections")
    .select("id, platform, is_connected, platform_username, token_expires_at, created_at")
    .eq("platform", "google_drive");

  // Get the best row (most recent)
  const { data: conn } = await supabase
    .from("platform_connections")
    .select("access_token, refresh_token, token_expires_at, platform_username, is_connected")
    .eq("platform", "google_drive")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const folderIdEnv = process.env.GOOGLE_DRIVE_FOLDER_ID || null;

  if (!conn?.access_token) {
    return NextResponse.json({
      allRowsInDB: allRows ?? [],
      dbError: rowError?.message,
      folderIdEnvVar: folderIdEnv,
      error: "No access token found in most recent row",
    });
  }

  // Test the token
  const testRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("'root' in parents and trashed = false")}&pageSize=10&fields=files(id,name,mimeType)`,
    { headers: { Authorization: `Bearer ${conn.access_token}` } }
  );
  const testData = await testRes.json();

  return NextResponse.json({
    allRowsInDB: allRows ?? [],
    folderIdEnvVar: folderIdEnv,
    connectedAs: conn.platform_username,
    tokenExpiresAt: conn.token_expires_at,
    tokenValid: testRes.ok,
    rootItems: testData.files ?? testData,
  });
}
