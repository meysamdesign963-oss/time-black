/**
 * Tiny helpers for consistent JSON API responses.
 */
import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { ok: false, error: message, ...extra },
    { status },
  );
}

export function unauthorized(message = "احراز هویت نشده‌اید") {
  return fail(message, 401);
}

export function forbidden(message = "دسترسی غیرمجاز") {
  return fail(message, 403);
}

export function notFound(message = "موردی یافت نشد") {
  return fail(message, 404);
}
