/**
 * GET /api/posts/slug/[slug]
 * --------------------------
 * Fetch a single post by its SEO slug (for shareable URLs).
 * Returns the post with author, like status, and repost info.
 */
import { db } from "@/lib/db";
import { ok, notFound } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const { user: viewer, applyRefresh } = await getAuth(request);

  const post = await db.post.findUnique({
    where: { slug },
    select: {
      id: true,
      content: true,
      imageUrl: true,
      videoUrl: true,
      mediaType: true,
      tags: true,
      visibility: true,
      status: true,
      likeCount: true,
      commentCount: true,
      viewCount: true,
      repostCount: true,
      isRepost: true,
      repostOfId: true,
      quoteText: true,
      slug: true,
      metaDescription: true,
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
  });

  if (!post) return notFound("پست یافت نشد");
  if (post.status !== "PUBLISHED" && post.user.id !== viewer?.id) {
    return notFound("پست یافت نشد");
  }

  // If this is a repost, fetch the original post info
  let original = null;
  if (post.isRepost && post.repostOfId) {
    const orig = await db.post.findUnique({
      where: { id: post.repostOfId },
      select: {
        id: true,
        content: true,
        imageUrl: true,
        videoUrl: true,
        mediaType: true,
        tags: true,
        likeCount: true,
        commentCount: true,
        slug: true,
        createdAt: true,
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
    original = orig;
  }

  const { likes, ...rest } = post as Record<string, unknown> & {
    likes?: unknown[];
  };
  const postWithLike = {
    ...rest,
    likedByMe: Array.isArray(likes) && likes.length > 0,
    original,
  };

  return applyRefresh(ok({ post: postWithLike }));
}
