"use client";

import { Eye, Users, TrendingUp, Calendar, Youtube, Instagram, Music2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PlatformChart } from "@/components/dashboard/platform-chart";
import { RecentPosts } from "@/components/dashboard/recent-posts";
import { PlatformStatCard } from "@/components/dashboard/platform-stat-card";

const overviewMetrics = [
  {
    title: "Total Views",
    value: 284700,
    trend: 12.5,
    icon: Eye,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-400/10",
  },
  {
    title: "Total Followers",
    value: 26900,
    trend: 8.2,
    icon: Users,
    iconColor: "text-green-400",
    iconBg: "bg-green-400/10",
  },
  {
    title: "Avg. Engagement Rate",
    value: "5.4%",
    trend: 1.1,
    icon: TrendingUp,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-400/10",
  },
  {
    title: "Posts This Month",
    value: 14,
    trend: -7.1,
    trendLabel: "vs last month",
    icon: Calendar,
    iconColor: "text-orange-400",
    iconBg: "bg-orange-400/10",
  },
];

const platformStats = [
  {
    platform: "youtube",
    icon: Youtube,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    views: 142000,
    followers: 12847,
    engagement: 4.2,
    posts: 32,
    isConnected: false,
  },
  {
    platform: "instagram",
    icon: Instagram,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    views: 89000,
    followers: 8432,
    engagement: 6.8,
    posts: 47,
    isConnected: false,
  },
  {
    platform: "tiktok",
    icon: Music2,
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
    views: 53700,
    followers: 5621,
    engagement: 8.1,
    posts: 23,
    isConnected: false,
  },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col">
      <Header
        title="Dashboard"
        description="Overview of your podcast social media performance"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Overview Metrics */}
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Overview
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {overviewMetrics.map((metric) => (
              <MetricCard
                key={metric.title}
                title={metric.title}
                value={metric.value}
                trend={metric.trend}
                trendLabel={metric.trendLabel}
                icon={metric.icon}
                iconColor={metric.iconColor}
                iconBg={metric.iconBg}
              />
            ))}
          </div>
        </div>

        {/* Platform Stats */}
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Platform Performance
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {platformStats.map((stat) => (
              <PlatformStatCard key={stat.platform} {...stat} />
            ))}
          </div>
        </div>

        {/* Chart + Recent Posts */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <PlatformChart title="Views Over Last 30 Days" />
          </div>
          <div className="xl:col-span-1">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-4 text-sm font-semibold text-foreground">
                Quick Stats
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Best performing platform", value: "TikTok" },
                  { label: "Avg. views per post", value: "4,832" },
                  { label: "Top content type", value: "Short clips" },
                  { label: "Best posting day", value: "Wednesday" },
                  { label: "Best posting time", value: "6-8 PM EST" },
                  { label: "Fastest growing", value: "Instagram" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between border-b border-border pb-2 last:border-0"
                  >
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                    <span className="text-xs font-semibold text-foreground">
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Posts */}
        <RecentPosts />
      </div>
    </div>
  );
}
