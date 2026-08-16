import { db } from "@/lib/db";
import { rateLimit } from "@/utils/validation";
import { ok, fail, unauthorized, notFound } from "@/utils/api-response";
import { getAuth, parseJsonBody } from "@/lib/route-helpers";

// Spam prevention: 10 timer-starts per minute per user.
const MAX_STARTS_PER_MIN = 10;

export async function POST(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const rl = rateLimit(`te-start:${user.id}`, MAX_STARTS_PER_MIN, 60 * 1000);
  if (!rl.ok) {
    return fail("در حال ایجاد رکوردهای زیاد. کمی صبر کنید.", 429, {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const body = await parseJsonBody<{ taskId?: string }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const taskId = (body.taskId || "").trim();
  if (!taskId) return fail("شناسه تسک الزامی است", 400);

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { id: true, userId: true, status: true },
  });
  if (!task) return notFound("تسک یافت نشد");
  if (task.userId !== user.id) return fail("دسترسی غیرمجاز", 403);
  if (task.status !== "ACTIVE") return fail("تسک فعال نیست", 400);

  // Stop any existing RUNNING entry for the user (compute duration, update totals)
  const running = await db.timeEntry.findFirst({
    where: { userId: user.id, status: "RUNNING" },
  });
  if (running) {
    const now = new Date();
    const duration = Math.max(
      0,
      Math.floor((now.getTime() - running.startedAt.getTime()) / 1000),
    );
    await db.timeEntry.update({
      where: { id: running.id },
      data: {
        status: "COMPLETED",
        endedAt: now,
        durationSec: duration,
      },
    });
    await db.task.update({
      where: { id: running.taskId },
      data: { totalSeconds: { increment: duration } },
    });
    await db.user.update({
      where: { id: user.id },
      data: { totalSeconds: { increment: duration } },
    });
  }

  const entry = await db.timeEntry.create({
    data: {
      userId: user.id,
      taskId,
      status: "RUNNING",
    },
    select: {
      id: true,
      taskId: true,
      startedAt: true,
      endedAt: true,
      durationSec: true,
      status: true,
      note: true,
      createdAt: true,
      task: { select: { id: true, title: true, color: true } },
    },
  });

  const res = ok({ entry });
  return applyRefresh(res);
}
