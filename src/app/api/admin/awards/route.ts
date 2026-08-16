/**
 * Admin Awards API
 * ----------------
 * GET  /api/admin/awards           — list all awards
 * POST /api/admin/awards           — award a user (give prize/badge)
 */
import { db } from "@/lib/db";
import { sanitizeText } from "@/utils/validation";
import { ok, fail, notFound } from "@/utils/api-response";
import {
  getAdminAuth,
  parseJsonBody,
  writeAudit,
  getClientIp,
} from "@/lib/route-helpers";

const VALID_TYPES = new Set([
  "MONTHLY_WINNER",
  "WEEKLY_WINNER",
  "TOP_3",
  "SPECIAL",
  "ACHIEVEMENT",
]);
const VALID_ICONS = new Set(["trophy", "medal", "crown", "star", "award"]);

export async function GET(request: Request) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)),
  );

  const [total, awards] = await Promise.all([
    db.userAward.count(),
    db.userAward.findMany({
      orderBy: { awardedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        period: true,
        rank: true,
        icon: true,
        color: true,
        awardedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    }),
  ]);

  return applyRefresh(ok({ awards, total, page, limit }));
}

export async function POST(request: Request) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const body = await parseJsonBody<{
    userId?: string;
    type?: string;
    title?: string;
    description?: string;
    period?: string;
    rank?: number;
    icon?: string;
    color?: string;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const userId = body.userId || "";
  if (!userId) return fail("کاربر الزامی است", 400);

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, username: true },
  });
  if (!target) return notFound("کاربر یافت نشد");

  const type = VALID_TYPES.has(body.type || "") ? body.type! : "ACHIEVEMENT";
  const title = sanitizeText(body.title || "").slice(0, 200);
  if (!title) return fail("عنوان جایزه الزامی است", 400);

  const description = body.description
    ? sanitizeText(body.description).slice(0, 1000)
    : null;
  const period = body.period
    ? sanitizeText(body.period).slice(0, 20)
    : null;
  const rank =
    typeof body.rank === "number" && body.rank >= 1 && body.rank <= 100
      ? body.rank
      : 1;
  const icon = VALID_ICONS.has(body.icon || "")
    ? body.icon!
    : "trophy";
  const color =
    typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)
      ? body.color
      : "#e0cba8";

  const award = await db.userAward.create({
    data: {
      userId,
      type,
      title,
      description,
      period,
      rank,
      icon,
      color,
      awardedBy: user.id,
    },
  });

  // Create notification for the user
  try {
    await db.notification.create({
      data: {
        userId,
        type: "SYSTEM",
        title: "🎉 جایزه جدید!",
        message: `شما جایزه «${title}» دریافت کردید`,
      },
    });
  } catch {
    // noop
  }

  await writeAudit({
    userId: user.id,
    action: "AWARD_USER",
    ip: getClientIp(request),
    meta: { awardId: award.id, userId, type, title },
  });

  return applyRefresh(ok({ award }));
}
