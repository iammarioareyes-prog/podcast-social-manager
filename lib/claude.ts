import Anthropic from "@anthropic-ai/sdk";

// Initialize Anthropic client
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface GenerateCaptionsParams {
  title: string;
  description: string;
  platforms: string[];
  podcastName?: string;
  episode?: string;
  analyticsContext?: string;
}

export interface CaptionResult {
  platform: string;
  caption: string;
  hashtags: string[];
}

/**
 * Generate platform-specific captions and hashtags using Claude
 * Uses claude-opus-4-6 with streaming
 */
export async function generateCaptions(
  params: GenerateCaptionsParams
): Promise<CaptionResult[]> {
  const {
    title,
    description,
    platforms,
    podcastName = "Our Podcast",
    episode = "",
    analyticsContext = "",
  } = params;

  const platformInstructions = platforms
    .map((p) => {
      if (p === "youtube") {
        return `YouTube Shorts: Write an engaging caption (150-300 chars) that teases the content. Include a call-to-action. YouTube allows up to 15 hashtags but 3-5 targeted ones work best.`;
      } else if (p === "instagram") {
        return `Instagram Reels: Write a compelling caption (125-150 chars visible before "more"). Can be longer (up to 2200 chars). Use emojis strategically. Instagram allows up to 30 hashtags, 10-15 is optimal.`;
      } else if (p === "tiktok") {
        return `TikTok: Write a punchy, hook-driven caption under 150 chars. TikTok captions should be conversational and native to the platform. Use 3-5 relevant hashtags including trending ones.`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");

  const prompt = `You are a social media expert specializing in podcast content promotion.

Podcast: "${podcastName}"
Episode/Content: "${title}"
Description: "${description}"
${episode ? `Episode Number: ${episode}` : ""}
${analyticsContext ? `Recent Performance Context: ${analyticsContext}` : ""}

Generate optimized social media captions and hashtags for the following platforms:
${platformInstructions}

Return a JSON array with this exact structure:
[
  {
    "platform": "youtube",
    "caption": "...",
    "hashtags": ["tag1", "tag2", "tag3"]
  },
  {
    "platform": "instagram",
    "caption": "...",
    "hashtags": ["tag1", "tag2", ...]
  },
  {
    "platform": "tiktok",
    "caption": "...",
    "hashtags": ["tag1", "tag2", "tag3"]
  }
]

Only include platforms from this list: ${platforms.join(", ")}

Make each caption unique and optimized for the specific platform's algorithm and audience behavior. Focus on authenticity and engagement.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  // Extract JSON from response
  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON from Claude response");
  }

  return JSON.parse(jsonMatch[0]) as CaptionResult[];
}

export interface StrategyParams {
  analyticsData: {
    platform: string;
    views: number;
    likes: number;
    engagement: number;
    topPosts: Array<{
      title: string;
      views: number;
      engagement: number;
    }>;
  }[];
  recentPosts: Array<{
    title: string;
    platform: string;
    status: string;
    views?: number;
  }>;
  podcastName?: string;
  podcastGenre?: string;
}

/**
 * Generate comprehensive content strategy using Claude
 */
export async function generateStrategy(params: StrategyParams): Promise<string> {
  const { analyticsData, recentPosts, podcastName = "Your Podcast", podcastGenre = "general" } = params;

  const analyticsStr = JSON.stringify(analyticsData, null, 2);
  const postsStr = JSON.stringify(recentPosts, null, 2);

  const prompt = `You are a top-tier social media strategist specializing in podcast growth across YouTube, Instagram, and TikTok.

Podcast: "${podcastName}" (Genre: ${podcastGenre})

Current Analytics Data:
${analyticsStr}

Recent Posts:
${postsStr}

Please provide a comprehensive weekly content strategy report that includes:

1. **Performance Analysis**: What's working and what isn't based on the data
2. **Platform-Specific Recommendations**: Tailored strategies for YouTube Shorts, Instagram Reels, and TikTok
3. **Optimal Posting Schedule**: Best days and times for each platform based on the genre
4. **Content Pillars**: 3-5 content themes/pillars to focus on
5. **Caption & Hashtag Strategy**: Templates and best practices
6. **Growth Opportunities**: Specific tactics to increase reach and engagement
7. **Trending Topics**: Current trends in the podcast space to leverage
8. **Weekly Content Calendar**: A sample 7-day posting schedule
9. **90-Day Growth Roadmap**: Key milestones and strategies

Be specific, actionable, and data-driven. Format with clear headers and bullet points.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return content.text;
}

/**
 * Stream strategy generation for real-time display
 */
export async function* streamStrategy(params: StrategyParams): AsyncGenerator<string> {
  const { analyticsData, recentPosts, podcastName = "Your Podcast", podcastGenre = "general" } = params;

  const analyticsStr = JSON.stringify(analyticsData, null, 2);
  const postsStr = JSON.stringify(recentPosts.slice(0, 10), null, 2);

  const prompt = `You are a top-tier social media strategist specializing in podcast growth across YouTube, Instagram, and TikTok.

Podcast: "${podcastName}" (Genre: ${podcastGenre})

Current Analytics Data:
${analyticsStr}

Recent Posts:
${postsStr}

Please provide a comprehensive weekly content strategy report that includes:

1. **Performance Analysis**: What's working and what isn't based on the data
2. **Platform-Specific Recommendations**: Tailored strategies for YouTube Shorts, Instagram Reels, and TikTok
3. **Optimal Posting Schedule**: Best days and times for each platform
4. **Content Pillars**: 3-5 content themes to focus on
5. **Caption & Hashtag Strategy**: Templates and best practices
6. **Growth Opportunities**: Specific tactics to increase reach and engagement
7. **Trending Topics**: Current trends in the podcast space to leverage
8. **Weekly Content Calendar**: A sample 7-day posting schedule
9. **90-Day Growth Roadmap**: Key milestones and strategies

Be specific, actionable, and data-driven. Format with clear markdown headers and bullet points.`;

  const stream = await anthropic.messages.stream({
    model: "claude-opus-4-5",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      yield chunk.delta.text;
    }
  }
}
