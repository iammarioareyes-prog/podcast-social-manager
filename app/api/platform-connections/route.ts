import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSSRSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const ssrClient = createSSRSupabaseClient();
  const { data: { user } } = await ssrClient.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("platform_connections")
    .select("platform, is_connected, platform_username, platform_user_id, metadata, token_expires_at")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await req.json();
  const { platform, is_connected } = body;

  if (!platform) {
    return NextResponse.json({ error: "platform required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("platform_connections")
    .update({ is_connected, access_token: null, refresh_token: null })
    .eq("platform", platform)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
