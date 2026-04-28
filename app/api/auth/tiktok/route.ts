import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;

  if (!clientKey || !redirectUri) {
    return NextResponse.json({ error: "TikTok OAuth not configured" }, { status: 500 });
  }

  const scope = "user.info.basic"; // TEST: isolate whether video.upload scope is the blocker
  const state = Math.random().toString(36).substring(7);

  // Build params WITHOUT scope so URLSearchParams doesn't encode the comma as %2C.
  // TikTok's OAuth server requires a literal comma between scopes.
  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });

  // Append scope manually to preserve the literal comma
  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}&scope=${scope}`;
  return NextResponse.redirect(authUrl);
}
