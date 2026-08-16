import { db } from "@/lib/db";
import { ok, unauthorized } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function POST(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  await db.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });

  const res = ok({ ok: true });
  return applyRefresh(res);
}
