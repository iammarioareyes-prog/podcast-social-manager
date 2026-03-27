import { NextRequest, NextResponse } from "next/server";
import { listDriveFiles } from "@/lib/google-drive";

/**
 * GET /api/google-drive/files
 * List files from Google Drive
 * TODO: Implement with Google Drive API v3 with real OAuth tokens
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId") || undefined;
    const query = searchParams.get("q") || undefined;
    const mimeType = searchParams.get("mimeType") || undefined;
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const pageToken = searchParams.get("pageToken") || undefined;

    // TODO: Get access token from platform_connections or session
    // For now, return mock data
    const result = await listDriveFiles({
      folderId,
      query,
      mimeType,
      pageSize,
      pageToken,
    });

    return NextResponse.json({
      ...result,
      message: "TODO: Connect Google Drive in Settings to browse real files",
    });
  } catch (error) {
    console.error("Google Drive files error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Google Drive files" },
      { status: 500 }
    );
  }
}
