/**
 * TikTok Content Posting API integration
 * TODO: Replace mock data with real API calls once OAuth tokens are configured
 */

export interface TikTokVideoCreate {
  title: string;
  videoUrl: string;
  privacyLevel?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";
  disableDuet?: boolean;
  disableComment?: boolean;
  disableStitch?: boolean;
  videoCoverTimestampMs?: number;
}

export interface TikTokAnalytics {
  videoId: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  avgWatchTime: number;
  completionRate: number;
}

export interface TikTokUser {
  openId: string;
  unionId: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
}

/**
 * Upload video to TikTok
 * TODO: Implement with TikTok Content Posting API
 * Step 1: POST /v2/post/publish/video/init/
 * Step 2: Upload video to upload_url
 * Step 3: POST /v2/post/publish/status/fetch/
 */
export async function postToTikTok(
  params: TikTokVideoCreate,
  accessToken: string
): Promise<{ publishId: string }> {
  // TODO: Step 1 - Initialize post
  // const initResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
  //   method: 'POST',
  //   headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     post_info: { title: params.title, privacy_level: params.privacyLevel },
  //     source_info: { source: 'PULL_FROM_URL', video_url: params.videoUrl }
  //   })
  // });

  const mockPublishId = `tt_${Date.now()}`;
  return { publishId: mockPublishId };
}

/**
 * Get TikTok user info
 * TODO: Implement with TikTok API
 */
export async function getTikTokUserInfo(accessToken: string): Promise<TikTokUser> {
  // TODO: GET https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count

  return {
    openId: "mock_tiktok_id",
    unionId: "mock_union_id",
    displayName: "YourPodcast",
    avatarUrl: "",
    followerCount: 5621,
    followingCount: 234,
    likesCount: 47820,
    videoCount: 89,
  };
}

/**
 * Get video analytics from TikTok
 * TODO: Implement with TikTok Research API
 */
export async function getTikTokVideoAnalytics(
  videoIds: string[],
  accessToken: string
): Promise<TikTokAnalytics[]> {
  // TODO: POST https://open.tiktokapis.com/v2/video/query/

  return videoIds.map((id) => ({
    videoId: id,
    title: `TikTok Video ${id}`,
    views: Math.floor(Math.random() * 100000) + 5000,
    likes: Math.floor(Math.random() * 5000) + 200,
    comments: Math.floor(Math.random() * 500) + 20,
    shares: Math.floor(Math.random() * 1000) + 50,
    reach: Math.floor(Math.random() * 80000) + 4000,
    impressions: Math.floor(Math.random() * 150000) + 8000,
    avgWatchTime: Math.random() * 15 + 5,
    completionRate: Math.random() * 60 + 20,
  }));
}

/**
 * Get TikTok OAuth authorization URL
 */
export function getTikTokAuthUrl(): string {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const redirectUri = encodeURIComponent(process.env.TIKTOK_REDIRECT_URI || "");
  const scope = encodeURIComponent("user.info.basic,video.publish,video.upload");
  const state = `state_${Date.now()}`;

  return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&response_type=code&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;
}

/**
 * Exchange TikTok auth code for access token
 * TODO: Implement token exchange
 */
export async function exchangeTikTokCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  openId: string;
  expiresIn: number;
}> {
  // TODO: POST https://open.tiktokapis.com/v2/oauth/token/

  return {
    accessToken: "mock_access_token",
    refreshToken: "mock_refresh_token",
    openId: "mock_open_id",
    expiresIn: 86400,
  };
}
