"use client";

import { useState } from "react";
import { Sparkles, Loader2, Youtube, Instagram, Music2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformSelector } from "./platform-selector";
import type { Platform } from "@/types";

interface CaptionData {
  platform: string;
  caption: string;
  hashtags: string[];
}

interface PostCreatorProps {
  onSubmit?: (data: PostFormData) => Promise<void>;
}

interface PostFormData {
  title: string;
  description: string;
  platforms: Platform[];
  caption: string;
  hashtags: string;
  scheduledAt: string;
  contentUrl: string;
  status: "draft" | "scheduled";
  captions_json: Record<string, string>;
}

const platformIcons = {
  youtube: { icon: Youtube, color: "text-red-500", label: "YouTube" },
  instagram: { icon: Instagram, color: "text-pink-500", label: "Instagram" },
  tiktok: { icon: Music2, color: "text-cyan-400", label: "TikTok" },
};

export function PostCreator({ onSubmit }: PostCreatorProps) {
  const [formData, setFormData] = useState<PostFormData>({
    title: "",
    description: "",
    platforms: ["youtube", "instagram", "tiktok"],
    caption: "",
    hashtags: "",
    scheduledAt: "",
    contentUrl: "",
    status: "draft",
    captions_json: {},
  });

  const [generatedCaptions, setGeneratedCaptions] = useState<CaptionData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCaption, setActiveCaption] = useState<string>("youtube");
  const [error, setError] = useState<string | null>(null);

  const handleGenerateCaptions = async () => {
    if (!formData.title) {
      setError("Please enter a title before generating captions.");
      return;
    }
    if (formData.platforms.length === 0) {
      setError("Please select at least one platform.");
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/claude/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_captions",
          title: formData.title,
          description: formData.description,
          platforms: formData.platforms,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate captions");
      }

      const data = await response.json();
      const captions: CaptionData[] = data.captions || [];
      setGeneratedCaptions(captions);

      // Auto-save all platform captions to captions_json — caption text only, no hashtags
      // (Hashtags are appended at post time from the brand settings in voice_profile)
      const captionsJson: Record<string, string> = {};
      for (const c of captions) {
        captionsJson[c.platform] = c.caption;
      }
      setFormData((prev) => ({ ...prev, captions_json: captionsJson }));

      // Set active caption to first platform
      if (captions.length > 0) {
        setActiveCaption(captions[0].platform);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate captions");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyCaption = (caption: CaptionData) => {
    setFormData((prev) => ({
      ...prev,
      caption: caption.caption,
      hashtags: caption.hashtags.join(" "),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Post Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Episode title or content description..."
              value={formData.title}
              onChange={(e) =>
                setFormData((p) => ({ ...p, title: e.target.value }))
              }
              className="mt-1.5"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Full description of the content..."
              value={formData.description}
              onChange={(e) =>
                setFormData((p) => ({ ...p, description: e.target.value }))
              }
              className="mt-1.5 min-h-24"
            />
          </div>

          <div>
            <Label htmlFor="contentUrl">Content URL</Label>
            <Input
              id="contentUrl"
              placeholder="https://drive.google.com/... or Supabase URL"
              value={formData.contentUrl}
              onChange={(e) =>
                setFormData((p) => ({ ...p, contentUrl: e.target.value }))
              }
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Google Drive link or uploaded file URL
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Platform Selection */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          <PlatformSelector
            selected={formData.platforms}
            onChange={(platforms) =>
              setFormData((p) => ({ ...p, platforms }))
            }
          />
        </CardContent>
      </Card>

      {/* AI Caption Generation */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Captions & Hashtags
            </CardTitle>
            <Button
              type="button"
              size="sm"
              onClick={handleGenerateCaptions}
              disabled={isGenerating}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {isGenerating ? "Generating..." : "Generate with AI"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Generated Captions */}
          {generatedCaptions.length > 0 && (
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
              <p className="mb-3 text-xs font-semibold text-purple-400">
                AI Generated Captions — click to apply
              </p>
              <Tabs value={activeCaption} onValueChange={setActiveCaption}>
                <TabsList className="bg-background/50 border border-border mb-3">
                  {generatedCaptions.map((caption) => {
                    const config = platformIcons[caption.platform as keyof typeof platformIcons];
                    if (!config) return null;
                    return (
                      <TabsTrigger
                        key={caption.platform}
                        value={caption.platform}
                        className="gap-1.5 text-xs"
                      >
                        <config.icon className={`h-3 w-3 ${config.color}`} />
                        {config.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {generatedCaptions.map((caption) => (
                  <TabsContent key={caption.platform} value={caption.platform}>
                    <div className="space-y-3">
                      <div className="rounded bg-background/50 p-3 text-sm text-foreground">
                        {caption.caption}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {caption.hashtags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          >
                            {tag.startsWith("#") ? tag : `#${tag}`}
                          </span>
                        ))}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => applyCaption(caption)}
                        className="w-full text-xs"
                      >
                        Apply This Caption
                      </Button>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}

          {/* Manual caption */}
          <div>
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              placeholder="Write your caption or use AI to generate..."
              value={formData.caption}
              onChange={(e) =>
                setFormData((p) => ({ ...p, caption: e.target.value }))
              }
              className="mt-1.5 min-h-20"
            />
          </div>

          <div>
            <Label htmlFor="hashtags">Hashtags</Label>
            <Input
              id="hashtags"
              placeholder="#podcast #content #creator"
              value={formData.hashtags}
              onChange={(e) =>
                setFormData((p) => ({ ...p, hashtags: e.target.value }))
              }
              className="mt-1.5"
            />
          </div>
        </CardContent>
      </Card>

      {/* Scheduling */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="scheduledAt">Publish Date & Time</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={formData.scheduledAt}
              onChange={(e) =>
                setFormData((p) => ({ ...p, scheduledAt: e.target.value }))
              }
              className="mt-1.5"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              variant="outline"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => setFormData((p) => ({ ...p, status: "draft" }))}
            >
              Save as Draft
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2"
              disabled={isSubmitting}
              onClick={() =>
                setFormData((p) => ({ ...p, status: "scheduled" }))
              }
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
              Schedule Post
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
