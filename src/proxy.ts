/**
 * Next.js Proxy (formerly Middleware) — security headers.
 * -------------------------------------------------------
 * Adds baseline browser-security headers to every response.
 *
 * In Next.js 16, `middleware.ts` was renamed to `proxy.ts`.
 * This file serves the same purpose: intercept every request and
 * attach security headers before the response is sent.
 *
 * CSP note: In development mode, Next.js requires `'unsafe-inline'` for
 * scripts (hydration data, HMR client, React Refresh runtime). In
 * production, we tighten the policy to block inline scripts.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isDev = process.env.NODE_ENV !== "production";

export function proxy(_req: NextRequest) {
  const res = NextResponse.next();

  // Prevent clickjacking — never allow this site in an <iframe>.
  res.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME-type sniffing.
  res.headers.set("X-Content-Type-Options", "nosniff");

  // Control referrer information leakage.
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Force HTTPS for 1 year (including subdomains).
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );

  // Disable Flash/PDF cross-domain policies (legacy, but cheap to set).
  res.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  // Permissions Policy: lock down powerful APIs.
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );

  // Content-Security-Policy.
  // In dev mode, Next.js requires broad permissions for HMR + hydration.
  // In production, we tighten the policy.
  if (isDev) {
    // Dev: permissive CSP to avoid blocking Next.js dev tools
    res.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "connect-src 'self' ws: wss: http: https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
  } else {
    // Prod: stricter CSP
    res.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
  }

  return res;
}

export const config = {
  // Apply to all routes except static asset paths.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.svg).*)",
  ],
};
