/**
 * POST /api/profile/[username]/reveal-contact
 * -------------------------------------------
 * Canvas security req #5 (Data Masking): the phone/email shown on public
 * profiles is masked by default. To see the full value, a logged-in user
 * must explicitly click "مشاهده" — and that action is recorded in the
 * AuditLog with viewer IP, timestamp, and target user.
 *
 * Returns the unmasked phone/email only to authenticated users.
 */
import { db } from "@/lib/db";
import { rateLimit } from "@/utils/validation";
import { ok, fail, unauthorized, forbidden, notFound } from "@/utils/api-response";
import { getAuth, writeAudit, getClientIp } from "@/lib/route-helpers";

// Sensitive endpoint: limit to 10 reveals per hour per user.
const MAX_REVEALS_PER_HOUR = 10;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { user: viewer, applyRefresh } = await getAuth(request);
  if (!viewer) return unauthorized();

  const rl = rateLimit(`reveal:${viewer.id}`, MAX_REVEALS_PER_HOUR, 60 * 60 * 1000);
  if (!rl.ok) {
    return fail("تعداد درخواست‌های مشاهده اطلاعات تماس بیش از حد بوده است.", 429, {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const { username } = await params;
  const target = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true, username: true, phone: true, email: true, displayName: true },
  });
  if (!target) return notFound("کاربر یافت نشد");

  // Users cannot reveal their own contact via this endpoint (they already see it)
  if (viewer.id === target.id) return forbidden();

  // Authorization: viewer must be following the target user to reveal contact info
  const followRecord = await db.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: viewer.id,
        followingId: target.id,
      },
    },
  });
  if (!followRecord) {
    return forbidden("برای مشاهده اطلاعات تماس باید کاربر را دنبال کنید");
  }

  // Audit trail (canvas req #8)
  await writeAudit({
    userId: viewer.id,
    action: "VIEW_PHONE",
    ip: getClientIp(request),
    meta: {
      targetUserId: target.id,
      targetUsername: target.username,
      targetDisplayName: target.displayName,
    },
  });

  const res = ok({
    phone: target.phone,
    email: target.email,
    revealedAt: new Date().toISOString(),
  });
  return applyRefresh(res);
}
