import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const appId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: "Instagram OAuth not configured" },
      { status: 500 }
    );
  }

  const scope = [
    "instagram_basic",
    "instagram_content_publish",
    "business_management",
    "pages_show_list",
    "pages_read_engagement",
  ].join(",");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope,
    response_type: "code",
  });

  return NextResponse.redirect(
    `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
  );
}
