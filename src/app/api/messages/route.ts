/**
 * Messages API
 * ------------
 * GET  /api/messages?partnerId=xxx&page=1  — list messages with a partner
 * POST /api/messages                       — send a message
 *    body: { recipientId, content }
 */
import { db } from "@/lib/db";
import { sanitizeText, rateLimit } from "@/utils/validation";
import { ok, fail, unauthorized, notFound, forbidden } from "@/utils/api-response";
import { getAuth, parseJsonBody } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const partnerId = url.searchParams.get("partnerId");
  if (!partnerId) return fail("partnerId الزامی است", 400);

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)),
  );

  // Verify partner exists
  const partner = await db.user.findUnique({
    where: { id: partnerId },
    select: { id: true, status: true },
  });
  if (!partner) return notFound("کاربر یافت نشد");

  const where = {
    OR: [
      { senderId: user.id, recipientId: partnerId },
      { senderId: partnerId, recipientId: user.id },
    ],
  };

  const [total, messages] = await Promise.all([
    db.message.count({ where }),
    db.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        senderId: true,
        recipientId: true,
        content: true,
        isRead: true,
        readAt: true,
        createdAt: true,
      },
    }),
  ]);

  // Mark received messages as read (async, don't block response)
  db.message
    .updateMany({
      where: {
        recipientId: user.id,
        senderId: partnerId,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    })
    .catch(() => {
      // noop
    });

  // Return in chronological order (oldest first)
  const ordered = messages.reverse();

  return applyRefresh(ok({ messages: ordered, total, page, limit }));
}

export async function POST(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  // Rate limit: 30 messages per minute
  const rl = rateLimit(`message:${user.id}`, 30, 60 * 1000);
  if (!rl.ok) {
    return fail("در حال ارسال پیام‌های زیاد. کمی صکر کنید.", 429);
  }

  const body = await parseJsonBody<{ recipientId?: string; content?: string }>(
    request,
  );
  if (!body) return fail("ورودی نامعتبر است", 400);

  const recipientId = body.recipientId || "";
  const content = sanitizeText(body.content || "").slice(0, 2000);
  if (!recipientId) return fail("گیرنده الزامی است", 400);
  if (!content) return fail("متن پیام الزامی است", 400);
  if (recipientId === user.id)
    return fail("نمی‌توانید به خودتان پیام دهید", 400);

  const recipient = await db.user.findUnique({
    where: { id: recipientId },
    select: { id: true, status: true, displayName: true },
  });
  if (!recipient) return notFound("گیرنده یافت نشد");
  if (recipient.status === "BLOCKED")
    return forbidden("این کاربر مسدود شده است");

  const message = await db.message.create({
    data: {
      senderId: user.id,
      recipientId,
      content,
    },
    select: {
      id: true,
      senderId: true,
      recipientId: true,
      content: true,
      isRead: true,
      createdAt: true,
    },
  });

  // Create notification for recipient
  try {
    await db.notification.create({
      data: {
        userId: recipientId,
        type: "SYSTEM",
        title: "پیام جدید",
        message: `${user.displayName} به شما پیام داد`,
        link: `/messages/${user.id}`,
      },
    });
  } catch {
    // noop
  }

  return applyRefresh(ok({ message }));
}
