"use client";

import { useState } from "react";
import { Youtube, Instagram, Music2, Check, ExternalLink, AlertCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface PlatformCardProps {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  isConnected: boolean;
  username?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  authUrl?: string;
  setupUrl?: string;
  setupDescription?: string;
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
  authUrl,
  setupUrl,
  setupDescription,
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
              <Button
                size="sm"
                onClick={onConnect}
                className="h-7 text-xs"
              >
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
              <a
                href={setupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
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
  const [connections, setConnections] = useState({
    youtube: { isConnected: false, username: "" },
    instagram: { isConnected: false, username: "" },
    tiktok: { isConnected: false, username: "" },
    googleDrive: { isConnected: false, username: "" },
  });

  const [apiKeys, setApiKeys] = useState({
    anthropic: "",
    supabaseUrl: "",
    supabaseKey: "",
  });

  const handleConnect = (platform: keyof typeof connections) => {
    // TODO: Redirect to OAuth flow
    const authUrls: Record<string, string> = {
      youtube: `/api/auth/youtube`,
      instagram: `/api/auth/instagram`,
      tiktok: `/api/auth/tiktok`,
      googleDrive: `/api/auth/google-drive`,
    };

    alert(
      `TODO: Redirect to ${authUrls[platform]} OAuth flow.\n\nMake sure you've configured the environment variables in .env.local`
    );
  };

  const handleDisconnect = (platform: keyof typeof connections) => {
    setConnections((prev) => ({
      ...prev,
      [platform]: { isConnected: false, username: "" },
    }));
  };

  return (
    <div className="flex flex-col">
      <Header title="Settings" description="Configure your platforms and API keys" />

      <div className="flex-1 space-y-6 p-6">
        {/* Platform Connections */}
        <div>
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Platform Connections
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Connect your social media accounts to publish and analyze content
          </p>

          <div className="space-y-3">
            <PlatformCard
              name="YouTube"
              icon={Youtube}
              color="text-red-500"
              bgColor="bg-red-500/10"
              isConnected={connections.youtube.isConnected}
              username={connections.youtube.username}
              onConnect={() => handleConnect("youtube")}
              onDisconnect={() => handleDisconnect("youtube")}
              setupDescription="Requires Google OAuth 2.0 with YouTube Data API v3 and YouTube Analytics API access. Configure YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in your environment."
              setupUrl="https://console.cloud.google.com/apis/credentials"
            />

            <PlatformCard
              name="Instagram"
              icon={Instagram}
              color="text-pink-500"
              bgColor="bg-pink-500/10"
              isConnected={connections.instagram.isConnected}
              username={connections.instagram.username}
              onConnect={() => handleConnect("instagram")}
              onDisconnect={() => handleDisconnect("instagram")}
              setupDescription="Requires Facebook Developer App with Instagram Graph API. Your account must be a Business or Creator account. Configure INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET."
              setupUrl="https://developers.facebook.com/apps"
            />

            <PlatformCard
              name="TikTok"
              icon={Music2}
              color="text-cyan-400"
              bgColor="bg-cyan-400/10"
              isConnected={connections.tiktok.isConnected}
              username={connections.tiktok.username}
              onConnect={() => handleConnect("tiktok")}
              onDisconnect={() => handleDisconnect("tiktok")}
              setupDescription="Requires TikTok Developer App with Content Posting API access. Configure TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET."
              setupUrl="https://developers.tiktok.com"
            />
          </div>
        </div>

        <Separator />

        {/* Google Drive */}
        <div>
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Storage & Content Sources
          </h2>
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
            isConnected={connections.googleDrive.isConnected}
            username={connections.googleDrive.username}
            onConnect={() => handleConnect("googleDrive")}
            onDisconnect={() => handleDisconnect("googleDrive")}
            setupDescription="Connect Google Drive to browse your podcast episodes and Opus Clips exports. Configure GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET."
            setupUrl="https://console.cloud.google.com/apis/credentials"
          />
        </div>

        <Separator />

        {/* API Configuration */}
        <div>
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            API Configuration
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            These values should be set in your .env.local file (never hardcode in UI)
          </p>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm">Environment Variables</CardTitle>
              <CardDescription className="text-xs">
                Copy these to your .env.local file. See .env.example for all required variables.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-background/60 p-4 font-mono text-xs text-muted-foreground">
                <p className="mb-1 text-green-400"># .env.local</p>
                <p>ANTHROPIC_API_KEY=your_key_here</p>
                <p>NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co</p>
                <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key</p>
                <p>SUPABASE_SERVICE_ROLE_KEY=your_service_key</p>
                <p>YOUTUBE_CLIENT_ID=your_client_id</p>
                <p>YOUTUBE_CLIENT_SECRET=your_secret</p>
                <p>INSTAGRAM_APP_ID=your_app_id</p>
                <p>INSTAGRAM_APP_SECRET=your_secret</p>
                <p>TIKTOK_CLIENT_KEY=your_key</p>
                <p>TIKTOK_CLIENT_SECRET=your_secret</p>
                <p>GOOGLE_DRIVE_CLIENT_ID=your_id</p>
                <p>GOOGLE_DRIVE_CLIENT_SECRET=your_secret</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Database Setup */}
        <div>
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Database Setup
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Run this SQL in your Supabase SQL Editor to create the required tables
          </p>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-foreground">
                  supabase/migrations/schema.sql
                </p>
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
              <div className="rounded bg-background/60 p-3 font-mono text-xs text-muted-foreground max-h-48 overflow-y-auto">
                <p className="text-green-400">-- Run in Supabase SQL Editor</p>
                <p>-- See supabase/migrations/schema.sql for full schema</p>
                <p className="mt-2">create table posts (...);</p>
                <p>create table analytics (...);</p>
                <p>create table platform_connections (...);</p>
                <p>create table content_items (...);</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
