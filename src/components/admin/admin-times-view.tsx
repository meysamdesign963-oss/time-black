"use client";

/**
 * AdminTimesView — paginated time-entries management.
 * Filters: status, user search, date from/to. Table of entries with
 * user, task, duration, date, status. "View" opens a detail dialog.
 * Summary bar shows total time across current filter set.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  ListChecks,
  Search,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatDuration,
  formatDurationHuman,
  formatPersianDateShort,
  formatPersianTime,
  toPersianDigits,
} from "@/utils/persian-date";

type Entry = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  status: "RUNNING" | "COMPLETED" | "CANCELLED";
  note: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  task: { id: string; title: string; color: string } | null;
};

type EntriesResp = { entries: Entry[]; total: number; page: number; limit: number };

const PAGE_SIZE = 25;

function statusBadge(status: Entry["status"]) {
  if (status === "RUNNING")
    return (
      <Badge className="bg-primary/15 text-primary border border-primary/40 gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-soft-pulse" />
        در حال اجرا
      </Badge>
    );
  if (status === "COMPLETED")
    return (
      <Badge className="bg-accent/15 text-accent border border-accent/40">
        تکمیل‌شده
      </Badge>
    );
  return (
    <Badge className="bg-destructive/15 text-destructive border border-destructive/40">
      لغو شده
    </Badge>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.025, duration: 0.3, ease: "easeOut" as const },
  }),
};

export function AdminTimesView() {
  const [status, setStatus] = useState<"ALL" | Entry["status"]>("ALL");
  const [userSearch, setUserSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EntriesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Entry | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (status !== "ALL") params.set("status", status);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      params.set("to", d.toISOString());
    }
    const res = await apiFetch<EntriesResp>(
      `/api/admin/time-entries?${params.toString()}`,
    );
    if (res.ok && res.data) {
      // client-side filter by user search (server doesn't support username query)
      let entries = res.data.entries;
      if (userSearch.trim()) {
        const q = userSearch.trim().toLowerCase();
        entries = entries.filter(
          (e) =>
            e.user.displayName.toLowerCase().includes(q) ||
            e.user.username.toLowerCase().includes(q),
        );
      }
      setData({ ...res.data, entries });
    } else {
      setData(null);
      if (res.error) toast.error(res.error);
    }
    setLoading(false);
  }, [page, status, from, to, userSearch]);

  useEffect(() => {
    (async () => {
      await fetchEntries();
    })();
  }, [fetchEntries]);

  const totalSecondsInView = useMemo(() => {
    if (!data) return 0;
    return data.entries
      .filter((e) => e.status === "COMPLETED")
      .reduce((acc, e) => acc + (e.durationSec || 0), 0);
  }, [data]);

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / PAGE_SIZE))
    : 1;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 space-y-6">
      <PageHeader
        title="مدیریت تایم‌ها"
        description="بررسی و فیلتر تمامی تایم‌های ثبت‌شده در پلتفرم"
      />

      {/* Filters */}
      <Card className="glass border-border/60">
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">وضعیت</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as typeof status);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه</SelectItem>
                <SelectItem value="COMPLETED">تکمیل‌شده</SelectItem>
                <SelectItem value="RUNNING">در حال اجرا</SelectItem>
                <SelectItem value="CANCELLED">لغو شده</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">جستجوی کاربر</Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="نام یا نام کاربری"
                className="pr-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">از تاریخ</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">تا تاریخ</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              dir="ltr"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary bar */}
      <div className="glass flex flex-wrap items-center gap-4 rounded-xl border border-border/60 p-4">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              مجموع تایم در فیلتر فعلی
            </p>
            <p className="font-academic text-lg font-bold text-foreground">
              {formatDurationHuman(totalSecondsInView)}
            </p>
          </div>
        </div>
        <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
          <ListChecks className="h-4 w-4" />
          تعداد رکوردها:{" "}
          <span className="font-mono text-foreground">
            {toPersianDigits(data?.total ?? 0)}
          </span>
        </div>
      </div>

      {/* Table */}
      <Card className="glass border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-right">کاربر</TableHead>
                  <TableHead className="text-right">تسک</TableHead>
                  <TableHead className="text-right">مدت زمان</TableHead>
                  <TableHead className="text-right">تاریخ ثبت</TableHead>
                  <TableHead className="text-right">وضعیت</TableHead>
                  <TableHead className="text-right">اقدامات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-6 w-full rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !data || data.entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12">
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/40">
                          <Timer className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          هیچ تایمی با این فیلترها یافت نشد
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.entries.map((e, idx) => (
                    <motion.tr
                      key={e.id}
                      custom={idx}
                      variants={fadeUp}
                      initial="hidden"
                      animate="show"
                      className="border-b border-border/40 transition-colors hover:bg-card/40"
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {e.user.avatarUrl && (
                              <AvatarImage
                                src={e.user.avatarUrl}
                                alt={e.user.displayName}
                              />
                            )}
                            <AvatarFallback className="bg-secondary text-[10px]">
                              {e.user.displayName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {e.user.displayName}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                              @{e.user.username}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {e.task ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor: e.task.color || "#e0cba8",
                              }}
                            />
                            <span className="truncate text-sm">
                              {e.task.title}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            تسک حذف‌شده
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {e.status === "RUNNING"
                          ? "—"
                          : formatDuration(e.durationSec)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatPersianDateShort(new Date(e.startedAt))}
                        <br />
                        <span className="font-mono">
                          {formatPersianTime(new Date(e.startedAt))}
                        </span>
                      </TableCell>
                      <TableCell>{statusBadge(e.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => setDetail(e)}
                        >
                          <Eye className="h-4 w-4" />
                          مشاهده
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            نمایش{" "}
            <span className="font-mono text-foreground">
              {toPersianDigits(data.entries.length)}
            </span>{" "}
            از{" "}
            <span className="font-mono text-foreground">
              {toPersianDigits(data.total)}
            </span>{" "}
            رکورد
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
            <span className="font-mono text-xs text-muted-foreground">
              {toPersianDigits(page)} / {toPersianDigits(totalPages)}
            </span>
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

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              جزئیات تایم
            </DialogTitle>
            <DialogDescription>
              اطلاعات کامل این رکورد زمانی
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">کاربر</span>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    {detail.user.avatarUrl && (
                      <AvatarImage
                        src={detail.user.avatarUrl}
                        alt={detail.user.displayName}
                      />
                    )}
                    <AvatarFallback className="bg-secondary text-[10px]">
                      {detail.user.displayName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{detail.user.displayName}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">تسک</span>
                <div className="flex items-center gap-2">
                  {detail.task && (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: detail.task.color || "#e0cba8",
                      }}
                    />
                  )}
                  <span>{detail.task?.title ?? "حذف‌شده"}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">وضعیت</span>
                {statusBadge(detail.status)}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">شروع</span>
                <span className="font-mono">
                  {formatPersianDateShort(new Date(detail.startedAt))}{" "}
                  {formatPersianTime(new Date(detail.startedAt))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">پایان</span>
                <span className="font-mono">
                  {detail.endedAt
                    ? `${formatPersianDateShort(new Date(detail.endedAt))} ${formatPersianTime(new Date(detail.endedAt))}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">مدت زمان</span>
                <span className="font-academic font-bold text-primary">
                  {detail.status === "RUNNING"
                    ? "در حال اجرا"
                    : formatDurationHuman(detail.durationSec)}
                </span>
              </div>
              {detail.note && (
                <div className="rounded-md border border-border/40 bg-card/40 p-3">
                  <p className="mb-1 text-xs text-muted-foreground">یادداشت</p>
                  <p className="text-sm leading-6">{detail.note}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminTimesView;
