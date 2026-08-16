import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  decideRoleForNewUser,
  issueSession,
} from "@/services/auth.service";
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "@/services/cookie.service";
import {
  isValidUsername,
  isValidDisplayName,
  isValidEmail,
  isValidPhone,
  isValidPassword,
  sanitizeText,
  rateLimit,
} from "@/utils/validation";
import { ok, fail } from "@/utils/api-response";
import { writeAudit, getClientIp, parseJsonBody } from "@/lib/route-helpers";

// Account-spam prevention: max 5 registrations per 15 min per IP.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const ip = getClientIp(request) || "unknown";
  const rl = rateLimit(`register:${ip}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!rl.ok) {
    return fail("تلاش بیش از حد برای ثبت‌نام. بعداً تلاش کنید.", 429, {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const body = await parseJsonBody<{
    username?: string;
    displayName?: string;
    phone?: string;
    email?: string;
    password?: string;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const username = (body.username || "").trim().toLowerCase();
  const displayName = sanitizeText(body.displayName || "");
  const phone = (body.phone || "").trim() || undefined;
  const email = (body.email || "").trim().toLowerCase() || undefined;
  const password = body.password || "";

  if (!isValidUsername(username))
    return fail("نام کاربری نامعتبر است (۳ تا ۲۰ حرف انگلیسی، عدد یا زیرخط)", 400);
  if (!isValidDisplayName(displayName))
    return fail("نام نمایشی نامعتبر است", 400);
  if (!isValidPassword(password))
    return fail("رمز عبور باید حداقل ۸ کاراکتر و شامل حرف و عدد باشد", 400);
  if (phone && !isValidPhone(phone))
    return fail("شماره موبایل نامعتبر است", 400);
  if (email && !isValidEmail(email))
    return fail("ایمیل نامعتبر است", 400);

  // uniqueness checks
  try {
    const exists = await db.user.findFirst({
      where: {
        OR: [
          { username },
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
      select: { id: true, username: true, phone: true, email: true },
    });
    if (exists) {
      if (exists.username === username) return fail("نام کاربری قبلاً گرفته شده", 409);
      if (phone && exists.phone === phone) return fail("شماره موبایل قبلاً ثبت شده", 409);
      if (email && exists.email === email) return fail("ایمیل قبلاً ثبت شده", 409);
    }
  } catch {
    return fail("خطا در بررسی اطلاعات. لطفاً دوباره تلاش کنید.", 500);
  }

  const passwordHash = await hashPassword(password);
  let role: string;
  try {
    role = await decideRoleForNewUser();
  } catch {
    return fail("خطا در ایجاد حساب. لطفاً دوباره تلاش کنید.", 500);
  }

  let user;
  try {
    user = await db.user.create({
      data: {
        username,
        displayName,
        phone,
        email,
        passwordHash,
        authMethod: "PASSWORD",
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
        createdAt: true,
      },
    });
  } catch {
    // Unique constraint violation or other DB error — never leak the raw Prisma message.
    return fail("این اطلاعات قبلاً ثبت شده یا نامعتبر است", 409);
  }

  const { accessToken, refreshToken } = await issueSession({
    id: user.id,
    role: user.role,
    username: user.username,
  });

  await writeAudit({
    userId: user.id,
    action: "REGISTER",
    ip: getClientIp(request),
    meta: { username, role },
  });

  const res = NextResponse.json({ ok: true, data: user }, { status: 201 });
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);
  return res;
}

export function GET() {
  return ok({ endpoints: ["POST /api/auth/register"] });
}
