"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Youtube, Instagram, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, getStatusColor } from "@/lib/utils";
import type { Post } from "@/types";

interface CalendarViewProps {
  posts: Post[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getPlatformIcon(platform: string) {
  switch (platform) {
    case "youtube":
      return <Youtube className="h-3 w-3 text-red-500" />;
    case "instagram":
      return <Instagram className="h-3 w-3 text-pink-500" />;
    case "tiktok":
      return <Music2 className="h-3 w-3 text-cyan-400" />;
    default:
      return null;
  }
}

export function CalendarView({ posts }: CalendarViewProps) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonth = () =>
    setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(year, month + 1, 1));

  const getPostsForDay = (day: number) => {
    return posts.filter((post) => {
      const date = post.scheduled_at || post.published_at;
      if (!date) return false;
      const postDate = new Date(date);
      return (
        postDate.getFullYear() === year &&
        postDate.getMonth() === month &&
        postDate.getDate() === day
      );
    });
  };

  // Build calendar grid
  const calendarDays: { day: number; currentMonth: boolean }[] = [];

  // Previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarDays.push({ day: daysInPrevMonth - i, currentMonth: false });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, currentMonth: true });
  }

  // Next month days to complete the grid
  const remainingDays = 42 - calendarDays.length;
  for (let i = 1; i <= remainingDays; i++) {
    calendarDays.push({ day: i, currentMonth: false });
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Calendar header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">
          {MONTHS[month]} {year}
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))}
          >
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAYS.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((cell, index) => {
          const isToday =
            cell.currentMonth &&
            cell.day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();

          const dayPosts = cell.currentMonth ? getPostsForDay(cell.day) : [];

          return (
            <div
              key={index}
              className={cn(
                "min-h-20 border-b border-r border-border p-1.5",
                !cell.currentMonth && "bg-muted/20",
                index % 7 === 6 && "border-r-0"
              )}
            >
              <div
                className={cn(
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  isToday
                    ? "bg-primary text-primary-foreground font-bold"
                    : cell.currentMonth
                    ? "text-foreground"
                    : "text-muted-foreground/40"
                )}
              >
                {cell.day}
              </div>

              {/* Posts for this day */}
              <div className="space-y-0.5">
                {dayPosts.slice(0, 2).map((post) => (
                  <div
                    key={post.id}
                    className={cn(
                      "flex items-center gap-1 rounded px-1 py-0.5 text-xs truncate",
                      post.status === "published" && "bg-green-500/10 text-green-400",
                      post.status === "scheduled" && "bg-blue-500/10 text-blue-400",
                      post.status === "draft" && "bg-gray-500/10 text-gray-400"
                    )}
                    title={post.title}
                  >
                    {post.platforms[0] && getPlatformIcon(post.platforms[0])}
                    <span className="truncate">{post.title}</span>
                  </div>
                ))}
                {dayPosts.length > 2 && (
                  <p className="px-1 text-xs text-muted-foreground">
                    +{dayPosts.length - 2} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
