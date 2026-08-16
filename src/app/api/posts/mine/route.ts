import { db } from "@/lib/db";
import { ok, unauthorized } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const posts = await db.post.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
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
      createdAt: true,
    },
  });

  const res = ok({ posts });
  return applyRefresh(res);
}
