import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await supabase
    .from("voice_profile")
    .select("*")
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return defaults if no profile exists
  const profile = data || {
    ig_tags: [
      "iammarioareyes",
      "tamishaharris",
      "mrchrisclassic",
      "jermailshelton",
      "undugubrotherhood",
    ],
    tiktok_tags: [],
    youtube_tags: [],
    ig_hashtags: [],
    tiktok_hashtags: [],
    youtube_hashtags: [],
    voice_examples: [],
    podcast_name: "I Am Mario Areyes",
    podcast_description: "",
  };

  return NextResponse.json(profile);
}

export async function PUT(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const body = await request.json();

  const { data: existing } = await supabase
    .from("voice_profile")
    .select("id")
    .limit(1)
    .single();

  let result;
  if (existing?.id) {
    result = await supabase
      .from("voice_profile")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from("voice_profile")
      .insert({ ...body })
      .select()
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(result.data);
}
