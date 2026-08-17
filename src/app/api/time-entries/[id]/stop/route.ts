import { db } from "@/lib/db";
import { ok, fail, unauthorized, notFound } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const entry = await db.timeEntry.findUnique({
    where: { id },
    select: { id: true, userId: true, taskId: true, startedAt: true, status: true },
  });
  if (!entry) return notFound("رکورد زمان یافت نشد");
  if (entry.userId !== user.id) return fail("دسترسی غیرمجاز", 403);
  if (entry.status !== "RUNNING") return fail("این رکورد از قبل متوقف شده", 400);

  const now = new Date();
  const duration = Math.max(
    0,
    Math.floor((now.getTime() - entry.startedAt.getTime()) / 1000),
  );

  // Atomic: update entry + increment task + increment user in transaction
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.timeEntry.update({
      where: { id },
      data: { status: "COMPLETED", endedAt: now, durationSec: duration },
      select: {
        id: true, taskId: true, startedAt: true, endedAt: true,
        durationSec: true, status: true, note: true,
        task: { select: { id: true, title: true, color: true } },
      },
    });
    await tx.task.update({
      where: { id: entry.taskId },
      data: { totalSeconds: { increment: duration } },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { totalSeconds: { increment: duration } },
    });
    return u;
  });

  return applyRefresh(ok({ entry: updated, durationSec: duration }));
}
