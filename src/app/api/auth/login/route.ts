import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, issueSession } from "@/services/auth.service";
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "@/services/cookie.service";
import { rateLimit } from "@/utils/validation";
import { ok, fail } from "@/utils/api-response";
import { writeAudit, getClientIp, parseJsonBody } from "@/lib/route-helpers";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const ip = getClientIp(request) || "unknown";
  const rl = rateLimit(`login:${ip}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!rl.ok) {
    return fail("تلاش‌های ناموفق بیش از حد. بعداً دوباره تلاش کنید.", 429, {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const body = await parseJsonBody<{ identifier?: string; password?: string }>(
    request,
  );
  if (!body) return fail("ورودی نامعتبر است", 400);

  const identifier = (body.identifier || "").trim();
  const password = body.password || "";

  if (!identifier || !password)
    return fail("نام کاربری یا رمز عبور اشتباه است", 401);

  // try username, email, phone
  let user;
  try {
    user = await db.user.findFirst({
      where: {
        OR: [{ username: identifier.toLowerCase() }, ...(identifier.includes("@") ? [{ email: identifier.toLowerCase() }] : []), ...(identifier.startsWith("09") ? [{ phone: identifier }] : [])],
      },
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
        passwordHash: true,
        totalSeconds: true,
        currentRank: true,
      },
    });
  } catch {
    return fail("خطا در ورود. لطفاً دوباره تلاش کنید.", 500);
  }

  if (!user || !user.passwordHash) {
    return fail("نام کاربری یا رمز عبور اشتباه است", 401);
  }
  if (user.status === "BLOCKED") {
    return fail("حساب شما مسدود شده است", 403);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return fail("نام کاربری یا رمز عبور اشتباه است", 401);
  }

  let session;
  try {
    session = await issueSession({
      id: user.id,
      role: user.role,
      username: user.username,
    });
  } catch {
    return fail("خطا در ایجاد نشست. لطفاً دوباره تلاش کنید.", 500);
  }
  const { accessToken, refreshToken } = session;

  await writeAudit({
    userId: user.id,
    action: "LOGIN",
    ip,
    meta: { identifier },
  });

  const { passwordHash: _pw, ...safeUser } = user;
  void _pw;

  const res = NextResponse.json({ ok: true, data: safeUser });
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);
  return res;
}

export function GET() {
  return ok({ endpoints: ["POST /api/auth/login"] });
}
