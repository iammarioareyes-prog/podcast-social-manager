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

// 9am, 2pm, 7pm EDT → UTC
const POSTING_HOURS_UTC = [13, 18, 23];

/**
 * GET /api/admin/rebuild-schedule
 *
 * Wipes all future scheduled posts and rebuilds with a proper
 * round-robin rotation: 3 posts per day (Mon–Sat), one from each
 * guest folder in sequence, cycling back to the start after all
 * folders have been used once.
 *
 * Posts are created without captions — regenerate them via the
 * Schedule page after this runs.
 */
export async function GET() {
  const supabase = createAgentSupabaseClient();

  // ── Drive access ─────────────────────────────────────────────
  const driveToken = await getDriveAccessToken(supabase);
  if (!driveToken) {
    return NextResponse.json({ error: "Google Drive not connected" }, { status: 503 });
  }

  // ── Already-posted clip IDs ───────────────────────────────────
  const { data: configRow } = await supabase
    .from("agent_config")
    .select("value")
    .eq("key", "posted_drive_ids")
    .maybeSingle();
  const postedIds: string[] = (configRow?.value as string[]) ?? [];

  // ── List all guest subfolders ─────────────────────────────────
  const subfolders = await listGuestSubfolders(driveToken);
  if (subfolders.length === 0) {
    return NextResponse.json({ error: "No guest folders found in Drive" }, { status: 422 });
  }

  // ── Get unposted clips for each folder (parallelised) ─────────
  const folderClipLists = await Promise.all(
    subfolders.map(async (folder) => {
      const clips = await listClipsInFolder(folder.id, driveToken);
      const unposted = clips.filter((c) => !postedIds.includes(c.id));
      return { folder, clips: unposted };
    })
  );

  // Keep only folders that actually have unposted content
  const foldersWithContent = folderClipLists.filter((f) => f.clips.length > 0);
  if (foldersWithContent.length < 3) {
    return NextResponse.json({
      error: `Not enough folders with unposted content. Found ${foldersWithContent.length}, need at least 3.`,
    }, { status: 422 });
  }

  // ── Build round-robin clip queue ──────────────────────────────
  // Round 1: F1[0], F2[0], F3[0], ...Fn[0]
  // Round 2: F1[1], F2[1], F3[1], ...Fn[1]
  // So every 3 consecutive slots always come from 3 different folders.
  const queue: Array<{ folderName: string; file: DriveFile }> = [];
  const maxRounds = Math.max(...foldersWithContent.map((f) => f.clips.length));

  for (let round = 0; round < maxRounds; round++) {
    for (const { folder, clips } of foldersWithContent) {
      if (round < clips.length) {
        queue.push({ folderName: folder.name, file: clips[round] });
      }
    }
  }

  // ── Delete all future scheduled posts ─────────────────────────
  const tomorrowMidnight = new Date();
  tomorrowMidnight.setUTCDate(tomorrowMidnight.getUTCDate() + 1);
  tomorrowMidnight.setUTCHours(0, 0, 0, 0);

  const { error: deleteErr } = await supabase
    .from("posts")
    .delete()
    .eq("status", "scheduled")
    .gte("scheduled_at", tomorrowMidnight.toISOString());

  if (deleteErr) {
    return NextResponse.json({ error: `Delete failed: ${deleteErr.message}` }, { status: 500 });
  }

  // ── Build new posting schedule ────────────────────────────────
  // Assign 3 clips per posting day (Mon–Sat) from the round-robin queue.
  const postsToInsert: Record<string, unknown>[] = [];
  let queueIndex = 0;

  // Scan up to 60 calendar days to find enough posting days
  for (let dayOffset = 1; dayOffset <= 60 && queueIndex < queue.length; dayOffset++) {
    const day = new Date(tomorrowMidnight);
    day.setUTCDate(tomorrowMidnight.getUTCDate() + dayOffset - 1);

    const dow = day.getUTCDay(); // 0=Sun
    if (dow === 0) continue; // skip Sundays

    // Assign 3 slots for this day
    for (let slot = 0; slot < 3 && queueIndex < queue.length; slot++) {
      const { folderName, file } = queue[queueIndex++];

      const scheduledAt = new Date(day);
      scheduledAt.setUTCHours(POSTING_HOURS_UTC[slot], 0, 0, 0);

      postsToInsert.push({
        title: file.name.replace(/\.[^.]+$/, ""), // strip extension
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

  if (postsToInsert.length === 0) {
    return NextResponse.json({ error: "No posts to insert" }, { status: 422 });
  }

  // ── Insert in batches of 50 to stay within Supabase limits ───
  let totalInserted = 0;
  for (let i = 0; i < postsToInsert.length; i += 50) {
    const batch = postsToInsert.slice(i, i + 50);
    const { error: insertErr } = await supabase.from("posts").insert(batch);
    if (insertErr) {
      return NextResponse.json({ error: `Insert failed: ${insertErr.message}` }, { status: 500 });
    }
    totalInserted += batch.length;
  }

  // ── Persist folder rotation index for the scan cron ──────────
  await supabase
    .from("agent_config")
    .upsert({ key: "folder_rotation_index", value: queueIndex % queue.length })
    .eq("key", "folder_rotation_index");

  return NextResponse.json({
    success: true,
    foldersFound: subfolders.length,
    foldersWithContent: foldersWithContent.length,
    totalClipsAvailable: queue.length,
    postsCreated: totalInserted,
    note: "Posts created without captions — use the Schedule page to generate captions for each one, or they will fall back to the post title.",
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
