import { db } from "@/lib/db";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "@/services/token.service";
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "@/services/cookie.service";
import { ok, unauthorized } from "@/utils/api-response";
import { getCurrentUser } from "@/services/auth.service";
import type { NextResponse } from "next/server";

/**
 * Explicit refresh endpoint. Rotates the refresh token: revokes the old
 * session, issues a new access token AND a new refresh token, and persists
 * the new session. The old refresh token becomes invalid immediately.
 */
export async function POST(request: Request) {
  const { user, refreshed, newRefreshToken } = await getCurrentUser(request);
  if (!user) return unauthorized();

  // If getCurrentUser did not rotate (e.g. access token was still valid, or
  // rotation failed mid-way), force a rotation here using the raw refresh
  // token from the cookie. This guarantees a fresh refresh token on every
  // successful call to /api/auth/refresh.
  let finalRefreshToken = newRefreshToken;
  if (!finalRefreshToken) {
    const cookieHeader = request.headers.get("cookie") || "";
    const refreshToken = cookieHeader
      .split("; ")
      .map((c) => c.split("="))
      .find(([k]) => k === "refreshToken")?.[1];
    if (refreshToken) {
      const decoded = verifyRefreshToken(refreshToken);
      const existing = decoded
        ? await db.session.findUnique({ where: { refreshToken } })
        : null;
      if (existing && !existing.revoked && existing.expiresAt > new Date()) {
        const newToken = generateRefreshToken({
          id: user.id,
          username: user.username,
        });
        const decodedNew = verifyRefreshToken(newToken);
        if (decodedNew && decodedNew.exp && decodedNew.jti) {
          try {
            await db.session.update({
              where: { id: existing.id },
              data: { revoked: true },
            });
            await db.session.create({
              data: {
                userId: user.id,
                jti: decodedNew.jti,
                refreshToken: newToken,
                expiresAt: new Date(decodedNew.exp * 1000),
              },
            });
            finalRefreshToken = newToken;
          } catch {
            // race with concurrent rotation — keep existing token
          }
        }
      }
    }
  }

  const res: NextResponse = ok({ user, refreshed: true });
  const newAccessToken = generateAccessToken({
    id: user.id,
    role: user.role,
    username: user.username,
  });
  setAccessTokenCookie(res, newAccessToken);
  if (finalRefreshToken) {
    setRefreshTokenCookie(res, finalRefreshToken);
  }
  return res;
}

export function GET(request: Request) {
  // also allow GET for convenience
  return POST(request);
}
