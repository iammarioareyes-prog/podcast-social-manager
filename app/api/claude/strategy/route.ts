import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

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
        return `YouTube Shorts description: MINIMUM 170 words. Start with a compelling hook, expand on the episode theme with context and insight, include a call-to-action (e.g. "Full episode on the channel — subscribe!"), mention guest name if applicable. No @tags. DO NOT include any hashtags in the caption text — put them ONLY in the "hashtags" array.`;
      } else if (p === "instagram") {
        return `Instagram Reels caption: MINIMUM 170 words. Open with a bold 1-2 sentence hook. Then write 3-4 short paragraphs expanding on the topic — share a real insight, ask the audience a question, connect the clip to a bigger theme. End with a call-to-action ("Link in bio" or "Share this with someone who needs it"). On a new line, add the account handles as plain text @mentions (NOT tagged users): @iammarioareyes @tamishaharris @mrchrisclassic @jermailshelton @undugubrotherhood. Use emojis throughout. DO NOT include any hashtags in the caption text — put them ONLY in the "hashtags" array.`;
      } else if (p === "tiktok") {
        return `TikTok caption: MINIMUM 170 words. Hook in the first line (this shows before "more"). Then write conversational, punchy paragraphs — speak directly to the viewer, share the "why this matters" angle, build curiosity about the full episode. End with a question to drive comments. Use emojis. DO NOT include any hashtags in the caption text — put them ONLY in the "hashtags" array.`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");

  const prompt = `You are a social media content writer for the "I Am Mario Areyes" podcast — a show about faith, mindset, Black excellence, entrepreneurship, and real conversations with real people.

Podcast: "${podcastName || "I Am Mario Areyes"}"
Content Title: "${title}"
Description: "${description}"
${episode ? `Episode: ${episode}` : ""}

Write platform-optimized captions for the following platforms. EVERY caption must be at minimum 170 words. Count carefully — do not submit anything shorter.

${platformInstructions}

IMPORTANT:
- Each caption must be genuinely different, written for how that platform's audience reads and engages
- Do NOT use generic filler — make the copy feel real, personal, and on-brand for a Black faith/mindset podcast
- The @mentions on Instagram go in the caption text as plain text only (do not suggest tagging users via the API)
- 170 words is a hard minimum. Longer is fine.
- CRITICAL: Hashtags ONLY go in the "hashtags" array. Never write hashtags inside the caption body text.

Return ONLY a valid JSON array with this exact structure, no markdown, no extra text:
[
  {
    "platform": "youtube",
    "caption": "...",
    "hashtags": ["tag1", "tag2", "tag3"]
  }
]

Include only platforms: ${platforms.join(", ")}`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4000,
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
