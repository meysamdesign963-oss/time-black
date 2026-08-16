/**
 * GET  /api/admin/announcements      — list all (including inactive)
 * POST /api/admin/announcements      — create new announcement
 */
import { db } from "@/lib/db";
import { sanitizeText, rateLimit } from "@/utils/validation";
import { ok, fail } from "@/utils/api-response";
import { getAdminAuth, parseJsonBody, writeAudit, getClientIp } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));

  const [total, announcements] = await Promise.all([
    db.announcement.count(),
    db.announcement.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return applyRefresh(ok({ announcements, total, page, limit }));
}

export async function POST(request: Request) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const rl = rateLimit(`announ:${user!.id}`, 10, 60 * 1000);
  if (!rl.ok) return fail("در حال ارسال تعداد زیادی اطلاعیه.", 429);

  const body = await parseJsonBody<{
    title?: string;
    body?: string;
    type?: string;
    active?: boolean;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const title = sanitizeText(body.title || "").slice(0, 200);
  const bodyText = sanitizeText(body.body || "").slice(0, 2000);
  if (!title || !bodyText) return fail("عنوان و متن الزامی است", 400);

  const type =
    body.type === "WARNING" || body.type === "SUCCESS" ? body.type : "INFO";
  const active = body.active !== false;

  const announcement = await db.announcement.create({
    data: {
      title,
      body: bodyText,
      type,
      active,
      createdBy: user!.id,
    },
  });

  await writeAudit({
    userId: user!.id,
    action: "CREATE_ANNOUNCEMENT",
    ip: getClientIp(request),
    meta: { id: announcement.id, title },
  });

  return applyRefresh(ok({ announcement }));
}
