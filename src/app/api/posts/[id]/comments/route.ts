/**
 * Comments API — GET (list with replies) + POST (create comment or reply)
 *
 * GET  /api/posts/[id]/comments?page=1&limit=20
 *   Returns top-level comments with nested replies (first 5 replies per comment)
 *
 * POST /api/posts/[id]/comments
 *   body: { content, parentId? }
 *   - If parentId is set, creates a reply to that comment
 *   - Increments parent's replyCount if reply
 *   - Notifies post owner (for comment) or comment author (for reply)
 */
import { db } from "@/lib/db";
import { sanitizeText, rateLimit } from "@/utils/validation";
import { ok, fail, unauthorized, notFound } from "@/utils/api-response";
import { getAuth, parseJsonBody } from "@/lib/route-helpers";

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

  const post = await db.post.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!post) return notFound("پست یافت نشد");

  const { user: viewer } = await getAuth(request);

  const [total, comments] = await Promise.all([
    db.comment.count({ where: { postId: id, parentId: null } }),
    db.comment.findMany({
      where: { postId: id, parentId: null },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        content: true,
        likeCount: true,
        replyCount: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        replies: {
          orderBy: { createdAt: "asc" },
          take: 5,
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

  // Map to include likedByMe
  const commentsWithLikeStatus = comments.map((c) => {
    const { likes, replies, ...rest } = c as Record<string, unknown> & {
      likes?: unknown[];
      replies?: Array<Record<string, unknown> & { likes?: unknown[] }>;
    };
    return {
      ...rest,
      likedByMe: Array.isArray(likes) && likes.length > 0,
      replies: Array.isArray(replies)
        ? replies.map((r) => {
            const { likes: rLikes, ...rRest } = r;
            return {
              ...rRest,
              likedByMe: Array.isArray(rLikes) && rLikes.length > 0,
            };
          })
        : [],
    };
  });

  return ok({ comments: commentsWithLikeStatus, total, page, limit });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const rl = rateLimit(`comment:${user.id}`, 20, 60 * 1000);
  if (!rl.ok) {
    return fail("در حال ارسال کامنت‌های زیاد. کمی صبر کنید.", 429);
  }

  const { id } = await params;
  const body = await parseJsonBody<{ content?: string; parentId?: string }>(
    request,
  );
  if (!body) return fail("ورودی نامعتبر است", 400);

  const content = sanitizeText(body.content || "").slice(0, 500);
  if (!content) return fail("متن کامنت الزامی است", 400);

  const post = await db.post.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!post) return notFound("پست یافت نشد");

  // If parentId is provided, verify it belongs to the same post
  let parentComment: { id: string; userId: string } | null = null;
  if (body.parentId) {
    parentComment = await db.comment.findUnique({
      where: { id: body.parentId },
      select: { id: true, userId: true, postId: true },
    });
    if (!parentComment) return notFound("کامنت والد یافت نشد");
    if (parentComment.postId !== id)
      return fail("کامنت والد متعلق به این پست نیست", 400);
  }

  const comment = await db.comment.create({
    data: {
      postId: id,
      userId: user.id,
      content,
      parentId: body.parentId || null,
    },
    select: {
      id: true,
      content: true,
      likeCount: true,
      replyCount: true,
      createdAt: true,
      parentId: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Update counts + notifications
  if (body.parentId && parentComment) {
    // Reply: increment parent's replyCount + notify parent comment author
    await db.comment.update({
      where: { id: body.parentId },
      data: { replyCount: { increment: 1 } },
    });
    // Don't increment post.commentCount for replies (only top-level comments)
    // Notify the parent comment author (if not self)
    if (parentComment.userId !== user.id) {
      try {
        await db.notification.create({
          data: {
            userId: parentComment.userId,
            type: "COMMENT",
            title: "پاسخ جدید به کامنت شما",
            message: `${user.displayName} به کامنت شما پاسخ داد`,
            link: `/post/${id}`,
          },
        });
      } catch {
        // noop
      }
    }
  } else {
    // Top-level comment: increment post.commentCount + notify post owner
    await db.post.update({
      where: { id },
      data: { commentCount: { increment: 1 } },
    });
    if (post.userId !== user.id) {
      try {
        await db.notification.create({
          data: {
            userId: post.userId,
            type: "COMMENT",
            title: "کامنت جدید",
            message: `${user.displayName} روی پست شما کامنت گذاشت`,
            link: `/post/${id}`,
          },
        });
      } catch {
        // noop
      }
    }
  }

  return applyRefresh(ok({ comment }));
}
