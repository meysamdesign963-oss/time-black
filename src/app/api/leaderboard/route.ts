import { db } from "@/lib/db";
import {
  startOfJalaliMonth,
  startOfJalaliWeek,
} from "@/utils/persian-date";
import { ok, fail } from "@/utils/api-response";

const RANGES = new Set(["today", "week", "month"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "week";
  if (!RANGES.has(range)) return fail("بازه نامعتبر است", 400);

  const now = new Date();
  let from: Date;
  if (range === "today") {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    from = startOfJalaliWeek(now);
  } else {
    from = startOfJalaliMonth(now);
  }

  // Aggregate total seconds per user from COMPLETED time entries in range
  const grouped = await db.timeEntry.groupBy({
    by: ["userId"],
    where: {
      status: "COMPLETED",
      startedAt: { gte: from },
    },
    _sum: { durationSec: true },
    orderBy: { _sum: { durationSec: "desc" } },
    take: 100,
  });

  const userIds = grouped.map((g) => g.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds }, status: "ACTIVE" },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      currentRank: true,
    },
  });

  // Count tasks per user in range
  const taskCounts = await db.timeEntry.groupBy({
    by: ["taskId"],
    where: { status: "COMPLETED", startedAt: { gte: from } },
    _count: { _all: true },
  });
  const taskOwnerMap = new Map<string, string>();
  const tasks = await db.task.findMany({
    where: { id: { in: taskCounts.map((t) => t.taskId) } },
    select: { id: true, userId: true },
  });
  for (const t of tasks) taskOwnerMap.set(t.id, t.userId);

  const userTaskCount = new Map<string, number>();
  for (const tc of taskCounts) {
    const owner = taskOwnerMap.get(tc.taskId);
    if (!owner) continue;
    userTaskCount.set(owner, (userTaskCount.get(owner) || 0) + 1);
  }

  const userMap = new Map(users.map((u) => [u.id, u]));

  const entries = grouped
    .map((g, idx) => {
      const u = userMap.get(g.userId);
      if (!u) return null;
      const totalSeconds = g._sum.durationSec || 0;
      return {
        rank: idx + 1,
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        totalSeconds,
        taskCount: userTaskCount.get(u.id) || 0,
        topThree: idx < 3,
      };
    })
    .filter(Boolean) as Array<{
    rank: number;
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    totalSeconds: number;
    taskCount: number;
    topThree: boolean;
  }>;

  return ok({
    range,
    from,
    leaderboard: entries,
  });
}
