// Platform types
export type Platform = "youtube" | "instagram" | "tiktok";

// Post status
export type PostStatus = "draft" | "scheduled" | "published" | "failed";

// Post type matching Supabase schema
export interface Post {
  id: string;
  title: string;
  description?: string;
  caption?: string;
  hashtags?: string[];
  platforms: Platform[];
  status: PostStatus;
  scheduled_at?: string;
  published_at?: string;
  content_url?: string;
  thumbnail_url?: string;
  platform_post_ids: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// Analytics type
export interface Analytics {
  id: string;
  post_id?: string;
  platform: Platform;
  platform_post_id?: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  watch_time_hours: number;
  click_through_rate: number;
  impressions: number;
  reach: number;
  engagement_rate: number;
  recorded_at: string;
}

// Platform connection
export interface PlatformConnection {
  id: string;
  platform: Platform;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  platform_user_id?: string;
  platform_username?: string;
  is_connected: boolean;
  created_at: string;
}

// Content item
export interface ContentItem {
  id: string;
  title: string;
  type: "full_episode" | "short" | "thumbnail";
  duration_seconds?: number;
  file_url?: string;
  thumbnail_url?: string;
  google_drive_id?: string;
  file_size_bytes?: number;
  created_at: string;
}

// Dashboard metrics
export interface DashboardMetrics {
  totalViews: number;
  totalViewsTrend: number;
  totalFollowers: number;
  totalFollowersTrend: number;
  engagementRate: number;
  engagementTrend: number;
  postsThisMonth: number;
  postsLastMonth: number;
  platformStats: PlatformStats[];
}

export interface PlatformStats {
  platform: Platform;
  views: number;
  followers: number;
  engagement: number;
  posts: number;
  isConnected: boolean;
}

// Chart data
export interface ChartDataPoint {
  date: string;
  youtube: number;
  instagram: number;
  tiktok: number;
  total: number;
}

// Claude AI response types
export interface ClaudeStrategyResponse {
  captions: {
    youtube: string;
    instagram: string;
    tiktok: string;
  };
  hashtags: {
    youtube: string[];
    instagram: string[];
    tiktok: string[];
  };
  recommendations: string[];
  bestPostingTimes: {
    platform: Platform;
    times: string[];
    days: string[];
  }[];
  contentIdeas: string[];
  weeklyStrategy: string;
}

// Google Drive file
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  duration?: number;
}

// Scheduled post form data
export interface PostFormData {
  title: string;
  description: string;
  caption: string;
  hashtags: string;
  platforms: Platform[];
  scheduled_at: string;
  content_url: string;
  thumbnail_url: string;
  status: PostStatus;
}

// Analytics filter
export interface AnalyticsFilter {
  platform?: Platform | "all";
  dateRange: "7d" | "30d" | "90d" | "custom";
  startDate?: string;
  endDate?: string;
}

// Best posting time heatmap
export interface HeatmapData {
  day: string;
  hour: number;
  value: number;
}

// Top performing post
export interface TopPost {
  id: string;
  title: string;
  platform: Platform;
  views: number;
  likes: number;
  engagement: number;
  thumbnail_url?: string;
  published_at?: string;
}

// Navigation item
export interface NavItem {
  title: string;
  href: string;
  icon: string;
}
