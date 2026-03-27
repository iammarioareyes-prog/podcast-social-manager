"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, RefreshCw, Copy, CheckCheck } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const defaultAnalyticsData = [
  {
    platform: "youtube",
    views: 142000,
    likes: 8430,
    engagement: 4.2,
    topPosts: [
      { title: "Episode 47: Future of AI", views: 48230, engagement: 8.4 },
      { title: "Episode 46 Highlights", views: 32100, engagement: 7.8 },
    ],
  },
  {
    platform: "instagram",
    views: 89000,
    likes: 6247,
    engagement: 6.8,
    topPosts: [
      { title: "Quick Tips Clip", views: 18470, engagement: 9.1 },
      { title: "Guest Interview Teaser", views: 14200, engagement: 8.7 },
    ],
  },
  {
    platform: "tiktok",
    views: 53700,
    likes: 4410,
    engagement: 8.1,
    topPosts: [
      { title: "Episode 47 Hook", views: 92400, engagement: 13.0 },
      { title: "Audio Quality Tips", views: 74200, engagement: 12.2 },
    ],
  },
];

// Simple markdown to HTML converter for display
function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-foreground mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-foreground mt-5 mb-2">$2</h2>'.replace("$2", "$1"))
    .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-foreground mt-5 mb-3">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li class="text-muted-foreground ml-4 mb-1">• $1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li class="text-muted-foreground ml-4 mb-1">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-muted-foreground mb-3">')
    .replace(/\n/g, "<br />");
}

