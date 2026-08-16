/**
 * GET /api/announcements
 * ----------------------
 * Public endpoint: returns active announcements for display to all users.
 */
import { db } from "@/lib/db";
import { ok } from "@/utils/api-response";

export async function GET() {
  const announcements = await db.announcement.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      body: true,
      type: true,
      createdAt: true,
    },
  });
  return ok({ announcements });
}
