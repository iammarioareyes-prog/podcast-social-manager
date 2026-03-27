"use client";

import { useState } from "react";
import { Eye, ThumbsUp, MessageCircle, Share2, Clock, MousePointerClick, Users, TrendingUp } from "lucide-react";
import { Header } from "@/components/layout/header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TrendChart } from "@/components/analytics/trend-chart";
import { MetricsTable } from "@/components/analytics/metrics-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateMockViewsData, generateHeatmapData, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

const dateRanges = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
];

// Heatmap color intensity
function getHeatmapColor(value: number): string {
  if (value >= 80) return "bg-purple-500";
  if (value >= 60) return "bg-purple-500/70";
  if (value >= 40) return "bg-purple-500/50";
  if (value >= 20) return "bg-purple-500/30";
  return "bg-purple-500/10";
}

const HOURS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return "12am";
  if (i < 12) return `${i}am`;
  if (i === 12) return "12pm";
  return `${i - 12}pm`;
});

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState("30d");
  const [platform, setPlatform] = useState("all");

  const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
  const viewsData = generateMockViewsData(days);
  const heatmapData = generateHeatmapData();

  const metrics = [
    {
      title: "Total Views",
      value: platform === "all" ? 284700 : platform === "youtube" ? 142000 : platform === "instagram" ? 89000 : 53700,
      trend: 12.5,
      icon: Eye,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-400/10",
    },
    {
      title: "Total Likes",
      value: platform === "all" ? 19087 : platform === "youtube" ? 8430 : platform === "instagram" ? 6247 : 4410,
      trend: 8.3,
      icon: ThumbsUp,
      iconColor: "text-red-400",
      iconBg: "bg-red-400/10",
    },
    {
      title: "Total Comments",
      value: platform === "all" ? 1765 : platform === "youtube" ? 743 : platform === "instagram" ? 612 : 410,
      trend: 15.2,
      icon: MessageCircle,
      iconColor: "text-green-400",
      iconBg: "bg-green-400/10",
    },
    {
      title: "Total Shares",
      value: platform === "all" ? 6454 : platform === "youtube" ? 2840 : platform === "instagram" ? 1974 : 1640,
      trend: 22.1,
      icon: Share2,
      iconColor: "text-yellow-400",
      iconBg: "bg-yellow-400/10",
    },
    {
      title: "Watch Time (hrs)",
      value: platform === "all" ? "1,284" : platform === "youtube" ? "742" : platform === "instagram" ? "321" : "221",
      trend: 9.8,
      icon: Clock,
      iconColor: "text-purple-400",
      iconBg: "bg-purple-400/10",
    },
    {
      title: "Avg CTR",
      value: "4.8%",
      trend: 1.2,
      icon: MousePointerClick,
      iconColor: "text-orange-400",
      iconBg: "bg-orange-400/10",
    },
    {
      title: "Total Reach",
      value: platform === "all" ? 371000 : platform === "youtube" ? 181000 : platform === "instagram" ? 112000 : 78000,
      trend: 18.4,
      icon: Users,
      iconColor: "text-cyan-400",
      iconBg: "bg-cyan-400/10",
    },
    {
      title: "Avg Engagement",
      value: "5.4%",
      trend: 1.1,
      icon: TrendingUp,
      iconColor: "text-pink-400",
      iconBg: "bg-pink-400/10",
    },
  ];

  return (
    <div className="flex flex-col">
      <Header
        title="Analytics"
        description="Detailed performance metrics across all platforms"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {dateRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setDateRange(range.value)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  dateRange === range.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {range.label}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" className="ml-auto text-xs">
            Export CSV
          </Button>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        {/* Charts */}
        <Tabs defaultValue="views">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="views">Views</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="reach">Reach</TabsTrigger>
          </TabsList>

          <TabsContent value="views" className="mt-4">
            <TrendChart
              data={viewsData}
              metric="views"
              title="Views Over Time"
              chartType="area"
            />
          </TabsContent>

          <TabsContent value="engagement" className="mt-4">
            <TrendChart
              data={viewsData.map((d) => ({
                ...d,
                youtube: Math.floor(d.youtube * 0.042),
                instagram: Math.floor(d.instagram * 0.068),
                tiktok: Math.floor(d.tiktok * 0.081),
              }))}
              metric="engagement"
              title="Engagement Over Time"
              chartType="bar"
            />
          </TabsContent>

          <TabsContent value="reach" className="mt-4">
            <TrendChart
              data={viewsData.map((d) => ({
                ...d,
                youtube: Math.floor(d.youtube * 1.28),
                instagram: Math.floor(d.instagram * 1.41),
                tiktok: Math.floor(d.tiktok * 1.53),
              }))}
              metric="reach"
              title="Reach Over Time"
              chartType="area"
            />
          </TabsContent>
        </Tabs>

        {/* Top content table */}
        <MetricsTable />

        {/* Posting time heatmap */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Best Posting Times Heatmap
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Engagement intensity by day and hour (darker = higher engagement)
          </p>

          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Hour labels */}
              <div className="mb-1 flex gap-0.5 pl-12">
                {HOURS.filter((_, i) => i % 3 === 0).map((hour) => (
                  <div
                    key={hour}
                    className="w-10 text-center text-xs text-muted-foreground"
                  >
                    {hour}
                  </div>
                ))}
              </div>

              {/* Heatmap rows */}
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day} className="mb-0.5 flex items-center gap-0.5">
                  <div className="w-10 text-right text-xs text-muted-foreground pr-2">
                    {day}
                  </div>
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const cell = heatmapData.find(
                      (d) => d.day === day && d.hour === hour
                    );
                    return (
                      <div
                        key={hour}
                        className={cn(
                          "h-6 w-6 rounded-sm transition-opacity hover:opacity-70",
                          getHeatmapColor(cell?.value || 0)
                        )}
                        title={`${day} ${HOURS[hour]}: ${cell?.value || 0}% engagement`}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Legend */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Low</span>
                <div className="flex gap-0.5">
                  {[10, 30, 50, 70, 90].map((v) => (
                    <div
                      key={v}
                      className={cn("h-4 w-6 rounded-sm", getHeatmapColor(v))}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">High</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
