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
  const post = await db.post.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true, content: true },
  });
  if (!post) return notFound("پست یافت نشد");

  await db.post.update({
    where: { id },
    data: { status: "HIDDEN" },
  });

  await writeAudit({
    userId: user.id,
    action: "ADMIN_HIDE_POST",
    ip: getClientIp(request),
    meta: { postId: id, ownerId: post.userId, snippet: post.content.slice(0, 80) },
  });

  // notify owner
  await db.notification.create({
    data: {
      userId: post.userId,
      type: "SYSTEM",
      title: "پست شما پنهان شد",
      message: "پست شما توسط مدیریت پنهان شد. در صورت اعتراض با پشتیبانی تماس بگیرید.",
    },
  });

  const res = ok({ ok: true });
  return applyRefresh(res);
}
