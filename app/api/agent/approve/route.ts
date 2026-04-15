import { NextRequest, NextResponse } from "next/server";
import { createAgentSupabaseClient } from "@/lib/agent-utils";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://iamm-podcast-mgr-v1.vercel.app";

/**
 * GET /api/agent/approve?token=<uuid>       — approve a single post
 * GET /api/agent/approve?group=<week_group> — approve all posts in a weekly batch
 *
 * Returns an HTML confirmation page (works in all email clients).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const group = searchParams.get("group");

  if (!token && !group) {
    return html("Missing approval token.", false);
  }

  const supabase = createAgentSupabaseClient();

  // ── Bulk approval by week_group_id ────────────────────────────────────────
  if (group) {
    const { data: posts, error } = await supabase
      .from("posts")
      .select("id, status, title, scheduled_at")
      .eq("week_group_id", group)
      .eq("status", "pending_approval");

    if (error || !posts || posts.length === 0) {
      return html("No pending posts found for this batch. They may already be approved.", false);
    }

    const ids = posts.map((p) => p.id);
    const { error: updateErr } = await supabase
      .from("posts")
      .update({
        status: "scheduled",
        approval_token: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (updateErr) {
      return html(`Failed to approve: ${updateErr.message}`, false);
    }

    const postLines = posts
      .map((p) => `<li style="color:#d0d0e0;margin:4px 0;">${p.title} — ${formatDate(p.scheduled_at)}</li>`)
      .join("");

    return html(
      `All ${posts.length} posts approved and scheduled!<br><br><ul style="padding-left:20px;">${postLines}</ul>`,
      true
    );
  }

  // ── Single post approval by token ─────────────────────────────────────────
  const { data: post, error: findErr } = await supabase
    .from("posts")
    .select("id, status, title, scheduled_at")
    .eq("approval_token", token)
    .maybeSingle();

  if (findErr || !post) {
    return html("Invalid or expired approval link.", false);
  }

  if (post.status !== "pending_approval") {
    return html(
      `"${post.title}" is already <strong>${post.status}</strong>.`,
      post.status === "scheduled" || post.status === "published"
    );
  }

  const { error: updateErr } = await supabase
    .from("posts")
    .update({
      status: "scheduled",
      approval_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", post.id);

  if (updateErr) {
    return html(`Failed to approve: ${updateErr.message}`, false);
  }

  return html(
    `"${post.title}" approved and scheduled for <strong>${formatDate(post.scheduled_at)}</strong> EST.`,
    true
  );
}

// ─────────────────────────────────────────────────────────────
// HTML response page
// ─────────────────────────────────────────────────────────────
function html(message: string, success: boolean): NextResponse {
  const icon = success ? "✅" : "❌";
  const color = success ? "#22c55e" : "#ef4444";
  const body = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Post ${success ? "Approved" : "Error"}</title>
  </head>
  <body style="background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box;">
    <div style="max-width:480px;text-align:center;">
      <div style="font-size:56px;margin-bottom:16px;">${icon}</div>
      <p style="color:${color};font-size:18px;font-weight:600;margin:0 0 16px;">${message}</p>
      <a href="${APP_URL}/schedule" style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:8px;">
        View Schedule →
      </a>
    </div>
  </body>
  </html>`;

  return new NextResponse(body, {
    status: success ? 200 : 400,
    headers: { "Content-Type": "text/html" },
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "unknown time";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
