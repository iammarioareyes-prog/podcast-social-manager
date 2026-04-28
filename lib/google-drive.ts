/**
 * Google Drive API integration
 * TODO: Replace mock data with real API calls once OAuth tokens are configured
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  description?: string;
  duration?: number;
  videoMediaMetadata?: { durationMillis?: string; width?: number; height?: number };
}

export interface DriveFolder {
  id: string;
  name: string;
  files: DriveFile[];
}

export interface DriveListParams {
  folderId?: string;
  mimeType?: string;
  query?: string;
  pageSize?: number;
  pageToken?: string;
  accessToken?: string;
}

const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/mpeg",
];

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

/**
 * List files from Google Drive using the Drive API v3
 */
export async function listDriveFiles(params: DriveListParams): Promise<{
  files: DriveFile[];
  nextPageToken?: string;
}> {
  const { folderId, mimeType, query, pageSize = 50, pageToken, accessToken } = params;

  if (!accessToken) {
    return { files: [] };
  }

  // Build the query string
  const queryParts: string[] = ["trashed = false"];

  // Use explicit folderId > env var > 'root' (My Drive top level)
  const targetFolder = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID || "root";
  queryParts.push(`'${targetFolder}' in parents`);

  if (mimeType) {
    queryParts.push(`mimeType contains '${mimeType}'`);
  }

  if (query) {
    queryParts.push(`name contains '${query}'`);
  }

  const searchParams = new URLSearchParams({
    q: queryParts.join(" and "),
    fields: "nextPageToken,files(id,name,mimeType,size,thumbnailLink,webViewLink,webContentLink,createdTime,modifiedTime,parents,description,videoMediaMetadata)",
    pageSize: String(pageSize),
    orderBy: "modifiedTime desc",
  });

  if (pageToken) {
    searchParams.set("pageToken", pageToken);
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    console.error("Google Drive API error:", await res.text());
    return { files: [] };
  }

  const data = await res.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Get a file's download URL from Google Drive
 * TODO: Implement with Google Drive API
 */
export async function getDriveFileUrl(
  fileId: string,
  accessToken: string
): Promise<string> {
  // TODO: GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media

  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Get Google Drive OAuth authorization URL
 */
export function getGoogleDriveAuthUrl(): string {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  const scope = encodeURIComponent(
    "https://www.googleapis.com/auth/drive.readonly"
  );

  return `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&access_type=offline`;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: string | number): string {
  const size = typeof bytes === "string" ? parseInt(bytes) : bytes;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}:${remainingMinutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * Check if a file is a video
 */
export function isVideoFile(mimeType: string): boolean {
  return VIDEO_MIME_TYPES.includes(mimeType);
}

/**
 * Check if a file is an image
 */
export function isImageFile(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.includes(mimeType);
}
