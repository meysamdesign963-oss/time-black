/**
 * GET /api/comments/[id]/replies
 * ------------------------------
 * Paginated list of replies for a comment (for "view more replies" feature).
 */
import { db } from "@/lib/db";
import { ok, notFound } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)),
  );

  const parent = await db.comment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!parent) return notFound("کامنت یافت نشد");

  const { user: viewer } = await getAuth(request);

  const [total, replies] = await Promise.all([
    db.comment.count({ where: { parentId: id } }),
    db.comment.findMany({
      where: { parentId: id },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        content: true,
        likeCount: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        ...(viewer
          ? {
              likes: {
                where: { userId: viewer.id },
                select: { id: true },
                take: 1,
              },
            }
          : {}),
      },
    }),
  ]);

  const repliesWithLikeStatus = replies.map((r) => {
    const { likes, ...rest } = r as Record<string, unknown> & {
      likes?: unknown[];
    };
    return { ...rest, likedByMe: Array.isArray(likes) && likes.length > 0 };
  });

  return ok({ replies: repliesWithLikeStatus, total, page, limit });
}
