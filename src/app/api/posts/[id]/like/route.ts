/**
 * POST /api/posts/[id]/like
 * -------------------------
 * Toggle like on a post. Creates PostLike if not liked, removes if liked.
 * Updates denormalized likeCount on the post.
 */
import { db } from "@/lib/db";
import { ok, fail, unauthorized, notFound, forbidden } from "@/utils/api-response";
import { getAuth, writeAudit, getClientIp } from "@/lib/route-helpers";
import { rateLimit } from "@/utils/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  // Rate limit: 30 likes per minute
  const rl = rateLimit(`like:${user.id}`, 30, 60 * 1000);
  if (!rl.ok) {
    return fail("در حال انجام actions زیاد. کمی صبر کنید.", 429);
  }

  const { id } = await params;
  const post = await db.post.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, visibility: true },
  });
  if (!post) return notFound("پست یافت نشد");

  // Check if already liked
  const existing = await db.postLike.findUnique({
    where: { postId_userId: { postId: id, userId: user.id } },
  });

  if (existing) {
    // Unlike
    await db.postLike.delete({ where: { id: existing.id } });
    await db.post.update({
      where: { id },
      data: { likeCount: { decrement: 1 } },
    });
    const res = ok({ liked: false, likeCount: Math.max(0, post.status === "PUBLISHED" ? 0 : 0) });
    // Get actual count
    const updated = await db.post.findUnique({
      where: { id },
      select: { likeCount: true },
    });
    return applyRefresh(
      ok({ liked: false, likeCount: updated?.likeCount ?? 0 }),
    );
  }

  // Like
  await db.postLike.create({ data: { postId: id, userId: user.id } });
  await db.post.update({
    where: { id },
    data: { likeCount: { increment: 1 } },
  });

  // Create notification for post owner (if not self-like)
  if (post.userId !== user.id) {
    try {
      await db.notification.create({
        data: {
          userId: post.userId,
          type: "LIKE",
          title: "لایک جدید",
          message: `${user.displayName} پست شما را لایک کرد`,
          link: `/posts/${id}`,
        },
      });
    } catch {
      // notification failure must not break the like
    }
  }

  const updated = await db.post.findUnique({
    where: { id },
    select: { likeCount: true },
  });
  return applyRefresh(ok({ liked: true, likeCount: updated?.likeCount ?? 1 }));
}
