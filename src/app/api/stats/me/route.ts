import { db } from "@/lib/db";
import { startOfJalaliMonth, formatPersianDateShort } from "@/utils/persian-date";
import { ok, unauthorized } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = startOfJalaliMonth(now);

  // Last 7 days daily totals
  const dailyTotals: Array<{ date: string; seconds: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(now.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    const agg = await db.timeEntry.aggregate({
      where: {
        userId: user.id,
        status: "COMPLETED",
        startedAt: { gte: dayStart, lt: dayEnd },
      },
      _sum: { durationSec: true },
    });
    dailyTotals.push({
      date: formatPersianDateShort(dayStart),
      seconds: agg._sum.durationSec || 0,
    });
  }

  const [todayAgg, monthAgg, taskCountsByStatus, taskDistributionAgg] =
    await Promise.all([
      db.timeEntry.aggregate({
        where: { userId: user.id, status: "COMPLETED", startedAt: { gte: todayStart } },
        _sum: { durationSec: true },
      }),
      db.timeEntry.aggregate({
        where: { userId: user.id, status: "COMPLETED", startedAt: { gte: monthStart } },
        _sum: { durationSec: true },
      }),
      db.task.groupBy({
        by: ["status"],
        where: { userId: user.id },
        _count: { _all: true },
      }),
      db.timeEntry.groupBy({
        by: ["taskId"],
        where: { userId: user.id, status: "COMPLETED" },
        _sum: { durationSec: true },
      }),
    ]);

  const taskIds = taskDistributionAgg.map((t) => t.taskId);
  const tasks = await db.task.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, title: true, color: true },
  });
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const taskDistribution = taskDistributionAgg
    .map((t) => {
      const task = taskMap.get(t.taskId);
      if (!task) return null;
      return {
        taskId: t.taskId,
        title: task.title,
        color: task.color,
        seconds: t._sum.durationSec || 0,
      };
    })
    .filter(Boolean) as Array<{
    taskId: string;
    title: string;
    color: string;
    seconds: number;
  }>;

  const taskCounts: Record<string, number> = {
    ACTIVE: 0,
    DONE: 0,
    CANCELLED: 0,
  };
  for (const t of taskCountsByStatus) {
    taskCounts[t.status] = t._count._all;
  }

  const stats = {
    todaySeconds: todayAgg._sum.durationSec || 0,
    monthSeconds: monthAgg._sum.durationSec || 0,
    totalSeconds: user.totalSeconds,
    currentRank: user.currentRank,
    prevRank: user.prevRank,
    taskCounts,
    dailyTotals,
    taskDistribution,
  };

  const res = ok({ stats });
  return applyRefresh(res);
}
