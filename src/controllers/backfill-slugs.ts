/**
 * Backfill script — generates SEO slugs for existing posts that have slug=null.
 * Run with: `bun run src/controllers/backfill-slugs.ts`
 */
import { db } from "@/lib/db";

function slugify(text: string, id: string): string {
  // Take first 40 chars, keep Persian letters + latin + digits, replace spaces with -
  const base = text
    .slice(0, 60)
    .trim()
    .replace(/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9]+/g, (m) => m)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF-]/g, "")
    .toLowerCase();
  // Append short ID suffix for uniqueness
  return `${base || "post"}-${id.slice(-6)}`;
}

async function main() {
  const posts = await db.post.findMany({
    where: { slug: null },
    select: { id: true, content: true },
  });
  console.log(`Found ${posts.length} posts without slug`);
  let updated = 0;
  for (const p of posts) {
    const slug = slugify(p.content, p.id);
    try {
      await db.post.update({ where: { id: p.id }, data: { slug } });
      updated++;
    } catch (e) {
      // slug collision — add more of the ID
      const slug2 = `post-${p.id.slice(-10)}`;
      await db.post.update({ where: { id: p.id }, data: { slug: slug2 } });
      updated++;
    }
  }
  console.log(`✓ Updated ${updated} posts with slugs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
