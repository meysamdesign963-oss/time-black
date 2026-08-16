import { db } from "@/lib/db";
import { ok } from "@/utils/api-response";
import { getAdminAuth } from "@/lib/route-helpers";

const VISIBILITY = new Set(["PUBLIC", "PRIVATE"]);
const STATUS = new Set(["DRAFT", "PUBLISHED", "HIDDEN"]);

export async function GET(request: Request) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const visibility = url.searchParams.get("visibility") || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "30", 10)));

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (status && STATUS.has(status)) where.status = status;
  if (visibility && VISIBILITY.has(visibility)) where.visibility = visibility;

  const [total, posts] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        content: true,
        imageUrl: true,
        visibility: true,
        status: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    }),
  ]);

  const res = ok({ posts, total, page, limit });
  return applyRefresh(res);
}
