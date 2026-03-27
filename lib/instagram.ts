/**
 * Instagram Graph API integration
 * TODO: Replace mock data with real API calls once OAuth tokens are configured
 */

export interface InstagramMediaCreate {
  caption: string;
  videoUrl?: string;
  imageUrl?: string;
  mediaType: "VIDEO" | "IMAGE" | "REELS";
  coverUrl?: string;
}

export interface InstagramInsights {
  mediaId: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  videoViews?: number;
  engagement: number;
}

export interface InstagramAccount {
  id: string;
  username: string;
  followersCount: number;
  followingCount: number;
  mediaCount: number;
  profilePictureUrl: string;
  biography: string;
}

/**
 * Create an Instagram media post (Reel)
 * TODO: Implement with Instagram Graph API
 * Step 1: POST /{ig-user-id}/media (create container)
 * Step 2: POST /{ig-user-id}/media_publish (publish)
 */
export async function postToInstagram(
  params: InstagramMediaCreate,
  accessToken: string,
  igUserId: string
): Promise<{ mediaId: string; permalink: string }> {
  // TODO: Step 1 - Create media container
  // const containerResponse = await fetch(
  //   `https://graph.instagram.com/${igUserId}/media`,
  //   {
  //     method: 'POST',
  //     body: JSON.stringify({
  //       media_type: params.mediaType,
  //       video_url: params.videoUrl,
  //       caption: params.caption,
  //       access_token: accessToken
  //     })
  //   }
  // );

  // TODO: Step 2 - Publish container
  // const publishResponse = await fetch(
  //   `https://graph.instagram.com/${igUserId}/media_publish`,
  //   { method: 'POST', body: JSON.stringify({ creation_id: container.id, access_token: accessToken }) }
  // );

  const mockMediaId = `ig_${Date.now()}`;
  return {
    mediaId: mockMediaId,
    permalink: `https://www.instagram.com/reel/${mockMediaId}/`,
  };
}

/**
 * Get Instagram account insights
 * TODO: Implement with Instagram Graph API
 */
export async function getInstagramAccountStats(
  accessToken: string,
  igUserId: string
): Promise<InstagramAccount> {
  // TODO: GET https://graph.instagram.com/{ig-user-id}?fields=id,username,followers_count,media_count&access_token=...

  return {
    id: igUserId || "mock_ig_id",
    username: "yourpodcast",
    followersCount: 8432,
    followingCount: 512,
    mediaCount: 247,
    profilePictureUrl: "",
    biography: "Your amazing podcast",
  };
}

/**
 * Get media insights for specific posts
 * TODO: Implement with Instagram Graph API
 */
export async function getInstagramMediaInsights(
  mediaIds: string[],
  accessToken: string
): Promise<InstagramInsights[]> {
  // TODO: GET https://graph.instagram.com/{media-id}/insights?metric=impressions,reach,likes&access_token=...

  return mediaIds.map((id) => ({
    mediaId: id,
    impressions: Math.floor(Math.random() * 20000) + 500,
    reach: Math.floor(Math.random() * 15000) + 400,
    likes: Math.floor(Math.random() * 800) + 50,
    comments: Math.floor(Math.random() * 100) + 5,
    shares: Math.floor(Math.random() * 200) + 10,
    saves: Math.floor(Math.random() * 300) + 20,
    videoViews: Math.floor(Math.random() * 12000) + 300,
    engagement: Math.random() * 8 + 2,
  }));
}

/**
 * Get Instagram OAuth authorization URL
 */
export function getInstagramAuthUrl(): string {
  const appId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  const scope = "instagram_basic,instagram_content_publish,instagram_manage_insights";

  return `https://api.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
}

/**
 * Exchange auth code for access token
 * TODO: Implement token exchange
 */
export async function exchangeInstagramCode(code: string): Promise<{
  accessToken: string;
  userId: string;
}> {
  // TODO: POST https://api.instagram.com/oauth/access_token

  return {
    accessToken: "mock_access_token",
    userId: "mock_user_id",
  };
}
