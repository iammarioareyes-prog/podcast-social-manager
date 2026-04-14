import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data: conn } = await supabase
    .from("platform_connections")
    .select("access_token, refresh_token, token_expires_at, platform_username, is_connected")
    .eq("platform", "google_drive")
    .single();

  if (!conn?.access_token) {
    return NextResponse.json({ error: "No connection found" });
  }

  const folderIdEnv = process.env.GOOGLE_DRIVE_FOLDER_ID || null;

  // Test 1: query root
  const rootQuery = encodeURIComponent("'root' in parents and trashed = false");
  const rootRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${rootQuery}&pageSize=20&fields=files(id,name,mimeType)&orderBy=name`,
    { headers: { Authorization: `Bearer ${conn.access_token}` } }
  );
  const rootData = await rootRes.json();

  // Test 2: query with no parent filter (recent files)
  const recentRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("trashed = false")}&pageSize=10&fields=files(id,name,mimeType,parents)&orderBy=modifiedTime+desc`,
    { headers: { Authorization: `Bearer ${conn.access_token}` } }
  );
  const recentData = await recentRes.json();

  // Test 3: if env folder ID is set, query that
  let envFolderData = null;
  if (folderIdEnv) {
    const envRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderIdEnv}' in parents and trashed = false`)}&pageSize=20&fields=files(id,name,mimeType)`,
      { headers: { Authorization: `Bearer ${conn.access_token}` } }
    );
    envFolderData = await envRes.json();
  }

  return NextResponse.json({
    connectedAs: conn.platform_username,
    tokenExpiresAt: conn.token_expires_at,
    folderIdEnvVar: folderIdEnv,
    rootItems: rootData.files ?? rootData,
    recentItems: recentData.files ?? recentData,
    envFolderItems: envFolderData,
  });
}
