/**
 * POST /api/posts/[id]/like
 * -------------------------
 * Toggle like on a post. Creates PostLike if not liked, removes if liked.
 * Updates denormalized likeCount on the post.
 * Uses transaction for atomicity.
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
    return fail("در حال انجام عملیات زیاد. کمی صبر کنید.", 429);
  }

  const { id } = await params;
  const post = await db.post.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, visibility: true, slug: true },
  });
  if (!post) return notFound("پست یافت نشد");

  // Only allow liking published public posts, or own posts
  if (post.status !== "PUBLISHED") return notFound("پست یافت نشد");
  if (post.visibility !== "PUBLIC" && post.userId !== user.id)
    return forbidden("دسترسی غیرمجاز");

  // Check if already liked
  const existing = await db.postLike.findUnique({
    where: { postId_userId: { postId: id, userId: user.id } },
  });

  if (existing) {
    // Unlike -- atomic transaction
    await db.$transaction([
      db.postLike.delete({ where: { id: existing.id } }),
      db.post.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
    const updated = await db.post.findUnique({
      where: { id },
      select: { likeCount: true },
    });
    return applyRefresh(
      ok({ liked: false, likeCount: Math.max(0, updated?.likeCount ?? 0) }),
    );
  }

  // Like -- atomic transaction
  await db.$transaction([
    db.postLike.create({ data: { postId: id, userId: user.id } }),
    db.post.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
    }),
  ]);

  // Create notification for post owner (if not self-like)
  if (post.userId !== user.id) {
    try {
      await db.notification.create({
        data: {
          userId: post.userId,
          type: "LIKE",
          title: "لایک جدید",
          message: `${user.displayName} پست شما را لایک کرد`,
          link: post.slug ? `/post/${post.slug}` : null,
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
