import { db } from "@/lib/db";
import {
  startOfJalaliMonth,
  startOfJalaliWeek,
} from "@/utils/persian-date";
import { ok, fail, unauthorized } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "all";

  const now = new Date();
  const where: Record<string, unknown> = { userId: user.id };
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    where.startedAt = { gte: start };
  } else if (range === "week") {
    where.startedAt = { gte: startOfJalaliWeek(now) };
  } else if (range === "month") {
    where.startedAt = { gte: startOfJalaliMonth(now) };
  }

  const entries = await db.timeEntry.findMany({
    where,
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      taskId: true,
      startedAt: true,
      endedAt: true,
      durationSec: true,
      status: true,
      note: true,
      createdAt: true,
      task: { select: { id: true, title: true, color: true } },
    },
    take: 500,
  });

  const totalSeconds = entries
    .filter((e) => e.status === "COMPLETED")
    .reduce((s, e) => s + e.durationSec, 0);

  const res = ok({ entries, totalSeconds, range });
  return applyRefresh(res);
}