const quickInsights = [
  {
    title: "Best Performing Platform",
    value: "TikTok",
    detail: "13.0% avg engagement rate",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
  {
    title: "Top Content Type",
    value: "Short Clips",
    detail: "Under 60 seconds perform 3x better",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    title: "Optimal Post Time",
    value: "6-8 PM EST",
    detail: "Tuesday & Thursday highest reach",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    title: "Growth Rate",
    value: "+18.4%",
    detail: "Month-over-month follower growth",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
];

export default function StrategyPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategy, setStrategy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [podcastName, setPodcastName] = useState("My Podcast");
  const [podcastGenre, setPodcastGenre] = useState("general");
  const strategyRef = useRef<HTMLDivElement>(null);

  const generateStrategy = async () => {
    setIsGenerating(true);
    setError(null);
    setStrategy("");

    try {
      const response = await fetch("/api/claude/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_strategy",
          analyticsData: defaultAnalyticsData,
          recentPosts: [
            { title: "Episode 47: Future of AI", platform: "youtube", status: "published", views: 48230 },
            { title: "Episode 46 Highlights", platform: "tiktok", status: "published", views: 92400 },
            { title: "Quick Audio Tips", platform: "instagram", status: "published", views: 18470 },
          ],
          podcastName,
          podcastGenre,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate strategy");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE format
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setStrategy((prev) => prev + parsed.text);
              }
            } catch {
              // Plain text fallback
              if (data && data !== "[DONE]") {
                setStrategy((prev) => prev + data);
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate strategy");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(strategy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Scroll to bottom as content streams
  useEffect(() => {
    if (strategyRef.current && isGenerating) {
      strategyRef.current.scrollTop = strategyRef.current.scrollHeight;
    }
  }, [strategy, isGenerating]);

  return (
    <div className="flex flex-col">
      <Header
        title="AI Strategy"
        description="Claude-powered content recommendations and insights"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Quick Insights */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {quickInsights.map((insight) => (
            <Card key={insight.title} className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{insight.title}</p>
                <p className={`mt-1 text-lg font-bold ${insight.color}`}>
                  {insight.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {insight.detail}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="strategy">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="strategy">Weekly Strategy</TabsTrigger>
            <TabsTrigger value="captions">Caption Templates</TabsTrigger>
            <TabsTrigger value="trends">Trending Topics</TabsTrigger>
          </TabsList>

          {/* Weekly Strategy Tab */}
          <TabsContent value="strategy" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-40">
                    <Label htmlFor="podcastName" className="text-xs">
                      Podcast Name
                    </Label>
                    <Input
                      id="podcastName"
                      value={podcastName}
                      onChange={(e) => setPodcastName(e.target.value)}
                      placeholder="Your Podcast Name"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div className="w-40">
                    <Label htmlFor="genre" className="text-xs">
                      Genre
                    </Label>
                    <Input
                      id="genre"
                      value={podcastGenre}
                      onChange={(e) => setPodcastGenre(e.target.value)}
                      placeholder="e.g., tech, comedy"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <Button
                    onClick={generateStrategy}
                    disabled={isGenerating}
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isGenerating ? "Generating..." : "Generate Strategy"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                    {error}
                    <p className="mt-1 text-xs text-red-400/70">
                      Make sure ANTHROPIC_API_KEY is configured.
                    </p>
                  </div>
                )}

                {!strategy && !isGenerating && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10">
                      <Sparkles className="h-8 w-8 text-purple-400" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Generate your personalized AI content strategy
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Claude will analyze your analytics and create a comprehensive weekly plan
                    </p>
                    <Button
                      onClick={generateStrategy}
                      className="mt-4 gap-2 bg-purple-600 hover:bg-purple-700"
                    >
                      <Sparkles className="h-4 w-4" />
                      Get My Strategy
                    </Button>
                  </div>
                )}

                {(strategy || isGenerating) && (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isGenerating && (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
                            <span className="text-xs text-purple-400">
                              Claude is thinking...
                            </span>
                          </>
                        )}
                      </div>
                      {strategy && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopy}
                            className="h-7 gap-1 text-xs"
                          >
                            {copied ? (
                              <CheckCheck className="h-3 w-3 text-green-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            {copied ? "Copied!" : "Copy"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={generateStrategy}
                            disabled={isGenerating}
                            className="h-7 gap-1 text-xs"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Regenerate
                          </Button>
                        </div>
                      )}
                    </div>

                    <div
                      ref={strategyRef}
                      className="prose-dark max-h-[600px] overflow-y-auto rounded-lg bg-background/40 p-4"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(strategy) + (isGenerating ? '<span class="animate-pulse text-purple-400">▋</span>' : ""),
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Caption Templates Tab */}
          <TabsContent value="captions" className="mt-4">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  platform: "YouTube Shorts",
                  color: "border-red-500/30 bg-red-500/5",
                  titleColor: "text-red-400",
                  templates: [
                    "🎙️ [Hook question]? Full episode link in bio! #podcast #[topic] #YouTube",
                    "This is why [surprising fact]... Swipe up for more! 🔥 #[genre]podcast",
                    "POV: You just discovered the best [genre] podcast 👀 Follow for weekly drops!",
                  ],
                },
                {
                  platform: "Instagram Reels",
                  color: "border-pink-500/30 bg-pink-500/5",
                  titleColor: "text-pink-400",
                  templates: [
                    "✨ [Engaging hook]\n\nFull episode now available - link in bio!\n\n#podcast #[topic] #reels #podcastclip",
                    "This conversation changed my perspective on [topic] 🤯\n\nNew episode out now! Drop a 🎙️ if you want to be tagged when we post.\n\n#podcast #content",
                    "3 things we learned about [topic] this week:\n1️⃣ [Point 1]\n2️⃣ [Point 2]\n3️⃣ [Point 3]\n\nFull breakdown → link in bio!",
                  ],
                },
                {
                  platform: "TikTok",
                  color: "border-cyan-500/30 bg-cyan-500/5",
                  titleColor: "text-cyan-400",
                  templates: [
                    "Nobody talks about [topic] like this 👀 #podcast #[topic] #fyp",
                    "POV: [relatable situation] #podcastclip #[niche] #foryou",
                    "This is the [topic] content you didn't know you needed 🎙️ #podcast #fyp #trending",
                  ],
                },
              ].map((section) => (
                <Card
                  key={section.platform}
                  className={`border ${section.color}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle
                      className={`text-sm font-semibold ${section.titleColor}`}
                    >
                      {section.platform}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {section.templates.map((template, i) => (
                      <div
                        key={i}
                        className="group relative rounded-lg bg-background/50 p-3"
                      >
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {template}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          onClick={() => {
                            navigator.clipboard.writeText(template);
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Trending Topics Tab */}
          <TabsContent value="trends" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Trending Podcast Topics (2024)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { topic: "AI & Technology", trend: "+42%", hot: true },
                      { topic: "Mental Health & Wellness", trend: "+38%", hot: true },
                      { topic: "True Crime", trend: "+29%", hot: false },
                      { topic: "Personal Finance", trend: "+24%", hot: false },
                      { topic: "Self-Improvement", trend: "+21%", hot: false },
                      { topic: "Creator Economy", trend: "+35%", hot: true },
                      { topic: "Entrepreneurship", trend: "+18%", hot: false },
                      { topic: "Pop Culture Commentary", trend: "+31%", hot: true },
                    ].map((item) => (
                      <div
                        key={item.topic}
                        className="flex items-center justify-between rounded-lg border border-border bg-background/30 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          {item.hot && (
                            <span className="text-xs">🔥</span>
                          )}
                          <span className="text-sm text-foreground">
                            {item.topic}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-green-400">
                          {item.trend}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Content Format Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { format: "Short clips (30-60s)", performance: 92, platform: "TikTok/Reels" },
                      { format: "Audiogram clips", performance: 78, platform: "Instagram" },
                      { format: "Quote graphics", performance: 65, platform: "All" },
                      { format: "Behind-the-scenes", performance: 71, platform: "Instagram" },
                      { format: "Guest highlights", performance: 85, platform: "All" },
                      { format: "Episode trailers (60-90s)", performance: 88, platform: "YouTube" },
                    ].map((item) => (
                      <div key={item.format}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs text-foreground">
                            {item.format}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.platform}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary/60"
                            style={{ width: `${item.performance}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
