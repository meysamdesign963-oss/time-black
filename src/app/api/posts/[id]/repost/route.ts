/**
 * POST /api/posts/[id]/repost
 * ---------------------------
 * Repost a post (with optional quote text).
 *
 * body: { quoteText?: string }
 *
 * Creates a new Post that is a repost of the original:
 *  - isRepost = true
 *  - repostOfId = original post ID
 *  - quoteText = optional user quote
 *  - content = quoteText || "" (so content field stays valid)
 *
 * Increments original post's repostCount.
 * Notifies original post author.
 */
import { db } from "@/lib/db";
import { sanitizeText, rateLimit } from "@/utils/validation";
import { ok, fail, unauthorized, notFound, forbidden } from "@/utils/api-response";
import { getAuth, parseJsonBody } from "@/lib/route-helpers";
import { generateSlug } from "@/utils/seo";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const rl = rateLimit(`repost:${user.id}`, 10, 60 * 1000);
  if (!rl.ok) return fail("در حال ری‌پست زیاد. کمی صبر کنید.", 429);

  const { id } = await params;
  const body = await parseJsonBody<{ quoteText?: string }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const original = await db.post.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, visibility: true },
  });
  if (!original) return notFound("پست یافت نشد");
  if (original.status !== "PUBLISHED" || original.visibility !== "PUBLIC")
    return fail("این پست قابل ری‌پست نیست", 400);

  // Prevent reposting own post
  if (original.userId === user.id)
    return fail("نمی‌توانید پست خودتان را ری‌پست کنید", 400);

  // Check if already reposted (one repost per user per post)
  const existing = await db.post.findFirst({
    where: { userId: user.id, repostOfId: id, isRepost: true },
    select: { id: true },
  });
  if (existing) return fail("شما قبلاً این پست را ری‌پست کرده‌اید", 400);

  const quoteText = body.quoteText
    ? sanitizeText(body.quoteText).slice(0, 500)
    : null;

  // Content for the repost: use quoteText or empty marker
  const content = quoteText || "ری‌پست";

  // Generate slug
  const tempId = Math.random().toString(36).slice(2, 8);
  const slug = generateSlug(content, tempId);

  const repost = await db.post.create({
    data: {
      userId: user.id,
      content,
      mediaType: "NONE",
      visibility: "PUBLIC",
      status: "PUBLISHED",
      isRepost: true,
      repostOfId: id,
      quoteText,
      slug,
    },
    select: {
      id: true,
      content: true,
      quoteText: true,
      isRepost: true,
      repostOfId: true,
      createdAt: true,
      user: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  // Increment original post's repostCount
  await db.post.update({
    where: { id },
    data: { repostCount: { increment: 1 } },
  });

  // Notify original post author
  try {
    await db.notification.create({
      data: {
        userId: original.userId,
        type: "SYSTEM",
        title: "ری‌پست جدید",
        message: `${user.displayName} پست شما را ری‌پست کرد`,
        link: `/post/${id}`,
      },
    });
  } catch {
    // noop
  }

  return applyRefresh(ok({ repost }));
}

/**
 * DELETE /api/posts/[id]/repost
 * -----------------------------
 * Undo a repost (delete the repost post).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const { id } = await params;

  const repost = await db.post.findFirst({
    where: { userId: user.id, repostOfId: id, isRepost: true },
    select: { id: true },
  });
  if (!repost) return notFound("ری‌پستی یافت نشد");

  await db.post.delete({ where: { id: repost.id } });

  // Decrement original post's repostCount
  await db.post.update({
    where: { id },
    data: { repostCount: { decrement: 1 } },
  });

  return applyRefresh(ok({ ok: true }));
}
