"use client";

/**
 * ProfileTimeStats — time analytics panel for the public profile view.
 *
 * Loads /api/profile/[username]/time-stats?months=6 and renders:
 *  - GitHub-style heatmap (CSS grid, 7 rows × N weeks)
 *  - Weekly bar chart (last 7 days, recharts)
 *  - Monthly summary cards
 *  - Category breakdown horizontal bars
 *  - Top tasks list
 *  - Best day card
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Award,
  CalendarDays,
  Clock,
  Flame,
  Tag,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/utils/api-fetch";
import {
  PERSIAN_WEEKDAYS_SHORT,
  formatDurationHuman,
  formatPersianDate,
  toPersianDigits,
} from "@/utils/persian-date";

type HeatmapCell = {
  date: string;
  seconds: number;
  jalaliDate: string;
  level: number;
};

type TimeStats = {
  heatmap: HeatmapCell[];
  weeklyStats: Array<{ date: string; seconds: number }>;
  monthlySummary: Array<{
    jy: number;
    jm: number;
    monthName: string;
    totalSeconds: number;
    activeDays: number;
  }>;
  categoryBreakdown: Array<{ category: string; seconds: number }>;
  topTasks: Array<{
    title: string;
    color: string;
    seconds: number;
  }>;
  bestDay: { date: string; seconds: number } | null;
  totalSeconds: number;
  activeDays: number;
  range: { from: string; to: string };
};

type StatsResp = TimeStats;

// Map 0-4 → tailwind class for heatmap cell
const LEVEL_BG = [
  "bg-secondary/40",
  "bg-primary/30",
  "bg-primary/50",
  "bg-primary/70",
  "bg-primary",
];

const LEVEL_LABEL = ["بدون فعالیت", "کم", "متوسط", "زیاد", "بسیار زیاد"];

const CATEGORY_LABELS: Record<string, string> = {
  general: "عمومی",
  study: "مطالعه",
  work: "کار",
  exercise: "ورزش",
  reading: "کتاب‌خوانی",
  personal: "شخصی",
  project: "پروژه",
};

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-muted-foreground",
  study: "bg-primary",
  work: "bg-accent",
  exercise: "bg-orange-500",
  reading: "bg-yellow-500",
  personal: "bg-pink-500",
  project: "bg-purple-500",
};

/**
 * Build a weeks-as-columns grid from the flat heatmap list.
 * Each "column" represents a week (7 consecutive days, oldest first).
 * Days where the heatmap range starts mid-week get leading empty cells.
 */
function buildWeekColumns(heatmap: HeatmapCell[]) {
  if (heatmap.length === 0) return [] as HeatmapCell[][];
  // Convert each date string to a Date to find its weekday.
  // JS getDay(): 0=Sun..6=Sat. We want week to start on Saturday (Persian week).
  // Shift so Saturday = 0, Sunday = 1, ..., Friday = 6.
  const shiftDay = (d: Date) => (d.getDay() + 1) % 7;

  const columns: HeatmapCell[][] = [];
  let current: HeatmapCell[] = [];
  // Pad the first column so the first day lands on the right row.
  const firstDay = shiftDay(new Date(heatmap[0].date + "T00:00:00Z"));
  for (let i = 0; i < firstDay; i++) current.push(null as never);

  for (const cell of heatmap) {
    current.push(cell);
    if (current.length === 7) {
      columns.push(current);
      current = [];
    }
  }
  if (current.length > 0) columns.push(current);
  return columns;
}

/**
 * Build month labels positioned above the week columns.
 * Returns array of { label, colIndex } where colIndex is the column
 * at which the month starts.
 */
function buildMonthLabels(weekColumns: HeatmapCell[][]) {
  const labels: Array<{ label: string; colIndex: number }> = [];
  let prevMonth = -1;
  weekColumns.forEach((week, idx) => {
    const firstReal = week.find(Boolean);
    if (!firstReal) return;
    // jalaliDate is "YYYY/MM/DD" with Persian digits — extract month
    const latin = firstReal.jalaliDate.replace(/[۰-۹]/g, (d) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
    );
    const parts = latin.split("/");
    if (parts.length < 2) return;
    const month = parseInt(parts[1], 10);
    if (month !== prevMonth) {
      labels.push({ label: firstReal.jalaliDate, colIndex: idx });
      prevMonth = month;
    }
  });
  return labels;
}

