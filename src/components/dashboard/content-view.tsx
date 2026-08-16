"use client";

/**
 * ContentView — content / post management page.
 *
 * Features:
 *  - Create/edit posts with image AND video upload (drag & drop)
 *  - Real DRAFT support (status=DRAFT)
 *  - Tabs: published / drafts / private
 *  - Tags auto-extracted from content (#hashtag)
 *  - Visibility: public / private
 *  - Media preview before publish
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  FileText,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { formatRelativeTime, toPersianDigits } from "@/utils/persian-date";
import { useRouterStore } from "@/store/router";
import { cn } from "@/lib/utils";

type Post = {
  id: string;
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
  mediaType: string;
  tags: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  status: "PUBLISHED" | "DRAFT";
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
};

type MineResp = { posts: Post[] };
type UploadResp = { url: string; mediaType: string; size: number };

type TabKey = "published" | "drafts" | "private";

export function ContentView() {
  const { navigate } = useRouterStore();
  const [tab, setTab] = useState<TabKey>("published");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [form, setForm] = useState({
    content: "",
    visibility: "PUBLIC" as "PUBLIC" | "PRIVATE",
  });
  // Media state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>("NONE");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const res = await apiFetch<MineResp>("/api/posts/mine");
      if (res.ok && res.data?.posts) setPosts(res.data.posts);
      else setPosts([]);
      setLoading(false);
    };
    run();
  }, []);

  const filteredPosts = posts.filter((p) => {
    if (tab === "published")
      return p.status === "PUBLISHED" && p.visibility === "PUBLIC";
    if (tab === "drafts") return p.status === "DRAFT";
    if (tab === "private")
      return p.status === "PUBLISHED" && p.visibility === "PRIVATE";
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ content: "", visibility: "PUBLIC" });
    setImageUrl(null);
    setVideoUrl(null);
    setMediaType("NONE");
    setDialogOpen(true);
  };

  const openEdit = (post: Post) => {
    setEditing(post);
    setForm({
      content: post.content,
      visibility: post.visibility,
    });
    setImageUrl(post.imageUrl);
    setVideoUrl(post.videoUrl);
    setMediaType(post.mediaType);
    setDialogOpen(true);
  };

  const resetMedia = () => {
    setImageUrl(null);
    setVideoUrl(null);
    setMediaType("NONE");
  };

  const handleFileSelect = async (file: File) => {
    // Validate locally first
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      toast.error("فقط تصویر یا ویدیو مجاز است");
      return;
    }
    if (isImage && file.size > 10 * 1024 * 1024) {
      toast.error("حداکثر حجم تصویر ۱۰ مگابایت");
      return;
    }
    if (isVideo && file.size > 50 * 1024 * 1024) {
      toast.error("حداکثر حجم ویدیو ۵۰ مگابایت");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || "خطا در آپلود فایل");
        return;
      }
      const data: UploadResp = json.data;
      // Reset and set new media (only one media per post)
      resetMedia();
      if (data.mediaType === "IMAGE") {
        setImageUrl(data.url);
        setMediaType("IMAGE");
      } else {
        setVideoUrl(data.url);
        setMediaType("VIDEO");
      }
      toast.success("فایل آپلود شد");
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handlePublish = async (asDraft = false) => {
    if (!form.content.trim()) {
      toast.error("متن پست الزامی است");
      return;
    }
    setSaving(true);
    const body: Record<string, unknown> = {
      content: form.content,
      imageUrl,
      videoUrl,
      mediaType,
      visibility: form.visibility,
      status: asDraft ? "DRAFT" : "PUBLISHED",
    };
    let res: { ok: boolean; data?: { post: Post }; error?: string };
    if (editing) {
      res = await apiFetch<{ post: Post }>(`/api/posts/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    } else {
      res = await apiFetch<{ post: Post }>("/api/posts", {
        method: "POST",
        body: JSON.stringify(body),
      });
    }
    setSaving(false);
    if (res.ok && res.data?.post) {
      const saved = res.data.post;
      toast.success(
        editing
          ? asDraft
            ? "پیش‌نویس به‌روزرسانی شد"
            : "پست به‌روزرسانی و منتشر شد"
          : asDraft
            ? "به‌عنوان پیش‌نویس ذخیره شد"
            : "پست منتشر شد",
      );
      setPosts((prev) => {
        const exists = prev.find((p) => p.id === saved.id);
        if (exists) return prev.map((p) => (p.id === saved.id ? saved : p));
        return [saved, ...prev];
      });
      setDialogOpen(false);
      if (asDraft) setTab("drafts");
      else if (form.visibility === "PRIVATE") setTab("private");
      else setTab("published");
    } else {
      toast.error(res.error || "خطا در ذخیره پست");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const res = await apiFetch(`/api/posts/${deleteId}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (res.ok) {
      toast.success("پست حذف شد");
      setPosts((prev) => prev.filter((p) => p.id !== deleteId));
      setDeleteId(null);
    } else {
      toast.error(res.error || "خطا در حذف پست");
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6">
      <PageHeader
        title="تولید و مدیریت محتوا"
        description="پست‌های خود را با تصویر و ویدیو منتشر کنید"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            ایجاد پست جدید
          </Button>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="published">پست‌های من</TabsTrigger>
          <TabsTrigger value="drafts">پیش‌نویس‌ها</TabsTrigger>
          <TabsTrigger value="private">پست‌های خصوصی</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <EmptyPosts tab={tab} onCreate={openCreate} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredPosts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                >
                  <Card className="card-lift h-full">
                    <CardContent className="flex h-full flex-col gap-3 p-5">
                      {/* Media preview */}
                      {post.mediaType === "VIDEO" && post.videoUrl ? (
                        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                          <video
                            src={post.videoUrl}
                            controls
                            className="h-full w-full"
                            preload="metadata"
                          />
                        </div>
                      ) : post.mediaType === "IMAGE" && post.imageUrl ? (
                        <div className="aspect-video w-full overflow-hidden rounded-lg bg-secondary/40">
                          <img
                            src={post.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : null}

                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              post.visibility === "PRIVATE"
                                ? "border-amber-500/40 text-amber-500"
                                : "border-accent/40 text-accent"
                            }
                          >
                            {post.visibility === "PRIVATE" ? (
                              <>
                                <EyeOff className="h-3 w-3" />
                                خصوصی
                              </>
                            ) : (
                              <>
                                <Eye className="h-3 w-3" />
                                عمومی
                              </>
                            )}
                          </Badge>
                          {post.status === "DRAFT" && (
                            <Badge variant="outline" className="text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              پیش‌نویس
                            </Badge>
                          )}
                          {post.mediaType === "VIDEO" && (
                            <Badge variant="outline" className="text-[10px]">
                              <Video className="h-3 w-3" />
                              ویدیو
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(new Date(post.createdAt))}
                        </span>
                      </div>

                      <p className="line-clamp-3 flex-1 text-sm text-foreground">
                        {post.content}
                      </p>

                      {/* Tags */}
                      {post.tags && (
                        <div className="flex flex-wrap gap-1">
                          {post.tags
                            .split(",")
                            .filter(Boolean)
                            .slice(0, 4)
                            .map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="bg-primary/10 text-primary text-[10px]"
                              >
                                #{tag}
                              </Badge>
                            ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Heart className="h-3.5 w-3.5" />
                            {toPersianDigits(post.likeCount)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3.5 w-3.5" />
                            {toPersianDigits(post.commentCount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => openEdit(post)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            ویرایش
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            title="آمار پست"
                            onClick={() => navigate("post-analytics", post.id)}
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                            آمار
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(post.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "ویرایش پست" : "ایجاد پست جدید"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "محتوای پست را ویرایش کنید"
                : "یک پست با تصویر یا ویدیو بسازید"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="post-content">متن پست *</Label>
              <Textarea
                id="post-content"
                value={form.content}
                onChange={(e) =>
                  setForm({ ...form, content: e.target.value })
                }
                placeholder="افکار خود را به اشتراک بگذارید... (از #هشتگ استفاده کنید)"
                rows={5}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {toPersianDigits(form.content.length)} / ۲۰۰۰
              </p>
            </div>

            {/* Media upload area */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                تصویر یا ویدیو (اختیاری)
              </Label>

              {/* Current media preview */}
              {mediaType === "VIDEO" && videoUrl ? (
                <div className="relative overflow-hidden rounded-lg border border-border/60 bg-black">
                  <video
                    src={videoUrl}
                    controls
                    className="aspect-video w-full"
                    preload="metadata"
                  />
                  <button
                    onClick={resetMedia}
                    className="absolute left-2 top-2 rounded-full bg-destructive/80 p-1 text-destructive-foreground hover:bg-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : mediaType === "IMAGE" && imageUrl ? (
                <div className="relative overflow-hidden rounded-lg border border-border/60">
                  <img
                    src={imageUrl}
                    alt=""
                    className="aspect-video w-full object-cover"
                  />
                  <button
                    onClick={resetMedia}
                    className="absolute left-2 top-2 rounded-full bg-destructive/80 p-1 text-destructive-foreground hover:bg-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/60 bg-secondary/20 py-8 transition-colors hover:border-primary/40 hover:bg-secondary/30",
                    uploading && "pointer-events-none opacity-60",
                  )}
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        فایل را اینجا رها کنید یا کلیک کنید
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        تصویر: jpg, png, webp, gif (تا ۱۰MB) | ویدیو: mp4, webm (تا ۵۰MB)
                      </p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            <div className="space-y-2">
              <Label>نمایش</Label>
              <RadioGroup
                value={form.visibility}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    visibility: v as "PUBLIC" | "PRIVATE",
                  })
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="PUBLIC" id="vis-public" />
                  <Label htmlFor="vis-public" className="cursor-pointer">
                    عمومی
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="PRIVATE" id="vis-private" />
                  <Label htmlFor="vis-private" className="cursor-pointer">
                    خصوصی
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving || uploading}
            >
              انصراف
            </Button>
            <Button
              variant="secondary"
              onClick={() => handlePublish(true)}
              disabled={saving || uploading}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              ذخیره پیش‌نویس
            </Button>
            <Button
              onClick={() => handlePublish(false)}
              disabled={saving || uploading}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              انتشار
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف پست</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف این پست مطمئن هستید؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              حذف پست
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyPosts({
  tab,
  onCreate,
}: {
  tab: TabKey;
  onCreate: () => void;
}) {
  const labels: Record<TabKey, { title: string; hint: string }> = {
    published: {
      title: "پست عمومی منتشرشده ندارید",
      hint: "اولین پست خود را با تصویر یا ویدیو منتشر کنید",
    },
    drafts: {
      title: "پیش‌نویسی ندارید",
      hint: "پست‌های ذخیره‌شده به‌صورت پیش‌نویس در اینجا نمایش داده می‌شوند",
    },
    private: {
      title: "پست خصوصی ندارید",
      hint: "پست‌های خصوصی فقط برای خود شما قابل مشاهده هستند",
    },
  };
  const m = labels[tab];
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/30 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
        <FileText className="h-7 w-7" />
      </div>
      <div>
        <p className="font-academic text-base font-bold text-foreground">
          {m.title}
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{m.hint}</p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="h-4 w-4" />
        ایجاد پست جدید
      </Button>
    </div>
  );
}

export default ContentView;
