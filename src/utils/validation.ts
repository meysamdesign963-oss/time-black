/**
 * Input validation helpers — strict server-side regex checks
 * to prevent SQLi / XSS and enforce Persian phone + username rules.
 */

/** Persian mobile: must be 11 digits starting with 09 */
export const PHONE_REGEX = /^09\d{9}$/;

/** Username: 3-20 chars, lowercase english letters, digits, underscore */
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

/** Email (google-only enforced at app layer) */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Persian display name: 2-40 chars, Persian letters, spaces, optional digits */
export const DISPLAY_NAME_REGEX = /^[\u0600-\u06FFa-zA-Z\s0-9]{2,40}$/;

/** Password: min 8 chars, at least one letter and one digit */
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function isValidPhone(v: string): boolean {
  return PHONE_REGEX.test(v);
}
export function isValidUsername(v: string): boolean {
  return USERNAME_REGEX.test(v);
}
export function isValidEmail(v: string): boolean {
  return EMAIL_REGEX.test(v);
}
export function isValidDisplayName(v: string): boolean {
  return DISPLAY_NAME_REGEX.test(v);
}
export function isValidPassword(v: string): boolean {
  return PASSWORD_REGEX.test(v);
}

/** Sanitize a free-text string against basic XSS */
export function sanitizeText(v: string): string {
  return v
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

/** Mask an Iranian phone: 0912****567 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 11) return phone;
  return `${phone.slice(0, 4)}****${phone.slice(7)}`;
}

/** Mask an email: a***@example.com */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name[0]}***@${domain}`;
}

/** In-memory rate limiter: max N attempts per window per key */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: maxAttempts - 1, resetAt: now + windowMs };
  }
  if (entry.count >= maxAttempts) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return {
    ok: true,
    remaining: maxAttempts - entry.count,
    resetAt: entry.resetAt,
  };
}
