/**
 * POST /api/auth/change-password
 * -------------------------------
 * Change the current user's password.
 * Verifies the old password, then sets the new one (bcrypt hashed).
 * Revokes all existing sessions (forces re-login on all devices).
 */
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/services/auth.service";
import { ok, fail, unauthorized } from "@/utils/api-response";
import { getAuth, parseJsonBody, writeAudit, getClientIp } from "@/lib/route-helpers";
import { rateLimit } from "@/utils/validation";

export async function POST(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  // Rate limit: 3 password changes per hour
  const rl = rateLimit(`pwd-change:${user.id}`, 3, 60 * 60 * 1000);
  if (!rl.ok) {
    return fail("تلاش‌های زیادی برای تغییر رمز. بعداً تلاش کنید.", 429);
  }

  const body = await parseJsonBody<{
    currentPassword?: string;
    newPassword?: string;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const currentPassword = body.currentPassword || "";
  const newPassword = body.newPassword || "";

  if (!currentPassword || !newPassword)
    return fail("رمز فعلی و جدید الزامی است", 400);
  if (newPassword.length < 8)
    return fail("رمز جدید باید حداقل ۸ کاراکتر باشد", 400);
  if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword))
    return fail("رمز جدید باید شامل حرف و عدد باشد", 400);

  // Fetch current password hash
  const userWithHash = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!userWithHash?.passwordHash)
    return fail("حساب شما رمز عبور ندارد (احراز هویت OTP)", 400);

  // Verify current password
  const valid = await verifyPassword(currentPassword, userWithHash.passwordHash);
  if (!valid) return fail("رمز عبور فعلی اشتباه است", 401);

  // Hash new password
  const newHash = await hashPassword(newPassword);

  // Update password
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  // Revoke all sessions (force re-login everywhere)
  await db.session.updateMany({
    where: { userId: user.id, revoked: false },
    data: { revoked: true },
  });

  await writeAudit({
    userId: user.id,
    action: "CHANGE_PASSWORD",
    ip: getClientIp(request),
  });

  return applyRefresh(ok({ ok: true }));
}
