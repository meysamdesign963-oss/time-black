"use client";

/**
 * SearchView — search users / posts / hashtags.
 * Uses leaderboard endpoint for users (filter client-side) and posts endpoint
 * for posts filtering. Hashtag tab is a "coming soon" placeholder.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Hash,
  Heart,
  MessageCircle,
  Search as SearchIcon,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouterStore } from "@/store/router";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatDurationHuman,
  formatRelativeTime,
  toPersianDigits,
} from "@/utils/persian-date";

type LeaderEntry = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  totalSeconds: number;
  taskCount: number;
  rank: number;
  topThree: boolean;
};

type LeaderboardResp = {
  range: string;
  leaderboard: LeaderEntry[];
};

type FeedPost = {
  id: string;
  content: string;
  imageUrl: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

type PostsResp = {
  posts: FeedPost[];
  total: number;
};

export function SearchView() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState<LeaderEntry[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Load all leaderboard (month range) once for client-side user filtering
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingUsers(true);
      const res = await apiFetch<LeaderboardResp>(
        "/api/leaderboard?range=month",
      );
      if (!active) return;
      setUsers(res.ok && res.data?.leaderboard ? res.data.leaderboard : []);
      setLoadingUsers(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Load newest posts (one page) for client-side post filtering
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingPosts(true);
      const res = await apiFetch<PostsResp>(
        "/api/posts?sort=newest&page=1&limit=50",
      );
      if (!active) return;
      setPosts(res.ok && res.data?.posts ? res.data.posts : []);
      setLoadingPosts(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const q = query.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q),
    );
  }, [users, q]);

  const filteredPosts = useMemo(() => {
    if (!q) return posts;
    return posts.filter((p) => p.content.toLowerCase().includes(q));
  }, [posts, q]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="جستجو"
        description="کاربران، پست‌ها و هشتگ‌ها را جستجو کنید"
      />

      {/* Search input */}
      <div className="relative mt-4 w-full">
        <SearchIcon className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="عبارت مورد نظر را وارد کنید..."
          className="h-11 pr-11 text-base"
          autoFocus
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="پاک کردن"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="users">
            <UserIcon className="h-4 w-4" />
            کاربران
          </TabsTrigger>
          <TabsTrigger value="posts">
            <MessageCircle className="h-4 w-4" />
            پست‌ها
          </TabsTrigger>
          <TabsTrigger value="hashtags">
            <Hash className="h-4 w-4" />
            هشتگ‌ها
          </TabsTrigger>
        </TabsList>

        {/* Users tab */}
        <TabsContent value="users" className="mt-4">
          {loadingUsers ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <UserCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <EmptyResult query={query} label="کاربری" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.map((u, i) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                >
                  <UserCard entry={u} />
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Posts tab */}
        <TabsContent value="posts" className="mt-4">
          {loadingPosts ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <PostCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <EmptyResult query={query} label="پستی" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPosts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                >
                  <PostCard post={p} />
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Hashtags tab (placeholder) */}
        <TabsContent value="hashtags" className="mt-4">
          <Card className="border-dashed bg-card/40">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/60">
                <Hash className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-academic text-base font-bold text-foreground">
                  به‌زودی
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  جستجوی پیشرفته بر اساس هشتگ به‌زودی فعال خواهد شد.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserCard({ entry }: { entry: LeaderEntry }) {
  const navigate = useRouterStore((s) => s.navigate);
  return (
    <button
      type="button"
      onClick={() => navigate("profile", entry.username)}
      className="group block w-full text-right transition-transform card-lift"
    >
      <Card className="h-full">
        <CardContent className="flex items-center gap-3 p-4">
          <Avatar className="h-12 w-12 border border-border/60">
            {entry.avatarUrl ? (
              <AvatarImage src={entry.avatarUrl} alt={entry.displayName} />
            ) : null}
            <AvatarFallback className="bg-secondary">
              {entry.displayName?.charAt(0) || "؟"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {entry.displayName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              @{entry.username}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
              <Clock className="h-3 w-3" />
              {formatDurationHuman(entry.totalSeconds)}
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-secondary/60 px-2 py-0.5 text-xs text-foreground">
            رتبه {toPersianDigits(entry.rank)}
          </span>
        </CardContent>
      </Card>
    </button>
  );
}

function PostCard({ post }: { post: FeedPost }) {
  const navigate = useRouterStore((s) => s.navigate);
  return (
    <Card className="card-lift h-full overflow-hidden p-0">
      {post.imageUrl ? (
        <img
          src={post.imageUrl}
          alt=""
          className="h-40 w-full object-cover"
          loading="lazy"
        />
      ) : null}
      <CardContent className="flex flex-col gap-3 p-4">
        <button
          type="button"
          onClick={() => navigate("profile", post.user.username)}
          className="flex items-center gap-2 text-right hover:opacity-80"
        >
          <Avatar className="h-8 w-8 border border-border/60">
            {post.user.avatarUrl ? (
              <AvatarImage src={post.user.avatarUrl} alt={post.user.displayName} />
            ) : null}
            <AvatarFallback className="bg-secondary text-xs">
              {post.user.displayName?.charAt(0) || "؟"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {post.user.displayName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              @{post.user.username} · {formatRelativeTime(new Date(post.createdAt))}
            </p>
          </div>
        </button>
        <p className="line-clamp-3 text-sm text-foreground/90 whitespace-pre-wrap">
          {post.content}
        </p>
        <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {toPersianDigits(post.likeCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {toPersianDigits(post.commentCount)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function UserCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2 w-20" />
          <Skeleton className="h-2 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

function PostCardSkeleton() {
  return (
    <Card className="overflow-hidden p-0">
      <Skeleton className="h-40 w-full rounded-none" />
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2 w-28" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </CardContent>
    </Card>
  );
}

function EmptyResult({ query, label }: { query: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-3 py-12 text-center"
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/60">
        <Users className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-academic text-base font-bold text-foreground">
          نتیجه‌ای یافت نشد
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {query.trim()
            ? `هیچ ${label} برای «${query}» پیدا نشد.`
            : `برای جستجو عبارتی را وارد کنید.`}
        </p>
      </div>
    </motion.div>
  );
}

export default SearchView;
