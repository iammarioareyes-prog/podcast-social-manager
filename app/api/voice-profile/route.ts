import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSSRSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const ssrClient = createSSRSupabaseClient();
  const { data: { user } } = await ssrClient.auth.getUser();
  return user;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("voice_profile")
    .select("*")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const profile = data || {
    ig_tags: ["iammarioareyes", "tamishaharris", "mrchrisclassic", "jermailshelton", "undugubrotherhood"],
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
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = serviceClient();
  const body = await request.json();

  const { data: existing } = await supabase
    .from("voice_profile")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

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
      .insert({ ...body, user_id: user.id })
      .select()
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(result.data);
}
