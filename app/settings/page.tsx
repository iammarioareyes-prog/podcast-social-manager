"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Youtube, Instagram, Music2, Check, ExternalLink, AlertCircle, RefreshCw, Upload } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface VoiceProfile {
  id?: string;
  voice_summary?: string;
  voice_examples?: string[];
  ig_tags?: string[];
  tiktok_tags?: string[];
  youtube_tags?: string[];
  ig_hashtags?: string[];
  tiktok_hashtags?: string[];
  youtube_hashtags?: string[];
  podcast_name?: string;
  podcast_description?: string;
}

interface PlatformConnection {
  platform: string;
  is_connected: boolean;
  platform_username?: string;
  token_expires_at?: string;
}

interface PlatformCardProps {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  isConnected: boolean;
  username?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  setupDescription?: string;
  setupUrl?: string;
  expiryWarning?: string; // amber warning shown when token is near/past expiry
}

function PlatformCard({
  name,
  icon: Icon,
  color,
  bgColor,
  isConnected,
  username,
  onConnect,
  onDisconnect,
  setupDescription,
  setupUrl,
  expiryWarning,
}: PlatformCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", bgColor)}>
              <Icon className={cn("h-5 w-5", color)} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{name}</p>
              {isConnected && username ? (
                <p className="text-xs text-muted-foreground">@{username}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Not connected</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <Check className="h-3 w-3" />
                  Connected
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDisconnect}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={onConnect} className="h-7 text-xs">
                Connect
              </Button>
            )}
          </div>
        </div>

        {!isConnected && setupDescription && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/30 p-3">
            <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{setupDescription}</p>
            {setupUrl && (
              <a href={setupUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                <ExternalLink className="h-3 w-3 text-primary" />
              </a>
            )}
          </div>
        )}

        {isConnected && expiryWarning && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3 w-3 flex-shrink-0 text-amber-400" />
              <p className="text-xs text-amber-400">{expiryWarning}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 flex-shrink-0 ml-2"
              onClick={onConnect}
            >
              Reconnect
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const [connections, setConnections] = useState<Record<string, PlatformConnection>>({});
  const [loading, setLoading] = useState(true);

  // Voice Profile state
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>({});
  const [voiceLoading, setVoiceLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Instagram tags editing state
  const [igTagsInput, setIgTagsInput] = useState("");
  const [igTagsSaving, setIgTagsSaving] = useState(false);

  // Hashtags editing state
  const [igHashtagsInput, setIgHashtagsInput] = useState("");
  const [tiktokHashtagsInput, setTiktokHashtagsInput] = useState("");
  const [youtubeHashtagsInput, setYoutubeHashtagsInput] = useState("");
  const [hashtagsSaving, setHashtagsSaving] = useState(false);

  useEffect(() => {
    loadConnections();
    loadVoiceProfile();

    // Show success/error toast based on URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) {
      const msg = params.get("success")?.replace("_", " ") || "Connected!";
      console.log("Success:", msg);
    }
  }, []);

  async function loadConnections() {
    try {
      const res = await fetch("/api/platform-connections");
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, PlatformConnection> = {};
        for (const c of data) {
          map[c.platform] = c;
        }
        setConnections(map);
      }
    } catch (err) {
      console.error("Failed to load connections:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadVoiceProfile() {
    try {
      const res = await fetch("/api/voice-profile");
      if (res.ok) {
        const data: VoiceProfile = await res.json();
        setVoiceProfile(data);
        const tags = data.ig_tags || [];
        setIgTagsInput(tags.map((t) => `@${t.replace("@", "")}`).join(" "));
        setIgHashtagsInput((data.ig_hashtags || []).join(", "));
        setTiktokHashtagsInput((data.tiktok_hashtags || []).join(", "));
        setYoutubeHashtagsInput((data.youtube_hashtags || []).join(", "));
      }
    } catch (err) {
      console.error("Failed to load voice profile:", err);
    } finally {
      setVoiceLoading(false);
    }
  }

  async function processFiles(fileList: File[]) {
    if (fileList.length === 0) return;
    setImportLoading(true);
    setImportSuccess(null);
    setImportError(null);

    try {
      // Extract only user message text client-side to stay under Vercel's 4.5MB body limit
      const extractedMessages: string[] = [];
      for (const file of fileList) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const convs: any[] = Array.isArray(parsed) ? parsed : [parsed];
        for (const conv of convs.slice(0, 200)) {
          const mapping = conv.mapping || {};
          for (const node of Object.values(mapping) as any[]) {
            if (
              node?.message?.author?.role === "user" &&
              node?.message?.content?.parts
            ) {
              const msg = node.message.content.parts.join(" ").trim();
              if (msg.length > 20 && msg.length < 1000) {
                extractedMessages.push(msg);
              }
            }
          }
        }
      }

      if (extractedMessages.length === 0) {
        setImportError("No usable messages found in the selected files.");
        return;
      }

      const res = await fetch("/api/voice-profile/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: extractedMessages.slice(0, 300) }),
      });

      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || "Import failed");
      } else {
        setImportSuccess(
          `Analyzed ${data.messagesAnalyzed} messages across ${fileList.length} file${fileList.length > 1 ? "s" : ""} — found ${data.examplesFound} caption examples.`
        );
        setQueuedFiles([]);
        await loadVoiceProfile();
      }
    } catch (err: any) {
      setImportError(err.message || "Failed to parse file");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleChatGPTImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    const merged = [...queuedFiles, ...newFiles].filter(
      (f, i, arr) => arr.findIndex((x) => x.name === f.name) === i
    );
    setQueuedFiles(merged);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith(".json"));
    if (dropped.length === 0) return;
    setQueuedFiles((prev) => {
      const merged = [...prev, ...dropped].filter(
        (f, i, arr) => arr.findIndex((x) => x.name === f.name) === i
      );
      return merged;
    });
  }, []);

  async function saveIgTags() {
    setIgTagsSaving(true);
    try {
      const tags = igTagsInput
        .split(/\s+/)
        .map((t) => t.replace(/^@/, "").trim())
        .filter(Boolean);

      const res = await fetch("/api/voice-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ig_tags: tags }),
      });
      if (res.ok) {
        await loadVoiceProfile();
      }
    } catch (err) {
      console.error("Failed to save IG tags:", err);
    } finally {
      setIgTagsSaving(false);
    }
  }

  async function saveHashtags() {
    setHashtagsSaving(true);
    try {
      const parseHashtags = (val: string) =>
        val
          .split(",")
          .map((h) => h.trim())
          .filter(Boolean);

      const res = await fetch("/api/voice-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ig_hashtags: parseHashtags(igHashtagsInput),
          tiktok_hashtags: parseHashtags(tiktokHashtagsInput),
          youtube_hashtags: parseHashtags(youtubeHashtagsInput),
        }),
      });
      if (res.ok) {
        await loadVoiceProfile();
      }
    } catch (err) {
      console.error("Failed to save hashtags:", err);
    } finally {
      setHashtagsSaving(false);
    }
  }

  function handleConnect(authPath: string) {
    window.location.href = authPath;
  }

  async function handleDisconnect(platform: string) {
    await fetch("/api/platform-connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, is_connected: false }),
    });
    loadConnections();
  }

  const isConnected = (platform: string) => connections[platform]?.is_connected === true;
  const getUsername = (platform: string) => connections[platform]?.platform_username;

  /**
   * Returns an amber warning string when the platform token expires within
   * WARN_DAYS days, or has already expired. Returns undefined otherwise.
   */
  function getTokenExpiryWarning(platform: string): string | undefined {
    const WARN_DAYS = 7;
    const conn = connections[platform];
    if (!conn?.is_connected || !conn.token_expires_at) return undefined;
    const expiresAt = new Date(conn.token_expires_at).getTime();
    const now = Date.now();
    const daysLeft = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return "Token expired — posts will fail until you reconnect.";
    if (daysLeft <= WARN_DAYS) return `Token expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — reconnect soon to avoid interruptions.`;
    return undefined;
  }

  return (
    <div className="flex flex-col">
      <Header title="Settings" description="Configure your platforms and API keys" />

      <div className="flex-1 space-y-6 p-6">
        {/* Platform Connections */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-foreground">Platform Connections</h2>
            <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={loadConnections}>
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Connect your social media accounts to publish and analyze content
          </p>

          <div className="space-y-3">
            <PlatformCard
              name="YouTube"
              icon={Youtube}
              color="text-red-500"
              bgColor="bg-red-500/10"
              isConnected={isConnected("youtube")}
              username={getUsername("youtube")}
              onConnect={() => handleConnect("/api/auth/youtube")}
              onDisconnect={() => handleDisconnect("youtube")}
              setupDescription="Connects via Google OAuth 2.0 with YouTube Data API v3 access."
              expiryWarning={getTokenExpiryWarning("youtube")}
            />

            <PlatformCard
              name="Instagram"
              icon={Instagram}
              color="text-pink-500"
              bgColor="bg-pink-500/10"
              isConnected={isConnected("instagram")}
              username={getUsername("instagram")}
              onConnect={() => handleConnect("/api/auth/instagram")}
              onDisconnect={() => handleDisconnect("instagram")}
              setupDescription="Requires Facebook Developer App with Instagram Graph API. Your account must be a Business or Creator account."
              setupUrl="https://developers.facebook.com/apps"
              expiryWarning={getTokenExpiryWarning("instagram")}
            />

            <PlatformCard
              name="TikTok"
              icon={Music2}
              color="text-cyan-400"
              bgColor="bg-cyan-400/10"
              isConnected={isConnected("tiktok")}
              username={getUsername("tiktok")}
              onConnect={() => handleConnect("/api/auth/tiktok")}
              onDisconnect={() => handleDisconnect("tiktok")}
              setupDescription="Requires TikTok Developer App with Content Posting API access."
              setupUrl="https://developers.tiktok.com"
              expiryWarning={getTokenExpiryWarning("tiktok")}
            />
          </div>
        </div>

        <Separator />

        {/* Google Drive */}
        <div>
          <h2 className="mb-1 text-sm font-semibold text-foreground">Storage & Content Sources</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Connect storage services to browse and use your content
          </p>

          <PlatformCard
            name="Google Drive"
            icon={({ className }) => (
              <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.28 3L0 14l3.15 5.5h17.7L24 14 17.72 3H6.28zm2.57 0h6.3l4.15 7.2H4.7L8.85 3zM3 16l2.58-4.5h12.84L21 16H3z" />
              </svg>
            )}
            color="text-green-500"
            bgColor="bg-green-500/10"
            isConnected={isConnected("google_drive")}
            username={getUsername("google_drive")}
            onConnect={() => handleConnect("/api/auth/google-drive")}
            onDisconnect={() => handleDisconnect("google_drive")}
            setupDescription="Connect Google Drive to browse your podcast episodes and Opus Clips exports."
          />
        </div>

        <Separator />

        {/* Voice Profile & Caption Settings */}
        <div>
          <h2 className="mb-1 text-sm font-semibold text-foreground">Voice Profile & Caption Settings</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Customize your writing voice and auto-tagging defaults for caption generation
          </p>

          <div className="space-y-4">
            {/* Voice Profile Card */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Voice Profile</CardTitle>
                <CardDescription className="text-xs">
                  Import your ChatGPT conversations to train the caption generator on your writing style
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!voiceLoading && voiceProfile.voice_summary && (
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="mb-1 text-xs font-medium text-foreground">Current Voice Summary</p>
                    <p className="text-xs text-muted-foreground">{voiceProfile.voice_summary}</p>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Export from ChatGPT (Settings → Data Controls → Export). Then <strong className="text-foreground">drag all 10 files</strong> onto the zone below, or click to add them one at a time.
                  </p>

                  {/* Drop zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                      isDragging
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted/20"
                    )}
                  >
                    <Upload className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                    <p className="text-xs font-medium text-foreground">
                      Drag & drop all conversations.json files here
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    multiple
                    className="hidden"
                    onChange={handleChatGPTImport}
                  />

                  {/* Queued files list */}
                  {queuedFiles.length > 0 && (
                    <div className="mt-3 rounded-lg bg-muted/30 p-3">
                      <p className="mb-2 text-xs font-medium text-foreground">{queuedFiles.length} file{queuedFiles.length > 1 ? "s" : ""} queued:</p>
                      <ul className="space-y-0.5">
                        {queuedFiles.map((f) => (
                          <li key={f.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Check className="h-3 w-3 text-green-400" />
                            {f.name}
                          </li>
                        ))}
                      </ul>
                      <Button
                        size="sm"
                        className="mt-3 h-7 w-full text-xs"
                        disabled={importLoading}
                        onClick={(e) => { e.stopPropagation(); processFiles(queuedFiles); }}
                      >
                        {importLoading ? "Analyzing..." : `Analyze ${queuedFiles.length} file${queuedFiles.length > 1 ? "s" : ""} →`}
                      </Button>
                    </div>
                  )}

                  {importSuccess && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2">
                      <Check className="h-3 w-3 text-green-400" />
                      <p className="text-xs text-green-400">{importSuccess}</p>
                    </div>
                  )}

                  {importError && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2">
                      <AlertCircle className="h-3 w-3 text-destructive" />
                      <p className="text-xs text-destructive">{importError}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Instagram Auto-Tags Card */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Instagram Auto-Tags</CardTitle>
                <CardDescription className="text-xs">
                  These accounts are automatically tagged at the end of every Instagram caption
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={igTagsInput}
                  onChange={(e) => setIgTagsInput(e.target.value)}
                  placeholder="@handle1 @handle2 @handle3"
                  className="min-h-[64px] resize-none font-mono text-xs"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Space-separated handles with @ prefix (e.g. @iammarioareyes @tamishaharris)
                </p>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={igTagsSaving}
                  onClick={saveIgTags}
                >
                  {igTagsSaving ? "Saving..." : "Save Tags"}
                </Button>
              </CardContent>
            </Card>

            {/* Hashtags Card */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Hashtags</CardTitle>
                <CardDescription className="text-xs">
                  Preferred hashtags for each platform — the AI will pull from these when generating captions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Instagram</label>
                  <Input
                    value={igHashtagsInput}
                    onChange={(e) => setIgHashtagsInput(e.target.value)}
                    placeholder="#podcast, #blackpodcast, #motivation"
                    className="h-8 font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">TikTok</label>
                  <Input
                    value={tiktokHashtagsInput}
                    onChange={(e) => setTiktokHashtagsInput(e.target.value)}
                    placeholder="#podcast, #podcastclips, #fyp"
                    className="h-8 font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">YouTube</label>
                  <Input
                    value={youtubeHashtagsInput}
                    onChange={(e) => setYoutubeHashtagsInput(e.target.value)}
                    placeholder="#shorts, #podcast, #interview"
                    className="h-8 font-mono text-xs"
                  />
                </div>

                <p className="text-xs text-muted-foreground">Comma-separated hashtags (with or without #)</p>

                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={hashtagsSaving}
                  onClick={saveHashtags}
                >
                  {hashtagsSaving ? "Saving..." : "Save Hashtags"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator />

        {/* API Configuration */}
        <div>
          <h2 className="mb-1 text-sm font-semibold text-foreground">API Configuration</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Environment variables configured in Vercel project settings.
          </p>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm">Required Environment Variables</CardTitle>
              <CardDescription className="text-xs">
                These must be set in Vercel (or .env.local for local dev).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-background/60 p-4 font-mono text-xs text-muted-foreground space-y-0.5">
                <p className="text-green-400"># Supabase</p>
                <p>NEXT_PUBLIC_SUPABASE_URL</p>
                <p>NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
                <p>SUPABASE_SERVICE_ROLE_KEY</p>
                <p className="mt-2 text-green-400"># AI</p>
                <p>ANTHROPIC_API_KEY</p>
                <p className="mt-2 text-green-400"># YouTube / Google OAuth</p>
                <p>YOUTUBE_CLIENT_ID</p>
                <p>YOUTUBE_CLIENT_SECRET</p>
                <p>YOUTUBE_REDIRECT_URI</p>
                <p className="mt-2 text-green-400"># Google Drive OAuth</p>
                <p>GOOGLE_DRIVE_CLIENT_ID</p>
                <p>GOOGLE_DRIVE_CLIENT_SECRET</p>
                <p>GOOGLE_DRIVE_REDIRECT_URI</p>
                <p>GOOGLE_DRIVE_FOLDER_ID</p>
                <p className="mt-2 text-green-400"># App</p>
                <p>NEXT_PUBLIC_APP_URL</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Database Setup */}
        <div>
          <h2 className="mb-1 text-sm font-semibold text-foreground">Database Setup</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Run this SQL in your Supabase SQL Editor to create the required tables
          </p>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-foreground">supabase/migrations/schema.sql</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 text-xs"
                  onClick={() => window.open("https://app.supabase.com", "_blank")}
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Supabase
                </Button>
              </div>
              <div className="rounded bg-background/60 p-3 font-mono text-xs text-muted-foreground">
                <p className="text-green-400">-- Schema already applied ✓</p>
                <p>posts · analytics · platform_connections · content_items</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
