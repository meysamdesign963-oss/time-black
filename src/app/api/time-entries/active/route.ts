import { db } from "@/lib/db";
import { ok, unauthorized } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const entry = await db.timeEntry.findFirst({
    where: { userId: user.id, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      taskId: true,
      startedAt: true,
      endedAt: true,
      durationSec: true,
      status: true,
      note: true,
      createdAt: true,
      task: {
        select: {
          id: true,
          title: true,
          color: true,
          targetSeconds: true,
          totalSeconds: true,
        },
      },
    },
  });

  const res = ok({ entry });
  return applyRefresh(res);
}
