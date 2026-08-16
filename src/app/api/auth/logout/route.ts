import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearTokenCookies } from "@/services/cookie.service";
import { ok, unauthorized } from "@/utils/api-response";
import { getAuth, writeAudit, getClientIp } from "@/lib/route-helpers";

export async function POST(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  // Revoke all active sessions for this user
  await db.session.updateMany({
    where: { userId: user.id, revoked: false },
    data: { revoked: true },
  });

  await writeAudit({
    userId: user.id,
    action: "LOGOUT",
    ip: getClientIp(request),
  });

  const res = NextResponse.json({ ok: true, data: { ok: true } });
  clearTokenCookies(res);
  void applyRefresh;
  return res;
}

export function GET() {
  return ok({ endpoints: ["POST /api/auth/logout"] });
}
