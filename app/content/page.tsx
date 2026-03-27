"use client";

import { useState, useCallback } from "react";
import { Upload, RefreshCw, Search, Filter, FolderOpen } from "lucide-react";
import { Header } from "@/components/layout/header";
import { ContentGrid } from "@/components/content/content-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DriveFile } from "@/lib/google-drive";

// Mock data for demo
const mockFiles: DriveFile[] = [
  {
    id: "drive_1",
    name: "Episode 47 - Full Interview.mp4",
    mimeType: "video/mp4",
    size: "524288000",
    thumbnailLink: "",
    webViewLink: "https://drive.google.com/file/d/drive_1",
    createdTime: "2024-01-15T10:00:00Z",
    modifiedTime: "2024-01-15T10:00:00Z",
    duration: 3600,
  },
  {
    id: "drive_2",
    name: "Episode 47 - Short Clip 1.mp4",
    mimeType: "video/mp4",
    size: "52428800",
    thumbnailLink: "",
    webViewLink: "https://drive.google.com/file/d/drive_2",
    createdTime: "2024-01-15T11:00:00Z",
    modifiedTime: "2024-01-15T11:00:00Z",
    duration: 60,
  },
  {
    id: "drive_3",
    name: "Episode 47 - Short Clip 2.mp4",
    mimeType: "video/mp4",
    size: "45088000",
    thumbnailLink: "",
    webViewLink: "https://drive.google.com/file/d/drive_3",
    createdTime: "2024-01-15T11:30:00Z",
    modifiedTime: "2024-01-15T11:30:00Z",
    duration: 58,
  },
  {
    id: "drive_4",
    name: "Episode 46 - Full Interview.mp4",
    mimeType: "video/mp4",
    size: "499122176",
    thumbnailLink: "",
    webViewLink: "https://drive.google.com/file/d/drive_4",
    createdTime: "2024-01-08T10:00:00Z",
    modifiedTime: "2024-01-08T10:00:00Z",
    duration: 3420,
  },
  {
    id: "drive_5",
    name: "Episode 46 - Short Clip 1.mp4",
    mimeType: "video/mp4",
    size: "48234496",
    thumbnailLink: "",
    webViewLink: "https://drive.google.com/file/d/drive_5",
    createdTime: "2024-01-08T11:00:00Z",
    modifiedTime: "2024-01-08T11:00:00Z",
    duration: 55,
  },
  {
    id: "drive_6",
    name: "Episode 47 Thumbnail.jpg",
    mimeType: "image/jpeg",
    size: "2097152",
    thumbnailLink: "",
    webViewLink: "https://drive.google.com/file/d/drive_6",
    createdTime: "2024-01-15T09:00:00Z",
    modifiedTime: "2024-01-15T09:00:00Z",
  },
  {
    id: "drive_7",
    name: "Episode 46 Thumbnail.jpg",
    mimeType: "image/jpeg",
    size: "1887436",
    thumbnailLink: "",
    webViewLink: "https://drive.google.com/file/d/drive_7",
    createdTime: "2024-01-08T09:00:00Z",
    modifiedTime: "2024-01-08T09:00:00Z",
  },
  {
    id: "drive_9",
    name: "Opus Clip - Ep47 Hook.mp4",
    mimeType: "video/mp4",
    size: "31457280",
    thumbnailLink: "",
    webViewLink: "https://drive.google.com/file/d/drive_9",
    createdTime: "2024-01-16T08:00:00Z",
    modifiedTime: "2024-01-16T08:00:00Z",
    duration: 45,
  },
  {
    id: "drive_10",
    name: "Opus Clip - Ep46 Best Moment.mp4",
    mimeType: "video/mp4",
    size: "28311552",
    thumbnailLink: "",
    webViewLink: "https://drive.google.com/file/d/drive_10",
    createdTime: "2024-01-09T08:00:00Z",
    modifiedTime: "2024-01-09T08:00:00Z",
    duration: 42,
  },
];

export default function ContentPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "video" | "image">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const filteredFiles = mockFiles.filter((file) => {
    const matchesSearch = file.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType =
      filterType === "all" ||
      (filterType === "video" && file.mimeType.startsWith("video/")) ||
      (filterType === "image" && file.mimeType.startsWith("image/"));
    return matchesSearch && matchesType;
  });

  const shortClips = filteredFiles.filter(
    (f) => f.mimeType.startsWith("video/") && f.duration && f.duration <= 180
  );
  const fullEpisodes = filteredFiles.filter(
    (f) => f.mimeType.startsWith("video/") && (!f.duration || f.duration > 180)
  );
  const thumbnails = filteredFiles.filter((f) => f.mimeType.startsWith("image/"));

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    // TODO: Handle file upload to Supabase storage
    console.log("Files dropped:", files.map((f) => f.name));
    alert(`Upload ${files.length} file(s) - TODO: implement Supabase storage upload`);
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    // TODO: Fetch from Google Drive API
    await new Promise((r) => setTimeout(r, 1500));
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col">
      <Header
        title="Content Library"
        description="Browse Google Drive files and Opus Clips shorts"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Upload drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-border/80"
          }`}
        >
          <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            Drag & drop files here, or{" "}
            <label className="cursor-pointer text-primary hover:underline">
              browse
              <input
                type="file"
                className="hidden"
                multiple
                accept="video/*,image/*"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  // TODO: implement upload
                  alert(`Upload ${files.length} file(s) - TODO: implement`);
                }}
              />
            </label>
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Supports MP4, MOV, AVI, JPG, PNG (max 2GB)
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select
            value={filterType}
            onValueChange={(v) => setFilterType(v as typeof filterType)}
          >
            <SelectTrigger className="w-36">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Files</SelectItem>
              <SelectItem value="video">Videos Only</SelectItem>
              <SelectItem value="image">Images Only</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>

          <Button variant="outline" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Connect Drive
          </Button>
        </div>

        {/* Content tabs */}
        <Tabs defaultValue="all">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="all">
              All ({filteredFiles.length})
            </TabsTrigger>
            <TabsTrigger value="shorts">
              Shorts ({shortClips.length})
            </TabsTrigger>
            <TabsTrigger value="episodes">
              Full Episodes ({fullEpisodes.length})
            </TabsTrigger>
            <TabsTrigger value="thumbnails">
              Thumbnails ({thumbnails.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <ContentGrid files={filteredFiles} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="shorts" className="mt-4">
            <ContentGrid files={shortClips} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="episodes" className="mt-4">
            <ContentGrid files={fullEpisodes} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="thumbnails" className="mt-4">
            <ContentGrid files={thumbnails} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
