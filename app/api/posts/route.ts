import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

// GET /api/posts - Get all posts
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const platform = searchParams.get("platform");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    if (platform) {
      query = query.contains("platforms", [platform]);
    }

    const { data, error, count } = await query;

    if (error) {
      // If Supabase is not configured, return mock data
      if (error.message.includes("relation") || error.message.includes("JWT")) {
        return NextResponse.json({
          posts: getMockPosts(),
          total: 4,
          message: "Using mock data - configure Supabase to use real data",
        });
      }
      throw error;
    }

    return NextResponse.json({ posts: data, total: count });
  } catch (error) {
    console.error("GET /api/posts error:", error);
    // Return mock data as fallback
    return NextResponse.json({
      posts: getMockPosts(),
      total: 4,
      message: "Using mock data - configure Supabase to use real data",
    });
  }
}

// POST /api/posts - Create a new post
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      caption,
      hashtags,
      platforms,
      status = "draft",
      scheduled_at,
      content_url,
      thumbnail_url,
    } = body;

    if (!title || !platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: "Title and at least one platform are required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("posts")
      .insert({
        title,
        description,
        caption,
        hashtags,
        platforms,
        status,
        scheduled_at: scheduled_at || null,
        content_url: content_url || null,
        thumbnail_url: thumbnail_url || null,
        platform_post_ids: {},
      })
      .select()
      .single();

    if (error) {
      // If Supabase not configured, return mock success
      if (error.message.includes("relation") || error.message.includes("JWT")) {
        return NextResponse.json({
          post: {
            id: `mock_${Date.now()}`,
            title,
            description,
            caption,
            hashtags,
            platforms,
            status,
            scheduled_at,
            content_url,
            thumbnail_url,
            platform_post_ids: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          message: "Mock post created - configure Supabase to persist data",
        });
      }
      throw error;
    }

    return NextResponse.json({ post: data }, { status: 201 });
  } catch (error) {
    console.error("POST /api/posts error:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}

function getMockPosts() {
  return [
    {
      id: "1",
      title: "Episode 47: The Future of AI in Podcasting",
      description: "Deep dive into how AI is transforming podcast creation",
      platforms: ["youtube", "instagram", "tiktok"],
      status: "published",
      published_at: "2024-01-20T14:00:00Z",
      platform_post_ids: { youtube: "abc123", instagram: "def456", tiktok: "ghi789" },
      created_at: "2024-01-19T10:00:00Z",
      updated_at: "2024-01-20T14:00:00Z",
    },
    {
      id: "2",
      title: "Episode 46 Highlights",
      platforms: ["instagram", "tiktok"],
      status: "published",
      published_at: "2024-01-18T16:00:00Z",
      platform_post_ids: {},
      created_at: "2024-01-17T10:00:00Z",
      updated_at: "2024-01-18T16:00:00Z",
    },
    {
      id: "3",
      title: "Episode 48: Behind the Scenes",
      platforms: ["youtube", "instagram"],
      status: "scheduled",
      scheduled_at: "2024-01-25T14:00:00Z",
      platform_post_ids: {},
      created_at: "2024-01-21T10:00:00Z",
      updated_at: "2024-01-21T10:00:00Z",
    },
    {
      id: "4",
      title: "Quick Tip: Recording Quality",
      platforms: ["tiktok"],
      status: "draft",
      platform_post_ids: {},
      created_at: "2024-01-22T10:00:00Z",
      updated_at: "2024-01-22T10:00:00Z",
    },
  ];
}
