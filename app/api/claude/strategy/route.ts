import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    if (action === "generate_captions") {
      return handleGenerateCaptions(params);
    } else if (action === "generate_strategy") {
      return handleGenerateStrategy(params);
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'generate_captions' or 'generate_strategy'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Claude API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleGenerateCaptions(params: {
  title: string;
  description?: string;
  platforms: string[];
  podcastName?: string;
  episode?: string;
}) {
  const { title, description = "", platforms, podcastName = "Our Podcast", episode = "" } = params;

  const platformInstructions = platforms
    .map((p) => {
      if (p === "youtube") {
        return "YouTube Shorts: engaging caption (150-300 chars), 3-5 targeted hashtags";
      } else if (p === "instagram") {
        return "Instagram Reels: compelling caption with hook (up to 2200 chars visible), 10-15 hashtags, use emojis";
      } else if (p === "tiktok") {
        return "TikTok: punchy hook-driven caption under 150 chars, 3-5 trending hashtags";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");

  const prompt = `You are a social media expert specializing in podcast content promotion.

Podcast: "${podcastName}"
Content Title: "${title}"
Description: "${description}"
${episode ? `Episode: ${episode}` : ""}

Generate optimized social media captions and hashtags for these platforms:
${platformInstructions}

Return ONLY a valid JSON array with this exact structure, no other text:
[
  {
    "platform": "youtube",
    "caption": "...",
    "hashtags": ["tag1", "tag2", "tag3"]
  }
]

Include only platforms: ${platforms.join(", ")}
Make each caption unique and optimized for the specific platform algorithm.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response type" }, { status: 500 });
  }

  // Extract JSON from response
  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "Could not parse captions from response" }, { status: 500 });
  }

  const captions = JSON.parse(jsonMatch[0]);
  return NextResponse.json({ captions });
}

async function handleGenerateStrategy(params: {
  analyticsData: Array<{
    platform: string;
    views: number;
    likes: number;
    engagement: number;
    topPosts: Array<{ title: string; views: number; engagement: number }>;
  }>;
  recentPosts: Array<{
    title: string;
    platform: string;
    status: string;
    views?: number;
  }>;
  podcastName?: string;
  podcastGenre?: string;
}) {
  const {
    analyticsData,
    recentPosts,
    podcastName = "Your Podcast",
    podcastGenre = "general",
  } = params;

  const prompt = `You are a top-tier social media strategist specializing in podcast growth across YouTube, Instagram, and TikTok.

Podcast: "${podcastName}" (Genre: ${podcastGenre})

Analytics Data:
${JSON.stringify(analyticsData, null, 2)}

Recent Posts (last 10):
${JSON.stringify(recentPosts.slice(0, 10), null, 2)}

Provide a comprehensive weekly content strategy report including:

## Performance Analysis
What's working and what isn't based on the data.

## Platform-Specific Recommendations
Tailored strategies for YouTube Shorts, Instagram Reels, and TikTok.

## Optimal Posting Schedule
Best days and times for each platform.

## Content Pillars
3-5 content themes to focus on.

## Caption & Hashtag Strategy
Templates and best practices for each platform.

## Growth Opportunities
Specific tactics to increase reach and engagement this week.

## Trending Topics
Current trends in the ${podcastGenre} podcast space to leverage.

## Weekly Content Calendar
A sample 7-day posting schedule with content ideas.

## 90-Day Growth Roadmap
Key milestones and strategies for sustainable growth.

Be specific, actionable, and data-driven. Use the actual numbers from the analytics data.`;

  // Stream the response using Server-Sent Events
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const streamResponse = await anthropic.messages.stream({
          model: "claude-opus-4-5",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
        });

        for await (const chunk of streamResponse) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const data = JSON.stringify({ text: chunk.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
