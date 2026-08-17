import { db } from "@/lib/db";
import { ok, unauthorized, notFound, forbidden } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const notif = await db.notification.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!notif) return forbidden("دسترسی غیرمجاز");
  if (notif.userId !== user.id) return forbidden("دسترسی غیرمجاز");

  await db.notification.update({
    where: { id },
    data: { isRead: true },
  });

  const res = ok({ ok: true });
  return applyRefresh(res);
}
