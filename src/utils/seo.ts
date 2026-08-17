/**
 * SEO helpers — slug generation, meta description, JSON-LD structured data.
 */

/**
 * Generate a URL-safe, English-only slug for a post.
 * Uses short readable English words + random alphanumeric suffix for uniqueness.
 * No Persian/Arabic characters in URL — better for SEO and shareability.
 *
 * Format:  <word1>-<word2>-<random6>
 * Example:  steady-dawn-x7k2m9
 */
const SLUG_WORDS = [
  "swift","calm","bright","noble","grand","vivid","solid","prime",
  "lunar","solar","ocean","flame","frost","bloom","stone","cloud",
  "amber","coral","cedar","maple","sage","raven","otter","crane",
  "pearl","delta","orbit","pulse","spark","gleam","haze","drift",
  "crest","blaze","dusk","dawn","mist","reef","vale","ridge",
  "haven","quest","forge","realm","vigor","grace","epoch","ember",
  "focus","logic","nexus","pixel","vault","prism","depth","latch",
  "glyph","plume","brisk","novel","quill","trove","pivot","scout",
  "craft","flint","moss","brook","thorn","dune","apex","summit",
  "haste","brave","lucid","crisp","quiet","bold","pure","keen",
  "warm","cool","dark","fair","lush","rich","rare","safe","vast",
  "wild","wise","true","free","just","open","real","deep","high",
];

function pickWords(): string {
  const w1 = SLUG_WORDS[Math.floor(Math.random() * SLUG_WORDS.length)];
  const w2 = SLUG_WORDS[Math.floor(Math.random() * SLUG_WORDS.length)];
  // Avoid duplicate words
  if (w1 === w2) return pickWords();
  return `${w1}-${w2}`;
}

export function generateSlug(_text: string, suffix?: string): string {
  const base = pickWords();
  const rand = suffix || Math.random().toString(36).slice(2, 8);
  return `${base}-${rand}`;
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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://timeblack.ir";
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
    mainEntityOfPage: `${baseUrl}/post/${post.slug || ""}`,
    url: `${baseUrl}/post/${post.slug || ""}`,
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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://timeblack.ir";
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
      url: `${baseUrl}/profile/${user.username}`,
    },
  };
}

/**
 * Generate JSON-LD for the whole site (Organization).
 */
export function generateSiteJsonLd(): Record<string, unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://timeblack.ir";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Time Black",
    alternateName: "تایم بلک",
    description:
      "پلتفرم رقابت تایم‌محور — تسک‌های خود را تعریف کنید، تایمر را فعال کنید و در رتبه‌بندی ماهانه با دیگران رقابت کنید",
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${baseUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
