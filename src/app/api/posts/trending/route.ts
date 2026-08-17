/**
 * GET /api/posts/trending
 * -----------------------
 * Returns trending hashtags + trending posts (most liked in last 7 days).
 * Powers the enhanced Explore page sidebar.
 */
import { db } from "@/lib/db";
import { ok } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user: viewer } = await getAuth(request);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Trending posts (most liked in last 7 days)
  const trendingPosts = await db.post.findMany({
    where: {
      visibility: "PUBLIC",
      status: "PUBLISHED",
      createdAt: { gte: sevenDaysAgo },
      likeCount: { gt: 0 },
    },
    orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
    take: 5,
    select: {
      id: true,
      content: true,
      imageUrl: true,
      videoUrl: true,
      mediaType: true,
      likeCount: true,
      commentCount: true,
      createdAt: true,
      tags: true,
      slug: true,
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

  // All tags from recent posts (last 30 days) — count frequency
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentPosts = await db.post.findMany({
    where: {
      visibility: "PUBLIC",
      status: "PUBLISHED",
      createdAt: { gte: thirtyDaysAgo },
      tags: { not: "" },
    },
    select: { tags: true },
    take: 500,
  });

  // Count tag frequency
  const tagCounts = new Map<string, number>();
  for (const p of recentPosts) {
    if (!p.tags) continue;
    const tags = p.tags.split(",");
    for (const t of tags) {
      const clean = t.trim().toLowerCase();
      if (clean) tagCounts.set(clean, (tagCounts.get(clean) || 0) + 1);
    }
  }
  const trendingTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));

  const postsWithLikeStatus = trendingPosts.map((p) => {
    const { likes, ...rest } = p as Record<string, unknown> & {
      likes?: unknown[];
    };
    return { ...rest, likedByMe: Array.isArray(likes) && likes.length > 0 };
  });

  return ok({ trendingPosts: postsWithLikeStatus, trendingTags });
}
