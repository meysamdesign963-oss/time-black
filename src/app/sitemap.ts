export const revalidate = 3600; // Re-generate at most once per hour

import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

/**
 * Dynamic sitemap.xml — generated at build/request time.
 * Includes: home, leaderboard, explore, public profiles, public posts.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://timeblack.ir";
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/winners`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/rules`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  // Public user profiles
  const users = await db.user.findMany({
    where: { status: "ACTIVE" },
    select: { username: true, updatedAt: true },
    take: 500,
  });
  const profilePages: MetadataRoute.Sitemap = users.map((u) => ({
    url: `${baseUrl}/profile/${u.username}`,
    lastModified: u.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Public posts with slugs
  const posts = await db.post.findMany({
    where: { visibility: "PUBLIC", status: "PUBLISHED", slug: { not: null } },
    select: { slug: true, updatedAt: true },
    take: 1000,
  });
  const postPages: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${baseUrl}/post/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...profilePages, ...postPages];
}
