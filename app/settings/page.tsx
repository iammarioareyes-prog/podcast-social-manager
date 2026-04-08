"use client";

import { useState, useEffect } from "react";
import { Youtube, Instagram, Music2, Check, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface PlatformConnection {
  platform: string;
  is_connected: boolean;
  platform_username?: string;
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
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const [connections, setConnections] = useState<Record<string, PlatformConnection>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConnections();

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
