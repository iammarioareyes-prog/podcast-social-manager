import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/instagram/insights
 * Fetch Instagram account and media insights
 * TODO: Implement with Instagram Graph API
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get("mediaId");

    if (mediaId) {
      // TODO: GET https://graph.instagram.com/{media-id}/insights?metric=impressions,reach,likes,comments,shares,saved,video_views&access_token=...

      return NextResponse.json({
        mediaId,
        impressions: Math.floor(Math.random() * 20000) + 1000,
        reach: Math.floor(Math.random() * 15000) + 800,
        likes: Math.floor(Math.random() * 1000) + 50,
        comments: Math.floor(Math.random() * 150) + 10,
        shares: Math.floor(Math.random() * 300) + 20,
        saves: Math.floor(Math.random() * 400) + 30,
        videoViews: Math.floor(Math.random() * 12000) + 500,
        engagementRate: Math.random() * 10 + 3,
        message: "TODO: Replace with actual Instagram Graph API insights",
      });
    }

    // Account-level insights
    // TODO: GET https://graph.instagram.com/{ig-user-id}/insights?metric=impressions,reach,follower_count&period=day

    return NextResponse.json({
      account: {
        id: "mock_ig_id",
        username: "yourpodcast",
        followersCount: 8432,
        followingCount: 512,
        mediaCount: 247,
      },
      insights: {
        impressions: 89000,
        reach: 62000,
        profileViews: 4200,
        websiteClicks: 890,
        period: "last_30_days",
      },
      message: "TODO: Replace with actual Instagram Graph API data",
    });
  } catch (error) {
    console.error("Instagram insights error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Instagram insights" },
      { status: 500 }
    );
  }
}
