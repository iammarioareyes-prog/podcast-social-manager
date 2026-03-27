import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatNumber, formatPercentage } from "@/lib/utils";

interface PlatformStatCardProps {
  platform: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  views: number;
  followers: number;
  engagement: number;
  posts: number;
  isConnected: boolean;
}

export function PlatformStatCard({
  platform,
  icon: Icon,
  color,
  bgColor,
  views,
  followers,
  engagement,
  posts,
  isConnected,
}: PlatformStatCardProps) {
  return (
    <Card className={cn("bg-card border-border", !isConnected && "opacity-60")}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                bgColor
              )}
            >
              <Icon className={cn("h-4 w-4", color)} />
            </div>
            <span className="text-sm font-semibold capitalize text-foreground">
              {platform}
            </span>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              isConnected
                ? "bg-green-500/10 text-green-400"
                : "bg-gray-500/10 text-gray-400"
            )}
          >
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Views</p>
            <p className="text-lg font-bold text-foreground">{formatNumber(views)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Followers</p>
            <p className="text-lg font-bold text-foreground">{formatNumber(followers)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Engagement</p>
            <p className="text-lg font-bold text-foreground">
              {formatPercentage(engagement)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Posts</p>
            <p className="text-lg font-bold text-foreground">{posts}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
