"use client";

/**
 * AdminAwardsView — awards management panel.
 * Lists awards with filter + delete + create dialog.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Award as AwardIcon,
  Crown,
  Medal,
  Search,
  Star,
  Trash2,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { AwardDialog } from "@/components/admin/award-dialog";
import { cn } from "@/lib/utils";

// ---------- Types ----------
type AwardItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  period: string | null;
  rank: number;
  icon: string;
  color: string;
  awardedAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

type AwardsResp = {
  awards: AwardItem[];
  total: number;
  page: number;
  limit: number;
};

const ICON_MAP: Record<string, React.ElementType> = {
  trophy: Trophy,
  medal: Medal,
  crown: Crown,
  star: Star,
  award: AwardIcon,
};

const TYPE_LABELS: Record<string, string> = {
  MONTHLY_WINNER: "برنده ماهانه",
  WEEKLY_WINNER: "برنده هفتگی",
  TOP_3: "نفر برتر",
  SPECIAL: "ویژه",
  ACHIEVEMENT: "دستاورد",
};

const TYPE_BADGE_CLASS: Record<string, string> = {
  MONTHLY_WINNER: "bg-primary/20 text-primary border border-primary/40",
  WEEKLY_WINNER: "bg-accent/20 text-accent border border-accent/40",
  TOP_3: "bg-primary/15 text-primary border border-primary/40",
  SPECIAL: "bg-orange-500/15 text-orange-400 border border-orange-500/40",
  ACHIEVEMENT:
    "bg-purple-500/15 text-purple-400 border border-purple-500/40",
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.025, duration: 0.3, ease: "easeOut" as const },
  }),
};

export function AdminAwardsView() {
  const [data, setData] = useState<AwardsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<AwardItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const fetchAwards = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1", limit: "100" });
    const res = await apiFetch<AwardsResp>(
      `/api/admin/awards?${params.toString()}`,
    );
    if (res.ok && res.data) {
      setData(res.data);
    } else {
      setData(null);
      if (res.error) toast.error(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      await fetchAwards();
    })();
  }, [fetchAwards]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.awards;
    if (typeFilter !== "ALL") {
      list = list.filter((a) => a.type === typeFilter);
    }
    if (debouncedQ.trim()) {
      const q = debouncedQ.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.user.displayName.toLowerCase().includes(q) ||
          a.user.username.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, typeFilter, debouncedQ]);

  const stats = useMemo(() => {
    if (!data)
      return { total: 0, monthly: 0, thisMonth: 0 };
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      total: data.total,
      monthly: data.awards.filter((a) => a.type === "MONTHLY_WINNER").length,
      thisMonth: data.awards.filter((a) => new Date(a.awardedAt) >= monthStart)
        .length,
    };
  }, [data]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await apiFetch(`/api/admin/awards/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (res.ok) {
      toast.success("جایزه حذف شد");
      setDeleteTarget(null);
      await fetchAwards();
    } else {
      toast.error(res.error || "خطا در حذف جایزه");
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
      <PageHeader
        title="مدیریت جوایز"
        description="اعطای نشان‌های افتخار به کاربران برتر و مدیریت جوایز ثبت‌شده"
        action={
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Trophy className="ml-2 h-4 w-4" />
            اعطای جایزه جدید
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="مجموع جوایز"
          value={toPersianDigits(stats.total)}
          icon={AwardIcon}
          accent="primary"
          hint="تعداد کل جوایز اعطاشده"
        />
        <StatCard
          label="برندگان ماهانه"
          value={toPersianDigits(stats.monthly)}
          icon={Trophy}
          accent="primary"
          hint="جوایز برنده ماه"
        />
        <StatCard
          label="جوایز این ماه"
          value={toPersianDigits(stats.thisMonth)}
          icon={Crown}
          accent="accent"
          hint="اعطاشده در ماه جاری"
        />
      </div>

      {/* Filters */}
      <Card className="glass border-border/60">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو بر اساس نام کاربر، نام کاربری یا عنوان جایزه…"
              className="pr-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="md:w-48">
              <SelectValue placeholder="همه نوع‌ها" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه نوع‌ها</SelectItem>
              <SelectItem value="MONTHLY_WINNER">برنده ماهانه</SelectItem>
              <SelectItem value="WEEKLY_WINNER">برنده هفتگی</SelectItem>
              <SelectItem value="TOP_3">نفر برتر</SelectItem>
              <SelectItem value="SPECIAL">ویژه</SelectItem>
              <SelectItem value="ACHIEVEMENT">دستاورد</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-right">کاربر</TableHead>
                  <TableHead className="text-right">نوع</TableHead>
                  <TableHead className="text-right">عنوان</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    دوره
                  </TableHead>
                  <TableHead className="text-center">رتبه</TableHead>
                  <TableHead className="text-right">تاریخ</TableHead>
                  <TableHead className="text-center">اقدامات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-6 w-full rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12">
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/40">
                          <Trophy className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {query || typeFilter !== "ALL"
                            ? "هیچ جایزه‌ای مطابق با فیلترها یافت نشد"
                            : "هنوز جایزه‌ای اعطا نشده است"}
                        </p>
                        {!query && typeFilter === "ALL" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCreateOpen(true)}
                          >
                            <Trophy className="ml-2 h-4 w-4" />
                            اعطای اولین جایزه
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((award, idx) => {
                    const Icon = ICON_MAP[award.icon] || Trophy;
                    return (
                      <motion.tr
                        key={award.id}
                        custom={idx}
                        variants={fadeUp}
                        initial="hidden"
                        animate="show"
                        className="border-b border-border/40 transition-colors hover:bg-card/40"
                      >
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              {award.user.avatarUrl && (
                                <AvatarImage
                                  src={award.user.avatarUrl}
                                  alt={award.user.displayName}
                                />
                              )}
                              <AvatarFallback className="bg-secondary text-xs">
                                {award.user.displayName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {award.user.displayName}
                              </p>
                              <p className="font-mono text-xs text-muted-foreground">
                                @{award.user.username}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                              TYPE_BADGE_CLASS[award.type] ||
                                "bg-secondary text-foreground",
                            )}
                          >
                            <Icon className="h-3 w-3" />
                            {TYPE_LABELS[award.type] || award.type}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <p className="truncate text-sm font-medium">
                            {award.title}
                          </p>
                          {award.description && (
                            <p className="truncate text-xs text-muted-foreground">
                              {award.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                          {award.period || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-secondary/60 px-2 text-xs font-medium">
                            {toPersianDigits(award.rank)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatPersianDateShort(new Date(award.awardedAt))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(award)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </motion.tr>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create award dialog */}
      <AwardDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false);
          void fetchAwards();
        }}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف جایزه</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف جایزه{" "}
              <span className="font-medium text-foreground">
                «{deleteTarget?.title}»
              </span>{" "}
              متعلق به{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.user.displayName}
              </span>{" "}
              مطمئن هستید؟ این عمل غیرقابل بازگشت است.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "در حال حذف..." : "حذف جایزه"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminAwardsView;
