"use client";

/**
 * PostCard — shared component for displaying a post with media (image/video),
 * like/comment counts, tags, author info, and repost action.
 *
 * Used by Explore, Profile, Post Detail, and Content views.
 *
 * The whole card is clickable and navigates to the post detail view
 * (via the `navigate("post", post.slug)` router action). Inner buttons
 * stop propagation to avoid triggering the navigation.
 */
import { useState } from "react";
import {
  Heart,
  MessageCircle,
  Eye,
  Video,
  ImageIcon,
  Repeat2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatRelativeTime,
  toPersianDigits,
} from "@/utils/persian-date";
import { apiFetch } from "@/utils/api-fetch";
import { useRouterStore } from "@/store/router";
import { useAuthStore } from "@/store/auth";

export type PostCardPost = {
  id: string;
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
  mediaType: string; // NONE | IMAGE | VIDEO
  tags: string | null;
  likeCount: number;
  commentCount: number;
  viewCount?: number;
  repostCount?: number;
  /** SEO slug — used to navigate to the post detail view. May be null for legacy rows. */
  slug?: string | null;
  createdAt: string;
  likedByMe?: boolean;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

export function PostCard({
  post,
  onLikeChange,
  /** When true, suppresses the click-to-navigate behaviour (used inside detail view). */
  staticLayout,
}: {
  post: PostCardPost;
  onLikeChange?: (postId: string, liked: boolean, count: number) => void;
  staticLayout?: boolean;
}) {
  const navigate = useRouterStore((s) => s.navigate);
  const { user } = useAuthStore();
  const [liked, setLiked] = useState(post.likedByMe ?? false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);
  const [repostBusy, setRepostBusy] = useState(false);

  const tags = post.tags
    ? post.tags.split(",").filter(Boolean).slice(0, 5)
    : [];

  // Determine whether this is the current user's own post
  const isOwn = !!user && user.id === post.user.id;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate("login");
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    // Optimistic
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((c) => c + (newLiked ? 1 : -1));
    const res = await apiFetch<{ liked: boolean; likeCount: number }>(
      `/api/posts/${post.id}/like`,
      { method: "POST" },
    );
    setLikeBusy(false);
    if (res.ok && res.data) {
      setLiked(res.data.liked);
      setLikeCount(res.data.likeCount);
      onLikeChange?.(post.id, res.data.liked, res.data.likeCount);
    } else {
      // Rollback
      setLiked(!newLiked);
      setLikeCount((c) => c + (newLiked ? -1 : 1));
      toast.error(res.error || "خطا در ثبت لایک");
    }
  };

  const handleRepostClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate("login");
      return;
    }
    if (isOwn) return; // Can't repost own post — button is disabled
    // Navigate to post detail where the full repost dialog lives
    if (post.slug) {
      navigate("post", post.slug);
    } else {
      // Legacy post without slug — go to explore
      navigate("explore");
    }
  };

  const handleCardClick = () => {
    if (staticLayout) return;
    if (post.slug) {
      navigate("post", post.slug);
    }
  };

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate("profile", post.user.username);
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    navigate("explore", `tag:${tag}`);
  };

  return (
    <article
      onClick={handleCardClick}
      role={staticLayout ? undefined : "button"}
      tabIndex={staticLayout ? undefined : 0}
      onKeyDown={(e) => {
        if (staticLayout) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className={cn(
        "glass card-lift overflow-hidden rounded-xl border border-border/60",
        !staticLayout &&
          "cursor-pointer transition-shadow hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      )}
    >
      {/* Author header */}
      <div className="flex items-center justify-between gap-2 p-3">
        <button
          onClick={handleAuthorClick}
          className="flex min-w-0 items-center gap-2"
        >
          <Avatar className="h-8 w-8 border border-border">
            <AvatarImage src={post.user.avatarUrl || undefined} />
            <AvatarFallback className="bg-secondary text-xs text-primary">
              {post.user.displayName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-medium text-foreground">
              {post.user.displayName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              @{post.user.username}
            </p>
          </div>
        </button>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatRelativeTime(new Date(post.createdAt))}
        </span>
      </div>

      {/* Media — natural aspect ratio for masonry layout */}
      {post.mediaType === "VIDEO" && post.videoUrl ? (
        <div
          className="w-full bg-black"
          onClick={(e) => e.stopPropagation()}
        >
          <video
            src={post.videoUrl}
            controls
            className="w-full"
            preload="metadata"
          />
        </div>
      ) : post.mediaType === "IMAGE" && post.imageUrl ? (
        <div className="block w-full overflow-hidden bg-secondary/30">
          <img
            src={post.imageUrl}
            alt={post.content.slice(0, 100) || "پست Time Black"}
            loading="lazy"
            className="w-full object-cover transition-transform hover:scale-105"
          />
        </div>
      ) : null}

      {/* Content */}
      <div className="space-y-2 p-3">
        <p
          className={cn(
            "whitespace-pre-wrap text-sm text-foreground/90",
            !staticLayout && "line-clamp-4",
          )}
        >
          {post.content}
        </p>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer text-[10px]"
                onClick={(e) => handleTagClick(e, tag)}
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground sm:gap-4">
            <button
              onClick={handleLike}
              disabled={likeBusy}
              className={cn(
                "flex items-center gap-1 transition-colors hover:text-primary",
                liked && "text-primary",
              )}
            >
              {likeBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Heart
                  className={cn("h-4 w-4", liked && "fill-current")}
                />
              )}
              {toPersianDigits(likeCount)}
            </button>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              {toPersianDigits(post.commentCount)}
            </span>
            {/* Repost button */}
            <button
              onClick={handleRepostClick}
              disabled={isOwn || repostBusy}
              title={
                isOwn
                  ? "نمی‌توانید پست خودتان را ری‌پست کنید"
                  : "ری‌پست"
              }
              className={cn(
                "flex items-center gap-1 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              <Repeat2 className="h-4 w-4" />
              {post.repostCount != null && post.repostCount > 0
                ? toPersianDigits(post.repostCount)
                : "ری‌پست"}
            </button>
            {post.viewCount != null && post.viewCount > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {toPersianDigits(post.viewCount)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {post.mediaType === "VIDEO" && (
              <Badge variant="outline" className="text-[10px]">
                <Video className="h-3 w-3" />
                ویدیو
              </Badge>
            )}
            {post.mediaType === "IMAGE" && (
              <Badge variant="outline" className="text-[10px]">
                <ImageIcon className="h-3 w-3" />
                تصویر
              </Badge>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
