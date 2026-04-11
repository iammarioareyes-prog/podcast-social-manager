import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iamm-podcast-mgr-v1.vercel.app";

  if (error || !code) {
    console.error("Instagram auth error:", error);
    return NextResponse.redirect(`${appUrl}/settings?error=instagram_auth_failed`);
  }

  try {
    const appId = process.env.INSTAGRAM_APP_ID!;
    const appSecret = process.env.INSTAGRAM_APP_SECRET!;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI!;

    // Step 1: Exchange code for short-lived access token
    const tokenRes = await fetch("https://graph.facebook.com/v19.0/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error("Instagram token error:", tokenData);
      return NextResponse.redirect(`${appUrl}/settings?error=instagram_token_failed`);
    }

    const shortLivedToken = tokenData.access_token;

    // Step 2: Exchange for long-lived token (60 days)
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`
    );
    const longTokenData = await longTokenRes.json();
    const accessToken = longTokenData.access_token || shortLivedToken;
    const expiresIn = longTokenData.expires_in || 5183944; // ~60 days

    // Step 3: Get Facebook Pages to find Instagram Business Account
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();
    const pages = pagesData.data || [];

    let instagramAccountId = null;
    let instagramUsername = null;
    let pageAccessToken = accessToken;

    // Find the first page with a connected Instagram Business Account
    for (const page of pages) {
      const igRes = await fetch(
        `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = await igRes.json();
      if (igData.instagram_business_account?.id) {
        instagramAccountId = igData.instagram_business_account.id;
        pageAccessToken = page.access_token;

        // Get Instagram username
        const igUserRes = await fetch(
          `https://graph.facebook.com/v19.0/${instagramAccountId}?fields=username,name&access_token=${pageAccessToken}`
        );
        const igUserData = await igUserRes.json();
        instagramUsername = igUserData.username || igUserData.name || instagramAccountId;
        break;
      }
    }

    if (!instagramAccountId) {
      console.error("No Instagram Business Account found on connected Facebook Pages");
      return NextResponse.redirect(`${appUrl}/settings?error=instagram_no_business_account`);
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Save to platform_connections
    await supabase.from("platform_connections").upsert(
      {
        platform: "instagram",
        access_token: pageAccessToken,
        refresh_token: null,
        token_expires_at: expiresAt,
        platform_user_id: instagramAccountId,
        platform_username: instagramUsername,
        is_connected: true,
        metadata: {
          instagram_account_id: instagramAccountId,
          username: instagramUsername,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "platform" }
    );

    return NextResponse.redirect(`${appUrl}/settings?success=instagram_connected`);
  } catch (err) {
    console.error("Instagram callback error:", err);
    return NextResponse.redirect(`${appUrl}/settings?error=instagram_callback_error`);
  }
}
