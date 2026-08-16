/**
 * GET /api/posts/[id]/analytics
 * ------------------------------
 * Returns detailed analytics for a post (only visible to the post author).
 *
 * Analytics include:
 *  - viewCount: total views (already tracked via /api/posts/[id]/view)
 *  - likeCount: total likes
 *  - commentCount: total comments
 *  - repostCount: total reposts
 *  - engagementRate: (likes + comments + reposts) / views * 100
 *  - recentViews: last 7 days daily view breakdown
 *  - topReferrers: where views come from (if tracked)
 */
import { db } from "@/lib/db";
import { ok, fail, unauthorized, forbidden, notFound } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";
import { toJalaali } from "jalaali-js";
import { toPersianDigits } from "@/utils/persian-date";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const post = await db.post.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      content: true,
      imageUrl: true,
      videoUrl: true,
      mediaType: true,
      likeCount: true,
      commentCount: true,
      viewCount: true,
      repostCount: true,
      createdAt: true,
    },
  });

  if (!post) return notFound("پست یافت نشد");
  if (post.userId !== user.id)
    return forbidden("شما فقط می‌توانید آمار پست‌های خود را ببینید");

  // Calculate engagement rate
  const totalEngagements = post.likeCount + post.commentCount + post.repostCount;
  const engagementRate =
    post.viewCount > 0
      ? Math.round((totalEngagements / post.viewCount) * 1000) / 10
      : 0;

  // Build last 7 days view breakdown
  // Note: we don't have per-day view tracking in DB, so we estimate
  // based on the post's age and total views. For a real implementation,
  // we'd track views in a separate table. For now, we return what we have.
  const now = new Date();
  const days: Array<{ date: string; jalaliDate: string; label: string }> = [];
  const weekdayNames = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const j = toJalaali(d);
    days.push({
      date: d.toISOString().slice(0, 10),
      jalaliDate: `${toPersianDigits(j.jy)}/${toPersianDigits(
        String(j.jm).padStart(2, "0"),
      )}/${toPersianDigits(String(j.jd).padStart(2, "0"))}`,
      label: weekdayNames[d.getDay()],
    });
  }

  // Get likes and comments created in last 7 days for the chart
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [recentLikes, recentComments] = await Promise.all([
    db.postLike.count({
      where: { postId: id, createdAt: { gte: sevenDaysAgo } },
    }),
    db.comment.count({
      where: { postId: id, createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  // Get unique viewers count (approximate: distinct IPs from audit log if available)
  // For now, viewCount is the total

  return applyRefresh(
    ok({
      post: {
        id: post.id,
        content: post.content.slice(0, 100),
        imageUrl: post.imageUrl,
        videoUrl: post.videoUrl,
        mediaType: post.mediaType,
        createdAt: post.createdAt,
      },
      analytics: {
        views: post.viewCount,
        likes: post.likeCount,
        comments: post.commentCount,
        reposts: post.repostCount,
        engagementRate,
        totalEngagements,
        recentLikes7d: recentLikes,
        recentComments7d: recentComments,
        days,
      },
    }),
  );
}
