import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, platforms, episode } = body;

    // Load voice profile
    const { data: profile } = await supabase
      .from("voice_profile")
      .select("*")
      .limit(1)
      .single();

    const igTags = profile?.ig_tags || [
      "iammarioareyes",
      "tamishaharris",
      "mrchrisclassic",
      "jermailshelton",
      "undugubrotherhood",
    ];
    const voiceSummary = profile?.voice_summary || "";
    const voiceExamples = profile?.voice_examples || [];
    const igHashtags = profile?.ig_hashtags || [];
    const tiktokHashtags = profile?.tiktok_hashtags || [];
    const youtubeHashtags = profile?.youtube_hashtags || [];
    const podcastName = profile?.podcast_name || "I Am Mario Areyes";

    const igTagsStr = igTags
      .map((t: string) => `@${t.replace("@", "")}`)
      .join(" ");

    const voiceContext = voiceSummary
      ? `\n\nVoice & Style: ${voiceSummary}`
      : "";

    const examplesContext =
      voiceExamples.length > 0
        ? `\n\nExample captions in their voice:\n${voiceExamples.slice(0, 3).join("\n---\n")}`
        : "";

    const platformInstructions = (platforms as string[])
      .map((p) => {
        if (p === "youtube") {
          const hashtagHints =
            youtubeHashtags.length > 0
              ? ` Include some of these known hashtags if relevant: ${youtubeHashtags.join(", ")}`
              : "";
          return `YouTube Shorts: Engaging caption 150-300 chars. Include CTA. 3-5 hashtags.${hashtagHints}`;
        } else if (p === "instagram") {
          const hashtagHints =
            igHashtags.length > 0
              ? ` Use some of these known hashtags: ${igHashtags.join(", ")}`
              : "";
          return `Instagram Reels: Compelling caption with the EXACT tag line at the end: "${igTagsStr}" — then hashtags. 10-15 hashtags.${hashtagHints}`;
        } else if (p === "tiktok") {
          const hashtagHints =
            tiktokHashtags.length > 0
              ? ` Include some of these known hashtags: ${tiktokHashtags.join(", ")}`
              : "";
          return `TikTok: Punchy hook-driven caption under 150 chars. 3-5 hashtags.${hashtagHints}`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");

    const prompt = `You are writing social media captions for the podcast "${podcastName}".${voiceContext}${examplesContext}

Episode: "${title}"
${description ? `Description: "${description}"` : ""}
${episode ? `Episode: ${episode}` : ""}

Write captions for these platforms:
${platformInstructions}

IMPORTANT: Write in the host's authentic voice. For Instagram, always end with the tag line before hashtags.

Return JSON array:
[
  {
    "platform": "instagram",
    "caption": "...",
    "hashtags": ["tag1", "tag2", ...]
  }
]

Only include platforms: ${platforms.join(", ")}`;

    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Could not parse response");

    const captions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ captions, igTags: igTagsStr });
  } catch (err: any) {
    console.error("Caption generation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