function toLatin(s: string) {
  return s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function getMonthName(jalaliDate: string): string {
  const latin = toLatin(jalaliDate);
  const parts = latin.split("/");
  if (parts.length < 2) return "";
  const m = parseInt(parts[1], 10);
  return (
    [
      "فروردین",
      "اردیبهشت",
      "خرداد",
      "تیر",
      "مرداد",
      "شهریور",
      "مهر",
      "آبان",
      "آذر",
      "دی",
      "بهمن",
      "اسفند",
    ][m - 1] || ""
  );
}

export function ProfileTimeStats({ username }: { username: string }) {
  const [stats, setStats] = useState<TimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await apiFetch<StatsResp>(
        `/api/profile/${encodeURIComponent(username)}/time-stats?months=6`,
      );
      if (!active) return;
      if (res.ok && res.data) {
        setStats(res.data);
        setError(null);
      } else {
        setError(res.error || "خطا در بارگذاری آمار");
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [username]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {error || "آمار زمان‌بندی در دسترس نیست."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const weekColumns = buildWeekColumns(stats.heatmap);
  const monthLabels = buildMonthLabels(weekColumns);

  // Weekly chart data
  const weeklyChartData = stats.weeklyStats.map((d) => {
    const date = new Date(d.date + "T00:00:00");
    const weekdayIdx = (date.getDay() + 1) % 7; // Sat=0
    return {
      label: PERSIAN_WEEKDAYS_SHORT[weekdayIdx],
      seconds: d.seconds,
    };
  });

  // Category breakdown (compute percentages)
  const totalCatSeconds =
    stats.categoryBreakdown.reduce((s, c) => s + c.seconds, 0) || 1;

  const topTasks = stats.topTasks.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Top summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          icon={Clock}
          label="مجموع تایم"
          value={formatDurationHuman(stats.totalSeconds)}
          accent="primary"
        />
        <SummaryCard
          icon={CalendarDays}
          label="روزهای فعال"
          value={`${toPersianDigits(stats.activeDays)} روز`}
          accent="accent"
        />
        <SummaryCard
          icon={Flame}
          label="بهترین روز"
          value={
            stats.bestDay
              ? formatDurationHuman(stats.bestDay.seconds)
              : "—"
          }
          accent="primary"
        />
        <SummaryCard
          icon={Activity}
          label="میانگین روزانه"
          value={
            stats.activeDays > 0
              ? formatDurationHuman(
                  Math.round(stats.totalSeconds / stats.activeDays),
                )
              : "—"
          }
        />
      </div>

      {/* Heatmap */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-academic text-base font-bold">
              <Activity className="h-4 w-4 text-primary" />
              فعالیت روزانه
            </h3>
            <span className="text-xs text-muted-foreground">
              ۶ ماه گذشته
            </span>
          </div>

          {stats.heatmap.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              هنوز داده‌ای ثبت نشده است.
            </div>
          ) : (
            <>
              {/* Heatmap grid: weeks as columns, days as rows */}
              <div className="overflow-x-auto pb-2">
                <div className="inline-flex flex-col gap-1">
                  {/* Month labels row */}
                  <div className="flex gap-[3px] pr-7 text-[10px] text-muted-foreground">
                    {monthLabels.map((m, i) => {
                      const nextCol =
                        i + 1 < monthLabels.length
                          ? monthLabels[i + 1].colIndex
                          : weekColumns.length;
                      const span = Math.max(1, nextCol - m.colIndex);
                      return (
                        <div
                          key={i}
                          style={{ width: `${span * 13}px` }}
                          className="truncate text-right"
                        >
                          {getMonthName(m.label)}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-1">
                    {/* Weekday labels column */}
                    <div className="grid grid-rows-7 gap-[3px] pr-1 text-[9px] text-muted-foreground">
                      {PERSIAN_WEEKDAYS_SHORT.map((d, i) => (
                        <div
                          key={i}
                          className="flex h-[11px] items-center"
                          style={{ visibility: i % 2 === 0 ? "visible" : "hidden" }}
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                    {/* Week columns */}
                    <div className="flex gap-[3px]">
                      {weekColumns.map((week, wi) => (
                        <div
                          key={wi}
                          className="grid grid-rows-7 gap-[3px]"
                        >
                          {Array.from({ length: 7 }).map((_, di) => {
                            const cell = week[di];
                            if (!cell) {
                              return (
                                <div
                                  key={di}
                                  className="h-[11px] w-[11px]"
                                />
                              );
                            }
                            return (
                              <div
                                key={di}
                                className={`h-[11px] w-[11px] rounded-[2px] transition-all hover:ring-1 hover:ring-primary/60 ${LEVEL_BG[cell.level]} ${
                                  hoveredCell?.date === cell.date
                                    ? "ring-1 ring-primary"
                                    : ""
                                }`}
                                onMouseEnter={() => setHoveredCell(cell)}
                                onMouseLeave={() =>
                                  setHoveredCell((c) =>
                                    c?.date === cell.date ? null : c,
                                  )
                                }
                                title={`${cell.jalaliDate} — ${formatDurationHuman(cell.seconds)}`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span>کمتر</span>
                  {LEVEL_BG.map((bg, i) => (
                    <div
                      key={i}
                      className={`h-[11px] w-[11px] rounded-[2px] ${bg}`}
                    />
                  ))}
                  <span>بیشتر</span>
                </div>
                {hoveredCell && (
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {hoveredCell.jalaliDate}
                    </span>
                    {" — "}
                    {formatDurationHuman(hoveredCell.seconds)}
                    {" ("}
                    {LEVEL_LABEL[hoveredCell.level]}
                    {")"}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Weekly bar chart + Best day card */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 p-4">
            <h3 className="flex items-center gap-2 font-academic text-base font-bold">
              <Clock className="h-4 w-4 text-primary" />
              فعالیت ۷ روز اخیر
            </h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "currentColor", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "rgba(224,203,168,0.1)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const v = payload[0].value as number;
                      return (
                        <div className="rounded-lg border border-border bg-card px-2 py-1 text-xs shadow-md">
                          <p className="text-foreground">
                            {formatDurationHuman(v)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="seconds" fill="#e0cba8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {stats.bestDay && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex h-full flex-col justify-center gap-2 p-4 text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
                <Award className="h-5 w-5" />
              </div>
              <p className="text-xs text-muted-foreground">بهترین روز</p>
              <p className="font-academic text-lg font-bold text-primary">
                {formatDurationHuman(stats.bestDay.seconds)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatPersianDate(new Date(stats.bestDay.date + "T00:00:00"))}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Monthly summary */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="flex items-center gap-2 font-academic text-base font-bold">
            <CalendarDays className="h-4 w-4 text-primary" />
            خلاصه ماهانه
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.monthlySummary.map((m, i) => (
              <motion.div
                key={`${m.jy}-${m.jm}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-lg border border-border/60 bg-secondary/30 p-3"
              >
                <p className="text-xs text-muted-foreground">
                  {m.monthName} {toPersianDigits(m.jy)}
                </p>
                <p className="mt-1 font-academic text-base font-bold text-primary">
                  {formatDurationHuman(m.totalSeconds)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {toPersianDigits(m.activeDays)} روز فعال
                </p>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Category breakdown + Top tasks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="flex items-center gap-2 font-academic text-base font-bold">
              <Activity className="h-4 w-4 text-primary" />
              تفکیک دسته‌بندی
            </h3>
            {stats.categoryBreakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                داده‌ای موجود نیست.
              </p>
            ) : (
              <ul className="space-y-2">
                {stats.categoryBreakdown.map((c) => {
                  const pct = Math.round(
                    (c.seconds / totalCatSeconds) * 100,
                  );
                  const label =
                    CATEGORY_LABELS[c.category] || c.category;
                  const bg = CATEGORY_COLORS[c.category] || "bg-primary";
                  return (
                    <li key={c.category}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-foreground">{label}</span>
                        <span className="text-muted-foreground">
                          {formatDurationHuman(c.seconds)} ·{" "}
                          {toPersianDigits(pct)}٪
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/60">
                        <div
                          className={`h-full ${bg}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="flex items-center gap-2 font-academic text-base font-bold">
              <Tag className="h-4 w-4 text-primary" />
              پرتکرارترین تسک‌ها
            </h3>
            {topTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                داده‌ای موجود نیست.
              </p>
            ) : (
              <ul className="space-y-2">
                {topTasks.map((t, i) => (
                  <motion.li
                    key={`${t.title}-${i}`}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: t.color || "#e0cba8" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {t.title}
                      </p>
                    </div>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {formatDurationHuman(t.seconds)}
                    </Badge>
                  </motion.li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  accent?: "primary" | "accent" | "default";
}) {
  const accentClass =
    accent === "primary"
      ? "text-primary"
      : accent === "accent"
        ? "text-accent"
        : "text-muted-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${accentClass}`} />
        {label}
      </div>
      <p className="mt-1 font-academic text-sm font-bold text-foreground sm:text-base">
        {value}
      </p>
    </div>
  );
}
