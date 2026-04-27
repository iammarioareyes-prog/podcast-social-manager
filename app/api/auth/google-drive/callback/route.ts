import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iamm-podcast-mgr-v1.vercel.app";

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings?error=drive_auth_failed`);
  }

  try {
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

    // Try update first; if no row exists yet, insert
    const { data: existing } = await supabase
      .from("platform_connections")
      .select("id")
      .eq("platform", "google_drive")
      .limit(1)
      .maybeSingle();

    const payload = {
      platform: "google_drive",
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

    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from("platform_connections")
        .update(payload)
        .eq("id", existing.id);
      if (updateErr) console.error("Drive connection update error:", updateErr);
    } else {
      const { error: insertErr } = await supabase
        .from("platform_connections")
        .insert(payload);
      if (insertErr) console.error("Drive connection insert error:", insertErr);
    }

    return NextResponse.redirect(`${appUrl}/settings?success=drive_connected`);
  } catch (err) {
    console.error("Google Drive OAuth callback error:", err);
    return NextResponse.redirect(`${appUrl}/settings?error=drive_auth_error`);
  }
}
