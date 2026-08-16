import { db } from "@/lib/db";
import { sanitizeText } from "@/utils/validation";
import { ok, fail, unauthorized, forbidden, notFound } from "@/utils/api-response";
import {
  getAuth,
  parseJsonBody,
  writeAudit,
  getClientIp,
} from "@/lib/route-helpers";

const VALID_STATUSES = new Set(["ACTIVE", "DONE", "CANCELLED"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const task = await db.task.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      targetSeconds: true,
      status: true,
      totalSeconds: true,
      color: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!task) return notFound("تسک یافت نشد");
  if (task.userId !== user.id) return forbidden();

  const { userId: _u, ...safe } = task;
  void _u;
  const res = ok({ task: safe });
  return applyRefresh(res);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const task = await db.task.findUnique({
    where: { id },
    select: { id: true, userId: true, title: true },
  });
  if (!task) return notFound("تسک یافت نشد");
  if (task.userId !== user.id) return forbidden();

  const body = await parseJsonBody<{
    title?: string;
    description?: string | null;
    targetSeconds?: number;
    color?: string;
    status?: string;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const t = sanitizeText(body.title).slice(0, 100);
    if (!t) return fail("عنوان نمی‌تواند خالی باشد", 400);
    data.title = t;
  }
  if (body.description !== undefined) {
    data.description = body.description
      ? sanitizeText(body.description).slice(0, 1000)
      : null;
  }
  if (typeof body.targetSeconds === "number" && body.targetSeconds >= 0) {
    data.targetSeconds = Math.min(body.targetSeconds, 24 * 3600);
  }
  if (typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)) {
    data.color = body.color;
  }
  if (typeof body.status === "string" && VALID_STATUSES.has(body.status)) {
    data.status = body.status;
  }

  const updated = await db.task.update({
    where: { id },
    data,
    select: {
      id: true,
      title: true,
      description: true,
      targetSeconds: true,
      status: true,
      totalSeconds: true,
      color: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "UPDATE_TASK",
    ip: getClientIp(request),
    meta: { taskId: id, fields: Object.keys(data) },
  });

  const res = ok({ task: updated });
  return applyRefresh(res);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const task = await db.task.findUnique({
    where: { id },
    select: { id: true, userId: true, title: true },
  });
  if (!task) return notFound("تسک یافت نشد");
  if (task.userId !== user.id) return forbidden();

  await db.task.delete({ where: { id } });

  await writeAudit({
    userId: user.id,
    action: "DELETE_TASK",
    ip: getClientIp(request),
    meta: { taskId: id, title: task.title },
  });

  const res = ok({ ok: true });
  return applyRefresh(res);
}
