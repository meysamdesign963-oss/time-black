import { db } from "@/lib/db";
import { sanitizeText } from "@/utils/validation";
import { ok, fail, unauthorized, forbidden, notFound } from "@/utils/api-response";
import { getAuth, writeAudit, getClientIp, parseJsonBody } from "@/lib/route-helpers";

/** Accept only http(s) URLs or local /uploads/ paths. */
function isValidMediaUrl(v: string): boolean {
  if (v.length > 2000) return false;
  if (v.startsWith("/uploads/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function extractTags(content: string): string {
  const matches =
    content.match(/#[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9_]+/g) ||
    [];
  const tags = matches
    .map((t) => t.slice(1).toLowerCase())
    .filter((t) => t.length >= 2 && t.length <= 30)
    .slice(0, 10);
  return Array.from(new Set(tags)).join(",");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { user: viewer, applyRefresh } = await getAuth(request);

  const post = await db.post.findUnique({
    where: { id },
    select: {
      id: true,
      content: true,
      imageUrl: true,
      videoUrl: true,
      mediaType: true,
      tags: true,
      visibility: true,
      status: true,
      likeCount: true,
      commentCount: true,
      viewCount: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      ...(viewer
        ? {
            likes: {
              where: { userId: viewer.id },
              select: { id: true },
              take: 1,
            },
          }
        : {}),
    },
  });
  if (!post) return notFound("پست یافت نشد");
  if (post.status !== "PUBLISHED" && post.user.id !== viewer?.id) {
    return notFound("پست یافت نشد");
  }

  const { likes, ...rest } = post as Record<string, unknown> & {
    likes?: unknown[];
  };
  const postWithLike = {
    ...rest,
    likedByMe: Array.isArray(likes) && likes.length > 0,
  };

  return applyRefresh(ok({ post: postWithLike }));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await parseJsonBody<{
    content?: string;
    imageUrl?: string | null;
    videoUrl?: string | null;
    mediaType?: string;
    tags?: string[];
    visibility?: string;
    status?: string;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const post = await db.post.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!post) return notFound("پست یافت نشد");
  if (post.userId !== user.id) return forbidden();

  const data: {
    content?: string;
    imageUrl?: string | null;
    videoUrl?: string | null;
    mediaType?: string;
    tags?: string;
    visibility?: string;
    status?: string;
  } = {};

  if (typeof body.content === "string") {
    const c = sanitizeText(body.content).slice(0, 2000);
    if (!c) return fail("متن پست الزامی است", 400);
    data.content = c;
    // Re-extract tags from new content
    const contentTags = extractTags(c);
    const explicitTags = Array.isArray(body.tags)
      ? body.tags
          .map((t) => sanitizeText(t).toLowerCase())
          .filter((t) => t.length >= 2 && t.length <= 30)
          .slice(0, 10)
      : [];
    data.tags = Array.from(
      new Set([...contentTags.split(",").filter(Boolean), ...explicitTags]),
    ).join(",");
  }
  if (body.imageUrl !== undefined) {
    data.imageUrl =
      typeof body.imageUrl === "string" && isValidMediaUrl(body.imageUrl)
        ? body.imageUrl
        : null;
  }
  if (body.videoUrl !== undefined) {
    data.videoUrl =
      typeof body.videoUrl === "string" && isValidMediaUrl(body.videoUrl)
        ? body.videoUrl
        : null;
  }
  // Recompute mediaType if media changed
  if (body.imageUrl !== undefined || body.videoUrl !== undefined) {
    const finalVideo = data.videoUrl !== undefined ? data.videoUrl : null;
    const finalImage = data.imageUrl !== undefined ? data.imageUrl : null;
    data.mediaType = finalVideo ? "VIDEO" : finalImage ? "IMAGE" : "NONE";
  }
  if (body.visibility === "PRIVATE" || body.visibility === "PUBLIC") {
    data.visibility = body.visibility;
  }
  if (body.status === "PUBLISHED" || body.status === "DRAFT") {
    data.status = body.status;
  }

  const updated = await db.post.update({
    where: { id },
    data,
    select: {
      id: true,
      content: true,
      imageUrl: true,
      videoUrl: true,
      mediaType: true,
      tags: true,
      visibility: true,
      status: true,
      likeCount: true,
      commentCount: true,
      viewCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const res = ok({ post: updated });
  return applyRefresh(res);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const post = await db.post.findUnique({
    where: { id },
    select: { id: true, userId: true, content: true },
  });
  if (!post) return notFound("پست یافت نشد");
  if (post.userId !== user.id) return forbidden();

  await db.post.delete({ where: { id } });

  await writeAudit({
    userId: user.id,
    action: "DELETE_POST",
    ip: getClientIp(request),
    meta: { postId: id, snippet: post.content.slice(0, 80) },
  });

  const res = ok({ ok: true });
  return applyRefresh(res);
}
