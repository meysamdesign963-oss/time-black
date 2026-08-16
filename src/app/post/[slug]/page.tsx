import type { Metadata } from "next";
import { db } from "@/lib/db";
import Page from "../../page";

/**
 * /post/[slug] — public post detail (clean URL)
 * SEO: dynamic metadata generated from the post's content (direct DB query).
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let post: {
    content: string;
    imageUrl: string | null;
    createdAt: string;
    user: { displayName: string; username: string };
  } | null = null;

  try {
    post = await db.post.findUnique({
      where: { slug },
      select: {
        content: true,
        imageUrl: true,
        createdAt: true,
        user: { select: { displayName: true, username: true } },
      },
    });
  } catch {
    // DB error
  }

  if (!post) {
    return {
      title: "پست یافت نشد | Time Black",
      description: "پست مورد نظر یافت نشد.",
    };
  }

  const content = post.content || "";
  const excerpt = content.length > 155 ? content.slice(0, 155) + "…" : content;
  const authorName = post.user?.displayName || "کاربر Time Black";
  const title = `${excerpt.slice(0, 60)} | Time Black`;

  return {
    title,
    description: excerpt,
    alternates: { canonical: `/post/${slug}` },
    openGraph: {
      title,
      description: excerpt,
      type: "article",
      locale: "fa_IR",
      images: post.imageUrl ? [{ url: post.imageUrl }] : undefined,
      authors: [authorName],
      publishedTime: post.createdAt,
    },
    twitter: {
      card: post.imageUrl ? "summary_large_image" : "summary",
      title,
      description: excerpt,
      images: post.imageUrl ? [post.imageUrl] : undefined,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <Page initialView="post" initialParam={slug} />;
}
