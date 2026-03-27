import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function formatPercentage(num: number): string {
  return `${num.toFixed(1)}%`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function getPlatformColor(platform: string): string {
  switch (platform) {
    case "youtube":
      return "#FF0000";
    case "instagram":
      return "#E1306C";
    case "tiktok":
      return "#00F2EA";
    default:
      return "#6366f1";
  }
}

export function getPlatformLabel(platform: string): string {
  switch (platform) {
    case "youtube":
      return "YouTube";
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    default:
      return platform;
  }
}

export function generateMockViewsData(days: number = 30): {
  date: string;
  youtube: number;
  instagram: number;
  tiktok: number;
  total: number;
}[] {
  const data = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    const youtube = Math.floor(Math.random() * 5000) + 500;
    const instagram = Math.floor(Math.random() * 3000) + 200;
    const tiktok = Math.floor(Math.random() * 8000) + 1000;

    data.push({
      date: dateStr,
      youtube,
      instagram,
      tiktok,
      total: youtube + instagram + tiktok,
    });
  }

  return data;
}

export function generateHeatmapData(): {
  day: string;
  hour: number;
  value: number;
}[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const data = [];

  for (const day of days) {
    for (let hour = 0; hour < 24; hour++) {
      // Simulate higher engagement during evening hours
      let baseValue = 10;
      if (hour >= 18 && hour <= 22) baseValue = 80;
      else if (hour >= 12 && hour <= 15) baseValue = 50;
      else if (hour >= 7 && hour <= 9) baseValue = 40;
      else if (hour >= 0 && hour <= 5) baseValue = 5;

      // Weekends have different patterns
      if (day === "Sat" || day === "Sun") {
        if (hour >= 10 && hour <= 14) baseValue = Math.max(baseValue, 60);
      }

      data.push({
        day,
        hour,
        value: Math.floor(baseValue * (0.7 + Math.random() * 0.6)),
      });
    }
  }

  return data;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "published":
      return "text-green-400 bg-green-400/10";
    case "scheduled":
      return "text-blue-400 bg-blue-400/10";
    case "draft":
      return "text-gray-400 bg-gray-400/10";
    case "failed":
      return "text-red-400 bg-red-400/10";
    default:
      return "text-gray-400 bg-gray-400/10";
  }
}
