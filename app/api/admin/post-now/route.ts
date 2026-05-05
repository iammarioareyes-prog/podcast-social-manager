import { NextResponse } from "next/server";
import { createAgentSupabaseClient, markDriveIdsAsPosted } from "@/lib/agent-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://iamm-podcast-mgr-v1.vercel.app";

/**
 * GET /api/admin/post-now
 *
 * One-shot admin endpoint: finds ALL scheduled/stuck posts for today that
 * haven't been published yet and posts them all IN PARALLEL so the total
 * execution time is bounded by the slowest single post, not post count × time.
 */
export async function GET() {
  const supabase = createAgentSupabaseClient();
  const now = new Date();

  // Find all scheduled/stuck posts for today (UTC)
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);

  // Reset today's failed OR stuck-publishing posts back to scheduled so they get retried.
  // "publishing" posts can get stuck if a previous function invocation timed out before
  // it could write the final status — treat them the same as failed.
  await supabase
    .from("posts")
    .update({ status: "scheduled", updated_at: now.toISOString() })
    .in("status", ["failed", "publishing"])
    .gte("scheduled_at", todayStart.toISOString())
    .lte("scheduled_at", todayEnd.toISOString());

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .in("status", ["scheduled", "publishing"]) // pick up stuck 'publishing' too
    .gte("scheduled_at", todayStart.toISOString())
    .lte("scheduled_at", now.toISOString()) // only posts whose time has come
    .order("scheduled_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({
      success: true,
      posted: 0,
      message: "No unposted scheduled posts found for today",
    });
  }

  // Claim all posts atomically before any posting begins
  const postIds = posts.map((p) => p.id);
  await supabase
    .from("posts")
    .update({ status: "publishing", updated_at: now.toISOString() })
    .in("id", postIds);

  // ── Post ALL posts in parallel ────────────────────────────────────────────
  // Total time = max(individual post time) rather than sum.
  const postResults = await Promise.allSettled(
    posts.map(async (post) => {
      const captions = (post.captions_json as Record<string, string>) || {};
      const videoUrl = post.content_url;

      // Build caption from guest name stored in description ("Guest: <name>").
      // This is the fallback when no AI-generated caption exists in captions_json.
      const guestName = (post.description || "").replace(/^Guest:\s*/i, "").trim();
      const defaultCaption = guestName
        ? `${post.title}\n\n${guestName} drops knowledge on the I Am Mario Areyes Podcast. You don't want to miss this one. 🎙️\n\nFull convo → link in bio`
        : post.title;

      // Prefer AI captions from captions_json; fall through to the template.
      // NOTE: never use post.description as a caption — it holds internal metadata ("Guest: X").
      const igCaption  = captions.instagram || defaultCaption;
      const ytDesc     = captions.youtube   || defaultCaption;
      const ttTitle    = captions.tiktok    || post.title;

      if (!videoUrl) {
        await supabase.from("posts").update({ status: "failed" }).eq("id", post.id);
        return { postId: post.id, title: post.title, error: "No content_url" };
      }

      const [igRes, ttRes, ytRes] = await Promise.allSettled([
        callPlatform(`${APP_URL}/api/instagram/post`, {
          postId: post.id,
          caption: igCaption,
          videoUrl,
        }),
        callPlatform(`${APP_URL}/api/tiktok/post`, {
          postId: post.id,
          title: ttTitle,
          videoUrl,
        }),
        callPlatform(`${APP_URL}/api/youtube/upload`, {
          postId: post.id,
          title: post.title,
          description: ytDesc,
          tags: post.hashtags || [],
          videoUrl,
          driveFileId: post.drive_file_id || undefined,
        }),
      ]);

      const platformPostIds: Record<string, string> = {};
      if (igRes.status === "fulfilled" && igRes.value.mediaId)   platformPostIds.instagram = igRes.value.mediaId;
      if (ttRes.status === "fulfilled" && ttRes.value.publishId)  platformPostIds.tiktok   = ttRes.value.publishId;
      if (ytRes.status === "fulfilled" && ytRes.value.videoId)   platformPostIds.youtube   = ytRes.value.videoId;

      const succeeded = [igRes, ttRes, ytRes].filter((r) => r.status === "fulfilled").length;
      const newStatus = succeeded === 0 ? "failed" : "published";

      await supabase.from("posts").update({
        status: newStatus,
        published_at: succeeded > 0 ? now.toISOString() : null,
        platform_post_ids: platformPostIds,
        updated_at: now.toISOString(),
      }).eq("id", post.id);

      if (post.drive_file_id && succeeded > 0) {
        await markDriveIdsAsPosted(supabase, [post.drive_file_id]);
      }

      return {
        postId: post.id,
        title: post.title,
        status: newStatus,
        platformResults: {
          instagram: igRes.status === "fulfilled" ? "ok" : (igRes as PromiseRejectedResult).reason?.message || "failed",
          tiktok:    ttRes.status === "fulfilled" ? "ok" : (ttRes as PromiseRejectedResult).reason?.message || "failed",
          youtube:   ytRes.status === "fulfilled" ? "ok" : (ytRes as PromiseRejectedResult).reason?.message || "failed",
        },
      };
    })
  );

  const results = postResults.map((r) =>
    r.status === "fulfilled" ? r.value : { error: r.reason?.message }
  );

  return NextResponse.json({ success: true, posted: posts.length, results });
}

async function callPlatform(url: string, body: Record<string, unknown>): Promise<Record<string, string>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000); // 55s hard limit per platform
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
