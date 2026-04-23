import { NextResponse } from "next/server";
import { createAgentSupabaseClient, markDriveIdsAsPosted } from "@/lib/agent-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://iamm-podcast-mgr-v1.vercel.app";

/**
 * GET /api/admin/post-now
 *
 * One-shot admin endpoint: finds ALL scheduled posts for today that haven't
 * been published yet (regardless of scheduled_at time) and posts them now.
 */
export async function GET() {

  const supabase = createAgentSupabaseClient();

  // Find all scheduled posts for today (UTC) — no time-window restriction
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .in("status", ["scheduled", "publishing"]) // pick up stuck 'publishing' too
    .gte("scheduled_at", todayStart.toISOString())
    .lte("scheduled_at", todayEnd.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ success: true, posted: 0, message: "No unposted scheduled posts found for today" });
  }

  const now = new Date();
  const postIds = posts.map((p) => p.id);

  // Claim them
  await supabase
    .from("posts")
    .update({ status: "publishing", updated_at: now.toISOString() })
    .in("id", postIds);

  const results = [];

  for (const post of posts) {
    const captions = (post.captions_json as Record<string, string>) || {};
    const videoUrl = post.content_url;

    if (!videoUrl) {
      await supabase.from("posts").update({ status: "failed" }).eq("id", post.id);
      results.push({ postId: post.id, title: post.title, error: "No content_url" });
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

    const platformPostIds: Record<string, string> = {};
    if (igRes.status === "fulfilled" && igRes.value.mediaId)  platformPostIds.instagram = igRes.value.mediaId;
    if (ttRes.status === "fulfilled" && ttRes.value.publishId) platformPostIds.tiktok   = ttRes.value.publishId;
    if (ytRes.status === "fulfilled" && ytRes.value.videoId)  platformPostIds.youtube   = ytRes.value.videoId;

    const succeeded = [igRes, ttRes, ytRes].filter((r) => r.status === "fulfilled").length;
    const failed    = [igRes, ttRes, ytRes].filter((r) => r.status === "rejected").length;
    const newStatus = failed === 3 ? "failed" : "published";

    await supabase.from("posts").update({
      status: newStatus,
      published_at: succeeded > 0 ? now.toISOString() : null,
      platform_post_ids: platformPostIds,
      updated_at: now.toISOString(),
    }).eq("id", post.id);

    if (post.drive_file_id && succeeded > 0) {
      await markDriveIdsAsPosted(supabase, [post.drive_file_id]);
    }

    results.push({
      postId: post.id,
      title: post.title,
      status: newStatus,
      platformResults: {
        instagram: igRes.status === "fulfilled" ? "ok" : (igRes as PromiseRejectedResult).reason?.message || "failed",
        tiktok:    ttRes.status === "fulfilled" ? "ok" : (ttRes as PromiseRejectedResult).reason?.message || "failed",
        youtube:   ytRes.status === "fulfilled" ? "ok" : (ytRes as PromiseRejectedResult).reason?.message || "failed",
      },
    });
  }

  return NextResponse.json({ success: true, posted: results.length, results });
}

async function callPlatform(url: string, body: Record<string, unknown>): Promise<Record<string, string>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50_000); // 50s hard limit
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
