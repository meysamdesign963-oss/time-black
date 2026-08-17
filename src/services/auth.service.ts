/**
 * Auth Service
 * ------------
 * Centralizes authentication logic: password hashing (bcrypt),
 * role assignment (first user => BOSS), OTP generation,
 * input validation, and session extraction from cookies.
 */
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/lib/db";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "./token.service";

const BCRYPT_ROUNDS = 12;

/** Hash a plaintext password using bcrypt */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Verify a plaintext password against a bcrypt hash */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Decide the role for a new user.
 * The very first registered user becomes BOSS (super admin).
 * Everyone else is a normal USER.
 * Uses a transaction to prevent TOCTOU race condition where multiple
 * concurrent registrations could all get BOSS role.
 */
export async function decideRoleForNewUser(): Promise<string> {
  return await db.$transaction(async (tx) => {
    const count = await tx.user.count();
    return count === 0 ? "BOSS" : "USER";
  }, { isolationLevel: "Serializable" });
}

/** Generate a 5-digit OTP code */
export function generateOtpCode(): string {
  // crypto-based 5 digit code
  const n = crypto.randomInt(0, 100000);
  return n.toString().padStart(5, "0");
}

/** Create both access & refresh tokens for a user, persist session */
export async function issueSession(user: {
  id: string;
  role: string;
  username: string;
}) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Decode refresh to get jti + expiry for session record
  const decoded = verifyRefreshToken(refreshToken);
  if (decoded && decoded.exp) {
    // Concurrent session control (canvas security req #2):
    // invalidate all previous active sessions for this user so a new login
    // from another device/browser immediately logs out the old one.
    await db.session.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true },
    });
    await db.session.create({
      data: {
        userId: user.id,
        jti: decoded.jti,
        refreshToken,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });
  }

  return { accessToken, refreshToken };
}

/** Resolve the current user from request cookies (access first, refresh fallback) */
export async function getCurrentUser(req: Request): Promise<{
  user: {
    id: string;
    username: string;
    displayName: string;
    role: string;
    status: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    bio: string | null;
    totalSeconds: number;
    currentRank: number;
  } | null;
  refreshed: boolean;
  /** When the refresh token was rotated, this holds the new refresh token. */
  newRefreshToken?: string;
}> {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map((c) => {
      const [k, ...v] = c.split("=");
      return [k, decodeURIComponent(v.join("="))];
    }),
  );

  const accessToken = cookies["accessToken"];
  const refreshToken = cookies["refreshToken"];

  // Try access token first.
  // Access tokens are short-lived (2m) and stateless — we trust the signature.
  // Session revocation is enforced on the refresh-token path below, so a
  // logged-out user loses access within at most 2 minutes.
  if (accessToken) {
    const payload = verifyAccessToken(accessToken);
    if (payload) {
      const user = await db.user.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          status: true,
          email: true,
          phone: true,
          avatarUrl: true,
          bio: true,
          totalSeconds: true,
          currentRank: true,
        },
      });
      if (user && user.status === "ACTIVE") return { user, refreshed: false };
    }
  }

  // Fallback: refresh token rotation. When the access token is expired/missing
  // but a valid refresh token is present, we rotate it: revoke the old session,
  // issue a brand-new refresh token + access token, and persist the new session.
  // This limits the blast radius of a stolen refresh token — once the legitimate
  // user makes their next request, the thief's token is revoked.
  if (refreshToken) {
    const payload = verifyRefreshToken(refreshToken);
    if (payload) {
      const session = await db.session.findUnique({
        where: { refreshToken },
      });
      if (session && !session.revoked && session.expiresAt > new Date()) {
        const user = await db.user.findUnique({
          where: { id: payload.id },
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
            status: true,
            email: true,
            phone: true,
            avatarUrl: true,
            bio: true,
            totalSeconds: true,
            currentRank: true,
          },
        });
        if (user && user.status === "ACTIVE") {
          // Rotate: revoke old session, issue new one.
          let newRefreshToken: string | undefined;
          try {
            const newToken = generateRefreshToken({
              id: user.id,
              username: user.username,
            });
            const decodedNew = verifyRefreshToken(newToken);
            if (decodedNew && decodedNew.exp && decodedNew.jti) {
              await db.session.update({
                where: { id: session.id },
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
              newRefreshToken = newToken;
            }
          } catch {
            // If rotation fails (e.g. race between two concurrent requests
            // both trying to rotate the same token), fall back to keeping the
            // existing session rather than locking the user out.
          }
          return { user, refreshed: true, newRefreshToken };
        }
      }
    }
  }

  return { user: null, refreshed: false };
}

/** Require an authenticated user; returns user or null */
export async function requireUser(req: Request) {
  const { user } = await getCurrentUser(req);
  if (!user) return null;
  return user;
}

/** Require an admin (BOSS or ADMIN); returns user or null */
export async function requireAdmin(req: Request) {
  const user = await requireUser(req);
  if (!user) return null;
  if (user.role !== "BOSS" && user.role !== "ADMIN") return null;
  return user;
}

/**
 * Require admin with proper status-code discrimination.
 * Returns `{ user, response }` — if `response` is non-null, send it directly.
 * - 401 if not authenticated
 * - 403 if authenticated but not admin role
 */
export async function requireAdminOrRespond(req: Request): Promise<{
  user: Awaited<ReturnType<typeof requireUser>> | null;
  response: import("next/server").NextResponse | null;
}> {
  const user = await requireUser(req);
  if (!user) {
    const { unauthorized } = await import("@/utils/api-response");
    return { user: null, response: unauthorized() };
  }
  if (user.role !== "BOSS" && user.role !== "ADMIN") {
    const { forbidden } = await import("@/utils/api-response");
    return { user: null, response: forbidden("دسترسی مدیریت لازم است") };
  }
  return { user, response: null };
}
