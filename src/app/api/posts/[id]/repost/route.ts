/**
 * POST /api/posts/[id]/repost -- Repost with optional quote. Transaction-safe.
 * DELETE /api/posts/[id]/repost -- Undo repost. Transaction-safe.
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
    select: { id: true, userId: true, status: true, visibility: true, slug: true },
  });
  if (!original) return notFound("پست یافت نشد");
  if (original.status !== "PUBLISHED" || original.visibility !== "PUBLIC")
    return fail("این پست قابل ری‌پست نیست", 400);
  if (original.userId === user.id)
    return fail("نمی‌توانید پست خودتان را ری‌پست کنید", 400);

  const quoteText = body.quoteText
    ? sanitizeText(body.quoteText).slice(0, 500)
    : null;
  const content = quoteText || "ری‌پست";
  const slug = generateSlug(content);

  // Atomic: create repost + increment counter in transaction
  let repost;
  try {
    repost = await db.$transaction(async (tx) => {
      const existing = await tx.post.findFirst({
        where: { userId: user.id, repostOfId: id, isRepost: true },
        select: { id: true },
      });
      if (existing) throw new Error("ALREADY_REPOSTED");

      const created = await tx.post.create({
        data: {
          userId: user.id, content, mediaType: "NONE",
          visibility: "PUBLIC", status: "PUBLISHED",
          isRepost: true, repostOfId: id, quoteText, slug,
        },
        select: {
          id: true, content: true, quoteText: true, isRepost: true,
          repostOfId: true, createdAt: true,
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      await tx.post.update({
        where: { id },
        data: { repostCount: { increment: 1 } },
      });

      return created;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_REPOSTED")
      return fail("شما قبلاً این پست را ری‌پست کرده‌اید", 400);
    throw e;
  }

  try {
    await db.notification.create({
      data: {
        userId: original.userId, type: "SYSTEM",
        title: "ری‌پست جدید",
        message: `${user.displayName} پست شما را ری‌پست کرد`,
        link: original.slug ? `/post/${original.slug}` : null,
      },
    });
  } catch { /* noop */ }

  return applyRefresh(ok({ repost }));
}

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

  // Atomic: delete repost + decrement counter (guard against negative)
  await db.$transaction([
    db.post.delete({ where: { id: repost.id } }),
    db.post.update({
      where: { id, repostCount: { gt: 0 } },
      data: { repostCount: { decrement: 1 } },
    }),
  ]);

  return applyRefresh(ok({ ok: true }));
}
