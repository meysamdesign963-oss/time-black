import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueSession, decideRoleForNewUser } from "@/services/auth.service";
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "@/services/cookie.service";
import { isValidPhone, rateLimit } from "@/utils/validation";
import { ok, fail } from "@/utils/api-response";
import { writeAudit, getClientIp, parseJsonBody } from "@/lib/route-helpers";

// Brute-force protection: max 5 verify attempts per 5 min per phone+IP.
// A 5-digit OTP has 100k combinations; this limit makes brute force infeasible.
/** Hash OTP code with SHA-256 for secure comparison */
function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const body = await parseJsonBody<{ phone?: string; code?: string }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const phone = (body.phone || "").trim();
  const code = (body.code || "").trim();

  if (!isValidPhone(phone)) return fail("شماره موبایل نامعتبر است", 400);
  if (!/^\d{5}$/.test(code)) return fail("کد یکبار مصرف نامعتبر است", 400);

  // Rate limit BEFORE hitting the DB so an attacker can't even probe codes.
  const ip = getClientIp(request) || "unknown";
  const rl = rateLimit(`verify-otp:${phone}:${ip}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!rl.ok) {
    return fail("تلاش بیش از حد. بعداً تلاش کنید.", 429, {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const otp = await db.otpCode.findFirst({
    where: {
      phone,
      code: hashOtp(code),
      consumed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return fail("کد یکبار مصرف اشتباه یا منقضی شده", 401);

  await db.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });

  // Find or create user
  let user = await db.user.findUnique({
    where: { phone },
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
    },
  });

  if (!user) {
    const role = await decideRoleForNewUser();
    const baseName = `u_${phone.slice(-7)}`;
    try {
      const created = await db.user.create({
        data: {
          username: baseName,
          displayName: `کاربر ${phone.slice(-4)}`,
          phone,
          authMethod: "OTP",
          role,
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
          totalSeconds: true,
          currentRank: true,
        },
      });
      user = created;
    } catch {
      // Race condition: another request created the user first. Re-fetch.
      const existing = await db.user.findUnique({
        where: { phone },
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
        },
      });
      if (!existing) return fail("خطا در ایجاد حساب. لطفاً دوباره تلاش کنید.", 500);
      user = existing;
    }
  }

  if (user.status === "BLOCKED")
    return fail("حساب شما مسدود شده است", 403);

  const { accessToken, refreshToken } = await issueSession({
    id: user.id,
    role: user.role,
    username: user.username,
  });

  await writeAudit({
    userId: user.id,
    action: "OTP_LOGIN",
    ip: getClientIp(request),
    meta: { phone },
  });

  const res = NextResponse.json({ ok: true, data: user });
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);
  return res;
}

export function GET() {
  return ok({ endpoints: ["POST /api/auth/verify-otp"] });
}
