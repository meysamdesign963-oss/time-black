/**
 * Backfill script — generates English-only SEO slugs for existing posts that have slug=null.
 * Run with: `bun run src/controllers/backfill-slugs.ts`
 */
import { db } from "@/lib/db";
import { generateSlug } from "@/utils/seo";

async function main() {
  const posts = await db.post.findMany({
    where: { slug: null },
    select: { id: true, content: true },
  });
  console.log(`Found ${posts.length} posts without slug`);
  let updated = 0;
  for (const p of posts) {
    const slug = generateSlug(p.content);
    try {
      await db.post.update({ where: { id: p.id }, data: { slug } });
      updated++;
    } catch {
      // slug collision — add more randomness
      const slug2 = generateSlug(p.content + "-" + p.id);
      try {
        await db.post.update({ where: { id: p.id }, data: { slug: slug2 } });
        updated++;
      } catch {
        console.error(`Failed to generate unique slug for post ${p.id}`);
      }
    }
  }
  console.log(`✓ Updated ${updated} posts with English-only slugs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
