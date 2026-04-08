import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Google Drive OAuth not configured" },
      { status: 500 }
    );
  }

  const scope = "https://www.googleapis.com/auth/drive.readonly";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/auth?${params.toString()}`
  );
}
