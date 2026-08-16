import { db } from "@/lib/db";
import { ok, fail } from "@/utils/api-response";
import { getAdminAuth } from "@/lib/route-helpers";

const STATUSES = new Set(["RUNNING", "COMPLETED", "CANCELLED"]);

export async function GET(request: Request) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") || undefined;
  const statusParam = url.searchParams.get("status") || undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (statusParam && STATUSES.has(statusParam)) where.status = statusParam;
  if (from || to) {
    const range: Record<string, unknown> = {};
    if (from) {
      const d = new Date(from);
      if (Number.isNaN(d.getTime())) return fail("تاریخ 'from' نامعتبر است", 400);
      range.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (Number.isNaN(d.getTime())) return fail("تاریخ 'to' نامعتبر است", 400);
      range.lte = d;
    }
    where.startedAt = range;
  }

  const [total, entries] = await Promise.all([
    db.timeEntry.count({ where }),
    db.timeEntry.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        durationSec: true,
        status: true,
        note: true,
        createdAt: true,
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        task: { select: { id: true, title: true, color: true } },
      },
    }),
  ]);

  const res = ok({ entries, total, page, limit });
  return applyRefresh(res);
}
