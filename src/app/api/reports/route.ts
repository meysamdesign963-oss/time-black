/**
 * POST /api/reports
 * -----------------
 * User submits a report/ticket to admin.
 * body: {
 *   type: BUG | ABUSE | SPAM | FEATURE_REQUEST | OTHER | FEEDBACK,
 *   subject: string,
 *   body: string,
 *   reportedUserId?: string,
 *   reportedPostId?: string,
 * }
 */
import { db } from "@/lib/db";
import { sanitizeText, rateLimit } from "@/utils/validation";
import { ok, fail, unauthorized } from "@/utils/api-response";
import { getAuth, parseJsonBody } from "@/lib/route-helpers";

const VALID_TYPES = new Set([
  "BUG",
  "ABUSE",
  "SPAM",
  "FEATURE_REQUEST",
  "OTHER",
  "FEEDBACK",
]);

export async function GET(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  // List reports filed by this user
  const reports = await db.report.findMany({
    where: { reporterId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      subject: true,
      body: true,
      status: true,
      priority: true,
      adminResponse: true,
      createdAt: true,
      resolvedAt: true,
    },
  });

  return applyRefresh(ok({ reports }));
}

export async function POST(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  // Rate limit: 5 reports per hour
  const rl = rateLimit(`report:${user.id}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return fail("در حال ارسال گزارش‌های زیاد. بعداً تلاش کنید.", 429);
  }

  const body = await parseJsonBody<{
    type?: string;
    subject?: string;
    body?: string;
    reportedUserId?: string;
    reportedPostId?: string;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const type = VALID_TYPES.has(body.type || "") ? body.type! : "OTHER";
  const subject = sanitizeText(body.subject || "").slice(0, 200);
  const bodyText = sanitizeText(body.body || "").slice(0, 5000);
  if (!subject) return fail("عنوان الزامی است", 400);
  if (!bodyText) return fail("متن گزارش الزامی است", 400);

  // Verify reported user/post if provided
  if (body.reportedUserId) {
    const target = await db.user.findUnique({
      where: { id: body.reportedUserId },
      select: { id: true },
    });
    if (!target) return fail("کاربر گزارش‌شده یافت نشد", 400);
  }
  if (body.reportedPostId) {
    const target = await db.post.findUnique({
      where: { id: body.reportedPostId },
      select: { id: true },
    });
    if (!target) return fail("پست گزارش‌شده یافت نشد", 400);
  }

  const report = await db.report.create({
    data: {
      reporterId: user.id,
      reportedUserId: body.reportedUserId || null,
      reportedPostId: body.reportedPostId || null,
      type,
      subject,
      body: bodyText,
      status: "OPEN",
      priority: type === "ABUSE" ? "HIGH" : "NORMAL",
    },
  });

  return applyRefresh(ok({ report }));
}
