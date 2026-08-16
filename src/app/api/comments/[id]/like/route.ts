/**
 * POST /api/comments/[id]/like
 * --------------------------------
 * Toggle like on a comment. Creates CommentLike if not liked, removes if liked.
 */
import { db } from "@/lib/db";
import { ok, fail, unauthorized, notFound } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";
import { rateLimit } from "@/utils/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const rl = rateLimit(`comment-like:${user.id}`, 30, 60 * 1000);
  if (!rl.ok) return fail("در حال انجام actions زیاد.", 429);

  const { id } = await params;
  const comment = await db.comment.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!comment) return notFound("کامنت یافت نشد");

  const existing = await db.commentLike.findUnique({
    where: { commentId_userId: { commentId: id, userId: user.id } },
  });

  if (existing) {
    await db.commentLike.delete({ where: { id: existing.id } });
    await db.comment.update({
      where: { id },
      data: { likeCount: { decrement: 1 } },
    });
    const updated = await db.comment.findUnique({
      where: { id },
      select: { likeCount: true },
    });
    return applyRefresh(ok({ liked: false, likeCount: updated?.likeCount ?? 0 }));
  }

  await db.commentLike.create({ data: { commentId: id, userId: user.id } });
  await db.comment.update({
    where: { id },
    data: { likeCount: { increment: 1 } },
  });

  // Notify comment author (if not self)
  if (comment.userId !== user.id) {
    try {
      await db.notification.create({
        data: {
          userId: comment.userId,
          type: "LIKE",
          title: "لایک جدید",
          message: `${user.displayName} کامنت شما را لایک کرد`,
        },
      });
    } catch {
      // noop
    }
  }

  const updated = await db.comment.findUnique({
    where: { id },
    select: { likeCount: true },
  });
  return applyRefresh(ok({ liked: true, likeCount: updated?.likeCount ?? 1 }));
}
