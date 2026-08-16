import { db } from "@/lib/db";
import {
  startOfJalaliMonth,
  startOfJalaliWeek,
} from "@/utils/persian-date";
import { maskPhone, maskEmail } from "@/utils/validation";
import { ok, fail, notFound } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  if (!username) return fail("نام کاربری الزامی است", 400);

  const user = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      role: true,
      phone: true,
      email: true,
      totalSeconds: true,
      currentRank: true,
      prevRank: true,
      createdAt: true,
    },
  });
  if (!user) return notFound("کاربر یافت نشد");

  // Stats: today, week, month totals
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = startOfJalaliWeek(now);
  const monthStart = startOfJalaliMonth(now);

  const [todayAgg, weekAgg, monthAgg, taskCount, postCount, followers, following, recentPosts, awards] =
    await Promise.all([
      db.timeEntry.aggregate({
        where: { userId: user.id, status: "COMPLETED", startedAt: { gte: todayStart } },
        _sum: { durationSec: true },
      }),
      db.timeEntry.aggregate({
        where: { userId: user.id, status: "COMPLETED", startedAt: { gte: weekStart } },
        _sum: { durationSec: true },
      }),
      db.timeEntry.aggregate({
        where: { userId: user.id, status: "COMPLETED", startedAt: { gte: monthStart } },
        _sum: { durationSec: true },
      }),
      db.task.count({ where: { userId: user.id } }),
      db.post.count({ where: { userId: user.id, status: "PUBLISHED", visibility: "PUBLIC" } }),
      db.follow.count({ where: { followeeId: user.id } }),
      db.follow.count({ where: { followerId: user.id } }),
      db.post.findMany({
        where: { userId: user.id, status: "PUBLISHED", visibility: "PUBLIC" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          content: true,
          imageUrl: true,
          likeCount: true,
          commentCount: true,
          createdAt: true,
          slug: true,
        },
      }),
      db.userAward.findMany({
        where: { userId: user.id },
        orderBy: { awardedAt: "desc" },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          period: true,
          rank: true,
          icon: true,
          color: true,
          awardedAt: true,
        },
      }),
    ]);

  // Check if current viewer is following
  const { user: viewer, applyRefresh } = await getAuth(request);
  let isFollowing = false;
  if (viewer && viewer.id !== user.id) {
    const f = await db.follow.findUnique({
      where: {
        followerId_followeeId: { followerId: viewer.id, followeeId: user.id },
      },
    });
    isFollowing = !!f;
  }

  const profile = {
    ...user,
    phone: user.phone ? maskPhone(user.phone) : null,
    email: user.email ? maskEmail(user.email) : null,
    isOwner: !!viewer && viewer.id === user.id,
    isFollowing,
    stats: {
      todaySeconds: todayAgg._sum.durationSec || 0,
      weekSeconds: weekAgg._sum.durationSec || 0,
      monthSeconds: monthAgg._sum.durationSec || 0,
      totalSeconds: user.totalSeconds,
      taskCount,
      postCount,
      followers,
      following,
    },
    recentPosts,
    awards,
  };

  const res = ok({ profile });
  return applyRefresh(res);
}
