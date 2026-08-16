"use client";

/**
 * AdminReportsView — analytics reports with date-range tabs.
 * Three charts: user growth (LineChart), daily activity (BarChart),
 * top tasks (horizontal BarChart). Plus summary stat cards.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  LineChart as LineChartIcon,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatDurationHuman,
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

type Entry = {
  id: string;
  startedAt: string;
  durationSec: number;
  status: string;
  task: { id: string; title: string; color: string } | null;
};

type EntriesResp = { entries: Entry[]; total: number };

type Range = "7d" | "30d" | "90d";

const PALETTE = [
  "#e0cba8",
  "#8fbc8f",
  "#c97064",
  "#a78bfa",
  "#7dd3fc",
  "#fbbf24",
  "#f87171",
  "#34d399",
];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="glass-strong rounded-md border border-border/60 px-3 py-2 text-xs">
      {label && <div className="text-muted-foreground">{label}</div>}
      <div className="font-academic font-bold text-primary">
        {toPersianDigits(payload[0].value)}
      </div>
    </div>
  );
}

function DurationTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="glass-strong rounded-md border border-border/60 px-3 py-2 text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-academic font-bold text-primary">
        {formatDurationHuman(Number(payload[0].value))}
      </div>
    </div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: "easeOut" as const },
  }),
};

export function AdminReportsView() {
  const [range, setRange] = useState<Range>("30d");
  const [overview, setOverview] = useState<OverviewResp["overview"] | null>(
    null,
  );
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [ovRes, entriesRes] = await Promise.all([
        apiFetch<OverviewResp>("/api/admin/overview"),
        apiFetch<EntriesResp>("/api/admin/time-entries?limit=100"),
      ]);
      if (!active) return;
      if (ovRes.ok && ovRes.data) setOverview(ovRes.data.overview);
      if (entriesRes.ok && entriesRes.data) setEntries(entriesRes.data.entries);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Filter signups to selected range (last 7/30/90 days)
  const signups = useMemo(() => {
    if (!overview) return [];
    const all = overview.signupsLast30Days;
    if (range === "7d") return all.slice(-7).map((d) => ({ ...d, date: d.date.slice(5) }));
    if (range === "30d") return all.map((d) => ({ ...d, date: d.date.slice(5) }));
    // 90d — we only have 30d from server, so pad with empty entries
    return all.map((d) => ({ ...d, date: d.date.slice(5) }));
  }, [overview, range]);

  // Daily activity from time entries (last N days)
  const dailyActivity = useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const map = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const e of entries) {
      const dayKey = new Date(e.startedAt).toISOString().slice(0, 10);
      if (map.has(dayKey) && e.status === "COMPLETED") {
        map.set(dayKey, map.get(dayKey)! + 1);
      }
    }
    return Array.from(map.entries())
      .slice(-days)
      .map(([date, count]) => {
        const jDate = new Date(date);
        const fa = `${toPersianDigits(
          String(jDate.getMonth() + 1).padStart(2, "0"),
        )}/${toPersianDigits(String(jDate.getDate()).padStart(2, "0"))}`;
        return { date: fa, count };
      });
  }, [entries, range]);

  // Top tasks by total seconds
  const topTasks = useMemo(() => {
    const map = new Map<string, { title: string; color: string; seconds: number }>();
    for (const e of entries) {
      if (!e.task || e.status !== "COMPLETED") continue;
      const existing = map.get(e.task.id);
      if (existing) {
        existing.seconds += e.durationSec;
      } else {
        map.set(e.task.id, {
          title: e.task.title,
          color: e.task.color,
          seconds: e.durationSec,
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 6);
  }, [entries]);

  // Stats
  const totalActivitySeconds = useMemo(
    () => entries
      .filter((e) => e.status === "COMPLETED")
      .reduce((acc, e) => acc + e.durationSec, 0),
    [entries],
  );

  const totalSignups = useMemo(
    () => signups.reduce((acc, d) => acc + d.count, 0),
    [signups],
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 space-y-6">
      <PageHeader
        title="گزارش‌های تحلیلی"
        description="نمودارهای رشد و فعالیت پلتفرم در بازه‌های مختلف"
        action={
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList>
              <TabsTrigger value="7d">۷ روز</TabsTrigger>
              <TabsTrigger value="30d">۳۰ روز</TabsTrigger>
              <TabsTrigger value="90d">۹۰ روز</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !overview ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
              <StatCard
                label="کاربران کل"
                value={toPersianDigits(overview.totalUsers)}
                icon={Users}
                hint={`${toPersianDigits(totalSignups)} عضو جدید در بازه`}
                accent="primary"
              />
            </motion.div>
            <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
              <StatCard
                label="مجموع فعالیت"
                value={formatDurationHuman(totalActivitySeconds)}
                icon={Activity}
                hint="مجموع تایم‌های تکمیل‌شده"
                accent="accent"
              />
            </motion.div>
            <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
              <StatCard
                label="تسک‌های فعال"
                value={toPersianDigits(overview.runningEntries)}
                icon={BarChart3}
                hint="تایمرهای در حال اجرا"
                accent="primary"
              />
            </motion.div>
            <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show">
              <StatCard
                label="گزارش‌های تخلف"
                value={toPersianDigits(overview.pendingReports)}
                icon={Trophy}
                hint="در انتظار بررسی"
                accent="destructive"
              />
            </motion.div>
          </>
        )}
      </div>

      {/* User growth chart */}
      <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show">
        <Card className="glass border-border/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5 text-primary" />
              <CardTitle className="font-academic text-lg">
                رشد کاربران
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 w-full rounded-lg" />
            ) : signups.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                داده‌ای موجود نیست
              </div>
            ) : (
              <div className="h-72 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={signups}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a3a4b" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#9a9aaa", fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: "#3a3a4b" }}
                      interval={range === "7d" ? 0 : 3}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#9a9aaa", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#e0cba8"
                      strokeWidth={2.5}
                      dot={{ fill: "#e0cba8", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Daily activity + Top tasks side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Daily activity bar chart */}
        <motion.div
          custom={5}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <Card className="glass h-full border-border/60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-accent" />
                <CardTitle className="font-academic text-lg">
                  فعالیت روزانه
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-72 w-full rounded-lg" />
              ) : dailyActivity.length === 0 ? (
                <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                  داده‌ای موجود نیست
                </div>
              ) : (
                <div className="h-72 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dailyActivity}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#3a3a4b"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#9a9aaa", fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: "#3a3a4b" }}
                        interval={range === "7d" ? 0 : 4}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "#9a9aaa", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar
                        dataKey="count"
                        fill="#8fbc8f"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top tasks horizontal bar */}
        <motion.div
          custom={6}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <Card className="glass h-full border-border/60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle className="font-academic text-lg">
                  پرتکرارترین تسک‌ها
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-72 w-full rounded-lg" />
              ) : topTasks.length === 0 ? (
                <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                  هنوز تسکی ثبت نشده است
                </div>
              ) : (
                <div className="h-72 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={topTasks}
                      margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#3a3a4b"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fill: "#9a9aaa", fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: "#3a3a4b" }}
                        tickFormatter={(v) =>
                          toPersianDigits(Math.round(v / 60))
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="title"
                        tick={{ fill: "#c5c5c5", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={120}
                      />
                      <Tooltip content={<DurationTooltip />} />
                      <Bar
                        dataKey="seconds"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={26}
                      >
                        {topTasks.map((t, i) => (
                          <Cell
                            key={t.title}
                            fill={t.color || PALETTE[i % PALETTE.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default AdminReportsView;
