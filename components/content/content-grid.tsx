"use client";

import { useState } from "react";
import {
  Video,
  Image as ImageIcon,
  Clock,
  HardDrive,
  ExternalLink,
  Play,
  Plus,
  Grid,
  List,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDuration, formatFileSize, isVideoFile } from "@/lib/google-drive";
import type { DriveFile } from "@/lib/google-drive";

interface ContentGridProps {
  files: DriveFile[];
  isLoading?: boolean;
  onSelect?: (file: DriveFile) => void;
}

function FileCard({
  file,
  onSelect,
}: {
  file: DriveFile;
  onSelect?: (file: DriveFile) => void;
}) {
  const isVideo = isVideoFile(file.mimeType);

  return (
    <Card
      className={cn(
        "group bg-card border-border transition-all hover:border-primary/50 cursor-pointer",
        onSelect && "hover:shadow-lg hover:shadow-primary/10"
      )}
      onClick={() => onSelect?.(file)}
    >
      <CardContent className="p-0">
        {/* Thumbnail */}
        <div className="relative h-36 w-full overflow-hidden rounded-t-lg bg-muted">
          {file.thumbnailLink ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.thumbnailLink}
              alt={file.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {isVideo ? (
                <Video className="h-12 w-12 text-muted-foreground/40" />
              ) : (
                <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
              )}
            </div>
          )}

          {/* Play button overlay for videos */}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                <Play className="h-5 w-5 text-black" />
              </div>
            </div>
          )}

          {/* Duration badge */}
          {file.duration && (
            <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
              {formatDuration(file.duration)}
            </div>
          )}

          {/* Type badge */}
          <div className="absolute left-2 top-2">
            <Badge
              variant="secondary"
              className="text-xs bg-black/60 text-white border-0"
            >
              {isVideo ? "Video" : "Image"}
            </Badge>
          </div>
        </div>

        {/* File info */}
        <div className="p-3">
          <p className="line-clamp-2 text-sm font-medium text-foreground">
            {file.name}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {file.size && (
              <div className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {formatFileSize(file.size)}
              </div>
            )}
            {file.duration && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(file.duration)}
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            {onSelect ? (
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(file);
                }}
              >
                <Plus className="mr-1 h-3 w-3" />
                Use
              </Button>
            ) : (
              <span />
            )}
            {file.webViewLink && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(file.webViewLink, "_blank");
                }}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FileSkeleton() {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        <div className="h-36 w-full animate-pulse rounded-t-lg bg-muted" />
        <div className="p-3 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ContentGrid({
  files,
  isLoading = false,
  onSelect,
}: ContentGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <FileSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Video className="mb-4 h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">
          No content found
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Connect Google Drive or upload files to get started
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {files.length} item{files.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {files.map((file) => (
            <FileCard key={file.id} file={file} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 hover:bg-accent/30 cursor-pointer"
              onClick={() => onSelect?.(file)}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded bg-muted flex-shrink-0">
                {isVideoFile(file.mimeType) ? (
                  <Video className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {file.name}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {file.size && (
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                  )}
                  {file.duration && (
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(file.duration)}
                    </span>
                  )}
                </div>
              </div>
              {onSelect && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(file);
                  }}
                >
                  Use
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
