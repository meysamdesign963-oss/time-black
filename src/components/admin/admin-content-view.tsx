"use client";

/**
 * AdminContentView — paginated post / content management.
 * Filters: status (PUBLISHED/HIDDEN), visibility (PUBLIC/PRIVATE).
 * Responsive grid of post cards with author info, content preview,
 * image thumbnail, status/visibility badges, hide (DELETE) action
 * with confirmation dialog. (DELETE on /api/admin/posts/[id] sets
 * status=HIDDEN server-side.)
 */
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Heart,
  ImageOff,
  Lock,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/utils/api-fetch";
import { formatPersianDateShort, toPersianDigits } from "@/utils/persian-date";

type Post = {
  id: string;
  content: string;
  imageUrl: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
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

type PostsResp = { posts: Post[]; total: number; page: number; limit: number };

const PAGE_SIZE = 12;

function statusBadge(s: Post["status"]) {
  if (s === "PUBLISHED")
    return (
      <Badge className="bg-accent/15 text-accent border border-accent/40">
        منتشرشده
      </Badge>
    );
  if (s === "HIDDEN")
    return (
      <Badge className="bg-destructive/15 text-destructive border border-destructive/40 gap-1">
        <EyeOff className="h-3 w-3" />
        مخفی‌شده
      </Badge>
    );
  return (
    <Badge variant="secondary" className="bg-muted/40 text-muted-foreground">
      پیش‌نویس
    </Badge>
  );
}

function visibilityBadge(v: Post["visibility"]) {
  return v === "PUBLIC" ? (
    <Badge variant="outline" className="gap-1 border-border/60">
      <Globe className="h-3 w-3" />
      عمومی
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 border-border/60">
      <Lock className="h-3 w-3" />
      خصوصی
    </Badge>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.4, ease: "easeOut" as const },
  }),
};

export function AdminContentView() {
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | Post["status"]
  >("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState<
    "ALL" | Post["visibility"]
  >("ALL");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PostsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideTarget, setHideTarget] = useState<Post | null>(null);
  const [hiding, setHiding] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (visibilityFilter !== "ALL") params.set("visibility", visibilityFilter);
    const res = await apiFetch<PostsResp>(
      `/api/admin/posts?${params.toString()}`,
    );
    if (res.ok && res.data) {
      setData(res.data);
    } else {
      setData(null);
      if (res.error) toast.error(res.error);
    }
    setLoading(false);
  }, [page, statusFilter, visibilityFilter]);

  useEffect(() => {
    (async () => {
      await fetchPosts();
    })();
  }, [fetchPosts]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  async function hidePost(id: string) {
    setHiding(true);
    const res = await apiFetch<{ ok: true }>(`/api/admin/posts/${id}`, {
      method: "DELETE",
    });
    setHiding(false);
    if (res.ok) {
      toast.success("پست با موفقیت مخفی شد");
      setHideTarget(null);
      await fetchPosts();
    } else {
      toast.error(res.error || "خطا در مخفی‌سازی پست");
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 space-y-6">
      <PageHeader
        title="مدیریت محتوا"
        description="بررسی و مدیریت پست‌های کاربران در پلتفرم"
      />

      {/* Filters */}
      <Card className="glass border-border/60">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">وضعیت</p>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as typeof statusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه</SelectItem>
                <SelectItem value="PUBLISHED">منتشرشده</SelectItem>
                <SelectItem value="HIDDEN">مخفی‌شده</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">نمایش</p>
            <Select
              value={visibilityFilter}
              onValueChange={(v) => {
                setVisibilityFilter(v as typeof visibilityFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه</SelectItem>
                <SelectItem value="PUBLIC">عمومی</SelectItem>
                <SelectItem value="PRIVATE">خصوصی</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mr-auto text-xs text-muted-foreground">
            مجموع:{" "}
            <span className="font-mono text-foreground">
              {toPersianDigits(data?.total ?? 0)}
            </span>{" "}
            پست
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : !data || data.posts.length === 0 ? (
        <Card className="glass border-border/60">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/40">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              هیچ پستی با این فیلترها یافت نشد
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.posts.map((p, idx) => (
            <motion.div
              key={p.id}
              custom={idx}
              variants={fadeUp}
              initial="hidden"
              animate="show"
            >
              <Card className="glass card-lift flex h-full flex-col overflow-hidden border-border/60">
                {p.imageUrl ? (
                  <div className="aspect-video w-full overflow-hidden bg-secondary/30">
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full bg-secondary/20 grid place-items-center">
                    <ImageOff className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                )}
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      {p.user.avatarUrl && (
                        <AvatarImage
                          src={p.user.avatarUrl}
                          alt={p.user.displayName}
                        />
                      )}
                      <AvatarFallback className="bg-secondary text-[10px]">
                        {p.user.displayName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {p.user.displayName}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        @{p.user.username}
                      </p>
                    </div>
                  </div>

                  <p className="line-clamp-3 min-h-[3.5rem] text-sm leading-6 text-muted-foreground">
                    {p.content}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {statusBadge(p.status)}
                    {visibilityBadge(p.visibility)}
                    <span className="mr-auto text-[10px] text-muted-foreground">
                      {formatPersianDateShort(new Date(p.createdAt))}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-3">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5" />
                        {toPersianDigits(p.likeCount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {toPersianDigits(p.commentCount)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 gap-1"
                      disabled={p.status === "HIDDEN"}
                      onClick={() => setHideTarget(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {p.status === "HIDDEN" ? "مخفی‌شده" : "مخفی‌سازی"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            صفحه{" "}
            <span className="font-mono text-foreground">
              {toPersianDigits(page)}
            </span>{" "}
            از{" "}
            <span className="font-mono text-foreground">
              {toPersianDigits(totalPages)}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronRight className="h-4 w-4" />
              قبلی
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              بعدی
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Hide confirmation */}
      <AlertDialog
        open={!!hideTarget}
        onOpenChange={(o) => !o && setHideTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>مخفی‌سازی پست</AlertDialogTitle>
            <AlertDialogDescription>
              این پست از دید عموم کاربران خارج خواهد شد. صاحب پست از طریق
              اعلان مطلع می‌شود. آیا ادامه می‌دهید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-border/40 bg-card/40 p-3">
            <p className="text-xs text-muted-foreground">پیش‌نمایش محتوا</p>
            <p className="mt-1 line-clamp-3 text-sm">
              {hideTarget?.content}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={hiding}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              disabled={hiding}
              onClick={() => hideTarget && hidePost(hideTarget.id)}
            >
              {hiding ? "در حال انجام…" : "مخفی کن"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminContentView;
