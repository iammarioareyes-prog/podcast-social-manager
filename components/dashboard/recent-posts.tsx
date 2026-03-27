"use client";

import { Youtube, Instagram, Music2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cn,
  formatNumber,
  formatDate,
  getPlatformLabel,
  getStatusColor,
  truncateText,
} from "@/lib/utils";
import type { Post } from "@/types";

const mockRecentPosts: Post[] = [
  {
    id: "1",
    title: "Episode 47: The Future of AI in Podcasting",
    description: "Deep dive into how AI is transforming podcast creation",
    caption: "AI is changing everything about how we create content...",
    hashtags: ["#podcast", "#AI", "#content"],
    platforms: ["youtube", "instagram", "tiktok"],
    status: "published",
    published_at: "2024-01-20T14:00:00Z",
    platform_post_ids: { youtube: "abc123", instagram: "def456", tiktok: "ghi789" },
    created_at: "2024-01-19T10:00:00Z",
    updated_at: "2024-01-20T14:00:00Z",
  },
  {
    id: "2",
    title: "Episode 46 Highlights: Best Moments",
    description: "Top clips from our previous episode",
    caption: "You didn't want to miss these moments...",
    hashtags: ["#podcast", "#highlights"],
    platforms: ["instagram", "tiktok"],
    status: "published",
    published_at: "2024-01-18T16:00:00Z",
    platform_post_ids: { instagram: "jkl012", tiktok: "mno345" },
    created_at: "2024-01-17T10:00:00Z",
    updated_at: "2024-01-18T16:00:00Z",
  },
  {
    id: "3",
    title: "Episode 48: Behind the Scenes",
    description: "What goes into making a podcast episode",
    caption: "Ever wondered what goes on behind the microphone?",
    hashtags: ["#podcast", "#bts", "#podcasting"],
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
    description: "Simple tips to improve your audio quality",
    caption: "Your mic matters less than you think...",
    hashtags: ["#podcasting", "#tips", "#audio"],
    platforms: ["tiktok"],
    status: "draft",
    platform_post_ids: {},
    created_at: "2024-01-22T10:00:00Z",
    updated_at: "2024-01-22T10:00:00Z",
  },
];

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
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-foreground">
          Recent Posts
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
          View all
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockRecentPosts.map((post) => (
            <div
              key={post.id}
              className="flex items-center gap-4 rounded-lg border border-border bg-background/40 p-3 transition-colors hover:bg-accent/30"
            >
              {/* Thumbnail placeholder */}
              <div className="h-12 w-20 flex-shrink-0 rounded bg-muted flex items-center justify-center">
                <span className="text-xs text-muted-foreground">No img</span>
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

              {/* Status badge */}
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
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
