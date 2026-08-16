import { db } from "@/lib/db";
import { startOfJalaliWeek, formatPersianDateShort } from "@/utils/persian-date";
import { ok } from "@/utils/api-response";
import { getAdminAuth } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = startOfJalaliWeek(now);

  const [
    totalUsers,
    blockedUsers,
    runningEntries,
    todaysTimeAgg,
    pendingReports,
    newUsersThisWeek,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { status: "BLOCKED" } }),
    db.timeEntry.count({ where: { status: "RUNNING" } }),
    db.timeEntry.aggregate({
      where: { status: "COMPLETED", startedAt: { gte: todayStart } },
      _sum: { durationSec: true },
    }),
    db.auditLog.count({ where: { action: "REPORT" } }),
    db.user.count({ where: { createdAt: { gte: weekStart } } }),
  ]);

  // Last 30 days signups (per day)
  const signups: Array<{ date: string; count: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(now.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const c = await db.user.count({
      where: { createdAt: { gte: dayStart, lt: dayEnd } },
    });
    signups.push({ date: formatPersianDateShort(dayStart), count: c });
  }

  const overview = {
    totalUsers,
    blockedUsers,
    runningEntries,
    todaysTotalSeconds: todaysTimeAgg._sum.durationSec || 0,
    pendingReports,
    newUsersThisWeek,
    signupsLast30Days: signups,
  };

  const res = ok({ overview });
  return applyRefresh(res);
}
