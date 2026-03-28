import { createClient } from "@supabase/supabase-js";

// Client-side Supabase client (lazy - avoids build-time initialization error when env vars not set)
export function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Backward-compat named export (lazy proxy)
export const supabase = new Proxy({} as ReturnType<typeof getSupabaseClient>, {
  get(_, prop: string | symbol) {
    return (getSupabaseClient() as any)[prop];
  },
});

// Server-side Supabase client (uses service role key - for API routes only)
export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Database types for Supabase
export type Database = {
  public: {
    Tables: {
      posts: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          caption: string | null;
          hashtags: string[] | null;
          platforms: string[];
          status: string;
          scheduled_at: string | null;
          published_at: string | null;
          content_url: string | null;
          thumbnail_url: string | null;
          platform_post_ids: Record<string, string>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["posts"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
      };
      analytics: {
        Row: {
          id: string;
          post_id: string | null;
          platform: string;
          platform_post_id: string | null;
          views: number;
          likes: number;
          comments: number;
          shares: number;
          saves: number;
          watch_time_hours: number;
          click_through_rate: number;
          impressions: number;
          reach: number;
          engagement_rate: number;
          recorded_at: string;
        };
      };
      platform_connections: {
        Row: {
          id: string;
          platform: string;
          access_token: string | null;
          refresh_token: string | null;
          token_expires_at: string | null;
          platform_user_id: string | null;
          platform_username: string | null;
          is_connected: boolean;
          created_at: string;
        };
      };
      content_items: {
        Row: {
          id: string;
          title: string;
          type: string;
          duration_seconds: number | null;
          file_url: string | null;
          thumbnail_url: string | null;
          google_drive_id: string | null;
          file_size_bytes: number | null;
          created_at: string;
        };
      };
    };
  };
};
