import { db } from "@/lib/db";
import { ok, fail, unauthorized } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

const TYPE_MAP: Record<string, string[]> = {
  rank: ["RANK_CHANGE"],
  interaction: ["LIKE", "COMMENT"],
  system: ["SYSTEM", "TASK"],
};

export async function GET(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all";

  const where: Record<string, unknown> = { userId: user.id };
  if (filter === "unread") where.isRead = false;
  else if (filter !== "all" && TYPE_MAP[filter]) {
    where.type = { in: TYPE_MAP[filter] };
  } else if (filter !== "all") {
    return fail("فیلتر نامعتبر است", 400);
  }

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        link: true,
        createdAt: true,
      },
    }),
    db.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  const res = ok({ notifications, unreadCount });
  return applyRefresh(res);
}
