/**
 * GET /api/users/[id]/awards
 * --------------------------
 * Public endpoint: list all awards for a user.
 */
import { db } from "@/lib/db";
import { ok, notFound } from "@/utils/api-response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!user) return notFound("کاربر یافت نشد");

  const awards = await db.userAward.findMany({
    where: { userId: id },
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
  });

  return ok({ awards });
}
