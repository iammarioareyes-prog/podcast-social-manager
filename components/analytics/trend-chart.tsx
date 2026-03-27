"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

interface TrendChartProps {
  data: Array<{
    date: string;
    youtube: number;
    instagram: number;
    tiktok: number;
  }>;
  metric: string;
  title?: string;
  chartType?: "area" | "bar";
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs capitalize text-muted-foreground">
              {entry.name}:
            </span>
            <span className="text-xs font-semibold text-foreground">
              {formatNumber(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function TrendChart({
  data,
  metric,
  title,
  chartType = "area",
}: TrendChartProps) {
  const formattedData = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          {title || metric}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          {chartType === "area" ? (
            <AreaChart
              data={formattedData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="ytGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF0000" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FF0000" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="igGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E1306C" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#E1306C" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ttGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00F2EA" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00F2EA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={{ stroke: "#374151" }}
                tickLine={false}
                interval={6}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={{ stroke: "#374151" }}
                tickLine={false}
                tickFormatter={formatNumber}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                formatter={(value) => (
                  <span style={{ color: "#9ca3af", textTransform: "capitalize" }}>
                    {value}
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey="youtube"
                stroke="#FF0000"
                strokeWidth={2}
                fill="url(#ytGradient)"
              />
              <Area
                type="monotone"
                dataKey="instagram"
                stroke="#E1306C"
                strokeWidth={2}
                fill="url(#igGradient)"
              />
              <Area
                type="monotone"
                dataKey="tiktok"
                stroke="#00F2EA"
                strokeWidth={2}
                fill="url(#ttGradient)"
              />
            </AreaChart>
          ) : (
            <BarChart
              data={formattedData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={{ stroke: "#374151" }}
                tickLine={false}
                interval={6}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={{ stroke: "#374151" }}
                tickLine={false}
                tickFormatter={formatNumber}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                formatter={(value) => (
                  <span style={{ color: "#9ca3af", textTransform: "capitalize" }}>
                    {value}
                  </span>
                )}
              />
              <Bar dataKey="youtube" fill="#FF0000" opacity={0.8} radius={[2, 2, 0, 0]} />
              <Bar dataKey="instagram" fill="#E1306C" opacity={0.8} radius={[2, 2, 0, 0]} />
              <Bar dataKey="tiktok" fill="#00F2EA" opacity={0.8} radius={[2, 2, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
