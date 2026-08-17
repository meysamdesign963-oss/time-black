/**
 * Route helpers — wrap getCurrentUser and apply a new access-token cookie
 * when the session was just refreshed from the refresh token.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/services/auth.service";
import { generateAccessToken } from "@/services/token.service";
import { db } from "@/lib/db";
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "@/services/cookie.service";

type AuthUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>["user"]>;

export async function getAuth(req: Request): Promise<{
  user: AuthUser | null;
  applyRefresh: (res: NextResponse) => NextResponse;
}> {
  const { user, refreshed, newRefreshToken } = await getCurrentUser(req);
  return {
    user,
    applyRefresh: (res: NextResponse) => {
      if (refreshed && user) {
        const token = generateAccessToken({
          id: user.id,
          role: user.role,
          username: user.username,
        });
        setAccessTokenCookie(res, token);
        // Refresh token rotation: persist the new refresh token cookie so the
        // old (possibly stolen) token is invalidated on the next request.
        if (newRefreshToken) {
          setRefreshTokenCookie(res, newRefreshToken);
        }
      }
      return res;
    },
  };
}

/**
 * Admin-gated auth helper with proper status-code discrimination.
 * Returns `{ user, applyRefresh, response }`:
 *  - If `response` is non-null, return it directly (401 or 403).
 *  - If `user` is non-null, the caller is an authenticated admin.
 * `applyRefresh` must be applied to the final response (same as getAuth).
 */
export async function getAdminAuth(req: Request): Promise<{
  user: AuthUser | null;
  applyRefresh: (res: NextResponse) => NextResponse;
  response: NextResponse | null;
}> {
  const { user, applyRefresh } = await getAuth(req);
  if (!user) {
    return {
      user: null,
      applyRefresh,
      response: NextResponse.json(
        { ok: false, error: "احراز هویت نشده‌اید" },
        { status: 401 },
      ),
    };
  }
  if (user.role !== "BOSS" && user.role !== "ADMIN") {
    return {
      user: null,
      applyRefresh,
      response: NextResponse.json(
        { ok: false, error: "دسترسی مدیریت لازم است" },
        { status: 403 },
      ),
    };
  }
  return { user, applyRefresh, response: null };
}

/**
 * Safely parse a JSON body, returning null on failure.
 * Rejects bodies larger than MAX_BODY_BYTES (100 KB) to prevent DoS via
 * huge payloads. Also caps the number of bytes read from the stream so a
 * malicious client cannot keep an idle connection open by streaming forever.
 */
const MAX_BODY_BYTES = 100 * 1024; // 100 KB

export async function parseJsonBody<T = unknown>(
  req: Request,
): Promise<T | null> {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return null;
    }
    // Read with a hard cap; req.text() would otherwise consume the entire stream.
    const reader = req.body?.getReader();
    if (!reader) {
      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) return null;
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    }
    const decoder = new TextDecoder();
    let received = 0;
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        // drain & discard
        try {
          await reader.cancel();
        } catch {
          /* noop */
        }
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Build an AuditLog entry. meta is JSON.stringified. */
export async function writeAudit(opts: {
  userId?: string | null;
  action: string;
  ip?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        action: opts.action,
        ip: opts.ip ?? null,
        meta: opts.meta ? JSON.stringify(opts.meta) : null,
      },
    });
  } catch {
    // audit must never break a request
  }
}

/** Extract client IP from request headers.
 *  Uses the LAST entry in x-forwarded-for (set by trusted reverse proxy).
 *  Validates the extracted IP to prevent IP spoofing attacks.
 */
export function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim());
    const candidate = parts[parts.length - 1] || null;
    if (candidate && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(candidate)) {
      const octets = candidate.split(".").map(Number);
      if (octets.every((o) => o >= 0 && o <= 255)) {
        return candidate;
      }
    }
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(realIp)) {
    const octets = realIp.split(".").map(Number);
    if (octets.every((o) => o >= 0 && o <= 255)) {
      return realIp;
    }
  }
  return null;
}
