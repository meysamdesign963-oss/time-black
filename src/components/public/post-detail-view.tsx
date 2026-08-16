"use client";

/**
 * PostDetailView — full post page (single-route SPA view: view === "post").
 *
 * Triggered when useRouterStore().view === "post" with param = post slug.
 *
 * Layout:
 *  - Back button (returns to explore or profile)
 *  - If repost: reposter banner + optional quote + original PostCard
 *    Else: the post itself as a PostCard (staticLayout)
 *  - Repost action button (with optional quote dialog) + undo
 *  - Comments section: input + paginated list with nested replies
 *  - SEO: sets document.title to first 60 chars + " | Time Black"
 *
 * Handles:
 *  - Null/missing slug → redirect to explore with toast
 *  - Loading + not-found + error states
 *  - Optimistic like toggles for comments (with rollback)
 *  - Inline reply input + "load more replies"
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  MessageSquareOff,
  Repeat2,
  Reply,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouterStore } from "@/store/router";
import { useAuthStore } from "@/store/auth";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatPersianDate,
  formatRelativeTime,
  toPersianDigits,
} from "@/utils/persian-date";
import { PostCard, type PostCardPost } from "@/components/common/post-card";
import { cn } from "@/lib/utils";

// ---------- Types ----------
type PostUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type PostDetail = {
  id: string;
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
  mediaType: string;
  tags: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  repostCount: number;
  isRepost: boolean;
  repostOfId: string | null;
  quoteText: string | null;
  slug: string | null;
  createdAt: string;
  user: PostUser;
  likedByMe: boolean;
  original: (PostCardPost & { repostCount?: number }) | null;
};

type CommentUser = PostUser;

type Reply = {
  id: string;
  content: string;
  likeCount: number;
  createdAt: string;
  likedByMe: boolean;
  user: CommentUser;
};

type Comment = {
  id: string;
  content: string;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  likedByMe: boolean;
  user: CommentUser;
  replies: Reply[];
};

// ---------- Helpers ----------

/** Format the page <title> for SEO. */
function buildPostTitle(content: string): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  const slice = trimmed.slice(0, 60);
  return `${slice}${trimmed.length > 60 ? "…" : ""} | Time Black`;
}

// ---------- Main View ----------

