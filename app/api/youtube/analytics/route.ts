import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/youtube/analytics
 * Fetch YouTube channel and video analytics
 * TODO: Implement actual YouTube Analytics API v2
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || getDateDaysAgo(30);
    const endDate = searchParams.get("endDate") || getDateDaysAgo(0);

    // TODO: Get access token and fetch real analytics
    // const analytics = google.youtubeAnalytics({ version: 'v2' });
    // const response = await analytics.reports.query({
    //   ids: 'channel==MINE',
    //   startDate,
    //   endDate,
    //   metrics: 'views,likes,comments,shares,estimatedWatchTime,averageViewDuration',
    //   dimensions: 'day'
    // });

    // Mock analytics data
    const days = getDaysBetween(startDate, endDate);
    const dailyData = days.map((date) => ({
      date,
      views: Math.floor(Math.random() * 5000) + 500,
      likes: Math.floor(Math.random() * 300) + 20,
      comments: Math.floor(Math.random() * 50) + 5,
      shares: Math.floor(Math.random() * 100) + 10,
      watchTimeMinutes: Math.floor(Math.random() * 10000) + 1000,
      averageViewDuration: Math.floor(Math.random() * 60) + 20,
      impressions: Math.floor(Math.random() * 20000) + 2000,
      clickThroughRate: Math.random() * 8 + 2,
    }));

    const totals = dailyData.reduce(
      (acc, day) => ({
        views: acc.views + day.views,
        likes: acc.likes + day.likes,
        comments: acc.comments + day.comments,
        shares: acc.shares + day.shares,
        watchTimeMinutes: acc.watchTimeMinutes + day.watchTimeMinutes,
        impressions: acc.impressions + day.impressions,
      }),
      { views: 0, likes: 0, comments: 0, shares: 0, watchTimeMinutes: 0, impressions: 0 }
    );

    return NextResponse.json({
      channel: {
        id: "mock_channel",
        title: "Your Podcast",
        subscriberCount: 12847,
        videoCount: 156,
        viewCount: totals.views,
      },
      analytics: {
        daily: dailyData,
        totals,
        period: { startDate, endDate },
      },
      message: "TODO: Replace with actual YouTube Analytics API data",
    });
  } catch (error) {
    console.error("YouTube analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch YouTube analytics" },
      { status: 500 }
    );
  }
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

function getDaysBetween(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split("T")[0]);
  }

  return days;
}
