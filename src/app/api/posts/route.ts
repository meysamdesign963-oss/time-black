/**
 * Posts API
 * ---------
 * GET  /api/posts            — public feed with filters (sort, tag, media, page)
 * POST /api/posts            — create a post (text + optional image/video + tags)
 *
 * Enhanced explore features:
 *  - Filter by media type (all/image/video/text-only)
 *  - Filter by hashtag
 *  - Sort by newest / popular / most-discussed
 *  - Trending tags endpoint at GET /api/posts/trending
 */
import { db } from "@/lib/db";
import { sanitizeText, rateLimit, hasRestriction } from "@/utils/validation";
import { ok, fail, unauthorized, forbidden } from "@/utils/api-response";
import { getAuth, parseJsonBody } from "@/lib/route-helpers";
import { generateSlug } from "@/utils/seo";

const MAX_POSTS_PER_MIN = 10;

/** Accept only http(s) URLs or local /uploads/ paths. */
function isValidMediaUrl(v: string): boolean {
  if (v.length > 2000) return false;
  // Local uploads path
  if (v.startsWith("/uploads/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Extract #hashtags from text, return comma-separated lowercased tags. */
function extractTags(content: string): string {
  // Match # followed by Persian/Arabic letters, latin letters, digits, underscore
  const matches =
    content.match(/#[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9_]+/g) ||
    [];
  const tags = matches
    .map((t) => t.slice(1).toLowerCase())
    .filter((t) => t.length >= 2 && t.length <= 30)
    .slice(0, 10);
  return Array.from(new Set(tags)).join(",");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sortParam = url.searchParams.get("sort") || "recommended";
  const sort =
    sortParam === "popular"
      ? "popular"
      : sortParam === "discussed"
        ? "discussed"
        : sortParam === "recommended"
          ? "recommended"
          : "newest";
  const mediaFilter = url.searchParams.get("media") || "all"; // all|image|video|text
  const tag = url.searchParams.get("tag") || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(url.searchParams.get("limit") || "12", 10)),
  );

  // Build where clause
  const where: Record<string, unknown> = {
    visibility: "PUBLIC",
    status: "PUBLISHED",
  };

  if (mediaFilter === "image") where.mediaType = "IMAGE";
  else if (mediaFilter === "video") where.mediaType = "VIDEO";
  else if (mediaFilter === "text") where.mediaType = "NONE";

  if (tag) {
    // SQLite LIKE for comma-separated tags
    where.tags = { contains: tag.toLowerCase() };
  }

  // Get current user for like status
  const { user: viewer } = await getAuth(request);

  // For "recommended" sort, we fetch more posts and score them with an
  // engagement-weighted algorithm (like Reddit/HN hot ranking), then
  // paginate the sorted result in JavaScript.
  if (sort === "recommended") {
    // Fetch all matching posts (up to 200) for scoring
    const allPosts = await db.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        content: true,
        imageUrl: true,
        videoUrl: true,
        mediaType: true,
        tags: true,
        likeCount: true,
        commentCount: true,
        viewCount: true,
        repostCount: true,
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

    // Calculate engagement score for each post
    const now = Date.now();
    const scored = allPosts.map((p) => {
      const ageHours = (now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
      // Engagement score: weighted sum of interactions
      const engagement =
        p.likeCount * 3 + p.commentCount * 2 + p.repostCount * 4 + p.viewCount * 0.1;
      // Time decay: newer posts get a boost (Hacker News style)
      // score = engagement / (ageHours + 2)^1.5
      const score = engagement / Math.pow(ageHours + 2, 1.5);
      return { ...p, _score: score };
    });

    // Sort by score descending
    scored.sort((a, b) => b._score - a._score);

    const total = scored.length;
    const start = (page - 1) * limit;
    const paginated = scored.slice(start, start + limit);

    // Map to include likedByMe + remove _score
    const postsWithLikeStatus = paginated.map((p) => {
      const { likes, _score, ...rest } = p as Record<string, unknown> & {
        likes?: unknown[];
        _score?: number;
      };
      return { ...rest, likedByMe: Array.isArray(likes) && likes.length > 0 };
    });

    return ok({ posts: postsWithLikeStatus, total, page, limit, sort });
  }

  // Standard sort (newest/popular/discussed) — uses DB orderBy
  const orderBy =
    sort === "popular"
      ? [{ likeCount: "desc" as const }, { createdAt: "desc" as const }]
      : sort === "discussed"
        ? [{ commentCount: "desc" as const }, { createdAt: "desc" as const }]
        : [{ createdAt: "desc" as const }];

  const [total, posts] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
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
        repostCount: true,
        slug: true,
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
    }),
  ]);

  // Map to include `likedByMe` boolean
  const postsWithLikeStatus = posts.map((p) => {
    const { likes, ...rest } = p as Record<string, unknown> & {
      likes?: unknown[];
    };
    return { ...rest, likedByMe: Array.isArray(likes) && likes.length > 0 };
  });

  return ok({ posts: postsWithLikeStatus, total, page, limit, sort });
}

export async function POST(request: Request) {
  const { user, applyRefresh } = await getAuth(request);
  if (!user) return unauthorized();

  // Check post restriction
  const userWithRestrictions = await db.user.findUnique({
    where: { id: user.id },
    select: { restrictions: true },
  });
  if (userWithRestrictions && hasRestriction(userWithRestrictions.restrictions || "", "canPost"))
    return forbidden("شما دسترسی ارسال پست ندارید");

  const rl = rateLimit(`post:${user.id}`, MAX_POSTS_PER_MIN, 60 * 1000);
  if (!rl.ok) {
    return fail("در حال ارسال پست‌های زیاد. کمی صبر کنید.", 429, {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const body = await parseJsonBody<{
    content?: string;
    imageUrl?: string;
    videoUrl?: string;
    mediaType?: string;
    tags?: string[];
    visibility?: string;
    status?: string;
  }>(request);
  if (!body) return fail("ورودی نامعتبر است", 400);

  const content = sanitizeText(body.content || "").slice(0, 2000);
  if (!content) return fail("متن پست الزامی است", 400);

  // Media handling: accept either explicit mediaType or infer from URLs
  const imageUrl =
    typeof body.imageUrl === "string" && isValidMediaUrl(body.imageUrl)
      ? body.imageUrl
      : null;
  const videoUrl =
    typeof body.videoUrl === "string" && isValidMediaUrl(body.videoUrl)
      ? body.videoUrl
      : null;

  let mediaType = "NONE";
  if (videoUrl) mediaType = "VIDEO";
  else if (imageUrl) mediaType = "IMAGE";

  // Tags: extract from content + any explicit tags
  const contentTags = extractTags(content);
  const explicitTags = Array.isArray(body.tags)
    ? body.tags
        .map((t) => sanitizeText(t).toLowerCase())
        .filter((t) => t.length >= 2 && t.length <= 30)
        .slice(0, 10)
    : [];
  const allTags = Array.from(
    new Set([...contentTags.split(",").filter(Boolean), ...explicitTags]),
  ).join(",");

  const visibility = body.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC";
  const status = body.status === "DRAFT" ? "DRAFT" : "PUBLISHED";

  // Generate SEO slug (unique via short ID suffix)
  const tempId = Math.random().toString(36).slice(2, 8);
  const slug = generateSlug(content, tempId);

  const post = await db.post.create({
    data: {
      userId: user.id,
      content,
      imageUrl,
      videoUrl,
      mediaType,
      tags: allTags,
      visibility,
      status,
      slug,
    },
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
      slug: true,
      createdAt: true,
      user: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  const res = ok({ post });
  return applyRefresh(res);
}
