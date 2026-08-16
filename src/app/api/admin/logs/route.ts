import { db } from "@/lib/db";
import { ok } from "@/utils/api-response";
import { getAdminAuth } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

  const where: Record<string, unknown> = {};
  if (action) where.action = action;

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        userId: true,
        action: true,
        ip: true,
        meta: true,
        createdAt: true,
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    }),
  ]);

  // parse meta JSON for convenience
  const parsed = logs.map((l) => ({
    ...l,
    meta: l.meta ? safeParse(l.meta) : null,
  }));

  const res = ok({ logs: parsed, total, page, limit });
  return applyRefresh(res);
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
