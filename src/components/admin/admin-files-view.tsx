"use client";

/**
 * AdminFilesView — paginated file manager.
 *
 * Lists all uploaded files (images, videos, avatars, covers) stored on the
 * filesystem under /public/uploads. Supports folder filter, name search,
 * thumbnail preview (images) / icon (videos), open in new tab, and delete
 * with confirmation. KPIs: total files, total size, per-folder breakdown.
 *
 * Endpoints:
 *   GET    /api/admin/files?folder=&q=&page=&limit=
 *   DELETE /api/admin/files?path=/uploads/xxx/yyy.png
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileImage,
  FileVideo,
  FolderOpen,
  HardDrive,
  ImageIcon,
  Loader2,
  Search,
  Trash2,
  UserCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { formatRelativeTime, toPersianDigits } from "@/utils/persian-date";

type FolderKey = "all" | "images" | "videos" | "avatars" | "covers";

type FileItem = {
  name: string;
  url: string;
  folder: string;
  size: number;
  createdAt: string;
  mimeType: string;
};

type FilesResp = {
  files: FileItem[];
  total: number;
  page: number;
  limit: number;
  stats: {
    totalFiles: number;
    totalSize: number;
    totalSizeMB: number;
    byFolder: Record<string, { count: number; size: number }>;
  };
};

const PAGE_SIZE = 50;

const FOLDER_LABEL: Record<string, string> = {
  images: "تصاویر",
  videos: "ویدیوها",
  avatars: "آواتارها",
  covers: "کاورها",
};

const FOLDER_ICON: Record<string, React.ElementType> = {
  images: FileImage,
  videos: FileVideo,
  avatars: UserCircle2,
  covers: ImageIcon,
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i * 0.03, 0.25), duration: 0.35, ease: "easeOut" as const },
  }),
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${toPersianDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) {
    return `${toPersianDigits(Math.round((bytes / 1024) * 10) / 10)} کیلوبایت`;
  }
  return `${toPersianDigits(Math.round((bytes / (1024 * 1024)) * 100) / 100)} مگابایت`;
}

function isImageFile(f: FileItem) {
  return f.mimeType.startsWith("image/");
}
function isVideoFile(f: FileItem) {
  return f.mimeType.startsWith("video/");
}

export function AdminFilesView() {
  const [folder, setFolder] = useState<FolderKey>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FilesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<FileItem | null>(null);

  // Debounced search via ref + timeout (avoids set-state-in-effect).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [search, setSearch] = useState("");

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      folder,
      q: search,
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    const res = await apiFetch<FilesResp>(
      `/api/admin/files?${params.toString()}`,
    );
    if (res.ok && res.data) {
      setData(res.data);
    } else {
      setData(null);
      if (res.error) toast.error(res.error);
    }
    setLoading(false);
  }, [folder, search, page]);

  useEffect(() => {
    (async () => {
      await fetchFiles();
    })();
  }, [fetchFiles]);

  // Debounce the query -> search
  const handleSearchChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 350);
  };

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / PAGE_SIZE))
    : 1;

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const path = encodeURIComponent(deleteTarget.url);
    const res = await apiFetch<{ ok: true }>(
      `/api/admin/files?path=${path}`,
      { method: "DELETE" },
    );
    setDeleting(false);
    if (res.ok) {
      toast.success("فایل حذف شد");
      setDeleteTarget(null);
      // If we removed the last item on this page, go back one page.
      if (data && data.files.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchFiles();
      }
    } else {
      toast.error(res.error || "خطا در حذف فایل");
    }
  }

  function openInNewTab(url: string) {
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
  }

  const byFolder = data?.stats?.byFolder ?? {};

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
      <PageHeader
        title="مدیریت فایل‌ها"
        description="بررسی، جستجو و حذف فایل‌های آپلودشده در پلتفرم"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {loading && !data ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="کل فایل‌ها"
              value={toPersianDigits(data?.stats.totalFiles ?? 0)}
              icon={FolderOpen}
              accent="primary"
            />
            <StatCard
              label="حجم کل"
              value={`${toPersianDigits(data?.stats.totalSizeMB ?? 0)} مگابایت`}
              icon={HardDrive}
              accent="accent"
            />
            <StatCard
              label="تصاویر"
              value={toPersianDigits(byFolder.images?.count ?? 0)}
              icon={FileImage}
              hint={formatFileSize(byFolder.images?.size ?? 0)}
            />
            <StatCard
              label="ویدیوها"
              value={toPersianDigits(byFolder.videos?.count ?? 0)}
              icon={FileVideo}
              hint={formatFileSize(byFolder.videos?.size ?? 0)}
            />
            <StatCard
              label="آواتارها"
              value={toPersianDigits(byFolder.avatars?.count ?? 0)}
              icon={UserCircle2}
              hint={formatFileSize(byFolder.avatars?.size ?? 0)}
            />
            <StatCard
              label="کاورها"
              value={toPersianDigits(byFolder.covers?.count ?? 0)}
              icon={ImageIcon}
              hint={formatFileSize(byFolder.covers?.size ?? 0)}
            />
          </>
        )}
      </div>

      {/* Filters */}
      <Card className="glass border-border/60">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">پوشه</p>
            <Select
              value={folder}
              onValueChange={(v) => {
                setFolder(v as FolderKey);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="images">تصاویر</SelectItem>
                <SelectItem value="videos">ویدیوها</SelectItem>
                <SelectItem value="avatars">آواتارها</SelectItem>
                <SelectItem value="covers">کاورها</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <p className="text-xs text-muted-foreground">جستجوی نام فایل</p>
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="مثلاً: avatar.png"
                className="pr-9"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="پاک کردن جستجو"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="mr-auto text-xs text-muted-foreground">
            نمایش{" "}
            <span className="font-mono text-foreground">
              {toPersianDigits(data?.files.length ?? 0)}
            </span>{" "}
            از{" "}
            <span className="font-mono text-foreground">
              {toPersianDigits(data?.total ?? 0)}
            </span>{" "}
            فایل
          </div>
        </CardContent>
      </Card>

      {/* Files grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : !data || data.files.length === 0 ? (
        <Card className="glass border-border/60">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/40">
              <FolderOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-academic text-base font-bold text-foreground">
              فایلی یافت نشد
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              با فیلترها و جستجوی فعلی هیچ فایلی موجود نیست. می‌توانید فیلترها
              را تغییر دهید.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.files.map((f, idx) => {
            const FolderIcon = FOLDER_ICON[f.folder] || FileImage;
            return (
              <motion.div
                key={`${f.folder}/${f.name}`}
                custom={idx}
                variants={fadeUp}
                initial="hidden"
                animate="show"
              >
                <Card className="glass card-lift group flex h-full flex-col overflow-hidden border-border/60">
                  {/* Thumbnail */}
                  <button
                    type="button"
                    onClick={() =>
                      isImageFile(f) ? openInNewTab(f.url) : setPreviewTarget(f)
                    }
                    className="relative block aspect-square w-full overflow-hidden bg-secondary/30"
                    title={isImageFile(f) ? "باز کردن تصویر در تب جدید" : "مشاهده"}
                  >
                    {isImageFile(f) ? (
                      <img
                        src={f.url}
                        alt={f.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : isVideoFile(f) ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <FileVideo className="h-10 w-10" />
                        <span className="text-[10px]">ویدیو</span>
                      </div>
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        <FileImage className="h-10 w-10" />
                      </div>
                    )}
                    <span className="absolute right-2 top-2 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </button>

                  <CardContent className="flex flex-1 flex-col gap-2 p-3">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="gap-1 border-border/60 text-[10px]"
                      >
                        <FolderIcon className="h-3 w-3" />
                        {FOLDER_LABEL[f.folder] || f.folder}
                      </Badge>
                      <span className="mr-auto text-[10px] text-muted-foreground">
                        {formatRelativeTime(new Date(f.createdAt))}
                      </span>
                    </div>

                    <p
                      className="line-clamp-2 break-all font-mono text-xs text-foreground"
                      title={f.name}
                    >
                      {f.name}
                    </p>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/40 pt-2">
                      <span className="text-[10px] text-muted-foreground">
                        {formatFileSize(f.size)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openInNewTab(f.url)}
                          title="باز کردن در تب جدید"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(f)}
                          title="حذف فایل"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
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

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف فایل</AlertDialogTitle>
            <AlertDialogDescription>
              این فایل به‌صورت دائمی از سرور حذف خواهد شد. این عمل قابل بازگشت
              نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && (
            <div className="rounded-md border border-border/40 bg-card/40 p-3">
              <p className="text-xs text-muted-foreground">فایل</p>
              <p className="mt-1 break-all font-mono text-sm">
                {deleteTarget.name}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                مسیر:{" "}
                <span className="font-mono">{deleteTarget.url}</span>
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال حذف…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  حذف فایل
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Video / file preview dialog */}
      <AlertDialog
        open={!!previewTarget}
        onOpenChange={(o) => !o && setPreviewTarget(null)}
      >
        <AlertDialogContent className="sm:max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{previewTarget?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              {previewTarget
                ? `${FOLDER_LABEL[previewTarget.folder] || previewTarget.folder} • ${formatFileSize(previewTarget.size)}`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {previewTarget && isVideoFile(previewTarget) && (
            <div className="overflow-hidden rounded-lg bg-black">
              <video
                src={previewTarget.url}
                controls
                className="aspect-video w-full"
                preload="metadata"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>بستن</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => previewTarget && openInNewTab(previewTarget.url)}
            >
              <ExternalLink className="h-4 w-4" />
              باز کردن در تب جدید
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminFilesView;
