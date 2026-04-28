import { NextRequest, NextResponse } from "next/server";
import {
  createAgentSupabaseClient,
  getDriveAccessToken,
  listGuestSubfolders,
  listClipsInFolder,
} from "@/lib/agent-utils";
import { listDriveFiles } from "@/lib/google-drive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://iamm-podcast-mgr-v1.vercel.app";
const POSTING_HOURS_UTC = [13, 18, 23]; // 9am, 2pm, 7pm EDT

/**
 * GET /api/admin/focus-week?guests=Mike+Williams,Camillia+Harris,Grey
 *
 * 1. Clears ALL scheduled posts
 * 2. Finds Drive folders matching the provided guest keywords
 * 3. Builds a 7-day schedule (today through day+6) with:
 *    - 3 posts/day at 9am / 2pm / 7pm EDT
 *    - 1 clip from each matched folder per day, rotating slot order daily
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const guestsParam = searchParams.get("guests") || "Mike Williams,Camillia Harris,Grey";
  const days = Math.min(parseInt(searchParams.get("days") || "7"), 30);
  const source = (searchParams.get("source") || "root").toLowerCase(); // "ig" → use IG subfolder

  const keywords = guestsParam
    .split(",")
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);

  if (keywords.length === 0) {
    return NextResponse.json({ error: "No guest keywords provided" }, { status: 400 });
  }

  const supabase = createAgentSupabaseClient();

  // ── Get Drive token ────────────────────────────────────────────────────────
  const driveToken = await getDriveAccessToken(supabase);
  if (!driveToken) {
    return NextResponse.json({ error: "Google Drive not connected" }, { status: 503 });
  }

  // ── Find matching folders ──────────────────────────────────────────────────
  // source=ig → look inside the IG subfolder for guest subfolders
  let allFolders: { id: string; name: string }[];
  if (source === "ig") {
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "root";
    const rootContents = await listDriveFiles({
      folderId: rootFolderId,
      mimeType: "application/vnd.google-apps.folder",
      pageSize: 100,
      accessToken: driveToken,
    });
    const igFolder = (rootContents.files ?? []).find(
      (f) => f.name.toLowerCase() === "ig"
    );
    if (!igFolder) {
      return NextResponse.json({ error: "IG folder not found — run /api/admin/organize-ig-clips first" }, { status: 422 });
    }
    const igContents = await listDriveFiles({
      folderId: igFolder.id,
      mimeType: "application/vnd.google-apps.folder",
      pageSize: 100,
      accessToken: driveToken,
    });
    allFolders = igContents.files ?? [];
  } else {
    allFolders = await listGuestSubfolders(driveToken);
  }
  const matchedFolders: Array<{ id: string; name: string; keyword: string }> = [];

  for (const keyword of keywords) {
    const words = keyword.split(" ").filter(Boolean);
    // A folder matches if it contains ALL words in the keyword (case-insensitive)
    const match = allFolders.find((f) => {
      const folderLower = f.name.toLowerCase();
      return words.every((w) => folderLower.includes(w));
    });
    if (match) {
      matchedFolders.push({ id: match.id, name: match.name, keyword });
    }
  }

  if (matchedFolders.length === 0) {
    const available = allFolders.map((f) => f.name).join(", ");
    return NextResponse.json({
      error: `No folders matched keywords: ${guestsParam}`,
      availableFolders: available,
    }, { status: 422 });
  }

  // ── Already-posted clip IDs ────────────────────────────────────────────────
  const { data: configRow } = await supabase
    .from("agent_config")
    .select("value")
    .eq("key", "posted_drive_ids")
    .maybeSingle();
  const postedIds: string[] = (configRow?.value as string[]) ?? [];

  // ── Load unposted clips from each matched folder ───────────────────────────
  const folderDecks: Array<{ name: string; clips: { id: string; name: string }[] }> = [];

  for (const folder of matchedFolders) {
    const clips = await listClipsInFolder(folder.id, driveToken);
    const unposted = clips.filter((c) => !postedIds.includes(c.id));
    folderDecks.push({ name: folder.name, clips: unposted });
  }

  const emptyFolders = folderDecks.filter((d) => d.clips.length === 0).map((d) => d.name);
  if (emptyFolders.length > 0) {
    return NextResponse.json({
      error: `These folders have no unposted clips: ${emptyFolders.join(", ")}`,
    }, { status: 422 });
  }

  // ── Clear ALL scheduled posts ──────────────────────────────────────────────
  const { error: deleteErr } = await supabase
    .from("posts")
    .delete()
    .eq("status", "scheduled");

  if (deleteErr) {
    return NextResponse.json({ error: `Clear failed: ${deleteErr.message}` }, { status: 500 });
  }

  // ── Build 7-day schedule ───────────────────────────────────────────────────
  // Each day: 1 clip from each matched folder
  // Rotate which folder fills which time slot daily so the posting order varies
  const n = matchedFolders.length;
  const postsToInsert: Record<string, unknown>[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() + dayOffset);

    for (let slot = 0; slot < n; slot++) {
      // Rotate folder → slot assignment each day
      const folderIdx = (slot + dayOffset) % n;
      const deck = folderDecks[folderIdx];

      if (deck.clips.length === 0) continue; // exhausted — skip

      const clip = deck.clips.shift()!; // take next unposted clip
      const scheduledAt = new Date(day);
      scheduledAt.setUTCHours(POSTING_HOURS_UTC[slot % POSTING_HOURS_UTC.length], 0, 0, 0);

      postsToInsert.push({
        title: clip.name.replace(/\.[^.]+$/, ""),
        description: `Guest: ${deck.name}`,
        platforms: ["instagram", "tiktok", "youtube"],
        status: "scheduled",
        scheduled_at: scheduledAt.toISOString(),
        content_url: `${APP_URL}/api/drive-proxy/${clip.id}`,
        drive_file_id: clip.id,
        captions_json: {},
        caption: "",
        hashtags: [],
        platform_post_ids: {},
      });
    }
  }

  if (postsToInsert.length === 0) {
    return NextResponse.json({ error: "No posts could be built — check clip availability" }, { status: 422 });
  }

  // ── Insert ─────────────────────────────────────────────────────────────────
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
    guestsMatched: matchedFolders.map((f) => f.name),
    daysScheduled: days,
    postsCreated: totalInserted,
    preview: postsToInsert.slice(0, 9).map((p) => ({
      title: (p.title as string).slice(0, 50),
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
