/**
 * PATCH  /api/admin/announcements/[id]  — update (title/body/type/active)
 * DELETE /api/admin/announcements/[id]  — delete
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const { id } = await params;
  const body = await parseJsonBody<{
    title?: string;
    body?: string;
    type?: string;
    active?: boolean;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) return notFound("اطلاعیه یافت نشد");

  const data: {
    title?: string;
    body?: string;
    type?: string;
    active?: boolean;
  } = {};

  if (typeof body.title === "string") {
    const t = sanitizeText(body.title).slice(0, 200);
    if (!t) return fail("عنوان الزامی است", 400);
    data.title = t;
  }
  if (typeof body.body === "string") {
    const b = sanitizeText(body.body).slice(0, 2000);
    if (!b) return fail("متن الزامی است", 400);
    data.body = b;
  }
  if (body.type === "INFO" || body.type === "WARNING" || body.type === "SUCCESS") {
    data.type = body.type;
  }
  if (typeof body.active === "boolean") {
    data.active = body.active;
  }

  const updated = await db.announcement.update({ where: { id }, data });

  await writeAudit({
    userId: user!.id,
    action: "UPDATE_ANNOUNCEMENT",
    ip: getClientIp(request),
    meta: { id, changes: Object.keys(data) },
  });

  return applyRefresh(ok({ announcement: updated }));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const { id } = await params;
  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) return notFound("اطلاعیه یافت نشد");

  await db.announcement.delete({ where: { id } });

  await writeAudit({
    userId: user!.id,
    action: "DELETE_ANNOUNCEMENT",
    ip: getClientIp(request),
    meta: { id, title: existing.title },
  });

  return applyRefresh(ok({ ok: true }));
}
