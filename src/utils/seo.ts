/**
 * SEO helpers — slug generation, meta description, JSON-LD structured data.
 */

/**
 * Generate a URL-safe slug from text.
 * Preserves Persian/Arabic characters, replaces spaces with dashes.
 * Appends a short random suffix for uniqueness.
 */
export function generateSlug(text: string, suffix: string): string {
  const base = text
    .slice(0, 60)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/[^\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9-]/g, "")
    .toLowerCase();
  return `${base || "post"}-${suffix}`;
}

/**
 * Auto-generate a meta description from post content.
 * Takes first ~155 chars, strips hashtags, trims at word boundary.
 */
export function generateMetaDescription(content: string): string {
  const clean = content
    .replace(/#[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9_]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= 155) return clean;
  const truncated = clean.slice(0, 155);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 100 ? lastSpace : 155)}...`;
}

/**
 * Generate JSON-LD structured data for a post (helps Google understand the content).
 */
export function generatePostJsonLd(post: {
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  user: { displayName: string; username: string };
  slug: string | null;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    headline: post.content.slice(0, 100),
    articleBody: post.content,
    datePublished: post.createdAt,
    author: {
      "@type": "Person",
      name: post.user.displayName,
      alternateName: `@${post.user.username}`,
    },
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: post.likeCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: post.commentCount,
      },
    ],
    ...(post.imageUrl
      ? { image: post.imageUrl, thumbnailUrl: post.imageUrl }
      : {}),
    ...(post.videoUrl ? { video: post.videoUrl } : {}),
    url: `/post/${post.slug || ""}`,
  };
}

/**
 * Generate JSON-LD for a user profile.
 */
export function generateProfileJsonLd(user: {
  displayName: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: user.displayName,
      alternateName: `@${user.username}`,
      description: user.bio || undefined,
      image: user.avatarUrl || undefined,
      dateCreated: user.createdAt,
    },
  };
}

/**
 * Generate JSON-LD for the whole site (Organization).
 */
export function generateSiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Time Black",
    alternateName: "تایم بلک",
    description:
      "پلتفرم رقابت تایم‌محور — تسک‌های خود را تعریف کنید، تایمر را فعال کنید و در رتبه‌بندی ماهانه با دیگران رقابت کنید",
    url: "/",
    potentialAction: {
      "@type": "SearchAction",
      target: "/search?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };
}
