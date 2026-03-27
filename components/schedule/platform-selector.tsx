"use client";

import { Youtube, Instagram, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Platform } from "@/types";

interface PlatformSelectorProps {
  selected: Platform[];
  onChange: (platforms: Platform[]) => void;
}

const platforms = [
  {
    id: "youtube" as Platform,
    label: "YouTube Shorts",
    icon: Youtube,
    color: "text-red-500",
    bg: "bg-red-500/10",
    borderActive: "border-red-500",
  },
  {
    id: "instagram" as Platform,
    label: "Instagram Reels",
    icon: Instagram,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    borderActive: "border-pink-500",
  },
  {
    id: "tiktok" as Platform,
    label: "TikTok",
    icon: Music2,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    borderActive: "border-cyan-400",
  },
];

export function PlatformSelector({ selected, onChange }: PlatformSelectorProps) {
  const toggle = (platform: Platform) => {
    if (selected.includes(platform)) {
      onChange(selected.filter((p) => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {platforms.map((platform) => {
        const isSelected = selected.includes(platform.id);
        return (
          <button
            key={platform.id}
            type="button"
            onClick={() => toggle(platform.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all",
              isSelected
                ? `${platform.borderActive} ${platform.bg} text-foreground`
                : "border-border bg-background text-muted-foreground hover:border-border/80 hover:bg-accent/30"
            )}
          >
            <platform.icon
              className={cn("h-4 w-4", isSelected ? platform.color : "")}
            />
            {platform.label}
          </button>
        );
      })}
    </div>
  );
}
