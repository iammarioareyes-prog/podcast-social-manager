import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import {
  createAgentSupabaseClient,
  getDriveAccessToken,
  listGuestSubfolders,
  listClipsInFolder,
  validateCronRequest,
} from "@/lib/agent-utils";
import type { DriveFile } from "@/lib/google-drive";

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

  // ── Get already-posted Drive IDs ──────────────────────────────────────────
  const { data: configRow } = await supabase
    .from("agent_config")
    .select("value")
    .eq("key", "posted_drive_ids")
    .maybeSingle();
  const postedIds: string[] = (configRow?.value as string[]) ?? [];

  // ── Get folder rotation index (persisted across scans) ────────────────────
  const { data: rotRow } = await supabase
    .from("agent_config")
    .select("value")
    .eq("key", "folder_rotation_index")
    .maybeSingle();
  let rotationIndex: number = (rotRow?.value as number) ?? 0;

  // ── List all guest subfolders + their unposted clips (parallel) ───────────
  const subfolders = await listGuestSubfolders(driveToken);
  if (subfolders.length < 3) {
    return NextResponse.json({
      error: `Not enough guest folders in Drive. Found ${subfolders.length}, need ≥3.`,
    }, { status: 422 });
  }

  const folderClipLists = await Promise.all(
    subfolders.map(async (folder) => {
      const clips = await listClipsInFolder(folder.id, driveToken);
      return { folder, clips: clips.filter((c) => !postedIds.includes(c.id)) };
    })
  );
  const foldersWithContent = folderClipLists.filter((f) => f.clips.length > 0);

  // ── Build full round-robin queue ──────────────────────────────────────────
  const fullQueue: Array<{ folderName: string; file: DriveFile; folderId: string }> = [];
  const maxRounds = Math.max(...foldersWithContent.map((f) => f.clips.length));
  for (let round = 0; round < maxRounds; round++) {
    for (const { folder, clips } of foldersWithContent) {
      if (round < clips.length) {
        fullQueue.push({ folderName: folder.name, file: clips[round], folderId: folder.id });
      }
    }
  }

  if (fullQueue.length === 0) {
    return NextResponse.json({ error: "No unposted clips available" }, { status: 422 });
  }

  // ── Compute posting schedule for the coming week ──────────────────────────
  // 3 posts per posting day (Mon–Sat), 9am / 2pm / 7pm EDT
  const POSTING_HOURS_UTC = [13, 18, 23];
  const nextMonday = new Date();
  nextMonday.setUTCHours(0, 0, 0, 0);
  const dow = nextMonday.getUTCDay();
  const daysToMon = dow === 0 ? 1 : (8 - dow) % 7 || 7;
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysToMon);

  // Mon–Sat = offsets 0,1,2,3,4,5
  const weekSlots: string[] = [];
  for (let d = 0; d < 6; d++) {
    for (const hour of POSTING_HOURS_UTC) {
      const dt = new Date(nextMonday);
      dt.setUTCDate(nextMonday.getUTCDate() + d);
      dt.setUTCHours(hour, 0, 0, 0);
      weekSlots.push(dt.toISOString());
    }
  }
  // weekSlots has 18 entries (6 days × 3 times)

  // ── Load voice profile ────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("voice_profile")
    .select("*")
    .limit(1)
    .maybeSingle();

  // ── Build posts: pick next 18 clips from rotation queue ──────────────────
  // Only generate captions for first 3 to stay within 60s budget;
  // remainder get captions_json:{} and can be generated via Schedule page.
  const weekGroupId = `week-${nextMonday.toISOString().slice(0, 10)}`;
  const postsToInsert = [];
  const approvalToken = randomUUID(); // shared per batch for simplicity

  for (let i = 0; i < weekSlots.length; i++) {
    const queuePos = (rotationIndex + i) % fullQueue.length;
    const { folderName, file } = fullQueue[queuePos];

    // Generate captions for the first 3 posts only (time budget)
    let captions: { instagram: string; tiktok: string; youtube: string } =
      { instagram: "", tiktok: "", youtube: "" };
    if (i < 3) {
      captions = await generateCaptions(anthropic, profile, file.name, folderName);
    }

    postsToInsert.push({
      title: file.name.replace(/\.[^.]+$/, ""),
      description: `Guest: ${folderName}`,
      platforms: ["instagram", "tiktok", "youtube"],
      status: "scheduled",
      scheduled_at: weekSlots[i],
      content_url: `${APP_URL}/api/drive-proxy/${file.id}`,
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

  // ── Persist new rotation index ────────────────────────────────────────────
  const newIndex = (rotationIndex + weekSlots.length) % fullQueue.length;
  await supabase
    .from("agent_config")
    .upsert({ key: "folder_rotation_index", value: newIndex })
    .eq("key", "folder_rotation_index");

  return NextResponse.json({
    success: true,
    postsCreated: inserted.length,
    weekGroupId,
    foldersUsed: foldersWithContent.length,
    rotationIndexStart: rotationIndex,
    rotationIndexNext: newIndex,
    clips: postsToInsert.map((p) => ({
      title: p.title,
      guest: (p.description as string).replace("Guest: ", ""),
      when: p.scheduled_at,
    })),
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
  // Hashtags are NOT passed to Claude — they are appended at post time from voice_profile
  const podcastName = (profile?.podcast_name as string) || "I Am Mario Areyes";

  const voiceContext = voiceSummary ? `\n\nVoice & Style: ${voiceSummary}` : "";
  const examplesContext = voiceExamples.length > 0
    ? `\n\nExample captions:\n${voiceExamples.slice(0, 3).join("\n---\n")}`
    : "";

  const prompt = `You are writing social media captions for the podcast "${podcastName}".${voiceContext}${examplesContext}

Clip: "${clipName}"
Guest/Episode: "${guestName}"

Write captions for 3 platforms:

Instagram Reels: Compelling caption. End with EXACTLY: "${igTagsStr}". Do NOT include any hashtags — hashtags are added automatically at post time.

TikTok: Punchy hook-driven caption under 150 chars. Do NOT include any hashtags.

YouTube Shorts: Engaging caption 150-300 chars with CTA. Do NOT include any hashtags.

Return JSON only, no extra text — caption text only, no hashtags anywhere:
{
  "instagram": "caption text only, no hashtags",
  "tiktok": "caption text only, no hashtags",
  "youtube": "caption text only, no hashtags"
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
