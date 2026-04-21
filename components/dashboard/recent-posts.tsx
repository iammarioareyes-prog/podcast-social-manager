"use client";

import { useEffect, useState } from "react";
import { Youtube, Instagram, Music2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatDate, getStatusColor, truncateText } from "@/lib/utils";
import type { Post } from "@/types";

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform) {
    case "youtube":
      return <Youtube className="h-3 w-3 text-red-500" />;
    case "instagram":
      return <Instagram className="h-3 w-3 text-pink-500" />;
    case "tiktok":
      return <Music2 className="h-3 w-3 text-cyan-400" />;
    default:
      return null;
  }
}

export function RecentPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/posts?limit=8")
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-foreground">
          Recent Posts
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          asChild
        >
          <a href="/schedule">View all</a>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No posts yet — create one in the Scheduler.
          </p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-background/40 p-3 transition-colors hover:bg-accent/30"
              >
                {/* Thumbnail */}
                <div className="h-12 w-20 flex-shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
                  {post.thumbnail_url ? (
                    <img
                      src={post.thumbnail_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No img</span>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {truncateText(post.title, 45)}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {post.platforms.map((p) => (
                        <PlatformIcon key={p} platform={p} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {post.published_at
                        ? formatDate(post.published_at)
                        : post.scheduled_at
                        ? `Scheduled ${formatDate(post.scheduled_at)}`
                        : "Draft"}
                    </span>
                  </div>
                </div>

                {/* Status + link */}
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      getStatusColor(post.status)
                    )}
                  >
                    {post.status}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    asChild
                  >
                    <a href="/schedule">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
