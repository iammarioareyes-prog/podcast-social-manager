import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import {
  createAgentSupabaseClient,
  getDriveAccessToken,
  listGuestSubfolders,
  pickRandomClips,
  computePostingSchedule,
  flipWeekPattern,
  validateCronRequest,
} from "@/lib/agent-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://iamm-podcast-mgr-v1.vercel.app";

// ─────────────────────────────────────────────────────────────
// GET /api/agent/scan  — Vercel cron sends GET requests
// POST /api/agent/scan — kept for manual triggers
// Called every Sunday night (Monday 00:00 UTC) by Vercel cron.
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  return runScan(req);
}

export async function POST(req: NextRequest) {
  return runScan(req);
}

async function runScan(req: NextRequest) {
  if (!validateCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAgentSupabaseClient();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ── Guard: don't create duplicate batches for the same week ─────────────
  const { data: existingPending } = await supabase
    .from("posts")
    .select("id")
    .eq("status", "pending_approval")
    .limit(1);
  if (existingPending && existingPending.length > 0) {
    return NextResponse.json({
      skipped: true,
      reason: "Pending approval posts already exist for this week. Approve or delete them first.",
    });
  }

  // ── Get Drive token ───────────────────────────────────────────────────────
  const driveToken = await getDriveAccessToken(supabase);
  if (!driveToken) {
    return NextResponse.json({ error: "Google Drive not connected" }, { status: 503 });
  }

  // ── Get week pattern and compute schedule BEFORE flipping ────────────────
  // We read the current pattern, generate the schedule for it, then flip.
  const { data: patternRow } = await supabase
    .from("agent_config")
    .select("value")
    .eq("key", "week_pattern")
    .single();
  const weekPattern: "A" | "B" = (patternRow?.value as "A" | "B") ?? "A";
  const scheduledTimes = computePostingSchedule(weekPattern);

  // ── Get already-posted Drive IDs ──────────────────────────────────────────
  const { data: configRow } = await supabase
    .from("agent_config")
    .select("value")
    .eq("key", "posted_drive_ids")
    .single();
  const postedIds: string[] = (configRow?.value as string[]) ?? [];

  // ── Pick 3 clips from 3 different guest folders ───────────────────────────
  const subfolders = await listGuestSubfolders(driveToken);
  if (subfolders.length < 3) {
    return NextResponse.json({
      error: `Not enough guest folders found in Drive. Found ${subfolders.length}, need at least 3.`,
    }, { status: 422 });
  }

  const picks = await pickRandomClips(subfolders, 3, postedIds, driveToken);
  if (picks.length < 3) {
    return NextResponse.json({
      error: `Not enough unposted clips across different guests. Found ${picks.length}/3.`,
    }, { status: 422 });
  }

  // ── Load voice profile ────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("voice_profile")
    .select("*")
    .limit(1)
    .maybeSingle();

  // ── Generate captions + build post rows ──────────────────────────────────
  const weekGroupId = `${weekPattern}-${scheduledTimes[0].slice(0, 10)}`;
  const postsToInsert = [];

  for (let i = 0; i < picks.length; i++) {
    const { file, folderName } = picks[i];
    const captions = await generateCaptions(anthropic, profile, file.name, folderName);
    const proxyUrl = `${APP_URL}/api/drive-proxy/${file.id}`;
    const approvalToken = randomUUID();

    postsToInsert.push({
      title: file.name.replace(/\.[^.]+$/, ""), // strip file extension
      description: `Guest: ${folderName}`,
      platforms: ["instagram", "tiktok", "youtube"],
      status: "pending_approval",
      scheduled_at: scheduledTimes[i],
      content_url: proxyUrl,
      drive_file_id: file.id,
      approval_token: approvalToken,
      week_group_id: weekGroupId,
      captions_json: captions,
      caption: captions.instagram,
      hashtags: [],
      platform_post_ids: {},
    });
  }

  // ── Insert to Supabase ────────────────────────────────────────────────────
  const { data: inserted, error: insertErr } = await supabase
    .from("posts")
    .insert(postsToInsert)
    .select();

  if (insertErr || !inserted) {
    console.error("Agent scan insert error:", insertErr);
    return NextResponse.json({ error: insertErr?.message || "Insert failed" }, { status: 500 });
  }

  // ── Send approval email ───────────────────────────────────────────────────
  await sendApprovalEmail(inserted, weekGroupId, weekPattern, scheduledTimes);

  // ── Flip week pattern for next Sunday ────────────────────────────────────
  await flipWeekPattern(supabase);

  return NextResponse.json({
    success: true,
    weekPattern,
    nextWeekPattern: weekPattern === "A" ? "B" : "A",
    postsCreated: inserted.length,
    weekGroupId,
    scheduledTimes,
    clips: picks.map((p) => ({ name: p.file.name, guest: p.folderName })),
  });
}

// ─────────────────────────────────────────────────────────────
// Caption generation (reuses exact same prompt as /api/caption/generate)
// ─────────────────────────────────────────────────────────────
async function generateCaptions(
  anthropic: Anthropic,
  profile: Record<string, unknown> | null,
  clipName: string,
  guestName: string
): Promise<{ instagram: string; tiktok: string; youtube: string }> {
  const igTags = (profile?.ig_tags as string[]) || [];
  const igTagsStr = igTags.map((t: string) => `@${t.replace("@", "")}`).join(" ");
  const voiceSummary = (profile?.voice_summary as string) || "";
  const voiceExamples = (profile?.voice_examples as string[]) || [];
  const igHashtags = (profile?.ig_hashtags as string[]) || [];
  const tiktokHashtags = (profile?.tiktok_hashtags as string[]) || [];
  const youtubeHashtags = (profile?.youtube_hashtags as string[]) || [];
  const podcastName = (profile?.podcast_name as string) || "I Am Mario Areyes";

  const voiceContext = voiceSummary ? `\n\nVoice & Style: ${voiceSummary}` : "";
  const examplesContext = voiceExamples.length > 0
    ? `\n\nExample captions:\n${voiceExamples.slice(0, 3).join("\n---\n")}`
    : "";

  const prompt = `You are writing social media captions for the podcast "${podcastName}".${voiceContext}${examplesContext}

Clip: "${clipName}"
Guest/Episode: "${guestName}"

Write captions for 3 platforms:

Instagram Reels: Compelling caption. End with EXACTLY: "${igTagsStr}" then hashtags. 10-15 hashtags.${igHashtags.length ? ` Use: ${igHashtags.join(", ")}` : ""}

TikTok: Punchy hook-driven caption under 150 chars. 3-5 hashtags.${tiktokHashtags.length ? ` Use: ${tiktokHashtags.join(", ")}` : ""}

YouTube Shorts: Engaging caption 150-300 chars with CTA. 3-5 hashtags.${youtubeHashtags.length ? ` Use: ${youtubeHashtags.join(", ")}` : ""}

Return JSON only, no extra text:
{
  "instagram": "full caption with tags and hashtags",
  "tiktok": "full caption with hashtags",
  "youtube": "full caption with hashtags"
}`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { instagram: clipName, tiktok: clipName, youtube: clipName };
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    instagram: parsed.instagram || clipName,
    tiktok: parsed.tiktok || clipName,
    youtube: parsed.youtube || clipName,
  };
}

