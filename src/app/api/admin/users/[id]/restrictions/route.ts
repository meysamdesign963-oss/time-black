/**
 * PATCH /api/admin/users/[id]/restrictions
 * ----------------------------------------
 * Set per-user restrictions (canPost, canComment, canMessage, canUpload).
 * Stored as JSON string in User.restrictions.
 *
 * body: {
 *   canPost?: boolean,
 *   canComment?: boolean,
 *   canMessage?: boolean,
 *   canUpload?: boolean,
 *   canCreateTask?: boolean,
 *   customNote?: string,
 * }
 */
import { db } from "@/lib/db";
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
  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true, restrictions: true },
  });
  if (!target) return notFound("کاربر یافت نشد");

  // ADMIN cannot restrict BOSS
  if (target.role === "BOSS" && user.role !== "BOSS")
    return fail("شما اجازه محدودسازی مدیر ارشد را ندارید", 403);

  const body = await parseJsonBody<{
    canPost?: boolean;
    canComment?: boolean;
    canMessage?: boolean;
    canUpload?: boolean;
    canCreateTask?: boolean;
    customNote?: string;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  // Parse existing restrictions or start fresh
  let existing: Record<string, unknown> = {};
  try {
    if (target.restrictions) existing = JSON.parse(target.restrictions);
  } catch {
    existing = {};
  }

  // Merge new restrictions
  const updated = { ...existing };
  if (typeof body.canPost === "boolean") updated.canPost = body.canPost;
  if (typeof body.canComment === "boolean") updated.canComment = body.canComment;
  if (typeof body.canMessage === "boolean") updated.canMessage = body.canMessage;
  if (typeof body.canUpload === "boolean") updated.canUpload = body.canUpload;
  if (typeof body.canCreateTask === "boolean")
    updated.canCreateTask = body.canCreateTask;
  if (typeof body.customNote === "string")
    updated.customNote = body.customNote.slice(0, 500);

  await db.user.update({
    where: { id },
    data: { restrictions: JSON.stringify(updated) },
  });

  await writeAudit({
    userId: user.id,
    action: "SET_RESTRICTIONS",
    ip: getClientIp(request),
    meta: { targetId: id, restrictions: updated },
  });

  return applyRefresh(ok({ restrictions: updated }));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const { id } = await params;
  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target) return notFound("کاربر یافت نشد");
  if (target.role === "BOSS" && user.role !== "BOSS")
    return fail("شما اجازه محدودسازی مدیر ارشد را ندارید", 403);

  await db.user.update({
    where: { id },
    data: { restrictions: "" },
  });

  await writeAudit({
    userId: user.id,
    action: "CLEAR_RESTRICTIONS",
    ip: getClientIp(request),
    meta: { targetId: id },
  });

  return applyRefresh(ok({ ok: true }));
}
