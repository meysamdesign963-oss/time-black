"use client";

/**
 * ExploreView — enhanced content discovery page.
 *
 * Features:
 *  - Sort tabs: newest / popular / most-discussed
 *  - Media filter: all / image / video / text-only
 *  - Tag filter (via URL param "tag:xxx" or sidebar click)
 *  - Trending sidebar: trending posts + trending hashtags
 *  - Infinite scroll (IntersectionObserver)
 *  - Masonry-style responsive grid (1/2/3 cols)
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Heart,
  Loader2,
  TrendingUp,
  Hash,
  Sparkles,
  RefreshCw,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { PostCard, type PostCardPost } from "@/components/common/post-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/utils/api-fetch";
import { toPersianDigits } from "@/utils/persian-date";
import { useRouterStore } from "@/store/router";

type SortKey = "recommended" | "newest" | "popular" | "discussed";
type MediaFilter = "all" | "image" | "video" | "text";

type TrendingResp = {
  trendingPosts: PostCardPost[];
  trendingTags: Array<{ tag: string; count: number }>;
};

const PAGE_SIZE = 12;

const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ElementType }[] = [
  { key: "recommended", label: "پیشنهادی", icon: Sparkles },
  { key: "newest", label: "جدیدترین", icon: TrendingUp },
  { key: "popular", label: "محبوب‌ترین", icon: Heart },
  { key: "discussed", label: "پربحث‌ترین", icon: Hash },
];

const MEDIA_OPTIONS: { key: MediaFilter; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "image", label: "تصاویر" },
  { key: "video", label: "ویدیوها" },
  { key: "text", label: "متنی" },
];

export function ExploreView() {
  const { param, navigate } = useRouterStore();
  // param can be "tag:xxx" when navigated from a hashtag
  const initialTag =
    param && param.startsWith("tag:") ? param.slice(4) : undefined;

  const [sort, setSort] = useState<SortKey>("recommended");
  const [media, setMedia] = useState<MediaFilter>("all");
  const [activeTag, setActiveTag] = useState<string | undefined>(initialTag);
  const [posts, setPosts] = useState<PostCardPost[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [trending, setTrending] = useState<TrendingResp | null>(null);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch trending data once
  useEffect(() => {
    const run = async () => {
      const res = await apiFetch<TrendingResp>("/api/posts/trending");
      if (res.ok && res.data) setTrending(res.data);
    };
    run();
  }, []);

  // Fetch posts when filters change
  const fetchPosts = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      const params = new URLSearchParams({
        sort,
        media,
        page: String(pageNum),
        limit: String(PAGE_SIZE),
      });
      if (activeTag) params.set("tag", activeTag);
      const res = await apiFetch<{ posts: PostCardPost[]; total: number }>(
        `/api/posts?${params.toString()}`,
      );
      if (replace) setLoading(false);
      else setLoadingMore(false);
      if (res.ok && res.data) {
        setPosts((prev) =>
          replace ? res.data!.posts : [...prev, ...res.data!.posts],
        );
        setTotalPages(Math.ceil(res.data.total / PAGE_SIZE));
      } else if (replace) {
        setPosts([]);
      }
    },
    [sort, media, activeTag],
  );

  // Reset to page 1 + fetch when filters change.
  // Use a ref to track filter signature so we don't need setState in effect.
  const filterSig = `${sort}:${media}:${activeTag ?? ""}`;
  const lastFilterRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastFilterRef.current === filterSig) return;
    lastFilterRef.current = filterSig;
    // Defer the fetch to escape the effect body (avoids set-state-in-effect).
    setTimeout(() => fetchPosts(1, true), 0);
  }, [filterSig, fetchPosts]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loadingMore &&
          !loading &&
          page < totalPages
        ) {
          const next = page + 1;
          setPage(next);
          fetchPosts(next, false);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [page, totalPages, loadingMore, loading, fetchPosts]);

  const handleTagClick = (tag: string) => {
    setActiveTag(tag === activeTag ? undefined : tag);
  };

  const handleRefresh = () => {
    setPage(1);
    fetchPosts(1, true);
    toast.success("به‌روزرسانی شد");
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8">
      <PageHeader
        title="اکسپلور"
        description="کشف محتوا و فعالیت کاربران پلتفرم"
        action={
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            به‌روزرسانی
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main feed */}
        <div className="space-y-4">
          {/* Sort tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-secondary/40 p-1">
              {SORT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setSort(opt.key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      sort === opt.key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Media filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Filter className="h-3 w-3" />
              فیلتر:
            </span>
            {MEDIA_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setMedia(opt.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  media === opt.key
                    ? "bg-primary/15 text-primary"
                    : "bg-secondary/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
            {activeTag && (
              <Badge className="bg-primary/15 text-primary">
                <Hash className="h-3 w-3" />
                {activeTag}
                <button
                  onClick={() => setActiveTag(undefined)}
                  className="mr-1 hover:text-primary-foreground"
                >
                  ×
                </button>
              </Badge>
            )}
          </div>

          {/* Posts masonry grid (Pinterest-style) */}
          {loading ? (
            <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton
                  key={i}
                  className="w-full rounded-xl"
                  style={{ height: `${200 + (i % 3) * 80}px` }}
                />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/30 py-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
                <Sparkles className="h-7 w-7" />
              </div>
              <p className="mt-3 font-academic text-base font-bold text-foreground">
                محتوایی یافت نشد
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {activeTag
                  ? `هیچ پستی با هشتگ #${activeTag} وجود ندارد`
                  : "با تغییر فیلترها دوباره امتحان کنید"}
              </p>
            </div>
          ) : (
            <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
              {posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: Math.min(i * 0.03, 0.2),
                    duration: 0.3,
                  }}
                >
                  <PostCard post={post} />
                </motion.div>
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {!loading && page < totalPages && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              {loadingMore ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  برای بارگذاری بیشتر اسکرول کنید…
                </span>
              )}
            </div>
          )}

          {!loading && page >= totalPages && posts.length > 0 && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              به انتهای فید رسیدید
            </div>
          )}
        </div>

        {/* Trending sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Trending tags */}
          <div className="glass rounded-xl border border-border/60 p-4">
            <h3 className="mb-3 flex items-center gap-2 font-academic text-sm font-bold text-foreground">
              <Hash className="h-4 w-4 text-primary" />
              هشتگ‌های داغ
            </h3>
            {trending?.trendingTags && trending.trendingTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {trending.trendingTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => handleTagClick(tag)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs transition-colors",
                      activeTag === tag
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    #{tag}
                    <span className="mr-1 opacity-60">
                      {toPersianDigits(count)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                هنوز هشتگ داغی ثبت نشده است
              </p>
            )}
          </div>

          {/* Trending posts */}
          <div className="glass rounded-xl border border-border/60 p-4">
            <h3 className="mb-3 flex items-center gap-2 font-academic text-sm font-bold text-foreground">
              <TrendingUp className="h-4 w-4 text-primary" />
              پست‌های داغ هفته
            </h3>
            {trending?.trendingPosts && trending.trendingPosts.length > 0 ? (
              <div className="space-y-2">
                {trending.trendingPosts.slice(0, 4).map((post) => (
                  <button
                    key={post.id}
                    onClick={() =>
                      post.slug
                        ? navigate("post", post.slug)
                        : navigate("profile", post.user.username)
                    }
                    className="flex w-full items-start gap-2 rounded-lg p-2 text-right transition-colors hover:bg-secondary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs text-foreground/90">
                        {post.content}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {post.user.displayName} •{" "}
                        {toPersianDigits(post.likeCount)} لایک
                      </p>
                    </div>
                    {post.imageUrl && (
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded">
                        <img
                          src={post.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                هنوز پست داغی وجود ندارد
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default ExploreView;
