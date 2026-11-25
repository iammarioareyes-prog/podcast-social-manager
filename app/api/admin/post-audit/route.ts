import { NextRequest, NextResponse } from "next/server";
import { createAgentSupabaseClient, getDriveConnection, listGuestSubfolders, listClipsInFolder } from "@/lib/agent-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/admin/post-audit
 *
 * 1. Rebuilds posted_drive_ids from published posts (makes the list accurate)
 * 2. For each guest folder in Drive, shows: total clips, posted count, remaining count
 * 3. Returns a full audit so you can pick which guests to schedule next
 *
 * Optional: ?sync=false to skip the posted_drive_ids sync (read-only)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sync = searchParams.get("sync") !== "false";

  const supabase = createAgentSupabaseClient();

  // ── Step 1: Gather all published posts with drive_file_ids ─────────────────
  const { data: publishedPosts, error: postsErr } = await supabase
    .from("posts")
    .select("id, title, description, drive_file_id, published_at, platform_post_ids")
    .eq("status", "published")
    .not("drive_file_id", "is", null)
    .order("published_at", { ascending: false });

  if (postsErr) {
    return NextResponse.json({ error: postsErr.message }, { status: 500 });
  }

  const publishedDriveIds = (publishedPosts ?? [])
    .map((p) => p.drive_file_id as string)
    .filter(Boolean);

  // ── Step 2: Get current posted_drive_ids from agent_config ─────────────────
  const { data: configRow } = await supabase
    .from("agent_config")
    .select("value")
    .eq("key", "posted_drive_ids")
    .maybeSingle();

  const currentPostedIds: string[] = (configRow?.value as string[]) ?? [];

  // ── Step 3: Merge and sync if requested ────────────────────────────────────
  const mergedPostedIds = Array.from(new Set([...currentPostedIds, ...publishedDriveIds]));
  const newIdsAdded = mergedPostedIds.length - currentPostedIds.length;

  if (sync && newIdsAdded > 0) {
    await supabase
      .from("agent_config")
      .update({ value: mergedPostedIds, updated_at: new Date().toISOString() })
      .eq("key", "posted_drive_ids");
  }

  // ── Step 4: Group published posts by guest name ────────────────────────────
  const byGuest: Record<string, { count: number; titles: string[]; lastPosted: string | null }> = {};
  for (const post of publishedPosts ?? []) {
    const guest = (post.description || "").replace(/^Guest:\s*/i, "").trim() || "Unknown";
    if (!byGuest[guest]) byGuest[guest] = { count: 0, titles: [], lastPosted: null };
    byGuest[guest].count++;
    byGuest[guest].titles.push(post.title);
    if (!byGuest[guest].lastPosted || post.published_at > byGuest[guest].lastPosted!) {
      byGuest[guest].lastPosted = post.published_at;
    }
  }

  // ── Step 5: Check Drive for remaining unposted clips per guest ─────────────
  let driveBreakdown: Array<{
    folder: string;
    total: number;
    posted: number;
    remaining: number;
  }> | null = null;

  const driveConn = await getDriveConnection(supabase);
  if (driveConn) {
    const folders = await listGuestSubfolders(driveConn.accessToken);
    driveBreakdown = [];

    await Promise.all(
      folders.map(async (folder) => {
        const clips = await listClipsInFolder(folder.id, driveConn.accessToken);
        const posted = clips.filter((c) => mergedPostedIds.includes(c.id)).length;
        driveBreakdown!.push({
          folder: folder.name,
          total: clips.length,
          posted,
          remaining: clips.length - posted,
        });
      })
    );

    // Sort: most remaining first
    driveBreakdown.sort((a, b) => b.remaining - a.remaining);
  }

  return NextResponse.json({
    summary: {
      totalPublished: publishedPosts?.length ?? 0,
      uniqueGuests: Object.keys(byGuest).length,
      trackedPostedIds: mergedPostedIds.length,
      newIdsSyncedFromPosts: newIdsAdded,
    },
    postedByGuest: Object.entries(byGuest)
      .sort((a, b) => (b[1].lastPosted ?? "").localeCompare(a[1].lastPosted ?? ""))
      .map(([guest, info]) => ({ guest, ...info })),
    driveBreakdown,
  });
}
