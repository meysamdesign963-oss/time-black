import { db } from "@/lib/db";
import { ok } from "@/utils/api-response";
import { getAdminAuth } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));

  const where = q
    ? {
        OR: [
          { username: { contains: q } },
          { displayName: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        status: true,
        authMethod: true,
        totalSeconds: true,
        currentRank: true,
        createdAt: true,
        restrictions: true,
        _count: {
          select: {
            tasks: true,
            timeEntries: { where: { status: "COMPLETED" } },
            posts: true,
            followers: true,
            followees: true,
            awards: true,
          },
        },
      },
    }),
  ]);

  const res = ok({ users, total, page, limit });
  return applyRefresh(res);
}
