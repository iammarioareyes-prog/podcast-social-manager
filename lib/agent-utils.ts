import { createClient } from "@supabase/supabase-js";
import { listDriveFiles, DriveFile } from "@/lib/google-drive";

// ─────────────────────────────────────────────────────────────
// Supabase client
// ─────────────────────────────────────────────────────────────
export function createAgentSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type SupabaseClient = ReturnType<typeof createAgentSupabaseClient>;

// ─────────────────────────────────────────────────────────────
// Google Drive token (with auto-refresh)
// ─────────────────────────────────────────────────────────────
export async function getDriveAccessToken(supabase: SupabaseClient): Promise<string | null> {
  const { data: conn } = await supabase
    .from("platform_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("platform", "google_drive")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conn?.access_token) return null;

  const isExpired = conn.token_expires_at
    ? Date.now() > new Date(conn.token_expires_at).getTime() - 60_000
    : false;

  if (isExpired && conn.refresh_token) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: conn.refresh_token,
        client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
        grant_type: "refresh_token",
      }),
    });
    const refreshed = await res.json();
    if (refreshed.access_token) {
      await supabase
        .from("platform_connections")
        .update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
        })
        .eq("platform", "google_drive");
      return refreshed.access_token;
    }
    return null;
  }

  return conn.access_token;
}

// ─────────────────────────────────────────────────────────────
// Drive folder helpers
// ─────────────────────────────────────────────────────────────
export async function listGuestSubfolders(accessToken: string): Promise<DriveFile[]> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const result = await listDriveFiles({
    folderId: rootFolderId || "root",
    mimeType: "application/vnd.google-apps.folder",
    pageSize: 100,
    accessToken,
  });
  return result.files ?? [];
}

export async function listClipsInFolder(folderId: string, accessToken: string): Promise<DriveFile[]> {
  const result = await listDriveFiles({
    folderId,
    pageSize: 50,
    accessToken,
  });
  // Return only video files
  return (result.files ?? []).filter(
    (f) => f.mimeType.startsWith("video/") || f.mimeType === "application/octet-stream"
  );
}

// ─────────────────────────────────────────────────────────────
// Clip selection — 3 clips from 3 different guest folders
// ─────────────────────────────────────────────────────────────
export async function pickRandomClips(
  subfolders: DriveFile[],
  count: number,
  postedIds: string[],
  accessToken: string
): Promise<Array<{ file: DriveFile; folderName: string }>> {
  // Shuffle subfolders
  const shuffled = [...subfolders].sort(() => Math.random() - 0.5);
  const picks: Array<{ file: DriveFile; folderName: string }> = [];

  for (const folder of shuffled) {
    if (picks.length >= count) break;
    const clips = await listClipsInFolder(folder.id, accessToken);
    const unposted = clips.filter((c) => !postedIds.includes(c.id));
    if (unposted.length === 0) continue;
    // Pick a random clip from this folder
    const chosen = unposted[Math.floor(Math.random() * unposted.length)];
    picks.push({ file: chosen, folderName: folder.name });
  }

  return picks;
}

// ─────────────────────────────────────────────────────────────
// Week pattern management
// ─────────────────────────────────────────────────────────────
export async function getWeekPattern(supabase: SupabaseClient): Promise<"A" | "B"> {
  const { data } = await supabase
    .from("agent_config")
    .select("value")
    .eq("key", "week_pattern")
    .single();
  return (data?.value as "A" | "B") ?? "A";
}

export async function flipWeekPattern(supabase: SupabaseClient): Promise<"A" | "B"> {
  const current = await getWeekPattern(supabase);
  const next = current === "A" ? "B" : "A";
  await supabase
    .from("agent_config")
    .update({ value: next, updated_at: new Date().toISOString() })
    .eq("key", "week_pattern");
  return next;
}

export async function markDriveIdsAsPosted(supabase: SupabaseClient, ids: string[]): Promise<void> {
  const { data } = await supabase
    .from("agent_config")
    .select("value")
    .eq("key", "posted_drive_ids")
    .single();
  const existing: string[] = (data?.value as string[]) ?? [];
  const merged = Array.from(new Set([...existing, ...ids]));
  await supabase
    .from("agent_config")
    .update({ value: merged, updated_at: new Date().toISOString() })
    .eq("key", "posted_drive_ids");
}

// ─────────────────────────────────────────────────────────────
// Scheduling helpers
// ─────────────────────────────────────────────────────────────

// Week A: Mon/Wed/Fri  — UTC day values 1,3,5
// Week B: Tue/Thu/Sat  — UTC day values 2,4,6
export function isTodayPostingDay(pattern: "A" | "B"): boolean {
  const dow = new Date().getUTCDay();
  return pattern === "A" ? [1, 3, 5].includes(dow) : [2, 4, 6].includes(dow);
}

/**
 * Compute the 3 scheduled_at timestamps for the upcoming posting week.
 * Assumes this is called on (or just after) Monday 00:00 UTC.
 *
 * Posting times (EST = UTC-4 during EDT):
 *   Morning   9am EDT = 13:00 UTC
 *   Afternoon 2pm EDT = 18:00 UTC
 *   Night     7pm EDT = 23:00 UTC
 */
export function computePostingSchedule(pattern: "A" | "B"): string[] {
  const now = new Date();

  // Find the Monday of the current week (or next Monday if Sunday)
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  const dow = monday.getUTCDay();
  if (dow !== 1) {
    const daysUntilMonday = dow === 0 ? 1 : 8 - dow;
    monday.setUTCDate(monday.getUTCDate() + daysUntilMonday);
  }

  const at = (daysOffset: number, utcHour: number): string => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + daysOffset);
    d.setUTCHours(utcHour, 0, 0, 0);
    return d.toISOString();
  };

  // Pattern A: Mon 9am, Wed 2pm, Fri 7pm  (UTC: +0d/13h, +2d/18h, +4d/23h)
  // Pattern B: Tue 9am, Thu 2pm, Sat 7pm  (UTC: +1d/13h, +3d/18h, +5d/23h)
  if (pattern === "A") {
    return [at(0, 13), at(2, 18), at(4, 23)];
  } else {
    return [at(1, 13), at(3, 18), at(5, 23)];
  }
}

// ─────────────────────────────────────────────────────────────
// Cron security
// ─────────────────────────────────────────────────────────────
export function validateCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // If CRON_SECRET is not configured, allow all cron calls (Vercel invocation only)
  if (!secret) return true;
  // Vercel sends: Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}
