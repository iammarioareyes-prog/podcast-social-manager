import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iamm-podcast-mgr-v1.vercel.app";

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings?error=tiktok_auth_failed`);
  }

  try {
    const clientKey = process.env.TIKTOK_CLIENT_KEY!;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET!;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI!;

    // Exchange code for tokens
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error("TikTok token error:", tokenData);
      return NextResponse.redirect(`${appUrl}/settings?error=tiktok_token_failed`);
    }

    const { access_token, refresh_token, expires_in, open_id } = tokenData;

    // Get user info
    const userRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const userData = await userRes.json();
    const username =
      userData?.data?.user?.display_name ||
      userData?.data?.user?.username ||
      open_id;

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Upsert into platform_connections
    await supabase.from("platform_connections").upsert(
      {
        platform: "tiktok",
        access_token,
        refresh_token,
        token_expires_at: expiresAt,
        platform_user_id: open_id,
        platform_username: username,
        is_connected: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "platform" }
    );

    return NextResponse.redirect(`${appUrl}/settings?success=tiktok_connected`);
  } catch (err) {
    console.error("TikTok callback error:", err);
    return NextResponse.redirect(`${appUrl}/settings?error=tiktok_callback_error`);
  }
}
