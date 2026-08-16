/**
 * GET  /api/messages/conversations
 * --------------------------------
 * List all conversations for the current user (people they've messaged or
 * received messages from), with the latest message preview + unread count.
 */
import { db } from "@/lib/db";
import { ok, unauthorized } from "@/utils/api-response";
import { getAuth } from "@/lib/route-helpers";

export async function GET(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  // Find all unique conversation partners
  const messages = await db.message.findMany({
    where: {
      OR: [{ senderId: user.id }, { recipientId: user.id }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      senderId: true,
      recipientId: true,
      content: true,
      isRead: true,
      createdAt: true,
    },
  });

  // Group by conversation partner
  const conversationsMap = new Map<
    string,
    {
      partnerId: string;
      partnerUsername: string;
      partnerDisplayName: string;
      partnerAvatarUrl: string | null;
      lastMessage: string;
      lastMessageAt: Date;
      unreadCount: number;
    }
  >();

  // Collect partner IDs
  const partnerIds = new Set<string>();
  for (const m of messages) {
    const partnerId = m.senderId === user.id ? m.recipientId : m.senderId;
    partnerIds.add(partnerId);
  }

  // Fetch partner user info
  const partners = await db.user.findMany({
    where: { id: { in: Array.from(partnerIds) } },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });
  const partnerMap = new Map(partners.map((p) => [p.id, p]));

  for (const m of messages) {
    const partnerId = m.senderId === user.id ? m.recipientId : m.senderId;
    const partner = partnerMap.get(partnerId);
    if (!partner) continue;

    const existing = conversationsMap.get(partnerId);
    if (!existing || existing.lastMessageAt < m.createdAt) {
      conversationsMap.set(partnerId, {
        partnerId,
        partnerUsername: partner.username,
        partnerDisplayName: partner.displayName,
        partnerAvatarUrl: partner.avatarUrl,
        lastMessage: m.content,
        lastMessageAt: m.createdAt,
        unreadCount: 0,
      });
    }
    // Count unread (messages received but not read)
    if (m.recipientId === user.id && !m.isRead) {
      const conv = conversationsMap.get(partnerId)!;
      conv.unreadCount += 1;
    }
  }

  const conversations = Array.from(conversationsMap.values()).sort(
    (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime(),
  );

  return applyRefresh(ok({ conversations }));
}
