import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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
    return NextResponse.redirect(`${appUrl}/settings?error=youtube_auth_failed`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.YOUTUBE_CLIENT_ID!,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
        redirect_uri: process.env.YOUTUBE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokenRes.ok || tokens.error) {
      console.error("YouTube token exchange failed:", tokens);
      return NextResponse.redirect(`${appUrl}/settings?error=youtube_token_failed`);
    }

    // Fetch channel info
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];

    // Store tokens in Supabase
    await supabase.from("platform_connections").upsert(
      {
        platform: "youtube",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        platform_user_id: channel?.id,
        platform_username: channel?.snippet?.title,
        is_connected: true,
        metadata: {
          subscriber_count: channel?.statistics?.subscriberCount,
          video_count: channel?.statistics?.videoCount,
          thumbnail_url: channel?.snippet?.thumbnails?.default?.url,
        },
      },
      { onConflict: "platform" }
    );

    return NextResponse.redirect(`${appUrl}/settings?success=youtube_connected`);
  } catch (err) {
    console.error("YouTube OAuth callback error:", err);
    return NextResponse.redirect(`${appUrl}/settings?error=youtube_auth_error`);
  }
}
