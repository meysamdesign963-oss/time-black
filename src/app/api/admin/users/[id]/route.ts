import { db } from "@/lib/db";
import { hashPassword } from "@/services/auth.service";
import { sanitizeText } from "@/utils/validation";
import { ok, fail, notFound } from "@/utils/api-response";
import {
  getAdminAuth,
  parseJsonBody,
  writeAudit,
  getClientIp,
} from "@/lib/route-helpers";

const VALID_ROLES = new Set(["BOSS", "ADMIN", "USER"]);
const VALID_STATUSES = new Set(["ACTIVE", "BLOCKED"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const { id } = await params;
  const target = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      username: true,
      displayName: true,
      email: true,
      phone: true,
    },
  });
  if (!target) return notFound("کاربر یافت نشد");

  // ADMIN cannot touch BOSS users; only BOSS can
  if (target.role === "BOSS" && user.role !== "BOSS")
    return fail("شما اجازه ویرایش مدیر ارشد را ندارید", 403);

  const body = await parseJsonBody<{
    role?: string;
    status?: string;
    displayName?: string;
    bio?: string;
    email?: string | null;
    phone?: string | null;
    newPassword?: string;
    revokeSessions?: boolean;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const data: Record<string, unknown> = {};

  // Role change
  if (typeof body.role === "string" && VALID_ROLES.has(body.role)) {
    if (body.role === "BOSS" && user.role !== "BOSS")
      return fail("شما اجازه ارتقا به مدیر ارشد را ندارید", 403);
    if (body.role !== "BOSS" && target.id === user.id && user.role === "BOSS") {
      return fail("شما نمی‌توانید نقش مدیر ارشد خودتان را کاهش دهید", 400);
    }
    if (target.role === "BOSS" && body.role !== "BOSS") {
      const bossCount = await db.user.count({ where: { role: "BOSS" } });
      if (bossCount <= 1) return fail("حداقل یک مدیر ارشد باید باقی بماند", 400);
    }
    data.role = body.role;
  }

  // Status change
  if (typeof body.status === "string" && VALID_STATUSES.has(body.status)) {
    if (target.id === user.id && body.status === "BLOCKED")
      return fail("شما نمی‌توانید حساب خودتان را مسدود کنید", 400);
    if (body.status === "BLOCKED" && target.role === "BOSS") {
      const bossCount = await db.user.count({ where: { role: "BOSS" } });
      if (bossCount <= 1) return fail("مسدود کردن تنها مدیر ارشد مجاز نیست", 400);
    }
    data.status = body.status;
    // If blocking, revoke all sessions
    if (body.status === "BLOCKED") {
      await db.session.updateMany({
        where: { userId: id, revoked: false },
        data: { revoked: true },
      });
    }
  }

  // Profile fields
  if (typeof body.displayName === "string") {
    const dn = sanitizeText(body.displayName).slice(0, 40);
    if (dn) data.displayName = dn;
  }
  if (typeof body.bio === "string") {
    data.bio = sanitizeText(body.bio).slice(0, 500) || null;
  }
  if (body.email !== undefined) {
    if (body.email === null) data.email = null;
    else if (typeof body.email === "string") {
      const e = body.email.trim().toLowerCase().slice(0, 200);
      if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) data.email = e;
    }
  }
  if (body.phone !== undefined) {
    if (body.phone === null) data.phone = null;
    else if (typeof body.phone === "string") {
      const p = body.phone.trim().slice(0, 20);
      if (p && /^09\d{9}$/.test(p)) data.phone = p;
    }
  }

  // Password reset
  if (typeof body.newPassword === "string" && body.newPassword.length >= 8 && /(?=.*[A-Za-z])(?=.*\d)/.test(body.newPassword)) {
    data.passwordHash = await hashPassword(body.newPassword);
    // Revoke all sessions for this user
    await db.session.updateMany({
      where: { userId: id, revoked: false },
      data: { revoked: true },
    });
  }

  // Session revocation (without password change)
  if (body.revokeSessions === true) {
    await db.session.updateMany({
      where: { userId: id, revoked: false },
      data: { revoked: true },
    });
  }

  if (Object.keys(data).length === 0 && !body.revokeSessions)
    return fail("هیچ فیلد معتبری برای به‌روزرسانی ارسال نشده", 400);

  const updated = await db.user.update({
    where: { id },
    data,
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      phone: true,
      avatarUrl: true,
      bio: true,
      role: true,
      status: true,
      totalSeconds: true,
      currentRank: true,
      createdAt: true,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "ADMIN_UPDATE_USER",
    ip: getClientIp(request),
    meta: {
      targetId: id,
      fields: Object.keys(data),
      passwordReset: !!body.newPassword,
      sessionsRevoked: body.revokeSessions === true || body.status === "BLOCKED",
    },
  });

  const res = ok({ user: updated });
  return applyRefresh(res);
}
