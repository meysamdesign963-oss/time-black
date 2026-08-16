/**
 * GET /api/messages/unread-count
 * ------------------------------
 * Returns total unread message count for the current user.
 * Used for the notification badge in the header.
 */
import { db } from "@/lib/db";
import { ok, unauthorized } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const count = await db.message.count({
    where: { recipientId: user.id, isRead: false },
  });

  return applyRefresh(ok({ count }));
}
