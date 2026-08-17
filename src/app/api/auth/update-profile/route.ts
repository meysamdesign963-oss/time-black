/**
 * PATCH /api/auth/update-profile
 * ------------------------------
 * Update the current user's profile (displayName, bio, avatarUrl, coverUrl).
 */
import { db } from "@/lib/db";
import { sanitizeText } from "@/utils/validation";
import { ok, fail, unauthorized } from "@/utils/api-response";
import { getAuth, parseJsonBody, writeAudit, getClientIp } from "@/lib/route-helpers";

export async function PATCH(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const body = await parseJsonBody<{
    displayName?: string;
    bio?: string;
    avatarUrl?: string | null;
    coverUrl?: string | null;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const data: Record<string, unknown> = {};

  if (typeof body.displayName === "string") {
    const dn = sanitizeText(body.displayName).slice(0, 40);
    if (!dn || dn.length < 2) return fail("نام نمایشی باید حداقل ۲ کاراکتر باشد", 400);
    data.displayName = dn;
  }
  if (typeof body.bio === "string") {
    data.bio = sanitizeText(body.bio).slice(0, 500) || null;
  }
  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl === null) {
      data.avatarUrl = null;
    } else if (typeof body.avatarUrl === "string") {
      // Accept local uploads or https URLs
      const url = body.avatarUrl.slice(0, 2000);
      if (url.startsWith("/uploads/") || url.startsWith("https://") || url.startsWith("https://")) {
        data.avatarUrl = url;
      }
    }
  }
  if (body.coverUrl !== undefined) {
    if (body.coverUrl === null) {
      data.coverUrl = null;
    } else if (typeof body.coverUrl === "string") {
      const url = body.coverUrl.slice(0, 2000);
      if (url.startsWith("/uploads/") || url.startsWith("https://") || url.startsWith("https://")) {
        data.coverUrl = url;
      }
    }
  }

  if (Object.keys(data).length === 0)
    return fail("هیچ فیلدی برای به‌روزرسانی ارسال نشده", 400);

  const updated = await db.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      phone: true,
      avatarUrl: true,
      coverUrl: true,
      bio: true,
      role: true,
      status: true,
      totalSeconds: true,
      currentRank: true,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "UPDATE_PROFILE",
    ip: getClientIp(request),
    meta: { fields: Object.keys(data) },
  });

  return applyRefresh(ok({ user: updated }));
}
