"use client";

/**
 * AdminRankingsView — current competition period + top 10 leaderboard
 * preview + period history (sample data) + reset button (placeholder).
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  Crown,
  History,
  Medal,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  PERSIAN_MONTHS,
  formatDurationHuman,
  jalaliMonthLength,
  toJalali,
  toPersianDigits,
} from "@/utils/persian-date";

type LeaderRow = {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  totalSeconds: number;
  taskCount: number;
  topThree: boolean;
};

type LeaderboardResp = {
  range: string;
  from: string;
  leaderboard: LeaderRow[];
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: "easeOut" as const },
  }),
};

// Static sample period history (placeholder)
const PERIOD_HISTORY = [
  {
    name: "مرداد ۱۴۰۳",
    winner: "امیر محمدی",
    total: "۱٬۲۴۰ ساعت",
    endedAt: "۱۴۰۳/۰۵/۳۱",
    status: "ENDED",
  },
  {
    name: "تیر ۱۴۰۳",
    winner: "مریم احمدی",
    total: "۱٬۰۸۰ ساعت",
    endedAt: "۱۴۰۳/۰۴/۳۱",
    status: "ENDED",
  },
  {
    name: "خرداد ۱۴۰۳",
    winner: "علی رضایی",
    total: "۹۶۵ ساعت",
    endedAt: "۱۴۰۳/۰۳/۳۱",
    status: "ENDED",
  },
];

export function AdminRankingsView() {
  const [data, setData] = useState<LeaderboardResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await apiFetch<LeaderboardResp>(
        "/api/leaderboard?range=month",
      );
      if (!active) return;
      if (res.ok && res.data) setData(res.data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const currentPeriod = useMemo(() => {
    const now = new Date();
    const j = toJalali(now);
    const monthName = PERSIAN_MONTHS[j.jm - 1];
    const daysInMonth = jalaliMonthLength(j.jy, j.jm);
    return {
      name: `${monthName} ${toPersianDigits(j.jy)}`,
      day: j.jd,
      totalDays: daysInMonth,
    };
  }, []);

  const top10 = data?.leaderboard.slice(0, 10) ?? [];

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 space-y-6">
      <PageHeader
        title="رتبه‌بندی و دوره‌ها"
        description="مدیریت دوره‌های رقابتی و مشاهده leaderboard ماه جاری"
        action={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw className="h-4 w-4" />
            بازنشانی رقابت
          </Button>
        }
      />

      {/* Current period card */}
      <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show">
        <Card className="glass-strong border-primary/30">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary/15 text-primary">
              <CalendarClock className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">دوره فعال رقابت</p>
              <h2 className="font-academic text-2xl font-bold text-foreground">
                {currentPeriod.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                روز {toPersianDigits(currentPeriod.day)} از{" "}
                {toPersianDigits(currentPeriod.totalDays)} ماه
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-card/40 px-4 py-3">
              <span className="text-xs text-muted-foreground">پیشرفت ماه</span>
              <span className="font-academic text-xl font-bold text-primary">
                {toPersianDigits(
                  Math.round((currentPeriod.day / currentPeriod.totalDays) * 100),
                )}
                ٪
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Top 10 leaderboard preview */}
      <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show">
        <Card className="glass border-border/60">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle className="font-academic text-lg">
                ۱۰ نفر برتر ماه
              </CardTitle>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Medal className="h-3 w-3" />
              {toPersianDigits(top10.length)} نفر
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : top10.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/40">
                  <Trophy className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  هنوز تایم فعالی در این ماه ثبت نشده است
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-16 text-right">رتبه</TableHead>
                      <TableHead className="text-right">کاربر</TableHead>
                      <TableHead className="text-right">مجموع تایم</TableHead>
                      <TableHead className="text-right">تسک‌ها</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {top10.map((r) => (
                      <TableRow
                        key={r.id}
                        className="border-b border-border/40 transition-colors hover:bg-card/40"
                      >
                        <TableCell>
                          <div className="flex items-center justify-center">
                            {r.rank === 1 ? (
                              <Crown className="h-5 w-5 text-primary" />
                            ) : r.rank <= 3 ? (
                              <Badge className="bg-primary/15 text-primary border border-primary/30 font-mono">
                                {toPersianDigits(r.rank)}
                              </Badge>
                            ) : (
                              <span className="font-mono text-sm text-muted-foreground">
                                {toPersianDigits(r.rank)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              {r.avatarUrl && (
                                <AvatarImage
                                  src={r.avatarUrl}
                                  alt={r.displayName}
                                />
                              )}
                              <AvatarFallback className="bg-secondary text-[10px]">
                                {r.displayName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {r.displayName}
                              </p>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                @{r.username}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-academic text-sm font-bold text-foreground">
                          {formatDurationHuman(r.totalSeconds)}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {toPersianDigits(r.taskCount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Period history */}
      <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show">
        <Card className="glass border-border/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-accent" />
              <CardTitle className="font-academic text-lg">
                تاریخچه دوره‌های پیشین
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {PERIOD_HISTORY.map((p) => (
              <div
                key={p.name}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-card/40 p-3"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary/40">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    برنده: {p.winner}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-academic text-sm font-bold text-primary">
                    {p.total}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    پایان: {p.endedAt}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Reset dialog (placeholder) */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>بازنشانی دوره رقابت</AlertDialogTitle>
            <AlertDialogDescription>
              این عملیات تمام امتیازات ماه جاری را آرشیو و یک دوره جدید آغاز
              می‌کند. این اقدام قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                toast.info("این قابلیت در نسخه بعد فعال خواهد شد")
              }
            >
              بازنشانی
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminRankingsView;
