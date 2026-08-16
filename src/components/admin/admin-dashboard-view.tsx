"use client";

/**
 * AdminDashboardView — overview of the whole platform.
 * 4 KPI stat cards, a 30-day signups area chart, and a list of
 * recent suspicious audit-log entries (actions containing REPORT or DELETE).
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Clock3,
  FileWarning,
  ListTodo,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatDurationHuman,
  formatRelativeTime,
  toPersianDigits,
} from "@/utils/persian-date";

type OverviewResp = {
  overview: {
    totalUsers: number;
    blockedUsers: number;
    runningEntries: number;
    todaysTotalSeconds: number;
    pendingReports: number;
    newUsersThisWeek: number;
    signupsLast30Days: Array<{ date: string; count: number }>;
  };
};

type LogItem = {
  id: string;
  userId: string | null;
  action: string;
  ip: string | null;
  meta: unknown;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
};

type LogsResp = { logs: LogItem[]; total: number };

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: "easeOut" as const },
  }),
};

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload as { date: string; count: number };
  return (
    <div className="glass-strong rounded-md border border-border/60 px-3 py-2 text-xs">
      <div className="text-muted-foreground">{p.date}</div>
      <div className="font-academic font-bold text-primary">
        {toPersianDigits(p.count)} عضو جدید
      </div>
    </div>
  );
}

export function AdminDashboardView() {
  const [overview, setOverview] = useState<OverviewResp["overview"] | null>(
    null,
  );
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [ovRes, logsRes] = await Promise.all([
        apiFetch<OverviewResp>("/api/admin/overview"),
        apiFetch<LogsResp>("/api/admin/logs?limit=100"),
      ]);
      if (!active) return;
      if (ovRes.ok && ovRes.data) setOverview(ovRes.data.overview);
      if (logsRes.ok && logsRes.data) {
        const suspicious = logsRes.data.logs.filter(
          (l) => l.action.includes("REPORT") || l.action.includes("DELETE"),
        );
        setLogs(suspicious.slice(0, 8));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const chartData = useMemo(() => {
    if (!overview) return [];
    return overview.signupsLast30Days.map((d) => ({
      ...d,
      // trim year off the short date "1403/07/12" → "07/12"
      date: d.date.length === 10 ? d.date.slice(5) : d.date,
    }));
  }, [overview]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 space-y-6">
      <PageHeader
        title="داشبورد مدیریت"
        description="نمای کلی لحظه‌ای از وضعیت پلتفرم"
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !overview ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
              <StatCard
                label="کاربران فعال"
                value={toPersianDigits(overview.totalUsers)}
                icon={Users}
                hint={`${toPersianDigits(overview.newUsersThisWeek)} عضو جدید این هفته`}
                accent="primary"
              />
            </motion.div>
            <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
              <StatCard
                label="تایم‌های امروز"
                value={formatDurationHuman(overview.todaysTotalSeconds)}
                icon={Clock3}
                hint="مجموع تایم‌های تکمیل‌شده امروز"
                accent="accent"
              />
            </motion.div>
            <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
              <StatCard
                label="تسک‌های در حال اجرا"
                value={toPersianDigits(overview.runningEntries)}
                icon={ListTodo}
                hint="تایمرهای در حال اجرا"
                accent="primary"
              />
            </motion.div>
            <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show">
              <StatCard
                label="گزارش‌های بررسی‌نشده"
                value={toPersianDigits(overview.pendingReports)}
                icon={FileWarning}
                hint={`${toPersianDigits(overview.blockedUsers)} کاربر مسدودشده`}
                accent="destructive"
              />
            </motion.div>
          </>
        )}
      </div>

      {/* Growth chart */}
      <motion.div
        custom={4}
        variants={fadeUp}
        initial="hidden"
        animate="show"
      >
        <Card className="glass border-border/60">
          <CardHeader>
            <CardTitle className="font-academic text-lg">
              رشد اعضا در ۳۰ روز گذشته
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 w-full rounded-lg" />
            ) : chartData.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                داده‌ای برای نمایش وجود ندارد
              </div>
            ) : (
              <div className="h-72 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="signupsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e0cba8" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#e0cba8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a3a4b" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#9a9aaa", fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: "#3a3a4b" }}
                      interval={3}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#9a9aaa", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#e0cba8"
                      strokeWidth={2}
                      fill="url(#signupsGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Suspicious activity / alerts */}
      <motion.div
        custom={5}
        variants={fadeUp}
        initial="hidden"
        animate="show"
      >
        <Card className="glass border-border/60">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <CardTitle className="font-academic text-lg">
                رویدادهای مشکوک اخیر
              </CardTitle>
            </div>
            <Badge variant="secondary" className="font-mono">
              {toPersianDigits(logs.length)}
            </Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-accent/15">
                  <ShieldAlert className="h-6 w-6 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground">
                  هیچ رویداد مشکوکی در سیستم ثبت نشده است
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {logs.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/40 p-3"
                  >
                    <Avatar className="h-9 w-9">
                      {l.user?.avatarUrl && (
                        <AvatarImage src={l.user.avatarUrl} alt={l.user.displayName} />
                      )}
                      <AvatarFallback className="bg-secondary text-xs">
                        {l.user?.displayName?.[0] ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {l.user?.displayName ?? "کاربر حذف‌شده"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {l.user ? `@${l.user.username}` : "—"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-left">
                      <Badge
                        variant="outline"
                        className="border-destructive/40 text-destructive"
                      >
                        {l.action}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {l.ip ?? "—"} · {formatRelativeTime(new Date(l.createdAt))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/30 p-3 text-xs text-muted-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
        داده‌ها هر بار ورود به این صفحه به‌روز می‌شوند. برای اطلاعات لحظه‌ای از بخش «گزارش‌های تحلیلی» بازدید کنید.
      </div>
    </div>
  );
}

export default AdminDashboardView;
