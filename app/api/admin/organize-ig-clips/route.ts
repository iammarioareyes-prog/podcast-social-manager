import { NextResponse } from "next/server";
import { createAgentSupabaseClient, getDriveAccessToken } from "@/lib/agent-utils";
import { listDriveFiles } from "@/lib/google-drive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_DURATION_MS = 90_000; // 90 seconds
const DRIVE = "https://www.googleapis.com/drive/v3";

/**
 * GET /api/admin/organize-ig-clips
 *
 * Scans all guest subfolders under the configured root Drive folder,
 * finds video clips ≤ 90 seconds, and moves them into:
 *   IG/[GuestName]/clip.mp4
 *
 * The IG folder must already exist as a sibling of the guest folders.
 * Guest subfolders inside IG are created automatically.
 *
 * After running this, use focus-week with &source=ig to schedule from
 * the IG folder instead of the root.
 */
export async function GET() {
  const supabase = createAgentSupabaseClient();
  const token = await getDriveAccessToken(supabase);
  if (!token) {
    return NextResponse.json({ error: "Google Drive not connected" }, { status: 503 });
  }

  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) {
    return NextResponse.json({ error: "GOOGLE_DRIVE_FOLDER_ID not configured" }, { status: 500 });
  }

  // ── Find the IG folder in root ─────────────────────────────────────────────
  const rootContents = await listDriveFiles({
    folderId: rootFolderId,
    mimeType: "application/vnd.google-apps.folder",
    pageSize: 100,
    accessToken: token,
  });

  const igFolder = (rootContents.files ?? []).find(
    (f) => f.name.toLowerCase() === "ig"
  );
  if (!igFolder) {
    return NextResponse.json(
      { error: "No folder named 'IG' found in your Drive root folder. Create it first." },
      { status: 422 }
    );
  }

  // Guest folders = all subfolders of root except IG
  const guestFolders = (rootContents.files ?? []).filter(
    (f) => f.id !== igFolder.id
  );

  if (guestFolders.length === 0) {
    return NextResponse.json({ error: "No guest folders found in root Drive folder" }, { status: 422 });
  }

  // ── Cache of existing IG subfolders to avoid redundant creates ─────────────
  const igSubfolders: Record<string, string> = {}; // guestName (lower) → folderId

  const existingIgSubs = await listDriveFiles({
    folderId: igFolder.id,
    mimeType: "application/vnd.google-apps.folder",
    pageSize: 100,
    accessToken: token,
  });
  for (const f of existingIgSubs.files ?? []) {
    igSubfolders[f.name.toLowerCase()] = f.id;
  }

  // ── Process each guest folder ──────────────────────────────────────────────
  const summary: Array<{ guest: string; moved: number; skipped: number; noMeta: number }> = [];

  for (const guestFolder of guestFolders) {
    const videos = await listDriveFiles({
      folderId: guestFolder.id,
      pageSize: 100,
      accessToken: token,
    });

    const allFiles = (videos.files ?? []).filter(
      (f) => f.mimeType.startsWith("video/") || f.mimeType === "application/octet-stream"
    );

    let moved = 0;
    let skipped = 0;
    let noMeta = 0;

    for (const file of allFiles) {
      const durMs = parseInt(file.videoMediaMetadata?.durationMillis ?? "0");

      if (durMs === 0) {
        // Duration unavailable — skip to be safe
        noMeta++;
        continue;
      }

      if (durMs > MAX_DURATION_MS) {
        skipped++;
        continue;
      }

      // ── Ensure IG/[GuestName]/ exists ───────────────────────────────────
      const key = guestFolder.name.toLowerCase();
      if (!igSubfolders[key]) {
        const createRes = await fetch(`${DRIVE}/files`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: guestFolder.name,
            mimeType: "application/vnd.google-apps.folder",
            parents: [igFolder.id],
          }),
        });
        const created = await createRes.json();
        igSubfolders[key] = created.id;
      }

      // ── Move file → IG/[GuestName]/ ─────────────────────────────────────
      await fetch(
        `${DRIVE}/files/${file.id}?addParents=${igSubfolders[key]}&removeParents=${guestFolder.id}&fields=id`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        }
      );

      moved++;
    }

    summary.push({ guest: guestFolder.name, moved, skipped, noMeta });
  }

  const totalMoved = summary.reduce((s, r) => s + r.moved, 0);

  return NextResponse.json({
    success: true,
    igFolderId: igFolder.id,
    totalMoved,
    summary,
    nextStep: totalMoved > 0
      ? "Run focus-week with &source=ig to schedule from the IG folder"
      : "No clips were moved — check that your guest folders contain video files with duration metadata",
  });
}
