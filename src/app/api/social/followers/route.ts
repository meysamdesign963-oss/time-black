import { db } from "@/lib/db";
import { ok, unauthorized } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const follows = await db.follow.findMany({
    where: { followeeId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      follower: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          currentRank: true,
          totalSeconds: true,
        },
      },
    },
  });

  const res = ok({ followers: follows });
  return applyRefresh(res);
}
