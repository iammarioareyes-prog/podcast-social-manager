"use client";

import { useEffect, useState } from "react";
import { Eye, Users, TrendingUp, Calendar, Youtube, Instagram, Music2, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PlatformChart } from "@/components/dashboard/platform-chart";
import { RecentPosts } from "@/components/dashboard/recent-posts";
import { PlatformStatCard } from "@/components/dashboard/platform-stat-card";

interface PlatformStats {
  instagram: { followers: number; posts: number; reach: number; engagement: number; connected: boolean; error: string };
  youtube:   { subscribers: number; views: number; videos: number; engagement: number; connected: boolean; error: string };
  tiktok:    { followers: number; likes: number; videos: number; connected: boolean; error: string };
  postsThisMonth: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/stats");
      const data = await res.json();
      setStats(data);
    } catch {
      // keep null
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const totalFollowers =
    (stats?.instagram.followers ?? 0) +
    (stats?.youtube.subscribers ?? 0) +
    (stats?.tiktok.followers ?? 0);

  const totalViews = stats?.youtube.views ?? 0;

  const overviewMetrics = [
    {
      title: "Total Views",
      value: loading ? "…" : totalViews.toLocaleString(),
      icon: Eye,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-400/10",
    },
    {
      title: "Total Followers",
      value: loading ? "…" : totalFollowers.toLocaleString(),
      icon: Users,
      iconColor: "text-green-400",
      iconBg: "bg-green-400/10",
    },
    {
      title: "TikTok Likes",
      value: loading ? "…" : (stats?.tiktok.likes ?? 0).toLocaleString(),
      icon: TrendingUp,
      iconColor: "text-purple-400",
      iconBg: "bg-purple-400/10",
    },
    {
      title: "Posts This Month",
      value: loading ? "…" : (stats?.postsThisMonth ?? 0),
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
      views: stats?.youtube.views ?? 0,
      followers: stats?.youtube.subscribers ?? 0,
      engagement: stats?.youtube.engagement ?? 0,
      posts: stats?.youtube.videos ?? 0,
      isConnected: stats?.youtube.connected ?? false,
    },
    {
      platform: "instagram",
      icon: Instagram,
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
      views: stats?.instagram.reach ?? 0,
      followers: stats?.instagram.followers ?? 0,
      engagement: stats?.instagram.engagement ?? 0,
      posts: stats?.instagram.posts ?? 0,
      isConnected: stats?.instagram.connected ?? false,
    },
    {
      platform: "tiktok",
      icon: Music2,
      color: "text-cyan-400",
      bgColor: "bg-cyan-400/10",
      views: stats?.tiktok.likes ?? 0,
      followers: stats?.tiktok.followers ?? 0,
      engagement: 0,
      posts: stats?.tiktok.videos ?? 0,
      isConnected: stats?.tiktok.connected ?? false,
    },
  ];

  return (
    <div className="flex flex-col">
      <Header
        title="Dashboard"
        description="Overview of your podcast social media performance"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Overview Metrics */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Overview
            </h2>
            <button
              onClick={fetchStats}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {overviewMetrics.map((metric) => (
              <MetricCard
                key={metric.title}
                title={metric.title}
                value={metric.value}
                trend={metric.trend}
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

        {/* Chart + Quick Stats */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <PlatformChart title="Views Over Last 30 Days" />
          </div>
          <div className="xl:col-span-1">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-4 text-sm font-semibold text-foreground">
                Platform Breakdown
              </h3>
              <div className="space-y-3">
                {[
                  { label: "YouTube Subscribers", value: loading ? "…" : (stats?.youtube.subscribers ?? 0).toLocaleString() },
                  { label: "YouTube Total Views", value: loading ? "…" : (stats?.youtube.views ?? 0).toLocaleString() },
                  { label: "YouTube Videos", value: loading ? "…" : (stats?.youtube.videos ?? 0).toLocaleString() },
                  { label: "Instagram Followers", value: loading ? "…" : (stats?.instagram.followers ?? 0).toLocaleString() },
                  { label: "Instagram Posts", value: loading ? "…" : (stats?.instagram.posts ?? 0).toLocaleString() },
                  { label: "TikTok Followers", value: loading ? "…" : (stats?.tiktok.followers ?? 0).toLocaleString() },
                  { label: "TikTok Total Likes", value: loading ? "…" : (stats?.tiktok.likes ?? 0).toLocaleString() },
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
