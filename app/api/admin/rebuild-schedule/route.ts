import { NextResponse } from "next/server";
import {
  createAgentSupabaseClient,
  getDriveAccessToken,
  listGuestSubfolders,
  listClipsInFolder,
} from "@/lib/agent-utils";
import type { DriveFile } from "@/lib/google-drive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://iamm-podcast-mgr-v1.vercel.app";
const POSTING_HOURS_UTC = [13, 18, 23]; // 9am, 2pm, 7pm EDT

/**
 * GET /api/admin/rebuild-schedule
 *
 * Wipes all future scheduled posts and rebuilds with a strict daily rotation:
 * - Each day gets exactly 3 posts, each from a DIFFERENT guest folder
 * - Folders rotate using a fair deque: pick the front 3, then move them to the back
 * - Folders with more clips naturally appear on more days
 * - Hassan (or any heavy folder) never appears twice on the same day
 */
export async function GET() {
  const supabase = createAgentSupabaseClient();

  const driveToken = await getDriveAccessToken(supabase);
  if (!driveToken) {
    return NextResponse.json({ error: "Google Drive not connected" }, { status: 503 });
  }

  // Already-posted clip IDs
  const { data: configRow } = await supabase
    .from("agent_config")
    .select("value")
    .eq("key", "posted_drive_ids")
    .maybeSingle();
  const postedIds: string[] = (configRow?.value as string[]) ?? [];

  // List all guest folders + their unposted clips (parallel)
  const subfolders = await listGuestSubfolders(driveToken);
  if (subfolders.length === 0) {
    return NextResponse.json({ error: "No guest folders found in Drive" }, { status: 422 });
  }

  const folderClipLists = await Promise.all(
    subfolders.map(async (folder) => {
      const clips = await listClipsInFolder(folder.id, driveToken);
      return {
        name: folder.name,
        clips: clips.filter((c) => !postedIds.includes(c.id)),
      };
    })
  );

  // ── Fair deque rotation ───────────────────────────────────────────────────
  // Each folder is a deck of clips. Each day: take 1 clip from the front 3
  // decks, then rotate those decks to the back. Remove empty decks first.
  //
  // This guarantees:
  //   • Each day = exactly 3 different folders
  //   • No folder appears twice on the same day
  //   • Folders cycle fairly before repeating

  interface FolderDeck {
    name: string;
    clips: DriveFile[];
  }

  let decks: FolderDeck[] = folderClipLists
    .filter((f) => f.clips.length > 0)
    .map((f) => ({ name: f.name, clips: [...f.clips] }));

  if (decks.length < 3) {
    return NextResponse.json({
      error: `Need at least 3 folders with unposted content. Found ${decks.length}.`,
    }, { status: 422 });
  }

  // Build daily groups
  const dailyGroups: Array<Array<{ folderName: string; file: DriveFile }>> = [];

  while (true) {
    // Drop exhausted decks
    decks = decks.filter((d) => d.clips.length > 0);
    if (decks.length < 3) break;

    // Take one clip from each of the first 3 decks
    const dayGroup: Array<{ folderName: string; file: DriveFile }> = [];
    for (let i = 0; i < 3; i++) {
      const file = decks[i].clips.shift()!;
      dayGroup.push({ folderName: decks[i].name, file });
    }
    dailyGroups.push(dayGroup);

    // Rotate: move the first 3 decks to the back so they cycle fairly
    const rotated = decks.splice(0, 3);
    decks.push(...rotated);
  }

  if (dailyGroups.length === 0) {
    return NextResponse.json({ error: "No posting days could be built" }, { status: 422 });
  }

  // ── Delete future scheduled posts starting tomorrow midnight UTC ─────────
  // "Tomorrow" in EDT = today's remaining day + the next full UTC day,
  // so we add 1 day to the current EDT midnight (UTC-4) to be safe.
  const now = new Date();
  // Treat "today" as the EDT calendar date: back off 4 hours then find midnight
  const edtNow = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const safeDeleteFrom = new Date(edtNow);
  safeDeleteFrom.setUTCHours(0, 0, 0, 0);          // midnight of current EDT day in UTC
  safeDeleteFrom.setUTCDate(safeDeleteFrom.getUTCDate() + 1); // tomorrow EDT midnight

  const { error: deleteErr } = await supabase
    .from("posts")
    .delete()
    .eq("status", "scheduled")
    .gte("scheduled_at", safeDeleteFrom.toISOString());

  if (deleteErr) {
    return NextResponse.json({ error: `Delete failed: ${deleteErr.message}` }, { status: 500 });
  }

  // ── Assign daily groups to Mon–Sat posting slots ──────────────────────────
  const postsToInsert: Record<string, unknown>[] = [];
  let dayGroupIdx = 0;

  for (let calOffset = 0; calOffset < 120 && dayGroupIdx < dailyGroups.length; calOffset++) {
    const day = new Date(safeDeleteFrom);
    day.setUTCDate(safeDeleteFrom.getUTCDate() + calOffset);

    // Post every day of the week — no skip

    const group = dailyGroups[dayGroupIdx++];

    for (let slot = 0; slot < group.length; slot++) {
      const { folderName, file } = group[slot];
      const scheduledAt = new Date(day);
      scheduledAt.setUTCHours(POSTING_HOURS_UTC[slot], 0, 0, 0);

      postsToInsert.push({
        title: file.name.replace(/\.[^.]+$/, ""),
        description: `Guest: ${folderName}`,
        platforms: ["instagram", "tiktok", "youtube"],
        status: "scheduled",
        scheduled_at: scheduledAt.toISOString(),
        content_url: `${APP_URL}/api/drive-proxy/${file.id}`,
        drive_file_id: file.id,
        captions_json: {},
        caption: "",
        hashtags: [],
        platform_post_ids: {},
      });
    }
  }

  // ── Insert in batches ─────────────────────────────────────────────────────
  let totalInserted = 0;
  for (let i = 0; i < postsToInsert.length; i += 50) {
    const { error: insertErr } = await supabase
      .from("posts")
      .insert(postsToInsert.slice(i, i + 50));
    if (insertErr) {
      return NextResponse.json({ error: `Insert failed: ${insertErr.message}` }, { status: 500 });
    }
    totalInserted += Math.min(50, postsToInsert.length - i);
  }

  return NextResponse.json({
    success: true,
    foldersFound: subfolders.length,
    foldersWithContent: folderClipLists.filter((f) => f.clips.length > 0).length,
    daysScheduled: dailyGroups.length,
    postsCreated: totalInserted,
    note: "Posts created without captions — generate them via the Schedule page, or they fall back to the post title.",
    preview: postsToInsert.slice(0, 9).map((p) => ({
      title: p.title,
      guest: (p.description as string).replace("Guest: ", ""),
      when: new Date(p.scheduled_at as string).toLocaleString("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    })),
  });
}
