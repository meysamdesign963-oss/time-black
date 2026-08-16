/**
 * JWT Token Service
 * -----------------
 * Generates and verifies access (2m) and refresh (15d) tokens.
 * Mirrors the Express reference from the canvas spec, adapted for Next.js API.
 *
 * Security keys are read from .env:
 *   - Access_Token_Security_Code  (128 chars)
 *   - Refresh_Token_Security_Code (128 chars)
 */
import jwt, { type JwtPayload } from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_SECRET = process.env.Access_Token_Security_Code;
const REFRESH_SECRET = process.env.Refresh_Token_Security_Code;

if (!ACCESS_SECRET || ACCESS_SECRET.length < 32) {
  throw new Error("Access_Token_Security_Code is missing or too short in .env");
}
if (!REFRESH_SECRET || REFRESH_SECRET.length < 32) {
  throw new Error("Refresh_Token_Security_Code is missing or too short in .env");
}

export type AccessTokenPayload = {
  id: string;
  role: string;
  username: string;
  jti: string;
};

export type RefreshTokenPayload = {
  id: string;
  username: string;
  jti: string;
};

/** Create a short-lived access token (2 minutes) */
export function generateAccessToken(user: {
  id: string;
  role: string;
  username: string;
}): string {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      username: user.username,
      jti: crypto.randomUUID(),
    },
    ACCESS_SECRET,
    { expiresIn: "2m" },
  );
}

/** Create a long-lived refresh token (15 days) */
export function generateRefreshToken(user: {
  id: string;
  username: string;
}): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      jti: crypto.randomUUID(),
    },
    REFRESH_SECRET,
    { expiresIn: "15d" },
  );
}

/** Verify an access token; returns the payload or null on failure */
export function verifyAccessToken(
  token: string,
): (JwtPayload & AccessTokenPayload) | null {
  try {
    return jwt.verify(token, ACCESS_SECRET) as JwtPayload & AccessTokenPayload;
  } catch {
    return null;
  }
}

/** Verify a refresh token; returns the payload or null on failure */
export function verifyRefreshToken(
  token: string,
): (JwtPayload & RefreshTokenPayload) | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as JwtPayload &
      RefreshTokenPayload;
  } catch {
    return null;
  }
}
