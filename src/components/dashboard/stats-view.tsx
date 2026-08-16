"use client";

/**
 * StatsView — personal stats & reports page.
 * Range tabs (daily/weekly/monthly), 4 KPI stat cards, line chart for
 * last-7-days daily totals, pie chart for task distribution, bar chart
 * for daily comparison, summary table by task.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  Clock,
  PieChart as PieChartIcon,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatDurationHuman,
  formatRelativeTime,
  toPersianDigits,
  PERSIAN_WEEKDAYS_SHORT,
} from "@/utils/persian-date";

type StatsResp = {
  stats: {
    todaySeconds: number;
    monthSeconds: number;
    totalSeconds: number;
    currentRank: number | null;
    prevRank: number | null;
    taskCounts: { ACTIVE: number; DONE: number; CANCELLED: number };
    dailyTotals: Array<{ date: string; seconds: number }>;
    taskDistribution: Array<{
      taskId: string;
      title: string;
      color: string;
      seconds: number;
    }>;
  };
};

type EntriesResp = {
  entries: Array<{
    id: string;
    taskId: string;
    durationSec: number;
    startedAt: string;
    status: string;
    task: { id: string; title: string; color: string };
  }>;
  totalSeconds: number;
};

type Range = "today" | "week" | "month";

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

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: "easeOut" as const },
  }),
};

export function StatsView() {
  const [range, setRange] = useState<Range>("week");
  const [stats, setStats] = useState<StatsResp["stats"] | null>(null);
  const [entries, setEntries] = useState<EntriesResp["entries"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const r = range === "today" ? "today" : range === "week" ? "week" : "month";
      const [statsRes, entriesRes] = await Promise.all([
        apiFetch<StatsResp>("/api/stats/me"),
        apiFetch<EntriesResp>(`/api/time-entries?range=${r}`),
      ]);
      if (!active) return;
      if (statsRes.ok && statsRes.data?.stats) setStats(statsRes.data.stats);
      if (entriesRes.ok && entriesRes.data?.entries) {
        setEntries(entriesRes.data.entries);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [range]);

  // Build chart data
  const lineData = useMemo(() => {
    if (!stats?.dailyTotals) return [];
    // dailyTotals has format "1403/07/12" - extract day name from date object
    return stats.dailyTotals.map((d) => {
      // parse Persian date "yyyy/mm/dd" -> need weekday. The data is consecutive
      // last 7 days, so we can compute weekday from index relative to today.
      // However, simpler: parse the gregorian equivalent.
      // We'll just show the day index from now - 6 + i
      const today = new Date();
      const i = stats.dailyTotals.length - 1 - stats.dailyTotals.indexOf(d);
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const weekdayIdx = day.getDay();
      return {
        name: PERSIAN_WEEKDAYS_SHORT[weekdayIdx],
        دقیقه: Math.round(d.seconds / 60),
        ثانیه: d.seconds,
      };
    });
  }, [stats]);

  const pieData = useMemo(() => {
    if (!stats?.taskDistribution) return [];
    return stats.taskDistribution
      .filter((t) => t.seconds > 0)
      .map((t) => ({
        name: t.title,
        value: Math.round(t.seconds / 60),
        seconds: t.seconds,
        color: t.color || PALETTE[0],
      }));
  }, [stats]);

  const rangeSeconds = useMemo(() => {
    return entries
      .filter((e) => e.status === "COMPLETED")
      .reduce((s, e) => s + e.durationSec, 0);
  }, [entries]);

  const doneCount = stats?.taskCounts.DONE ?? 0;

  const avgDaily = useMemo(() => {
    if (!stats?.dailyTotals) return 0;
    const total = stats.dailyTotals.reduce((s, d) => s + d.seconds, 0);
    return Math.round(total / stats.dailyTotals.length);
  }, [stats]);

  const bestDay = useMemo(() => {
    if (!stats?.dailyTotals) return null;
    return stats.dailyTotals.reduce(
      (best, d) => (d.seconds > (best?.seconds || 0) ? d : best),
      null as { date: string; seconds: number } | null,
    );
  }, [stats]);

  // Summary table by task
  const summaryRows = useMemo(() => {
    const map = new Map<
      string,
      {
        title: string;
        color: string;
        count: number;
        total: number;
        lastAt: Date | null;
      }
    >();
    for (const e of entries) {
      if (e.status !== "COMPLETED") continue;
      const key = e.taskId;
      if (!map.has(key)) {
        map.set(key, {
          title: e.task.title,
          color: e.task.color || PALETTE[0],
          count: 0,
          total: 0,
          lastAt: null,
        });
      }
      const row = map.get(key)!;
      row.count += 1;
      row.total += e.durationSec;
      const d = new Date(e.startedAt);
      if (!row.lastAt || d > row.lastAt) row.lastAt = d;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [entries]);

  const totalPieSeconds = pieData.reduce((s, d) => s + d.seconds, 0);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6">
      <PageHeader
        title="آمار و گزارش"
        description="تحلیل فعالیت‌های زمانی شما"
        action={
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList>
              <TabsTrigger value="today">روزانه</TabsTrigger>
              <TabsTrigger value="week">هفتگی</TabsTrigger>
              <TabsTrigger value="month">ماهانه</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {/* KPI cards */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={0}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {loading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </>
        ) : (
          <>
            <StatCard
              label="مجموع تایم"
              value={formatDurationHuman(rangeSeconds)}
              icon={Clock}
              hint={
                range === "today"
                  ? "امروز"
                  : range === "week"
                    ? "این هفته"
                    : "این ماه"
              }
              accent="primary"
            />
            <StatCard
              label="تسک‌های تکمیل‌شده"
              value={toPersianDigits(doneCount)}
              icon={Trophy}
              hint="از کل تسک‌های شما"
              accent="accent"
            />
            <StatCard
              label="میانگین روزانه"
              value={formatDurationHuman(avgDaily)}
              icon={TrendingUp}
              hint="در ۷ روز گذشته"
              accent="primary"
            />
            <StatCard
              label="بهترین روز"
              value={bestDay ? formatDurationHuman(bestDay.seconds) : "—"}
              icon={CalendarDays}
              hint={bestDay ? bestDay.date : "بدون داده"}
              accent="accent"
            />
          </>
        )}
      </motion.div>

      {/* Line chart */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={1}
      >
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-academic text-lg font-bold text-foreground">
                روند فعالیت ۷ روز اخیر
              </h3>
            </div>
            {loading ? (
              <Skeleton className="h-72 w-full rounded-lg" />
            ) : lineData.length === 0 ? (
              <ChartEmpty />
            ) : (
              <div className="h-72 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={lineData}>
                    <defs>
                      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#e0cba8"
                          stopOpacity={0.5}
                        />
                        <stop
                          offset="100%"
                          stopColor="#e0cba8"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(154,154,170,0.15)"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#9a9aaa", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#9a9aaa", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#2a2a3b",
                        border: "1px solid rgba(58,58,75,0.6)",
                        borderRadius: 12,
                        color: "#f5f5dc",
                      }}
                      labelStyle={{ color: "#9a9aaa" }}
                      formatter={(value: number, name: string) => {
                        if (name === "ثانیه") {
                          return [
                            formatDurationHuman(value as number),
                            "زمان",
                          ];
                        }
                        return [`${toPersianDigits(value)} دقیقه`, "زمان"];
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="دقیقه"
                      stroke="#e0cba8"
                      strokeWidth={2.5}
                      fill="url(#gold)"
                      dot={{ fill: "#e0cba8", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pie chart */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={2}
        >
          <Card className="h-full">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-accent" />
                <h3 className="font-academic text-lg font-bold text-foreground">
                  توزیع زمان بر اساس تسک
                </h3>
              </div>
              {loading ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : pieData.length === 0 ? (
                <ChartEmpty />
              ) : (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="h-56 w-56" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {pieData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry.color}
                              stroke="rgba(30,30,46,0.8)"
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "#2a2a3b",
                            border: "1px solid rgba(58,58,75,0.6)",
                            borderRadius: 12,
                            color: "#f5f5dc",
                          }}
                          formatter={(value: number, _name, props) => {
                            const sec =
                              (props && props.payload && props.payload.seconds) || 0;
                            const pct =
                              totalPieSeconds > 0
                                ? Math.round((sec / totalPieSeconds) * 100)
                                : 0;
                            return [
                              `${formatDurationHuman(sec)} (${toPersianDigits(pct)}٪)`,
                              "زمان",
                            ];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2 self-stretch overflow-y-auto">
                    {pieData.map((d, i) => {
                      const pct =
                        totalPieSeconds > 0
                          ? Math.round((d.seconds / totalPieSeconds) * 100)
                          : 0;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: d.color }}
                          />
                          <span className="flex-1 truncate text-foreground">
                            {d.name}
                          </span>
                          <span className="font-mono text-primary">
                            {toPersianDigits(pct)}٪
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Bar chart */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={3}
        >
          <Card className="h-full">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-academic text-lg font-bold text-foreground">
                  مقایسه روزانه
                </h3>
              </div>
              {loading ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : lineData.length === 0 ? (
                <ChartEmpty />
              ) : (
                <div className="h-56 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lineData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(154,154,170,0.15)"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#9a9aaa", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#9a9aaa", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#2a2a3b",
                          border: "1px solid rgba(58,58,75,0.6)",
                          borderRadius: 12,
                          color: "#f5f5dc",
                        }}
                        labelStyle={{ color: "#9a9aaa" }}
                        formatter={(value: number) => [
                          `${formatDurationHuman(value * 60)}`,
                          "زمان",
                        ]}
                      />
                      <Bar
                        dataKey="دقیقه"
                        fill="#e0cba8"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Summary table */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={4}
      >
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="font-academic text-lg font-bold text-foreground">
                خلاصه بر اساس تسک
              </h3>
            </div>
            {loading ? (
              <Skeleton className="h-48 w-full rounded-lg" />
            ) : summaryRows.length === 0 ? (
              <ChartEmpty message="هنوز داده‌ای ثبت نشده است" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>نام تسک</TableHead>
                      <TableHead>تعداد دفعات</TableHead>
                      <TableHead>مجموع تایم</TableHead>
                      <TableHead>میانگین</TableHead>
                      <TableHead>آخرین انجام</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: row.color }}
                            />
                            <span className="text-sm font-medium text-foreground">
                              {row.title}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {toPersianDigits(row.count)}
                        </TableCell>
                        <TableCell className="font-mono text-primary">
                          {formatDurationHuman(row.total)}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {formatDurationHuman(
                            row.count > 0 ? Math.round(row.total / row.count) : 0,
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.lastAt
                            ? formatRelativeTime(row.lastAt)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

    </div>
  );
}

function ChartEmpty({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
        <BarChart3 className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-foreground">
        {message || "داده‌ای برای نمایش وجود ندارد"}
      </p>
      <p className="text-xs text-muted-foreground">
        با ثبت فعالیت‌های بیشتر، نمودارها نمایش داده می‌شوند
      </p>
    </div>
  );
}

export default StatsView;
