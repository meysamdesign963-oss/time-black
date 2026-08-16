import { db } from "@/lib/db";
import { generateOtpCode } from "@/services/auth.service";
import { isValidPhone, rateLimit } from "@/utils/validation";
import { ok, fail } from "@/utils/api-response";
import { parseJsonBody, getClientIp } from "@/lib/route-helpers";

const MAX_ATTEMPTS = 3;
const WINDOW_MS = 5 * 60 * 1000;
const OTP_TTL_MS = 2 * 60 * 1000;

export async function POST(request: Request) {
  const body = await parseJsonBody<{ phone?: string; purpose?: string }>(
    request,
  );
  if (!body) return fail("ورودی نامعتبر است", 400);

  const phone = (body.phone || "").trim();
  const purpose = body.purpose === "REGISTER" ? "REGISTER" : "LOGIN";

  if (!isValidPhone(phone)) return fail("شماره موبایل نامعتبر است", 400);

  // Rate limit on phone+IP: prevents a single attacker from hammering one
  // phone (DoS / harassment) while also preventing rotating-phone SMS spam.
  const ip = getClientIp(request) || "unknown";
  const rl = rateLimit(`otp:${phone}:${ip}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!rl.ok) {
    return fail("تلاش بیش از حد برای ارسال کد. بعداً تلاش کنید.", 429, {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // invalidate previous unconsumed codes for this phone & purpose
  await db.otpCode.updateMany({
    where: { phone, purpose, consumed: false, expiresAt: { gt: new Date() } },
    data: { consumed: true },
  });

  await db.otpCode.create({
    data: { phone, code, purpose, expiresAt },
  });

  const isDev = process.env.NODE_ENV !== "production";
  return ok({
    ok: true,
    delivered: true,
    ...(isDev ? { devCode: code } : {}),
  });
}

export function GET() {
  return ok({ endpoints: ["POST /api/auth/send-otp"] });
}
