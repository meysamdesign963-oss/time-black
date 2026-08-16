/**
 * Cookie helpers for auth tokens.
 * HttpOnly + Secure (in production) + SameSite=strict to prevent XSS theft.
 */
import type { NextResponse } from "next/server";

const ACCESS_COOKIE = "accessToken";
const REFRESH_COOKIE = "refreshToken";

const isProd = process.env.NODE_ENV === "production";

export function setAccessTokenCookie(res: NextResponse, token: string) {
  res.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge: 2 * 60, // 2 minutes
    path: "/",
  });
}

export function setRefreshTokenCookie(res: NextResponse, token: string) {
  res.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge: 15 * 24 * 60 * 60, // 15 days
    path: "/",
  });
}

export function clearTokenCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  res.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}

export const ACCESS_COOKIE_NAME = ACCESS_COOKIE;
export const REFRESH_COOKIE_NAME = REFRESH_COOKIE;
