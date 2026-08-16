/**
 * GET /api/notifications/unread-count
 * -----------------------------------
 * Returns total unread notification count for the current user.
 * Used for the header badge.
 */
import { db } from "@/lib/db";
import { ok, unauthorized } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const count = await db.notification.count({
    where: { userId: user.id, isRead: false },
  });

  return applyRefresh(ok({ count }));
}
