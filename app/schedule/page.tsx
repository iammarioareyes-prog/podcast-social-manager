"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { PostCreator } from "@/components/schedule/post-creator";
import { CalendarView } from "@/components/schedule/calendar-view";
import { Button } from "@/components/ui/button";
import type { Post } from "@/types";

// Mock posts for calendar
const mockPosts: Post[] = [
  {
    id: "1",
    title: "Episode 47 Teaser",
    platforms: ["youtube", "instagram", "tiktok"],
    status: "published",
    published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    platform_post_ids: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Ep 47 Highlight Reel",
    platforms: ["instagram", "tiktok"],
    status: "published",
    published_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    platform_post_ids: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "3",
    title: "Behind the Scenes",
    platforms: ["youtube", "instagram"],
    status: "scheduled",
    scheduled_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    platform_post_ids: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "4",
    title: "Episode 48 Promo",
    platforms: ["youtube", "instagram", "tiktok"],
    status: "scheduled",
    scheduled_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    platform_post_ids: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "5",
    title: "Fan Q&A Clip",
    platforms: ["tiktok"],
    status: "scheduled",
    scheduled_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    platform_post_ids: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function SchedulePage() {
  const [showCreator, setShowCreator] = useState(false);
  const [posts, setPosts] = useState<Post[]>(mockPosts);

  const handleCreatePost = async (data: {
    title: string;
    description: string;
    platforms: string[];
    caption: string;
    hashtags: string;
    scheduledAt: string;
    contentUrl: string;
    status: string;
  }) => {
    // TODO: Save to Supabase via POST /api/posts
    const newPost: Post = {
      id: Date.now().toString(),
      title: data.title,
      description: data.description,
      caption: data.caption,
      hashtags: data.hashtags.split(" ").filter(Boolean),
      platforms: data.platforms as Post["platforms"],
      status: data.status as Post["status"],
      scheduled_at: data.scheduledAt || undefined,
      content_url: data.contentUrl || undefined,
      platform_post_ids: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setPosts((prev) => [...prev, newPost]);
    setShowCreator(false);
    alert(`Post "${data.title}" ${data.status === "scheduled" ? "scheduled" : "saved as draft"}!`);
  };

  return (
    <div className="flex flex-col">
      <Header
        title="Post Scheduler"
        description="Plan and schedule content across all platforms"
      />

      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {posts.filter((p) => p.status === "scheduled").length} upcoming posts
            </p>
          </div>
          <Button
            onClick={() => setShowCreator(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Post
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Calendar - takes up 2/3 */}
          <div className="xl:col-span-2">
            <CalendarView posts={posts} />
          </div>

          {/* Upcoming posts sidebar */}
          <div className="xl:col-span-1">
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Upcoming Posts
                </h3>
              </div>
              <div className="divide-y divide-border">
                {posts
                  .filter(
                    (p) =>
                      p.status === "scheduled" &&
                      p.scheduled_at &&
                      new Date(p.scheduled_at) > new Date()
                  )
                  .sort(
                    (a, b) =>
                      new Date(a.scheduled_at!).getTime() -
                      new Date(b.scheduled_at!).getTime()
                  )
                  .slice(0, 6)
                  .map((post) => (
                    <div key={post.id} className="p-3 hover:bg-accent/20">
                      <p className="text-sm font-medium text-foreground truncate">
                        {post.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {post.scheduled_at &&
                          new Date(post.scheduled_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1">
                        {post.platforms.map((p) => (
                          <span
                            key={p}
                            className="rounded-full bg-accent px-1.5 py-0.5 text-xs text-muted-foreground capitalize"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}

                {posts.filter(
                  (p) => p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at) > new Date()
                ).length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No upcoming posts scheduled
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Post Creator Modal */}
      {showCreator && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Create Post</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCreator(false)}
                className="text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <PostCreator onSubmit={handleCreatePost} />
          </div>
        </div>
      )}
    </div>
  );
}
