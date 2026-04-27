import { NextResponse } from "next/server";

export async function GET() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;

  if (!clientKey || !redirectUri) {
    return NextResponse.json({ error: "TikTok OAuth not configured" }, { status: 500 });
  }

  const scope = "user.info.basic,video.publish";
  const state = Math.random().toString(36).substring(7);

  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: "code",
    scope,
    redirect_uri: redirectUri,
    state,
  });

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
