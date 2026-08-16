import type { Metadata } from "next";
import { db } from "@/lib/db";
import Page from "../../page";

/**
 * /profile/[username] — public user profile (clean URL)
 * SEO: dynamic metadata generated from the user's data (direct DB query).
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  let profile: { displayName: string; bio: string | null; avatarUrl: string | null } | null = null;

  try {
    profile = await db.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { displayName: true, bio: true, avatarUrl: true },
    });
  } catch {
    // DB error — fall back to generic metadata
  }

  if (!profile) {
    return {
      title: "پروفایل یافت نشد | Time Black",
      description: "کاربر مورد نظر یافت نشد.",
    };
  }

  const displayName = profile.displayName || username;
  const bio = profile.bio || `پروفایل ${displayName} در Time Black — فعالیت‌ها، تایم‌ها و پست‌ها`;
  const title = `${displayName} (@${username}) | Time Black`;

  return {
    title,
    description: bio,
    alternates: { canonical: `/profile/${username}` },
    openGraph: {
      title,
      description: bio,
      type: "profile",
      locale: "fa_IR",
      images: profile.avatarUrl ? [{ url: profile.avatarUrl }] : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description: bio,
      images: profile.avatarUrl ? [profile.avatarUrl] : undefined,
    },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <Page initialView="profile" initialParam={username} />;
}
