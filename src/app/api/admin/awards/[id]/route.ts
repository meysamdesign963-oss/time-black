/**
 * DELETE /api/admin/awards/[id] — remove an award
 */
import { db } from "@/lib/db";
import { ok, notFound } from "@/utils/api-response";
import { getAdminAuth, writeAudit, getClientIp } from "@/lib/route-helpers";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const { id } = await params;
  const award = await db.userAward.findUnique({
    where: { id },
    select: { id: true, title: true, userId: true },
  });
  if (!award) return notFound("جایزه یافت نشد");

  await db.userAward.delete({ where: { id } });

  await writeAudit({
    userId: user.id,
    action: "DELETE_AWARD",
    ip: getClientIp(request),
    meta: { awardId: id, title: award.title },
  });

  return applyRefresh(ok({ ok: true }));
}
