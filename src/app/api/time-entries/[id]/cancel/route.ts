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
    select: { id: true, userId: true, status: true, startedAt: true },
  });
  if (!entry) return notFound("رکورد زمان یافت نشد");
  if (entry.userId !== user.id) return fail("دسترسی غیرمجاز", 403);
  if (entry.status !== "RUNNING") return fail("این رکورد قابل لغو نیست", 400);

  const now = new Date();
  const updated = await db.timeEntry.update({
    where: { id },
    data: {
      status: "CANCELLED",
      endedAt: now,
      durationSec: 0,
    },
    select: {
      id: true,
      taskId: true,
      startedAt: true,
      endedAt: true,
      durationSec: true,
      status: true,
      note: true,
      task: { select: { id: true, title: true, color: true } },
    },
  });

  const res = ok({ entry: updated });
  return applyRefresh(res);
}
