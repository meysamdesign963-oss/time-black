/**
 * Admin Reports API
 * -----------------
 * GET  /api/admin/reports          — list all reports with filters
 * PATCH /api/admin/reports/[id]    — update status, priority, add admin response
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

export async function GET(request: Request) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const type = url.searchParams.get("type") || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)),
  );

  const where: Record<string, unknown> = {};
  if (status && ["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"].includes(status)) {
    where.status = status;
  }
  if (type) where.type = type;

  const [total, reports] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
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
        reporter: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        reportedUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    }),
  ]);

  return applyRefresh(ok({ reports, total, page, limit }));
}
