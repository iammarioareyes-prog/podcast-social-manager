"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Send, Loader2, Zap } from "lucide-react";
import { Header } from "@/components/layout/header";
import { PostCreator } from "@/components/schedule/post-creator";
import { CalendarView } from "@/components/schedule/calendar-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Post } from "@/types";

export default function SchedulePage() {
  const [showCreator, setShowCreator] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [isPostingToday, setIsPostingToday] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/posts?limit=100");
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch {
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleCreatePost = async (data: {
    title: string;
    description: string;
    platforms: string[];
    caption: string;
    hashtags: string;
    scheduledAt: string;
    contentUrl: string;
    status: string;
    captions_json?: Record<string, string>;
  }) => {
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          caption: data.caption,
          hashtags: data.hashtags.split(" ").filter(Boolean),
          platforms: data.platforms,
          status: data.status,
          scheduled_at: data.scheduledAt || null,
          content_url: data.contentUrl || null,
          captions_json: data.captions_json && Object.keys(data.captions_json).length > 0
            ? data.captions_json
            : null,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create post");

      setShowCreator(false);
      showToast(
        `Post "${data.title}" ${data.status === "scheduled" ? "scheduled" : "saved as draft"}!`
      );
      await loadPosts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create post", "error");
    }
  };

  const handlePublishNow = async (post: Post) => {
    if (!post.content_url) {
      showToast("No video URL attached to this post", "error");
      return;
    }

    setPublishingId(post.id);
    const errors: string[] = [];

    try {
      for (const platform of post.platforms) {
        try {
          let endpoint = "";
          let body: Record<string, unknown> = { postId: post.id };

          const captions = (post.captions_json as Record<string, string>) ?? {};

          if (platform === "instagram") {
            endpoint = "/api/instagram/post";
            body = {
              postId: post.id,
              caption: captions.instagram || [post.caption, ...(post.hashtags ?? [])].filter(Boolean).join("\n\n"),
              videoUrl: post.content_url,
            };
          } else if (platform === "tiktok") {
            endpoint = "/api/tiktok/post";
            body = {
              postId: post.id,
              title: captions.tiktok || post.title,
              videoUrl: post.content_url,
            };
          } else if (platform === "youtube") {
            endpoint = "/api/youtube/upload";
            body = {
              postId: post.id,
              title: post.title,
              description: captions.youtube || post.description || post.caption || "",
              tags: post.hashtags ?? [],
              videoUrl: post.content_url,
              driveFileId: post.drive_file_id || undefined,
            };
          }

          if (!endpoint) continue;

          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          const result = await res.json();
          if (!res.ok) {
            errors.push(`${platform}: ${result.error || "Failed"}`);
          }
        } catch {
          errors.push(`${platform}: Network error`);
        }
      }

      if (errors.length === 0) {
        showToast(`"${post.title}" published successfully!`);
      } else if (errors.length < post.platforms.length) {
        showToast(`Partially published. Errors: ${errors.join("; ")}`, "error");
      } else {
        showToast(`Publish failed: ${errors.join("; ")}`, "error");
      }

      await loadPosts();
    } finally {
      setPublishingId(null);
    }
  };

  const handlePostToday = async () => {
    setIsPostingToday(true);
    try {
      const res = await fetch("/api/admin/post-now");
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to post today's content", "error");
      } else if (data.posted === 0) {
        showToast("No scheduled posts found for today");
      } else {
        const ok = data.results?.filter((r: { status?: string }) => r.status === "published").length ?? 0;
        showToast(`Posted ${ok}/${data.posted} posts successfully`);
      }
      await loadPosts();
    } catch {
      showToast("Request timed out — posts may still be uploading in the background", "error");
      await loadPosts();
    } finally {
      setIsPostingToday(false);
    }
  };

  const now = new Date();

  // Posts scheduled for today that are overdue (past their time) and not yet published
  const todayOverduePosts = posts
    .filter(
      (p) =>
        (p.status === "scheduled" || p.status === "publishing") &&
        p.scheduled_at &&
        new Date(p.scheduled_at) <= now &&
        new Date(p.scheduled_at).toDateString() === now.toDateString()
    )
    .sort(
      (a, b) =>
        new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()
    );

  const upcomingPosts = posts
    .filter(
      (p) =>
        p.status === "scheduled" &&
        p.scheduled_at &&
        new Date(p.scheduled_at) > now
    )
    .sort(
      (a, b) =>
        new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()
    )
    .slice(0, 6);

  const draftPosts = posts.filter((p) => p.status === "draft").slice(0, 6);

  return (
    <div className="flex flex-col">
      <Header
        title="Post Scheduler"
        description="Plan and schedule content across all platforms"
      />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Loading..."
                : `${posts.filter((p) => p.status === "scheduled").length} upcoming posts`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handlePostToday}
              disabled={isPostingToday}
              className="gap-2"
            >
              {isPostingToday ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {isPostingToday ? "Posting…" : "Post Today"}
            </Button>
            <Button onClick={() => setShowCreator(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Post
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Calendar - takes up 2/3 */}
          <div className="xl:col-span-2">
            <CalendarView posts={posts} />
          </div>

          {/* Sidebar */}
          <div className="xl:col-span-1 space-y-4">
            {/* Today's overdue posts — visible and actionable */}
            {todayOverduePosts.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5">
                <div className="border-b border-amber-500/20 p-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-amber-400">Today — Needs Posting</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs gap-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                    onClick={handlePostToday}
                    disabled={isPostingToday}
                  >
                    {isPostingToday ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Zap className="h-3 w-3" />
                    )}
                    Post All
                  </Button>
                </div>
                <div className="divide-y divide-border">
                  {todayOverduePosts.map((post) => (
                    <PostSidebarRow
                      key={post.id}
                      post={post}
                      isPublishing={publishingId === post.id}
                      onPublish={() => handlePublishNow(post)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Posts */}
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Upcoming Posts</h3>
              </div>
              <div className="divide-y divide-border">
                {upcomingPosts.map((post) => (
                  <PostSidebarRow
                    key={post.id}
                    post={post}
                    isPublishing={publishingId === post.id}
                    onPublish={() => handlePublishNow(post)}
                  />
                ))}
                {!isLoading && upcomingPosts.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No upcoming posts scheduled
                  </div>
                )}
              </div>
            </div>

            {/* Draft Posts */}
            {draftPosts.length > 0 && (
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border p-4">
                  <h3 className="text-sm font-semibold text-foreground">Drafts</h3>
                </div>
                <div className="divide-y divide-border">
                  {draftPosts.map((post) => (
                    <PostSidebarRow
                      key={post.id}
                      post={post}
                      isPublishing={publishingId === post.id}
                      onPublish={() => handlePublishNow(post)}
                    />
                  ))}
                </div>
              </div>
            )}
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

function PostSidebarRow({
  post,
  isPublishing,
  onPublish,
}: {
  post: Post;
  isPublishing: boolean;
  onPublish: () => void;
}) {
  const dateStr = post.scheduled_at || post.created_at;
  return (
    <div className="p-3 hover:bg-accent/20">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {dateStr &&
              new Date(dateStr).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {post.platforms.map((p) => (
              <span
                key={p}
                className="rounded-full bg-accent px-1.5 py-0.5 text-xs text-muted-foreground capitalize"
              >
                {p}
              </span>
            ))}
            <Badge
              variant="secondary"
              className={`text-xs ${
                post.status === "published"
                  ? "bg-green-500/10 text-green-500"
                  : post.status === "scheduled"
                  ? "bg-blue-500/10 text-blue-500"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {post.status}
            </Badge>
          </div>
        </div>
        {post.status !== "published" && (
          <Button
            size="sm"
            variant="outline"
            className="flex-shrink-0 h-7 px-2 text-xs gap-1"
            onClick={onPublish}
            disabled={isPublishing}
          >
            {isPublishing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            {isPublishing ? "Posting…" : "Publish Now"}
          </Button>
        )}
      </div>
    </div>
  );
}
