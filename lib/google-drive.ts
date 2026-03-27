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
 * List files from Google Drive
 * TODO: Implement with Google Drive API v3
 */
export async function listDriveFiles(params: DriveListParams): Promise<{
  files: DriveFile[];
  nextPageToken?: string;
}> {
  // TODO: Implement actual API call
  // GET https://www.googleapis.com/drive/v3/files
  // with Authorization: Bearer {accessToken}

  const { folderId, mimeType, query, pageSize = 20 } = params;

  // Mock data for development
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
      id: "drive_8",
      name: "Episode 45 - Full Interview.mp4",
      mimeType: "video/mp4",
      size: "576716800",
      thumbnailLink: "",
      webViewLink: "https://drive.google.com/file/d/drive_8",
      createdTime: "2024-01-01T10:00:00Z",
      modifiedTime: "2024-01-01T10:00:00Z",
      duration: 4200,
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

  // Filter by query if provided
  let filteredFiles = mockFiles;
  if (query) {
    filteredFiles = mockFiles.filter((f) =>
      f.name.toLowerCase().includes(query.toLowerCase())
    );
  }

  // Filter by mime type
  if (mimeType) {
    filteredFiles = filteredFiles.filter((f) => f.mimeType.startsWith(mimeType));
  }

  return {
    files: filteredFiles.slice(0, pageSize),
    nextPageToken: undefined,
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
