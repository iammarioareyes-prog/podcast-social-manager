"use client";

import { useState, useCallback, useEffect } from "react";
import { RefreshCw, Search, Filter, FolderOpen, Folder, ChevronRight, Home, ChevronDown } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import type { DriveFile } from "@/lib/google-drive";

interface FolderEntry {
  id: string;
  name: string;
}

interface BreadcrumbEntry {
  id: string | null;
  name: string;
}

const PAGE_SIZE = 100;

async function fetchDrivePage(folderId?: string, pageToken?: string) {
  const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
  if (folderId) params.set("folderId", folderId);
  if (pageToken) params.set("pageToken", pageToken);
  const res = await fetch(`/api/google-drive/files?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) return { files: [] as DriveFile[], nextPageToken: undefined, errorCode: (data.error ?? "unknown") as string };
  return { files: (data.files ?? []) as DriveFile[], nextPageToken: data.nextPageToken as string | undefined, errorCode: undefined };
}

export default function ContentPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "video" | "image">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [allItems, setAllItems] = useState<DriveFile[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [driveError, setDriveError] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([
    { id: null, name: "My Drive" },
  ]);

  const currentFolderId = breadcrumb[breadcrumb.length - 1].id;

  const loadFolder = useCallback(async (folderId?: string) => {
    setIsLoading(true);
    setDriveError(null);
    setAllItems([]);
    setNextPageToken(undefined);
    const result = await fetchDrivePage(folderId ?? undefined);
    if (result.errorCode) setDriveError(result.errorCode);
    setAllItems(result.files);
    setNextPageToken(result.nextPageToken);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadFolder(currentFolderId ?? undefined);
  }, [loadFolder, currentFolderId]);

  const handleRefresh = () => loadFolder(currentFolderId ?? undefined);

  const handleLoadMore = async () => {
    if (!nextPageToken || isLoadingMore) return;
    setIsLoadingMore(true);
    const result = await fetchDrivePage(currentFolderId ?? undefined, nextPageToken);
    setAllItems((prev) => [...prev, ...result.files]);
    setNextPageToken(result.nextPageToken);
    setIsLoadingMore(false);
  };

  const handleFolderClick = (folder: FolderEntry) => {
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  };

  // Separate folders from files
  const folders: FolderEntry[] = allItems
    .filter((item) => item.mimeType === "application/vnd.google-apps.folder")
    .map((f) => ({ id: f.id, name: f.name }));

  const files = allItems.filter(
    (item) => item.mimeType !== "application/vnd.google-apps.folder"
  );

  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
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

  const isAtRoot = breadcrumb.length === 1;

  // Summary line shown below the breadcrumb
  const summaryParts: string[] = [];
  if (folders.length > 0) summaryParts.push(`${folders.length}${nextPageToken ? "+" : ""} ${isAtRoot ? "guest folders" : "subfolders"}`);
  if (files.length > 0) summaryParts.push(`${files.length}${nextPageToken ? "+" : ""} clip${files.length !== 1 ? "s" : ""}`);
  const summary = summaryParts.join(", ");

  return (
    <div className="flex flex-col">
      <Header
        title="Content Library"
        description="Browse your Google Drive clips organized by episode"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />}
              {i === breadcrumb.length - 1 ? (
                <span className="font-medium text-foreground flex items-center gap-1">
                  {i === 0 ? <Home className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}
                  {crumb.name}
                  {summary ? <span className="ml-1 text-xs font-normal text-muted-foreground">({summary})</span> : null}
                </span>
              ) : (
                <button
                  onClick={() => handleBreadcrumbClick(i)}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {i === 0 ? <Home className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}
                  {crumb.name}
                </button>
              )}
            </span>
          ))}
        </nav>

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
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Guest / episode folders */}
        {folders.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {isAtRoot ? "Guest Folders" : "Subfolders"}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {folders.map((folder) => (
                <Card
                  key={folder.id}
                  className="group cursor-pointer border-border bg-card hover:border-primary/50 transition-all"
                  onClick={() => handleFolderClick(folder)}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <FolderOpen className="h-8 w-8 flex-shrink-0 text-yellow-500 group-hover:text-yellow-400 transition-colors" />
                    <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
                      {folder.name}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Clips / files */}
        {(files.length > 0 || isLoading) && (
          <div>
            {folders.length > 0 && (
              <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Clips
              </h2>
            )}
            <Tabs defaultValue="all">
              <TabsList className="bg-card border border-border">
                <TabsTrigger value="all">All ({filteredFiles.length}{nextPageToken ? "+" : ""})</TabsTrigger>
                <TabsTrigger value="shorts">Shorts ({shortClips.length})</TabsTrigger>
                <TabsTrigger value="episodes">Full Episodes ({fullEpisodes.length})</TabsTrigger>
                <TabsTrigger value="thumbnails">Thumbnails ({thumbnails.length})</TabsTrigger>
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
        )}

        {/* Load More */}
        {nextPageToken && !isLoading && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="gap-2"
            >
              {isLoadingMore ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {isLoadingMore ? "Loading…" : `Load more`}
            </Button>
          </div>
        )}

        {/* Empty / error state */}
        {!isLoading && folders.length === 0 && files.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/30" />
            {driveError === "not_connected" ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  Google Drive is not connected
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Go to{" "}
                  <a href="/settings" className="underline hover:text-foreground">
                    Settings
                  </a>{" "}
                  and connect Google Drive to browse your clips
                </p>
              </>
            ) : driveError === "token_expired" ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  Google Drive session expired
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Go to{" "}
                  <a href="/settings" className="underline hover:text-foreground">
                    Settings
                  </a>
                  , disconnect Google Drive, then reconnect it
                </p>
              </>
            ) : driveError ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  Could not load Google Drive files
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Try reconnecting Google Drive in{" "}
                  <a href="/settings" className="underline hover:text-foreground">
                    Settings
                  </a>
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  {isAtRoot ? "No files found in your Google Drive" : "This folder is empty"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  {isAtRoot
                    ? "Upload clips to Google Drive and they will appear here"
                    : "Go back and open a different folder"}
                </p>
              </>
            )}
            <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
