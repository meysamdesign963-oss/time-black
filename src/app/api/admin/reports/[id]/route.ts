/**
 * PATCH /api/admin/reports/[id]
 * -----------------------------
 * Update report status, priority, and/or add admin response.
 * body: {
 *   status?: OPEN | IN_PROGRESS | RESOLVED | DISMISSED,
 *   priority?: LOW | NORMAL | HIGH | URGENT,
 *   adminResponse?: string,
 * }
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

const VALID_STATUS = new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"]);
const VALID_PRIORITY = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const { id } = await params;
  const body = await parseJsonBody<{
    status?: string;
    priority?: string;
    adminResponse?: string;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const existing = await db.report.findUnique({ where: { id } });
  if (!existing) return notFound("گزارش یافت نشد");

  const data: Record<string, unknown> = {};
  if (typeof body.status === "string" && VALID_STATUS.has(body.status)) {
    data.status = body.status;
    if (body.status === "RESOLVED" || body.status === "DISMISSED") {
      data.resolvedById = user!.id;
      data.resolvedAt = new Date();
    }
  }
  if (
    typeof body.priority === "string" &&
    VALID_PRIORITY.has(body.priority)
  ) {
    data.priority = body.priority;
  }
  if (typeof body.adminResponse === "string") {
    data.adminResponse = sanitizeText(body.adminResponse).slice(0, 5000) || null;
  }

  if (Object.keys(data).length === 0)
    return fail("هیچ فیلد معتبری ارسال نشده", 400);

  const updated = await db.report.update({
    where: { id },
    data,
    select: {
      id: true,
      type: true,
      subject: true,
      body: true,
      status: true,
      priority: true,
      adminResponse: true,
      resolvedAt: true,
      updatedAt: true,
    },
  });

  // Notify reporter about status change / response
  if (existing.reporterId) {
    try {
      const notifyMsg =
        body.status === "RESOLVED"
          ? "گزارش شما بررسی و حل شد"
          : body.status === "IN_PROGRESS"
            ? "گزارش شما در حال بررسی است"
            : body.adminResponse
              ? "پاسخ جدید به گزارش شما"
              : "گزارش شما به‌روزرسانی شد";
      await db.notification.create({
        data: {
          userId: existing.reporterId,
          type: "SYSTEM",
          title: "به‌روزرسانی گزارش",
          message: notifyMsg,
        },
      });
    } catch {
      // noop
    }
  }

  await writeAudit({
    userId: user!.id,
    action: "UPDATE_REPORT",
    ip: getClientIp(request),
    meta: { reportId: id, fields: Object.keys(data) },
  });

  return applyRefresh(ok({ report: updated }));
}
