import Anthropic from "@anthropic-ai/sdk";

// Initialize Anthropic client
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface VoiceProfile {
  voice_summary?: string;
  tone_keywords?: string[];
  emoji_style?: string;
  voice_examples?: string[];
  podcast_name?: string;
}

export interface GenerateCaptionsParams {
  title: string;
  description: string;
  platforms: string[];
  podcastName?: string;
  episode?: string;
  analyticsContext?: string;
  voiceProfile?: VoiceProfile;
}

export interface CaptionResult {
  platform: string;
  caption: string;
  hashtags: string[];
}

/**
 * Generate platform-specific captions using Claude.
 * Instagram captions follow the Reels-optimised structure:
 *   Hook (≤55 chars) → Body (guest + bullets) → CTA
 * Voice profile data is injected when available.
 */
export async function generateCaptions(
  params: GenerateCaptionsParams
): Promise<CaptionResult[]> {
  const {
    title,
    description,
    platforms,
    podcastName = "I Am Mario Areyes Podcast",
    episode = "",
    analyticsContext = "",
    voiceProfile,
  } = params;

  // Build voice context block
  const voiceLines: string[] = [];
  if (voiceProfile?.voice_summary) voiceLines.push(`Voice summary: ${voiceProfile.voice_summary}`);
  if (voiceProfile?.tone_keywords?.length) voiceLines.push(`Tone: ${voiceProfile.tone_keywords.join(", ")}`);
  if (voiceProfile?.emoji_style) voiceLines.push(`Emoji style: ${voiceProfile.emoji_style}`);
  if (voiceProfile?.voice_examples?.length) {
    voiceLines.push(`Example captions from this creator:\n${voiceProfile.voice_examples.slice(0, 3).map((e) => `  "${e}"`).join("\n")}`);
  }
  const voiceContext = voiceLines.length
    ? `\nCREATOR VOICE (match this tone exactly):\n${voiceLines.join("\n")}`
    : "";

  const platformInstructions = platforms
    .map((p) => {
      if (p === "youtube") {
        return `YOUTUBE SHORTS:
Write a 2-3 sentence description (100-200 words). Open with a punchy hook line, then name the guest and explain what viewers will learn. End with a CTA pointing to the full episode. No hashtags in the text (added separately).`;
      } else if (p === "instagram") {
        return `INSTAGRAM REELS — follow this structure exactly (NO hashtags; they are appended automatically):

LINE 1 — HOOK (hard limit: ≤55 characters, no period): The only line visible before "more." Must stop the scroll. Use a punchy statement, open loop ("He went from X to Y"), or direct pull quote. Count the characters.

[blank line]

BODY (2-5 lines, use line breaks between each):
• Guest name + their authority/credential in 1 line
• 2-3 specific insight bullets from the clip title (use — or a single relevant emoji as bullet)
• Optional: 1 line of story setup or tension that makes them want to watch

[blank line]

CTA (1-2 lines): A specific, active ask. NOT "let me know what you think." Examples that work: "Drop a 🔥 if this hit you" / "Tag someone who needs this" / "Full convo → link in bio"

Target total: 150-250 words. Use emojis purposefully, not decoratively.`;
      } else if (p === "tiktok") {
        return `TIKTOK:
Write a punchy hook-driven title/caption under 120 characters. Conversational, native to TikTok. Can be a question, challenge, or bold claim. No hashtags in text (added separately).`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");

  const prompt = `You are a social media strategist for the "${podcastName}" podcast. Your job is to write captions that sound exactly like the creator — not generic podcast copy.
${voiceContext}

CONTENT TO CAPTION:
Title: "${title}"
Guest / Context: "${description}"
${episode ? `Episode: ${episode}` : ""}
${analyticsContext ? `Performance context: ${analyticsContext}` : ""}

PLATFORM INSTRUCTIONS:
${platformInstructions}

Return ONLY a valid JSON array — no markdown fences, no explanation:
[
  { "platform": "instagram", "caption": "...", "hashtags": [] },
  { "platform": "youtube",   "caption": "...", "hashtags": [] },
  { "platform": "tiktok",    "caption": "...", "hashtags": [] }
]

Include only the platforms listed: ${platforms.join(", ")}
Hashtags array should always be empty — they are managed separately.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 3000,
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

  // Strip markdown code fences if present, then extract JSON array
  const cleaned = content.text.replace(/```[a-z]*\n?/gi, "").trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
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
