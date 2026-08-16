/**
 * POST /api/posts/[id]/view
 * -------------------------
 * Increment view count (idempotent per session — uses simple IP+post hash
 * in-memory dedup to prevent artificial inflation).
 */
import { db } from "@/lib/db";
import { ok, notFound } from "@/utils/api-response";
import { getClientIp } from "@/lib/route-helpers";

// Simple in-memory dedup: {ip:postId} -> last viewed timestamp
const viewedRecently = new Map<string, number>();
const DEDUP_WINDOW = 5 * 60 * 1000; // 5 minutes

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ip = getClientIp(request) || "unknown";
  const key = `${ip}:${id}`;
  const now = Date.now();

  // Dedup: don't count repeated views from same IP within 5 minutes
  const lastView = viewedRecently.get(key);
  if (lastView && now - lastView < DEDUP_WINDOW) {
    return ok({ counted: false });
  }
  viewedRecently.set(key, now);

  // Cleanup old entries (prevent memory leak)
  if (viewedRecently.size > 10000) {
    for (const [k, t] of viewedRecently) {
      if (now - t > DEDUP_WINDOW) viewedRecently.delete(k);
    }
  }

  const post = await db.post.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!post) return notFound("پست یافت نشد");

  await db.post.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
  });

  return ok({ counted: true });
}