// ─────────────────────────────────────────────────────────────
// Approval email via Resend
// ─────────────────────────────────────────────────────────────
async function sendApprovalEmail(
  posts: Record<string, unknown>[],
  weekGroupId: string,
  pattern: "A" | "B",
  scheduledTimes: string[]
) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const toEmail = process.env.APPROVAL_EMAIL || "iammarioareyes@gmail.com";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping approval email");
    return;
  }

  const days = pattern === "A"
    ? ["Monday 9am", "Wednesday 2pm", "Friday 7pm"]
    : ["Tuesday 9am", "Thursday 2pm", "Saturday 7pm"];

  const postCards = posts.map((post: Record<string, unknown>, i: number) => {
    const captions = (post.captions_json as Record<string, string>) || {};
    const approveUrl = `${APP_URL}/api/agent/approve?token=${post.approval_token}`;
    return `
    <div style="background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:24px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <span style="background:#7c3aed;color:white;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;">${days[i]}</span>
        <span style="color:#a0a0b0;font-size:13px;">Post ${i + 1} of 3</span>
      </div>
      <h3 style="color:white;margin:0 0 4px;font-size:16px;">${post.title}</h3>
      <p style="color:#a0a0b0;font-size:13px;margin:0 0 16px;">📁 ${post.description}</p>

      <div style="background:#0f0f1a;border-radius:8px;padding:14px;margin-bottom:10px;">
        <p style="color:#e1306c;font-size:11px;font-weight:700;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">Instagram</p>
        <p style="color:#d0d0e0;font-size:13px;margin:0;line-height:1.5;">${truncate(captions.instagram, 200)}</p>
      </div>
      <div style="background:#0f0f1a;border-radius:8px;padding:14px;margin-bottom:10px;">
        <p style="color:#69c9d0;font-size:11px;font-weight:700;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">TikTok</p>
        <p style="color:#d0d0e0;font-size:13px;margin:0;line-height:1.5;">${truncate(captions.tiktok, 200)}</p>
      </div>
      <div style="background:#0f0f1a;border-radius:8px;padding:14px;margin-bottom:16px;">
        <p style="color:#ff0000;font-size:11px;font-weight:700;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">YouTube</p>
        <p style="color:#d0d0e0;font-size:13px;margin:0;line-height:1.5;">${truncate(captions.youtube, 200)}</p>
      </div>

      <a href="${approveUrl}" style="display:inline-block;background:#22c55e;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
        ✅ Approve This Post
      </a>
    </div>`;
  }).join("");

  const approveAllUrl = `${APP_URL}/api/agent/approve?group=${weekGroupId}`;
  const weekLabel = pattern === "A" ? "Mon / Wed / Fri" : "Tue / Thu / Sat";
  const dateLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px 16px;margin:0;">
    <div style="max-width:600px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:32px;">
        <h1 style="color:white;font-size:22px;margin:0 0 8px;">🎙️ Weekly Clips Ready for Approval</h1>
        <p style="color:#a0a0b0;font-size:14px;margin:0;">Week of ${dateLabel} · ${weekLabel} · All 3 platforms</p>
      </div>

      ${postCards}

      <div style="text-align:center;border-top:1px solid #333;padding-top:24px;margin-top:8px;">
        <p style="color:#a0a0b0;font-size:13px;margin:0 0 16px;">Or approve all 3 posts at once:</p>
        <a href="${approveAllUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          ✅ Approve All 3 Posts
        </a>
        <p style="color:#666;font-size:11px;margin:16px 0 0;">Powered by your Podcast Social Manager agent</p>
      </div>
    </div>
  </body>
  </html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: `[Podcast Agent] 3 Clips Ready — ${weekLabel} — ${dateLabel}`,
      html,
    }),
  });

  if (!res.ok) {
    console.error("Resend email error:", await res.text());
  }
}

function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}
