"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Calendar,
  BarChart3,
  Sparkles,
  Settings,
  Mic2,
  Youtube,
  Instagram,
  Music2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Content Library",
    href: "/content",
    icon: FolderOpen,
  },
  {
    title: "Schedule",
    href: "/schedule",
    icon: Calendar,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    title: "AI Strategy",
    href: "/strategy",
    icon: Sparkles,
  },
];

const platforms = [
  {
    name: "YouTube",
    icon: Youtube,
    color: "text-red-500",
    connected: false,
  },
  {
    name: "Instagram",
    icon: Instagram,
    color: "text-pink-500",
    connected: false,
  },
  {
    name: "TikTok",
    icon: Music2,
    color: "text-cyan-400",
    connected: false,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Mic2 className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Podcast Manager</p>
          <p className="text-xs text-muted-foreground">Social Media Suite</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Navigation
        </p>
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.title}
            </Link>
          );
        })}

        {/* Platforms section */}
        <div className="mt-6">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Platforms
          </p>
          {platforms.map((platform) => (
            <div
              key={platform.name}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
            >
              <platform.icon className={cn("h-4 w-4 flex-shrink-0", platform.color)} />
              <span className="flex-1 text-muted-foreground">{platform.name}</span>
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  platform.connected ? "bg-green-500" : "bg-gray-600"
                )}
              />
            </div>
          ))}
        </div>
      </nav>

      {/* Settings */}
      <div className="border-t border-border p-4">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </div>
  );
}
