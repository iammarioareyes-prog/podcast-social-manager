import { NextRequest, NextResponse } from "next/server";
import {
  createAgentSupabaseClient,
  markDriveIdsAsPosted,
  validateCronRequest,
} from "@/lib/agent-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://iamm-podcast-mgr-v1.vercel.app";

/**
 * POST /api/agent/run
 *
 * Called 3× daily (9am / 2pm / 7pm EDT) Mon–Sat by Vercel cron.
 * Checks the current week pattern and skips if today isn't a posting day.
 * Finds any scheduled posts due within a 15-minute window and posts them
 * to Instagram, TikTok, and YouTube simultaneously.
 */
export async function POST(req: NextRequest) {
  if (!validateCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAgentSupabaseClient();

  // ── Find scheduled posts due within ±10 minutes of now ──────────────────
  const now = new Date();
  const windowStart = new Date(now.getTime() - 10 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 10 * 60 * 1000);

  // Use 'publishing' status as a lock to prevent double-posting
  // First claim them atomically
  const { data: duePosts, error: fetchErr } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "scheduled")
    .gte("scheduled_at", windowStart.toISOString())
    .lte("scheduled_at", windowEnd.toISOString());

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!duePosts || duePosts.length === 0) {
    return NextResponse.json({ success: true, posted: 0, message: "No posts due in this window" });
  }

  // Atomically claim posts by marking them 'publishing' to prevent double-runs
  const postIds = duePosts.map((p) => p.id);
  await supabase
    .from("posts")
    .update({ status: "publishing", updated_at: now.toISOString() })
    .in("id", postIds)
    .eq("status", "scheduled"); // guard: only update if still scheduled

  // ── Post each to all 3 platforms in parallel ─────────────────────────────
  const results = [];

  for (const post of duePosts) {
    const captions = (post.captions_json as Record<string, string>) || {};
    const videoUrl = post.content_url;

    if (!videoUrl) {
      await supabase.from("posts").update({ status: "failed" }).eq("id", post.id);
      results.push({ postId: post.id, error: "No content_url" });
      continue;
    }

    const [igRes, ttRes, ytRes] = await Promise.allSettled([
      callPlatform(`${APP_URL}/api/instagram/post`, {
        postId: post.id,
        caption: captions.instagram || post.caption || post.title,
        videoUrl,
      }),
      callPlatform(`${APP_URL}/api/tiktok/post`, {
        postId: post.id,
        title: captions.tiktok || post.title,
        videoUrl,
      }),
      callPlatform(`${APP_URL}/api/youtube/upload`, {
        postId: post.id,
        title: post.title,
        description: captions.youtube || post.description || "",
        tags: post.hashtags || [],
        videoUrl,
      }),
    ]);

    // Collect platform post IDs from successful responses
    const platformPostIds: Record<string, string> = {};
    if (igRes.status === "fulfilled" && igRes.value.mediaId) {
      platformPostIds.instagram = igRes.value.mediaId;
    }
    if (ttRes.status === "fulfilled" && ttRes.value.publishId) {
      platformPostIds.tiktok = ttRes.value.publishId;
    }
    if (ytRes.status === "fulfilled" && ytRes.value.videoId) {
      platformPostIds.youtube = ytRes.value.videoId;
    }

    const succeeded = [igRes, ttRes, ytRes].filter((r) => r.status === "fulfilled").length;
    const failed    = [igRes, ttRes, ytRes].filter((r) => r.status === "rejected").length;
    const newStatus = succeeded === 3 ? "published" : failed === 3 ? "failed" : "published";

    await supabase.from("posts").update({
      status: newStatus,
      published_at: succeeded > 0 ? now.toISOString() : null,
      platform_post_ids: platformPostIds,
      updated_at: now.toISOString(),
    }).eq("id", post.id);

    // Mark Drive file as posted so it won't be re-selected
    if (post.drive_file_id && succeeded > 0) {
      await markDriveIdsAsPosted(supabase, [post.drive_file_id]);
    }

    results.push({
      postId: post.id,
      title: post.title,
      status: newStatus,
      platformResults: {
        instagram: igRes.status === "fulfilled" ? "ok" : igRes.reason,
        tiktok:    ttRes.status === "fulfilled" ? "ok" : ttRes.reason,
        youtube:   ytRes.status === "fulfilled" ? "ok" : ytRes.reason,
      },
    });
  }

  return NextResponse.json({ success: true, posted: results.length, results });
}

// ─────────────────────────────────────────────────────────────
// Internal fetch helper
// ─────────────────────────────────────────────────────────────
async function callPlatform(url: string, body: Record<string, unknown>): Promise<Record<string, string>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
