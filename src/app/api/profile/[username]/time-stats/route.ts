/**
 * GET /api/profile/[username]/time-stats?months=6
 * -----------------------------------------------
 * Returns daily time totals for the last N months (for heatmap visualization).
 * Also returns weekly stats + category breakdown + best day.
 */
import { db } from "@/lib/db";
import { ok, fail, notFound } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";
import { toJalaali, jalaaliToDateObject } from "jalaali-js";
import { toPersianDigits, PERSIAN_MONTHS } from "@/utils/persian-date";

/** Jalali month length (inline to avoid ESM/CJS import issues). */
function jalaliMonthLen(jy: number, jm: number): number {
  // Leap year check for Jalali calendar
  const leap = isLeapJalaaliYear(jy);
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return leap ? 30 : 29;
}

function isLeapJalaaliYear(jy: number): boolean {
  // Jalali leap year algorithm
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  let jp = breaks[0];
  let jump = 0;
  for (let i = 0; i < breaks.length; i++) {
    const jm3 = breaks[i];
    jump = jm3 - jp;
    if (jy < jm3) break;
    jp = jm3;
  }
  let n = jy - jp;
  if (n < jump) {
    // intermediate year
    return (jump - n) % 4 === 0;
  }
  // after a long jump
  return n % 4 === 1;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const url = new URL(request.url);
  const monthsParam = parseInt(url.searchParams.get("months") || "6", 10);
  const months = Math.min(12, Math.max(1, monthsParam));

  const user = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true, username: true },
  });
  if (!user) return notFound("کاربر یافت نشد");

  // Calculate date range: last N months from today
  const now = new Date();
  const jNow = toJalaali(now);
  // Go back N months in Jalali calendar
  let startJy = jNow.jy;
  let startJm = jNow.jm - (months - 1);
  while (startJm <= 0) {
    startJy -= 1;
    startJm += 12;
  }
  const startDate = jalaaliToDateObject(startJy, startJm, 1);

  // Fetch all completed time entries in range
  const entries = await db.timeEntry.findMany({
    where: {
      userId: user.id,
      status: "COMPLETED",
      startedAt: { gte: startDate },
    },
    select: {
      durationSec: true,
      startedAt: true,
      task: { select: { category: true, title: true, color: true } },
    },
  });

  // Group by day (Gregorian date string YYYY-MM-DD)
  const dayMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  const taskMap = new Map<string, { title: string; color: string; seconds: number }>();

  for (const e of entries) {
    const dayKey = e.startedAt.toISOString().slice(0, 10);
    dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + e.durationSec);

    const cat = e.task?.category || "general";
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + e.durationSec);

    if (e.task) {
      const existing = taskMap.get(e.task.title);
      if (existing) {
        existing.seconds += e.durationSec;
      } else {
        taskMap.set(e.task.title, {
          title: e.task.title,
          color: e.task.color || "#e0cba8",
          seconds: e.durationSec,
        });
      }
    }
  }

  // Build heatmap data: array of { date, seconds, jalaliDate, level }
  // Level: 0 (no activity) → 4 (high activity)
  const heatmap: Array<{
    date: string;
    seconds: number;
    jalaliDate: string;
    level: number;
  }> = [];

  const maxSeconds = Math.max(...Array.from(dayMap.values()), 1);
  const iterDate = new Date(startDate);
  iterDate.setHours(0, 0, 0, 0);
  while (iterDate <= now) {
    const dayKey = iterDate.toISOString().slice(0, 10);
    const seconds = dayMap.get(dayKey) || 0;
    const j = toJalaali(iterDate);
    const jalaliDate = `${toPersianDigits(j.jy)}/${toPersianDigits(
      String(j.jm).padStart(2, "0"),
    )}/${toPersianDigits(String(j.jd).padStart(2, "0"))}`;

    // Calculate level (0-4) based on percentage of max
    let level = 0;
    if (seconds > 0) {
      const pct = seconds / maxSeconds;
      level = pct >= 0.75 ? 4 : pct >= 0.5 ? 3 : pct >= 0.25 ? 2 : 1;
    }

    heatmap.push({ date: dayKey, seconds, jalaliDate, level });
    iterDate.setDate(iterDate.getDate() + 1);
  }

  // Weekly stats (last 7 days)
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const weeklyStats: Array<{ date: string; seconds: number }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dayKey = d.toISOString().slice(0, 10);
    weeklyStats.push({
      date: dayKey,
      seconds: dayMap.get(dayKey) || 0,
    });
  }

  // Monthly summary
  const monthlySummary: Array<{
    jy: number;
    jm: number;
    monthName: string;
    totalSeconds: number;
    activeDays: number;
  }> = [];
  for (let i = 0; i < months; i++) {
    let my = startJy;
    let mm = startJm + i;
    while (mm > 12) {
      my += 1;
      mm -= 12;
    }
    const monthStart = jalaaliToDateObject(my, mm, 1);
    const monthLen = jalaliMonthLen(my, mm);
    const monthEnd = jalaaliToDateObject(my, mm, monthLen);
    monthEnd.setHours(23, 59, 59, 999);

    let total = 0;
    let activeDays = 0;
    for (const [dayKey, secs] of dayMap) {
      const d = new Date(dayKey);
      if (d >= monthStart && d <= monthEnd) {
        total += secs;
        if (secs > 0) activeDays++;
      }
    }
    monthlySummary.push({
      jy: my,
      jm: mm,
      monthName: PERSIAN_MONTHS[mm - 1],
      totalSeconds: total,
      activeDays,
    });
  }

  // Category breakdown
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, seconds]) => ({ category, seconds }))
    .sort((a, b) => b.seconds - a.seconds);

  // Top tasks
  const topTasks = Array.from(taskMap.values())
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 10);

  // Best day (most productive in range)
  let bestDay: { date: string; seconds: number } | null = null;
  for (const [dayKey, seconds] of dayMap) {
    if (!bestDay || seconds > bestDay.seconds) {
      bestDay = { date: dayKey, seconds };
    }
  }

  const totalSeconds = entries.reduce((sum, e) => sum + e.durationSec, 0);
  const activeDaysTotal = new Set(
    entries.map((e) => e.startedAt.toISOString().slice(0, 10)),
  ).size;

  return ok({
    heatmap,
    weeklyStats,
    monthlySummary,
    categoryBreakdown,
    topTasks,
    bestDay,
    totalSeconds,
    activeDays: activeDaysTotal,
    range: { from: startDate.toISOString(), to: now.toISOString() },
  });
}
