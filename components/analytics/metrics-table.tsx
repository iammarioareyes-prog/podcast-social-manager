"use client";

import { Youtube, Instagram, Music2, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatNumber, formatPercentage } from "@/lib/utils";

interface MetricRow {
  title: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  impressions: number;
  reach: number;
  thumbnail?: string;
}

interface MetricsTableProps {
  data?: MetricRow[];
  title?: string;
}

function PlatformBadge({ platform }: { platform: string }) {
  const configs = {
    youtube: { icon: Youtube, color: "text-red-500", bg: "bg-red-500/10", label: "YT" },
    instagram: { icon: Instagram, color: "text-pink-500", bg: "bg-pink-500/10", label: "IG" },
    tiktok: { icon: Music2, color: "text-cyan-400", bg: "bg-cyan-400/10", label: "TT" },
  };

  const config = configs[platform as keyof typeof configs];
  if (!config) return null;

  return (
    <div
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded",
        config.bg
      )}
      title={platform}
    >
      <config.icon className={cn("h-3 w-3", config.color)} />
    </div>
  );
}

function TrendBadge({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 text-xs",
        isPositive ? "text-green-500" : "text-red-500"
      )}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {Math.abs(value).toFixed(1)}%
    </div>
  );
}

const mockData: MetricRow[] = [
  {
    title: "Episode 47: Future of AI",
    platform: "youtube",
    views: 48230,
    likes: 2847,
    comments: 312,
    shares: 892,
    engagement: 8.4,
    impressions: 124000,
    reach: 98000,
  },
  {
    title: "Episode 47: Future of AI",
    platform: "tiktok",
    views: 92400,
    likes: 8430,
    comments: 743,
    shares: 2840,
    engagement: 13.0,
    impressions: 180000,
    reach: 145000,
  },
  {
    title: "Best Moments Ep46",
    platform: "instagram",
    views: 18470,
    likes: 1240,
    comments: 89,
    shares: 340,
    engagement: 9.1,
    impressions: 42000,
    reach: 31000,
  },
  {
    title: "Quick Tip: Audio Quality",
    platform: "tiktok",
    views: 74200,
    likes: 6820,
    comments: 420,
    shares: 1840,
    engagement: 12.2,
    impressions: 156000,
    reach: 128000,
  },
  {
    title: "Episode 46 Full Cut",
    platform: "youtube",
    views: 32100,
    likes: 1890,
    comments: 201,
    shares: 540,
    engagement: 8.2,
    impressions: 89000,
    reach: 72000,
  },
];

export function MetricsTable({ data = mockData, title = "Top Performing Content" }: MetricsTableProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 text-left text-xs font-medium text-muted-foreground">
                  Content
                </th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground">
                  Views
                </th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground">
                  Likes
                </th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">
                  Comments
                </th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground hidden lg:table-cell">
                  Shares
                </th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground">
                  Engagement
                </th>
                <th className="pb-3 text-right text-xs font-medium text-muted-foreground hidden xl:table-cell">
                  Reach
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.map((row, index) => (
                <tr key={index} className="hover:bg-accent/20">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <PlatformBadge platform={row.platform} />
                      <span className="text-sm text-foreground line-clamp-1 max-w-48">
                        {row.title}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm font-medium text-foreground">
                      {formatNumber(row.views)}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(row.likes)}
                    </span>
                  </td>
                  <td className="py-3 text-right hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(row.comments)}
                    </span>
                  </td>
                  <td className="py-3 text-right hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(row.shares)}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        row.engagement >= 10
                          ? "bg-green-500/10 text-green-400"
                          : row.engagement >= 5
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-gray-500/10 text-gray-400"
                      )}
                    >
                      {formatPercentage(row.engagement)}
                    </span>
                  </td>
                  <td className="py-3 text-right hidden xl:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(row.reach)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
