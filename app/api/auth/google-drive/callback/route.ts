import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSSRSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iamm-podcast-mgr-v1.vercel.app";

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings?error=drive_auth_failed`);
  }

  try {
    // Get the authenticated user from their session cookie
    const ssrClient = createSSRSupabaseClient();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${appUrl}/login?next=/settings`);
    }

    // Service role client for DB writes
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_DRIVE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokenRes.ok || tokens.error) {
      console.error("Google Drive token exchange failed:", tokens);
      const reason = encodeURIComponent(tokens.error_description || tokens.error || "unknown");
      return NextResponse.redirect(`${appUrl}/settings?error=drive_token_failed&reason=${reason}`);
    }

    // Fetch user info to get display name
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userRes.json();

    const payload = {
      user_id: user.id,
      platform: "google_drive" as const,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      platform_user_id: userInfo.id,
      platform_username: userInfo.email,
      is_connected: true,
      metadata: {
        email: userInfo.email,
        name: userInfo.name,
        folder_id: process.env.GOOGLE_DRIVE_FOLDER_ID || "",
      },
    };

    // Try user-scoped upsert (after migration 004 runs)
    const { error: upsertErr } = await supabase
      .from("platform_connections")
      .upsert(payload, { onConflict: "user_id,platform" });

    if (upsertErr) {
      // Pre-migration fallback: update by platform only
      const { data: existing } = await supabase
        .from("platform_connections")
        .select("id")
        .eq("platform", "google_drive")
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from("platform_connections").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("platform_connections").insert(payload);
      }
    }

    return NextResponse.redirect(`${appUrl}/settings?success=drive_connected`);
  } catch (err) {
    console.error("Google Drive OAuth callback error:", err);
    return NextResponse.redirect(`${appUrl}/settings?error=drive_auth_error`);
  }
}
