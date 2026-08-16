"use client";

/**
 * DashboardView — the command center of the user dashboard.
 * Sections: welcome bar, 3 stat cards, active tasks + running entry,
 * recent notifications, recent activity timeline.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  ListTodo,
  PauseCircle,
  Play,
  Sparkles,
  Square,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRouterStore } from "@/store/router";
import { useAuthStore } from "@/store/auth";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatDuration,
  formatDurationHuman,
  formatPersianDate,
  formatRelativeTime,
  toPersianDigits,
} from "@/utils/persian-date";

type Task = {
  id: string;
  title: string;
  description: string | null;
  targetSeconds: number;
  totalSeconds: number;
  status: "ACTIVE" | "DONE" | "CANCELLED";
  color: string;
  createdAt: string;
};

type TasksResp = { tasks: Task[] };

type ActiveEntry = {
  id: string;
  taskId: string;
  startedAt: string;
  task: { id: string; title: string; color: string };
} | null;

type ActiveResp = { entry: ActiveEntry };

type StatsResp = {
  stats: {
    todaySeconds: number;
    monthSeconds: number;
    totalSeconds: number;
    currentRank: number | null;
    prevRank: number | null;
    taskCounts: { ACTIVE: number; DONE: number; CANCELLED: number };
    dailyTotals: Array<{ date: string; seconds: number }>;
    taskDistribution: Array<{
      taskId: string;
      title: string;
      color: string;
      seconds: number;
    }>;
  };
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
};

type NotificationsResp = { notifications: NotificationItem[]; unreadCount: number };

type TimeEntry = {
  id: string;
  taskId: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  status: string;
  task: { id: string; title: string; color: string };
};

type EntriesResp = { entries: TimeEntry[]; totalSeconds: number; range: string };

const DAILY_GOAL_SECONDS = 4 * 3600;

const NOTIF_ICON: Record<string, React.ElementType> = {
  RANK_CHANGE: Trophy,
  LIKE: Sparkles,
  COMMENT: Bell,
  SYSTEM: Bell,
  TASK: ListTodo,
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: "easeOut" as const },
  }),
};

export function DashboardView() {
  const navigate = useRouterStore((s) => s.navigate);
  const user = useAuthStore((s) => s.user);

  const [stats, setStats] = useState<StatsResp["stats"] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeEntry, setActiveEntry] = useState<ActiveEntry>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // tick for the running entry display
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [statsRes, tasksRes, activeRes, notifRes, entriesRes] =
        await Promise.all([
          apiFetch<StatsResp>("/api/stats/me"),
          apiFetch<TasksResp>("/api/tasks?status=ACTIVE"),
          apiFetch<ActiveResp>("/api/time-entries/active"),
          apiFetch<NotificationsResp>("/api/notifications?filter=all"),
          apiFetch<EntriesResp>("/api/time-entries?range=all"),
        ]);
      if (!active) return;
      if (statsRes.ok && statsRes.data?.stats) setStats(statsRes.data.stats);
      if (tasksRes.ok && tasksRes.data?.tasks) setTasks(tasksRes.data.tasks);
      if (activeRes.ok && activeRes.data) setActiveEntry(activeRes.data.entry);
      if (notifRes.ok && notifRes.data?.notifications) {
        setNotifications(notifRes.data.notifications.slice(0, 4));
      }
      if (entriesRes.ok && entriesRes.data?.entries) {
        setRecentEntries(entriesRes.data.entries.slice(0, 5));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Ticking clock while a timer is running
  useEffect(() => {
    if (!activeEntry) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [activeEntry]);

  const elapsed =
    activeEntry && activeEntry.startedAt
      ? Math.floor(
          (Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000,
        )
      : 0;
  void tick;

  const handleStart = async (taskId: string) => {
    setBusy(true);
    const res = await apiFetch<ActiveResp>("/api/time-entries/start", {
      method: "POST",
      body: JSON.stringify({ taskId }),
    });
    setBusy(false);
    if (res.ok && res.data?.entry) {
      setActiveEntry(res.data.entry);
      toast.success("تایمر شروع شد");
      navigate("timer", res.data.entry.taskId);
    } else {
      toast.error(res.error || "خطا در شروع تایمر");
    }
  };

  const handleStopActive = async () => {
    if (!activeEntry) return;
    setBusy(true);
    const res = await apiFetch<{
      entry: TimeEntry;
      durationSec: number;
    }>(`/api/time-entries/${activeEntry.id}/stop`, { method: "POST" });
    setBusy(false);
    if (res.ok && res.data?.entry) {
      toast.success(
        `تایمر متوقف شد — ${formatDurationHuman(res.data.durationSec)}`,
      );
      setActiveEntry(null);
      // refresh stats + recent entries so the cards/timeline reflect new totals
      const [s, e] = await Promise.all([
        apiFetch<StatsResp>("/api/stats/me"),
        apiFetch<EntriesResp>("/api/time-entries?range=all"),
      ]);
      if (s.ok && s.data?.stats) setStats(s.data.stats);
      if (e.ok && e.data?.entries) setRecentEntries(e.data.entries.slice(0, 5));
    } else {
      toast.error(res.error || "خطا در توقف تایمر");
    }
  };

  const todaySeconds = stats?.todaySeconds ?? 0;
  const todayPct = Math.min(
    100,
    Math.round((todaySeconds / DAILY_GOAL_SECONDS) * 100),
  );
  const activeCount = stats?.taskCounts.ACTIVE ?? tasks.length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-8">
      <PageHeader
        title="داشبورد"
        description="خلاصه وضعیت فعالیت‌های امروز شما"
      />

      {/* Welcome bar */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={0}
      >
        <div className="glass relative overflow-hidden rounded-2xl border border-border/60 p-5 sm:p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -left-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-accent/10 blur-3xl"
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {formatPersianDate(new Date())}
              </p>
              <h2 className="mt-1 font-academic text-2xl font-bold text-foreground sm:text-3xl">
                سلام، {user?.displayName || "کاربر"}! 👋
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                خلاصه وضعیت شما:
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("timer")}>
                <Play className="h-4 w-4" />
                شروع تایمر
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("stats")}>
                <Trophy className="h-4 w-4" />
                مشاهده آمار
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 3 Stat cards */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={1}
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {loading ? (
          <>
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </>
        ) : (
          <>
            <StatCard
              label="تایم امروز"
              value={formatDurationHuman(todaySeconds)}
              icon={Clock}
              hint={`${toPersianDigits(todayPct)}٪ از هدف ۴ ساعت روزانه`}
              accent="primary"
            />
            <StatCard
              label="رتبه فعلی"
              value={
                stats?.currentRank
                  ? `#${toPersianDigits(stats.currentRank)}`
                  : "—"
              }
              icon={Trophy}
              hint={
                stats?.prevRank && stats.currentRank
                  ? stats.prevRank > stats.currentRank
                    ? `صعود ${toPersianDigits(stats.prevRank - stats.currentRank)} پله`
                    : stats.prevRank < stats.currentRank
                      ? `سقوط ${toPersianDigits(stats.currentRank - stats.prevRank)} پله`
                      : "بدون تغییر نسبت به دیروز"
                  : "بدون تغییر نسبت به دیروز"
              }
              accent="primary"
            />
            <StatCard
              label="تسک‌های فعال"
              value={toPersianDigits(activeCount)}
              icon={ListTodo}
              hint={`${toPersianDigits(stats?.taskCounts.DONE ?? 0)} تسک تکمیل‌شده`}
              accent="accent"
            />
          </>
        )}
      </motion.div>

      {/* Active tasks + Running entry */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={2}
        >
          <Card className="h-full">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-academic text-lg font-bold text-foreground">
                  تسک‌های فعال
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("tasks")}
                >
                  همه
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>

              {activeEntry && (
                <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <PauseCircle className="h-5 w-5 shrink-0 animate-soft-pulse text-primary" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">
                          در حال انجام
                        </p>
                        <p className="truncate text-sm font-medium text-foreground">
                          {activeEntry.task.title}
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-mono text-lg font-bold text-primary">
                        {formatDuration(elapsed)}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1 h-7 text-xs"
                        disabled={busy}
                        onClick={handleStopActive}
                      >
                        <Square className="h-3 w-3" />
                        توقف
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                <EmptyState
                  icon={ListTodo}
                  title="تسک فعالی ندارید"
                  hint="یک تسک جدید بسازید تا شروع کنید"
                  actionLabel="ایجاد تسک"
                  onAction={() => navigate("tasks")}
                />
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                  {tasks.slice(0, 6).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 transition-colors hover:bg-card/70"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {t.title}
                        </p>
                        {t.description && (
                          <p className="truncate text-xs text-muted-foreground">
                            {t.description}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 shrink-0"
                        disabled={busy}
                        onClick={() => handleStart(t.id)}
                      >
                        <Play className="h-3.5 w-3.5" />
                        شروع
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent notifications */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={3}
        >
          <Card className="h-full">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-academic text-lg font-bold text-foreground">
                  اعلان‌های اخیر
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("notifications")}
                >
                  مشاهده همه
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="اعلان جدیدی وجود ندارد"
                  hint="اعلان‌های رتبه‌بندی و تعاملات اینجا نمایش داده می‌شوند"
                />
              ) : (
                <div className="space-y-2">
                  {notifications.map((n) => {
                    const Icon = NOTIF_ICON[n.type] || Bell;
                    return (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                          n.isRead
                            ? "border-border/40 bg-card/30"
                            : "border-primary/30 bg-primary/5"
                        }`}
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary/60 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {n.title}
                          </p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {n.message}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {formatRelativeTime(new Date(n.createdAt))}
                          </p>
                        </div>
                        {!n.isRead && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent activity timeline */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={4}
      >
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-academic text-lg font-bold text-foreground">
                فعالیت‌های اخیر
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("stats")}
              >
                مشاهده آمار کامل
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : recentEntries.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="هنوز فعالیتی ثبت نشده"
                hint="با شروع تایمر روی یک تسک، اولین فعالیت خود را ثبت کنید"
                actionLabel="رفتن به تایمر"
                onAction={() => navigate("timer")}
              />
            ) : (
              <div className="relative space-y-3 pr-3">
                {recentEntries.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/30 p-3"
                  >
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: e.task.color || "#e0cba8" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {e.task.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatRelativeTime(new Date(e.startedAt))}
                      </p>
                    </div>
                    {e.status === "COMPLETED" ? (
                      <Badge
                        variant="secondary"
                        className="font-mono text-primary"
                      >
                        {formatDurationHuman(e.durationSec)}
                      </Badge>
                    ) : e.status === "CANCELLED" ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        لغوشده
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-primary">
                        <PauseCircle className="h-3 w-3" />
                        در حال انجام
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon: React.ElementType;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/30 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {hint && (
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{hint}</p>
      )}
      {actionLabel && onAction && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onAction}
        >
          <CheckCircle2 className="h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default DashboardView;
