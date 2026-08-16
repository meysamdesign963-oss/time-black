import { db } from "@/lib/db";
import { sanitizeText, rateLimit } from "@/utils/validation";
import { ok, fail, unauthorized, notFound } from "@/utils/api-response";
import {
  getAuth,
  parseJsonBody,
  writeAudit,
  getClientIp,
} from "@/lib/route-helpers";

// Spam prevention: 20 follow/unfollow actions per minute per user.
const MAX_FOLLOWS_PER_MIN = 20;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const rl = rateLimit(`follow:${user.id}`, MAX_FOLLOWS_PER_MIN, 60 * 1000);
  if (!rl.ok) {
    return fail("در حال انجام actions زیاد. کمی صبر کنید.", 429, {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  // Parse body (currently unused, but maintains a consistent API surface).
  await parseJsonBody(request);

  const { username } = await params;
  if (!username) return fail("نام کاربری الزامی است", 400);

  const target = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true, username: true },
  });
  if (!target) return notFound("کاربر یافت نشد");
  if (target.id === user.id) return fail("نمی‌توانید خودتان را دنبال کنید", 400);

  const existing = await db.follow.findUnique({
    where: {
      followerId_followeeId: { followerId: user.id, followeeId: target.id },
    },
  });

  let following = false;
  if (existing) {
    await db.follow.delete({ where: { id: existing.id } });
    following = false;
    await writeAudit({
      userId: user.id,
      action: "UNFOLLOW",
      ip: getClientIp(request),
      meta: { targetId: target.id },
    });
  } else {
    await db.follow.create({
      data: { followerId: user.id, followeeId: target.id },
    });
    following = true;
    // Defense-in-depth: re-sanitize displayName in case it was updated since
    // registration without going through sanitizeText.
    const safeName = sanitizeText(user.displayName || user.username);
    await db.notification.create({
      data: {
        userId: target.id,
        type: "SYSTEM",
        title: "دنبال‌کننده جدید",
        message: `${safeName} شما را دنبال کرد`,
        link: `/profile/${user.username}`,
      },
    });
    await writeAudit({
      userId: user.id,
      action: "FOLLOW",
      ip: getClientIp(request),
      meta: { targetId: target.id },
    });
  }

  const res = ok({ following });
  return applyRefresh(res);
}
