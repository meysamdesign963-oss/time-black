"use client";

/**
 * PostAnalyticsView — detailed analytics for a single post authored by the
 * current user. Triggered when router.view === "post-analytics" with param
 * set to the post id.
 *
 * Shows:
 *  - Post preview (content + media thumbnail)
 *  - KPI cards: views, likes, comments, reposts, engagement rate
 *  - 7-day recent activity chart (recentLikes7d + recentComments7d)
 *  - Day labels from analytics.days
 *
 * Endpoint: GET /api/posts/[id]/analytics
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Eye,
  Heart,
  ImageOff,
  Loader2,
  MessageCircle,
  Repeat2,
  TrendingUp,
  Video,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useRouterStore } from "@/store/router";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatPersianDate,
  formatRelativeTime,
  toPersianDigits,
} from "@/utils/persian-date";

type AnalyticsResp = {
  post: {
    id: string;
    content: string;
    imageUrl: string | null;
    videoUrl: string | null;
    mediaType: string;
    createdAt: string;
  };
  analytics: {
    views: number;
    likes: number;
    comments: number;
    reposts: number;
    engagementRate: number;
    totalEngagements: number;
    recentLikes7d: number;
    recentComments7d: number;
    days: Array<{ date: string; jalaliDate: string; label: string }>;
  };
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i * 0.05, 0.3), duration: 0.4, ease: "easeOut" as const },
  }),
};

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          {p.name}:{" "}
          <span className="font-mono text-foreground">
            {toPersianDigits(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function PostAnalyticsView() {
  const { param, back, navigate } = useRouterStore();
  const [data, setData] = useState<AnalyticsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const lastParamRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!param) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      // Avoid refetching for the same param.
      if (lastParamRef.current === param) return;
      lastParamRef.current = param;

      setLoading(true);
      setNotFound(false);
      const res = await apiFetch<AnalyticsResp>(
        `/api/posts/${encodeURIComponent(param)}/analytics`,
      );
      if (cancelled) return;
      if (res.ok && res.data) {
        setData(res.data);
      } else {
        setData(null);
        if (res.error) toast.error(res.error);
        setNotFound(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [param]);

  // Build chart data — single bar per series with day labels alongside.
  const chartData = data
    ? [
        { name: "لایک (۷ روز)", value: data.analytics.recentLikes7d, color: "#e0cba8" },
        { name: "کامنت (۷ روز)", value: data.analytics.recentComments7d, color: "#8fbc8f" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[900px] space-y-6 px-4 py-6">
      <PageHeader
        title="آمار پست"
        description="بررسی عملکرد و تعامل کاربران با این پست"
        action={
          <Button variant="outline" size="sm" onClick={back}>
            <ArrowRight className="h-4 w-4" />
            بازگشت
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : notFound || !data ? (
        <Card className="glass border-border/60">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/40">
              <BarChart3 className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-academic text-base font-bold text-foreground">
              آمار پست در دسترس نیست
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              ممکن است پست حذف شده باشد یا شما مجوز مشاهده آمار آن را نداشته
              باشید.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate("content")}>
              بازگشت به مدیریت محتوا
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="space-y-6"
        >
          {/* Post preview */}
          <Card className="glass border-border/60">
            <CardHeader>
              <CardTitle className="text-base">پیش‌نمایش پست</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.post.mediaType === "VIDEO" && data.post.videoUrl ? (
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                  <video
                    src={data.post.videoUrl}
                    controls
                    preload="metadata"
                    className="h-full w-full"
                  />
                </div>
              ) : data.post.mediaType === "IMAGE" && data.post.imageUrl ? (
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-secondary/40">
                  <img
                    src={data.post.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="grid aspect-video w-full place-items-center rounded-lg bg-secondary/30 text-muted-foreground">
                  <ImageOff className="h-8 w-8" />
                </div>
              )}

              <p className="line-clamp-4 text-sm leading-6 text-foreground">
                {data.post.content || "—"}
              </p>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {data.post.mediaType === "VIDEO" && (
                  <Badge variant="outline" className="gap-1">
                    <Video className="h-3 w-3" />
                    ویدیو
                  </Badge>
                )}
                {data.post.mediaType === "IMAGE" && (
                  <Badge variant="outline" className="gap-1">
                    <ImageOff className="h-3 w-3" />
                    تصویر
                  </Badge>
                )}
                <span className="mr-auto">
                  {formatPersianDate(new Date(data.post.createdAt))}
                </span>
                <span>•</span>
                <span>{formatRelativeTime(new Date(data.post.createdAt))}</span>
              </div>
            </CardContent>
          </Card>

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard
              label="بازدید"
              value={toPersianDigits(data.analytics.views)}
              icon={Eye}
              accent="primary"
            />
            <StatCard
              label="لایک"
              value={toPersianDigits(data.analytics.likes)}
              icon={Heart}
              accent="destructive"
            />
            <StatCard
              label="کامنت"
              value={toPersianDigits(data.analytics.comments)}
              icon={MessageCircle}
              accent="accent"
            />
            <StatCard
              label="ری‌پست"
              value={toPersianDigits(data.analytics.reposts)}
              icon={Repeat2}
              accent="primary"
            />
            <StatCard
              label="نرخ تعامل"
              value={`${toPersianDigits(data.analytics.engagementRate)}٪`}
              icon={TrendingUp}
              accent="accent"
              hint={`کل تعامل‌ها: ${toPersianDigits(data.analytics.totalEngagements)}`}
            />
          </div>

          {/* Engagement rate explanation */}
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="p-4 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <TrendingUp className="h-4 w-4 text-accent" />
                نرخ تعامل چگونه محاسبه می‌شود؟
              </p>
              <p className="mt-2 leading-6">
                نرخ تعامل برابر است با:{" "}
                <span className="font-mono text-foreground" dir="rtl">
                  (لایک + کامنت + ری‌پست) / بازدید × ۱۰۰
                </span>
                . این عدد نشان می‌دهد چند درصد از کسانی که پست را دیده‌اند با آن
                تعامل داشته‌اند.
              </p>
            </CardContent>
          </Card>

          {/* Recent activity — 7 days */}
          <Card className="glass border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" />
                فعالیت ۷ روز اخیر
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="currentColor"
                      className="text-border/40"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "currentColor" }}
                      className="text-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "currentColor" }}
                      className="text-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      allowDecimals={false}
                      tickFormatter={(v) => toPersianDigits(Number(v))}
                    />
                    <Tooltip
                      cursor={{ fill: "currentColor", opacity: 0.08 }}
                      content={<ChartTooltip />}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={80}>
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Day-by-day labels */}
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  بازه زمانی ۷ روز اخیر:
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {data.analytics.days.map((d, i) => (
                    <div
                      key={d.date}
                      className="rounded-lg border border-border/40 bg-card/40 px-2 py-2 text-center"
                    >
                      <p className="text-[10px] text-muted-foreground">
                        {d.label}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-foreground">
                        {d.jalaliDate}
                      </p>
                      <p className="mt-1 text-[9px] text-muted-foreground/70">
                        روز {toPersianDigits(i + 1)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary row */}
              <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-4">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: "#e0cba8" }}
                  />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      لایک در ۷ روز اخیر
                    </p>
                    <p className="font-academic text-lg font-bold text-foreground">
                      {toPersianDigits(data.analytics.recentLikes7d)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: "#8fbc8f" }}
                  />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      کامنت در ۷ روز اخیر
                    </p>
                    <p className="font-academic text-lg font-bold text-foreground">
                      {toPersianDigits(data.analytics.recentComments7d)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer action */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={back}>
              <ArrowRight className="h-4 w-4" />
              بازگشت
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("content")}
              className="gap-2"
            >
              مشاهده در مدیریت محتوا
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default PostAnalyticsView;