export function PostDetailView() {
  const slug = useRouterStore((s) => s.param);
  const navigate = useRouterStore((s) => s.navigate);
  const back = useRouterStore((s) => s.back);
  const { user } = useAuthStore();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  // Repost state
  const [repostOpen, setRepostOpen] = useState(false);
  const [repostQuote, setRepostQuote] = useState("");
  const [repostBusy, setRepostBusy] = useState(false);
  // Whether the current user has already reposted THIS post.
  // The GET endpoint doesn't include this flag, so we discover it lazily
  // when the user attempts to repost (or after a successful repost).
  const [repostedByMe, setRepostedByMe] = useState(false);

  // Track the current slug so we can refetch when it changes (e.g. when
  // navigating from one post detail to another via a related link).
  const lastSlugRef = useRef<string | null>(null);

  // Fetch post by slug (or bail out if slug is null/empty)
  useEffect(() => {
    let active = true;
    (async () => {
      if (!slug) {
        // No slug — old post or bad navigation
        setNotFound(true);
        setLoading(false);
        toast.error("این پست قابل دسترس نیست");
        // Defer navigation to escape the effect body
        setTimeout(() => navigate("explore"), 0);
        return;
      }
      // Same slug — no-op
      if (lastSlugRef.current === slug) return;
      lastSlugRef.current = slug;

      setLoading(true);
      setNotFound(false);
      setPost(null);
      setComments([]);
      setCommentsTotal(0);
      setCommentsLoading(true);
      setRepostedByMe(false);

      const res = await apiFetch<{ post: PostDetail }>(
        `/api/posts/slug/${encodeURIComponent(slug)}`,
      );
      if (!active) return;
      if (res.ok && res.data?.post) {
        setPost(res.data.post);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [slug, navigate]);

  // SEO: set document.title once we have the post content
  useEffect(() => {
    if (!post) return;
    // Use original post content for SEO when this is a repost
    const contentForTitle = post.isRepost && post.original
      ? post.original.content
      : post.content;
    if (typeof document !== "undefined") {
      document.title = buildPostTitle(contentForTitle);
    }
    return () => {
      // Reset to a sensible default when leaving the view
      if (typeof document !== "undefined") {
        document.title = "Time Black";
      }
    };
  }, [post]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!post) return;
    setCommentsLoading(true);
    const res = await apiFetch<{ comments: Comment[]; total: number }>(
      `/api/posts/${post.id}/comments?page=1&limit=50`,
    );
    setCommentsLoading(false);
    if (res.ok && res.data) {
      setComments(res.data.comments);
      setCommentsTotal(res.data.total);
    } else {
      setComments([]);
      setCommentsTotal(0);
    }
  }, [post]);

  useEffect(() => {
    if (!post) return;
    // Defer to escape the effect body (avoids set-state-in-effect lint error).
    const t = setTimeout(() => {
      fetchComments();
    }, 0);
    return () => clearTimeout(t);
  }, [post, fetchComments]);

  // ---------- Handlers ----------

  const handleBack = () => {
    // Try to go back in history; if no history, fall back to explore
    const hist = useRouterStore.getState().history;
    if (hist.length > 0) {
      back();
      return;
    }
    navigate("explore");
  };

  const handleCommentSubmit = async () => {
    if (!user) {
      toast.info("برای کامنت گذاشتن وارد شوید");
      navigate("login");
      return;
    }
    const text = commentText.trim();
    if (!text) {
      toast.error("متن کامنت الزامی است");
      return;
    }
    if (!post) return;
    setCommentBusy(true);
    const res = await apiFetch<{ comment: Comment }>(
      `/api/posts/${post.id}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ content: text }),
      },
    );
    setCommentBusy(false);
    if (res.ok && res.data?.comment) {
      // Optimistic prepend
      setComments((prev) => [res.data!.comment, ...prev]);
      setCommentsTotal((n) => n + 1);
      setCommentText("");
      toast.success("کامنت ثبت شد");
      // Update post's commentCount locally
      setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
    } else {
      toast.error(res.error || "خطا در ثبت کامنت");
    }
  };

  const handleReplySubmit = async (parentId: string, text: string): Promise<boolean> => {
    if (!user) {
      toast.info("برای پاسخ دادن وارد شوید");
      navigate("login");
      return false;
    }
    if (!post) return false;
    if (!text.trim()) {
      toast.error("متن پاسخ الزامی است");
      return false;
    }
    const res = await apiFetch<{ comment: Reply & { parentId: string } }>(
      `/api/posts/${post.id}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ content: text.trim(), parentId }),
      },
    );
    if (res.ok && res.data?.comment) {
      const reply: Reply = {
        id: res.data.comment.id,
        content: res.data.comment.content,
        likeCount: res.data.comment.likeCount,
        createdAt: res.data.comment.createdAt,
        likedByMe: res.data.comment.likedByMe,
        user: res.data.comment.user,
      };
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? {
                ...c,
                replies: [...c.replies, reply],
                replyCount: c.replyCount + 1,
              }
            : c,
        ),
      );
      toast.success("پاسخ ثبت شد");
      return true;
    }
    toast.error(res.error || "خطا در ثبت پاسخ");
    return false;
  };

  // Like a comment (top-level) — optimistic
  const handleCommentLike = async (commentId: string) => {
    if (!user) {
      toast.info("برای لایک کردن وارد شوید");
      navigate("login");
      return;
    }
    // Snapshot for rollback
    const snapshot = comments;
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              likedByMe: !c.likedByMe,
              likeCount: c.likeCount + (c.likedByMe ? -1 : 1),
            }
          : c,
      ),
    );
    const res = await apiFetch<{ liked: boolean; likeCount: number }>(
      `/api/comments/${commentId}/like`,
      { method: "POST" },
    );
    if (!res.ok || !res.data) {
      setComments(snapshot);
      toast.error(res.error || "خطا در ثبت لایک");
    } else {
      // Reconcile with server-returned values
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                likedByMe: res.data!.liked,
                likeCount: res.data!.likeCount,
              }
            : c,
        ),
      );
    }
  };

  // Like a reply — optimistic
  const handleReplyLike = async (
    commentId: string,
    replyId: string,
  ) => {
    if (!user) {
      toast.info("برای لایک کردن وارد شوید");
      navigate("login");
      return;
    }
    const snapshot = comments;
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              replies: c.replies.map((r) =>
                r.id === replyId
                  ? {
                      ...r,
                      likedByMe: !r.likedByMe,
                      likeCount: r.likeCount + (r.likedByMe ? -1 : 1),
                    }
                  : r,
              ),
            }
          : c,
      ),
    );
    const res = await apiFetch<{ liked: boolean; likeCount: number }>(
      `/api/comments/${replyId}/like`,
      { method: "POST" },
    );
    if (!res.ok || !res.data) {
      setComments(snapshot);
      toast.error(res.error || "خطا در ثبت لایک");
    } else {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                replies: c.replies.map((r) =>
                  r.id === replyId
                    ? {
                        ...r,
                        likedByMe: res.data!.liked,
                        likeCount: res.data!.likeCount,
                      }
                    : r,
                ),
              }
            : c,
        ),
      );
    }
  };

  // Load more replies for a comment (when replyCount > 5)
  const handleLoadMoreReplies = async (commentId: string) => {
    const res = await apiFetch<{ replies: Reply[]; total: number }>(
      `/api/comments/${commentId}/replies?page=1&limit=50`,
    );
    if (res.ok && res.data) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                replies: res.data!.replies,
                // We can't easily track "loaded all" flag here, but replyCount
                // already reflects the total — if it equals replies.length, we
                // hide the "load more" button.
              }
            : c,
        ),
      );
    } else {
      toast.error(res.error || "خطا در بارگذاری پاسخ‌ها");
    }
  };

  // Repost submit (with optional quote)
  const handleRepostSubmit = async () => {
    if (!user || !post) return;
    setRepostBusy(true);
    const res = await apiFetch<{ repost: { id: string } }>(
      `/api/posts/${post.id}/repost`,
      {
        method: "POST",
        body: JSON.stringify({
          quoteText: repostQuote.trim() || undefined,
        }),
      },
    );
    setRepostBusy(false);
    if (res.ok && res.data) {
      setRepostedByMe(true);
      setPost((p) =>
        p ? { ...p, repostCount: p.repostCount + 1 } : p,
      );
      setRepostOpen(false);
      setRepostQuote("");
      toast.success("ری‌پست شد");
    } else {
      // Likely "already reposted"
      if (res.error && res.error.includes("قبلاً")) {
        setRepostedByMe(true);
        setRepostOpen(false);
        toast.info("شما قبلاً این پست را ری‌پست کرده‌اید");
      } else {
        toast.error(res.error || "خطا در ری‌پست");
      }
    }
  };

  // Undo repost
  const handleUndoRepost = async () => {
    if (!user || !post) return;
    setRepostBusy(true);
    const res = await apiFetch(`/api/posts/${post.id}/repost`, {
      method: "DELETE",
    });
    setRepostBusy(false);
    if (res.ok) {
      setRepostedByMe(false);
      setPost((p) =>
        p ? { ...p, repostCount: Math.max(0, p.repostCount - 1) } : p,
      );
      toast.success("ری‌پست لغو شد");
    } else {
      toast.error(res.error || "خطا در لغو ری‌پست");
    }
  };

  // ---------- Render helpers ----------

  const isOwnPost = !!user && !!post && user.id === post.user.id;

  if (loading) return <PostDetailSkeleton />;

  if (notFound || !post) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary/60">
              <MessageSquareOff className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-academic text-lg font-bold text-foreground">
                پست یافت نشد
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                ممکن است حذف شده باشد یا لینک اشتباه باشد.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("explore")}>
              بازگشت به اکسپلور
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // The "displayed" post: if this is a repost, show the ORIGINAL inside a
  // PostCard; otherwise show the post itself.
  const displayedPost: PostCardPost & { repostCount?: number } = post.isRepost &&
    post.original
    ? post.original
    : {
        id: post.id,
        content: post.content,
        imageUrl: post.imageUrl,
        videoUrl: post.videoUrl,
        mediaType: post.mediaType,
        tags: post.tags,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        viewCount: post.viewCount,
        repostCount: post.repostCount,
        slug: post.slug,
        createdAt: post.createdAt,
        likedByMe: post.likedByMe,
        user: post.user,
      };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Back button */}
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت
        </Button>
      </div>

      {/* Repost banner (if applicable) */}
      {post.isRepost && post.original && (
        <div className="mb-3 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Repeat2 className="h-4 w-4 text-primary" />
            <button
              onClick={() => navigate("profile", post.user.username)}
              className="text-sm font-medium text-primary hover:underline"
            >
              {post.user.displayName}
            </button>
            <span className="text-sm text-muted-foreground">ری‌پست کرد</span>
            <span className="mr-auto text-xs text-muted-foreground">
              {formatRelativeTime(new Date(post.createdAt))}
            </span>
          </div>
          {post.quoteText && (
            <blockquote className="rounded-lg border-r-4 border-primary/40 bg-secondary/30 p-3 text-sm text-foreground/90">
              {post.quoteText}
            </blockquote>
          )}
        </div>
      )}

      {/* Post card (static layout — no click-to-navigate) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <PostCard post={displayedPost} staticLayout />
      </motion.div>

      {/* Repost action row */}
      {!isOwnPost && (
        <div className="mt-4 flex items-center gap-2">
          {repostedByMe ? (
            <>
              <Badge
                variant="outline"
                className="border-accent/40 bg-accent/10 text-accent"
              >
                <Repeat2 className="h-3 w-3" />
                ری‌پست شده
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndoRepost}
                disabled={repostBusy}
                className="text-destructive hover:text-destructive"
              >
                {repostBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                لغو ری‌پست
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRepostOpen(true)}
              disabled={repostBusy}
            >
              <Repeat2 className="h-3.5 w-3.5" />
              ری‌پست
            </Button>
          )}
          {post.repostCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {toPersianDigits(post.repostCount)} ری‌پست
            </span>
          )}
        </div>
      )}

      {/* Repost dialog */}
      <Dialog open={repostOpen} onOpenChange={setRepostOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ری‌پست این پست</DialogTitle>
            <DialogDescription>
              می‌توانید یک یادداشت اختیاری به ری‌پست خود اضافه کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="repost-quote">یادداشت (اختیاری)</Label>
            <Textarea
              id="repost-quote"
              value={repostQuote}
              onChange={(e) => setRepostQuote(e.target.value)}
              placeholder="افکار خودتان درباره این پست بنویسید..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {toPersianDigits(repostQuote.length)} / ۵۰۰
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRepostOpen(false)}
              disabled={repostBusy}
            >
              انصراف
            </Button>
            <Button onClick={handleRepostSubmit} disabled={repostBusy}>
              {repostBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              <Repeat2 className="h-4 w-4" />
              ری‌پست
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments section */}
      <section className="mt-8 space-y-4">
        <h2 className="flex items-center gap-2 font-academic text-lg font-bold text-foreground">
          <MessageCircle className="h-5 w-5 text-primary" />
          کامنت‌ها
          {commentsTotal > 0 && (
            <Badge variant="secondary" className="text-xs">
              {toPersianDigits(commentsTotal)}
            </Badge>
          )}
        </h2>

        {/* Comment input */}
        {user ? (
          <Card>
            <CardContent className="space-y-3 p-4">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="کامنت خود را بنویسید..."
                rows={3}
                maxLength={500}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {toPersianDigits(commentText.length)} / ۵۰۰
                </span>
                <Button
                  size="sm"
                  onClick={handleCommentSubmit}
                  disabled={commentBusy || !commentText.trim()}
                >
                  {commentBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  ارسال کامنت
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <p className="text-sm text-muted-foreground">
                برای کامنت گذاشتن وارد شوید.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("login")}
              >
                ورود
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Comments list */}
        {commentsLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/30 py-12 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
              <MessageCircle className="h-7 w-7" />
            </div>
            <p className="font-academic text-base font-bold text-foreground">
              هنوز کامنتی ثبت نشده
            </p>
            <p className="text-sm text-muted-foreground">
              اولین نفر باشید!
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {comments.map((comment, i) => (
              <motion.li
                key={comment.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(i * 0.03, 0.2),
                  duration: 0.25,
                }}
              >
                <CommentItem
                  comment={comment}
                  onLike={() => handleCommentLike(comment.id)}
                  onReply={(text) => handleReplySubmit(comment.id, text)}
                  onReplyLike={(replyId) =>
                    handleReplyLike(comment.id, replyId)
                  }
                  onLoadMoreReplies={() =>
                    handleLoadMoreReplies(comment.id)
                  }
                  canReply={!!user}
                />
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------- Comment Item ----------

function CommentItem({
  comment,
  onLike,
  onReply,
  onReplyLike,
  onLoadMoreReplies,
  canReply,
}: {
  comment: Comment;
  onLike: () => void;
  onReply: (text: string) => Promise<boolean>;
  onReplyLike: (replyId: string) => void;
  onLoadMoreReplies: () => void;
  canReply: boolean;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const navigate = useRouterStore((s) => s.navigate);

  const handleReply = async () => {
    setReplyBusy(true);
    const ok = await onReply(replyText);
    setReplyBusy(false);
    if (ok) {
      setReplyText("");
      setReplyOpen(false);
    }
  };

  // Show "load more replies" button when there are more replies than what's
  // currently rendered (the GET endpoint returns at most 5 inline replies).
  const showLoadMore = comment.replyCount > comment.replies.length;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Comment header */}
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => navigate("profile", comment.user.username)}
            className="flex min-w-0 items-center gap-2"
          >
            <Avatar className="h-8 w-8 border border-border">
              <AvatarImage src={comment.user.avatarUrl || undefined} />
              <AvatarFallback className="bg-secondary text-xs text-primary">
                {comment.user.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-medium text-foreground">
                {comment.user.displayName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                @{comment.user.username}
              </p>
            </div>
          </button>
          <span
            className="shrink-0 text-xs text-muted-foreground"
            title={formatPersianDate(new Date(comment.createdAt))}
          >
            {formatRelativeTime(new Date(comment.createdAt))}
          </span>
        </div>

        {/* Comment body */}
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {comment.content}
        </p>

        {/* Comment actions */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <button
            onClick={onLike}
            className={cn(
              "flex items-center gap-1 transition-colors hover:text-primary",
              comment.likedByMe && "text-primary",
            )}
          >
            <Heart
              className={cn("h-3.5 w-3.5", comment.likedByMe && "fill-current")}
            />
            {comment.likeCount > 0 && toPersianDigits(comment.likeCount)}
          </button>
          {canReply && (
            <button
              onClick={() => setReplyOpen((v) => !v)}
              className="flex items-center gap-1 transition-colors hover:text-primary"
            >
              <Reply className="h-3.5 w-3.5" />
              پاسخ
            </button>
          )}
          {comment.replyCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {toPersianDigits(comment.replyCount)} پاسخ
            </span>
          )}
        </div>

        {/* Inline reply input */}
        {replyOpen && canReply && (
          <div className="space-y-2 rounded-lg border border-border/60 bg-secondary/20 p-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="پاسخ خود را بنویسید..."
              rows={2}
              maxLength={500}
              className="bg-background"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setReplyOpen(false);
                  setReplyText("");
                }}
                disabled={replyBusy}
              >
                انصراف
              </Button>
              <Button
                size="sm"
                onClick={handleReply}
                disabled={replyBusy || !replyText.trim()}
              >
                {replyBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                ارسال پاسخ
              </Button>
            </div>
          </div>
        )}

        {/* Replies (1 level of nesting) */}
        {comment.replies.length > 0 && (
          <ul className="space-y-2 border-r-2 border-border/40 pr-3">
            {comment.replies.map((reply) => (
              <li key={reply.id} className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() =>
                      navigate("profile", reply.user.username)
                    }
                    className="flex min-w-0 items-center gap-2"
                  >
                    <Avatar className="h-6 w-6 border border-border">
                      <AvatarImage src={reply.user.avatarUrl || undefined} />
                      <AvatarFallback className="bg-secondary text-[10px] text-primary">
                        {reply.user.displayName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 text-right">
                      <p className="truncate text-xs font-medium text-foreground">
                        {reply.user.displayName}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        @{reply.user.username}
                      </p>
                    </div>
                  </button>
                  <span
                    className="shrink-0 text-[10px] text-muted-foreground"
                    title={formatPersianDate(new Date(reply.createdAt))}
                  >
                    {formatRelativeTime(new Date(reply.createdAt))}
                  </span>
                </div>
                <p className="whitespace-pre-wrap pr-8 text-xs text-foreground/90">
                  {reply.content}
                </p>
                <div className="flex items-center gap-3 pr-8 text-[11px] text-muted-foreground">
                  <button
                    onClick={() => onReplyLike(reply.id)}
                    className={cn(
                      "flex items-center gap-1 transition-colors hover:text-primary",
                      reply.likedByMe && "text-primary",
                    )}
                  >
                    <Heart
                      className={cn(
                        "h-3 w-3",
                        reply.likedByMe && "fill-current",
                      )}
                    />
                    {reply.likeCount > 0 && toPersianDigits(reply.likeCount)}
                  </button>
                </div>
              </li>
            ))}

            {showLoadMore && (
              <li>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onLoadMoreReplies}
                  className="text-xs text-primary"
                >
                  نمایش {toPersianDigits(comment.replyCount - comment.replies.length)} پاسخ دیگر
                </Button>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Skeleton ----------

function PostDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
      <Skeleton className="h-8 w-24 rounded" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

export default PostDetailView;
