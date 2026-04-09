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
    const { conversations } = body; // Array of ChatGPT conversation objects

    if (!conversations || !Array.isArray(conversations)) {
      return NextResponse.json({ error: "Invalid conversations data" }, { status: 400 });
    }

    // Extract user messages that look like captions/social media content
    const userMessages: string[] = [];
    for (const conv of conversations.slice(0, 100)) {
      // Limit to 100 conversations
      const mapping = conv.mapping || {};
      for (const node of Object.values(mapping) as any[]) {
        if (
          node?.message?.author?.role === "user" &&
          node?.message?.content?.parts
        ) {
          const text = node.message.content.parts.join(" ").trim();
          if (text.length > 20 && text.length < 1000) {
            userMessages.push(text);
          }
        }
      }
    }

    // Use Claude to extract voice characteristics and example captions
    const sampleMessages = userMessages.slice(0, 50).join("\n---\n");

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Analyze these messages from a podcast host to extract their writing voice and style for social media captions. Look for patterns in how they write captions, their tone, common phrases, hashtag usage, and emoji patterns.

Messages:
${sampleMessages}

Return a JSON object with:
{
  "voice_summary": "2-3 sentence description of their writing style and tone",
  "example_captions": ["up to 5 actual good caption examples from their messages"],
  "common_hashtags": ["hashtags they frequently use"],
  "tone_keywords": ["casual/formal/hype/motivational/etc"],
  "emoji_style": "how they use emojis"
}

Only return valid JSON.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse response");

    const voiceData = JSON.parse(jsonMatch[0]);

    // Save to voice_profile
    const { data: existing } = await supabase
      .from("voice_profile")
      .select("id, voice_examples, ig_hashtags")
      .limit(1)
      .single();

    const updateData = {
      voice_summary: voiceData.voice_summary,
      voice_examples: voiceData.example_captions || [],
      tone_keywords: voiceData.tone_keywords || [],
      emoji_style: voiceData.emoji_style || "",
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      await supabase
        .from("voice_profile")
        .update(updateData)
        .eq("id", existing.id);
    } else {
      await supabase.from("voice_profile").insert({
        ...updateData,
        ig_tags: [
          "iammarioareyes",
          "tamishaharris",
          "mrchrisclassic",
          "jermailshelton",
          "undugubrotherhood",
        ],
        tiktok_tags: [],
        youtube_tags: [],
        ig_hashtags: voiceData.common_hashtags || [],
        tiktok_hashtags: [],
        youtube_hashtags: [],
        podcast_name: "I Am Mario Areyes",
      });
    }

    return NextResponse.json({
      success: true,
      messagesAnalyzed: userMessages.length,
      voiceSummary: voiceData.voice_summary,
      examplesFound: voiceData.example_captions?.length || 0,
    });
  } catch (err: any) {
    console.error("Import error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
