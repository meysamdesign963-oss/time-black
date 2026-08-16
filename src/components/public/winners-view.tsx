"use client";

/**
 * WinnersView — Hall of Fame (تالار افتخارات)
 * ---------------------------------------------
 * Public view that showcases:
 *   - Hero header (gold gradient)
 *   - Current month podium (top 3 from leaderboard)
 *   - Previous monthly winners grid (from awards API)
 *   - All-time top 10 list
 *   - Achievement badge showcase (award types legend)
 *   - Live "زنده" pulse indicator + 60s auto-refresh
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Award as AwardIcon,
  Calendar,
  Clock,
  Crown,
  ListTodo,
  Medal,
  Sparkles,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouterStore } from "@/store/router";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatDurationHuman,
  formatPersianDate,
  formatRelativeTime,
  toPersianDigits,
} from "@/utils/persian-date";
import { cn } from "@/lib/utils";

// ---------- Types ----------
type LeaderEntry = {
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
  leaderboard: LeaderEntry[];
};

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

// ---------- Award type metadata ----------
const AWARD_TYPE_META: Record<
  string,
  { label: string; icon: React.ElementType; color: string; description: string }
> = {
  MONTHLY_WINNER: {
    label: "برنده ماهانه",
    icon: Trophy,
    color: "#e0cba8",
    description: "کاربری که بیشترین تایم را در یک ماه ثبت کرده است.",
  },
  WEEKLY_WINNER: {
    label: "برنده هفتگی",
    icon: Medal,
    color: "#8FBC8F",
    description: "کاربر برتر در پایان هر هفته.",
  },
  TOP_3: {
    label: "نفر برتر",
    icon: Crown,
    color: "#D4AF37",
    description: "سه نفر برتر دوره‌های رقابت.",
  },
  SPECIAL: {
    label: "دستاورد ویژه",
    icon: Star,
    color: "#E89A4F",
    description: "تقدیر از فعالیت‌های فوق‌العاده و نمونه.",
  },
  ACHIEVEMENT: {
    label: "دستاورد",
    icon: AwardIcon,
    color: "#C589E8",
    description: "دستاوردهای خاص و قابل تقدیر کاربران.",
  },
};

const ICON_MAP: Record<string, React.ElementType> = {
  trophy: Trophy,
  medal: Medal,
  crown: Crown,
  star: Star,
  award: AwardIcon,
};

const PULSE_INDICATOR_REFRESH_MS = 60_000;

// ---------- Helpers ----------
function rankRowClass(rank: number): string {
  if (rank === 1) return "bg-primary/10 hover:bg-primary/15";
  if (rank === 2) return "bg-secondary/40 hover:bg-secondary/60";
  if (rank === 3) return "bg-primary/5 hover:bg-primary/10";
  return "hover:bg-card/40";
}

function rankBadgeClass(rank: number): string {
  if (rank === 1) return "bg-primary text-primary-foreground";
  if (rank === 2) return "bg-secondary text-foreground border border-border";
  if (rank === 3)
    return "bg-primary/20 text-primary border border-primary/40";
  return "bg-muted/30 text-muted-foreground";
}

// ---------- Podium (top 3) ----------
function Podium({
  top3,
  loading,
}: {
  top3: LeaderEntry[];
  loading: boolean;
}) {
  const navigate = useRouterStore((s) => s.navigate);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
        <Skeleton className="h-60 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
    );
  }

  if (top3.length === 0) {
    return (
      <Card className="glass border-border/60">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/40">
            <Trophy className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-academic text-base font-bold text-foreground">
            هنوز برنده‌ای در ماه جاری ثبت نشده
          </p>
          <p className="text-sm text-muted-foreground">
            با ثبت تایم‌های تمرکز، نخستین برنده ماه می‌توانید شما باشید.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Visual order in RTL: silver (left in DOM = right visually in LTR? careful):
  // We want the gold (#1) center, silver (#2) right, bronze (#3) left in RTL.
  // In RTL with grid, items flow right-to-left, so first grid item appears on the right.
  // To get silver on the right and bronze on the left, we order DOM: bronze, gold, silver.
  // Wait — re-read spec: "1st place center (larger), 2nd right (silver), 3rd left (bronze)"
  // In RTL: right is the "start".  So silver should appear at start (right), gold center, bronze left.
  // With CSS grid in RTL, first DOM item appears at the right. So order: silver(2), gold(1), bronze(3).
  const order: (LeaderEntry | null)[] = [
    top3[1] ?? null, // silver (rank 2) — visual right in RTL
    top3[0] ?? null, // gold (rank 1) — center
    top3[2] ?? null, // bronze (rank 3) — visual left
  ];

  const podiumStyles = [
    {
      // silver
      height: "sm:h-56",
      ring: "ring-border",
      glow: "",
      crown: null,
      icon: Medal,
      iconColor: "text-muted-foreground",
      badge: "bg-secondary text-foreground border border-border",
      label: "نفر دوم",
      crownBadge: null as React.ReactNode,
    },
    {
      // gold
      height: "sm:h-72",
      ring: "ring-primary/50",
      glow: "shadow-[0_0_45px_-10px_rgba(224,203,168,0.45)]",
      crown: <Crown className="h-6 w-6 text-primary" />,
      icon: Trophy,
      iconColor: "text-primary",
      badge: "bg-primary text-primary-foreground",
      label: "برنده ماه جاری",
      crownBadge: (
        <Badge className="bg-primary/15 text-primary border border-primary/40 gap-1">
          <Crown className="h-3 w-3" />
          قهرمان
        </Badge>
      ),
    },
    {
      // bronze
      height: "sm:h-48",
      ring: "ring-primary/30",
      glow: "",
      crown: null,
      icon: AwardIcon,
      iconColor: "text-primary/80",
      badge: "bg-primary/20 text-primary border border-primary/40",
      label: "نفر سوم",
      crownBadge: null as React.ReactNode,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
      {order.map((entry, i) => {
        const style = podiumStyles[i];
        if (!entry) {
          return (
            <Card
              key={`empty-${i}`}
              className={cn(
                "glass flex h-40 items-center justify-center border-border/60",
                style.height,
              )}
            >
              <p className="text-xs text-muted-foreground">—</p>
            </Card>
          );
        }
        const Icon = style.icon;
        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.15 + i * 0.15,
              duration: 0.55,
              ease: "easeOut",
            }}
          >
            <Card
              className={cn(
                "glass card-lift relative cursor-pointer overflow-hidden rounded-2xl border-border/60 ring-1 transition-all",
                style.height,
                style.ring,
                style.glow,
              )}
              onClick={() => navigate("profile", entry.username)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate("profile", entry.username);
                }
              }}
            >
              {/* Gold radial glow */}
              {i === 1 && (
                <div
                  className="pointer-events-none absolute inset-0 opacity-60"
                  style={{
                    background:
                      "radial-gradient(ellipse at top, rgba(224,203,168,0.18), transparent 60%)",
                  }}
                />
              )}

              <CardContent className="relative flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
                {style.crown && (
                  <motion.div
                    initial={{ scale: 0, rotate: -25 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      delay: 0.55 + i * 0.15,
                      type: "spring",
                      stiffness: 220,
                      damping: 14,
                    }}
                  >
                    {style.crown}
                  </motion.div>
                )}
                <div className="relative">
                  <Avatar
                    className={cn(
                      "border-2",
                      i === 1
                        ? "h-24 w-24 border-primary"
                        : "h-16 w-16 border-border",
                    )}
                  >
                    {entry.avatarUrl && (
                      <AvatarImage
                        src={entry.avatarUrl}
                        alt={entry.displayName}
                      />
                    )}
                    <AvatarFallback className="bg-secondary text-primary">
                      {entry.displayName?.charAt(0) || "؟"}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-bold",
                      style.badge,
                    )}
                  >
                    {toPersianDigits(entry.rank)}
                  </span>
                </div>

                <div className="min-w-0 space-y-1">
                  <p className="truncate font-academic text-base font-bold text-foreground">
                    {entry.displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{entry.username}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Clock className="h-3 w-3" />
                    {formatDurationHuman(entry.totalSeconds)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <ListTodo className="h-3 w-3" />
                    {toPersianDigits(entry.taskCount)} تسک
                  </span>
                </div>

                {style.crownBadge}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------- Previous monthly winners (from awards) ----------
function PastWinnersGrid({
  awards,
  loading,
}: {
  awards: AwardItem[];
  loading: boolean;
}) {
  const navigate = useRouterStore((s) => s.navigate);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (awards.length === 0) {
    return (
      <Card className="glass border-border/60">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary/40">
            <Medal className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            هنوز برنده ماهانه‌ای در تالار افتخارات ثبت نشده است.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {awards.map((award, idx) => {
        const Icon = ICON_MAP[award.icon] || Trophy;
        return (
          <motion.div
            key={award.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: idx * 0.06,
              duration: 0.4,
              ease: "easeOut",
            }}
          >
            <Card
              className="glass card-lift cursor-pointer overflow-hidden border-border/60 transition-all hover:border-primary/40"
              onClick={() => navigate("profile", award.user.username)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate("profile", award.user.username);
                }
              }}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
                  style={{
                    backgroundColor: `${award.color}20`,
                    color: award.color,
                  }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <Avatar className="h-11 w-11 border border-border">
                  {award.user.avatarUrl && (
                    <AvatarImage
                      src={award.user.avatarUrl}
                      alt={award.user.displayName}
                    />
                  )}
                  <AvatarFallback className="bg-secondary text-xs">
                    {award.user.displayName?.charAt(0) || "؟"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {award.user.displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{award.user.username}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    {award.period && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {award.period}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(new Date(award.awardedAt))}
                    </span>
                  </div>
                </div>
                {award.rank > 0 && award.rank <= 3 && (
                  <Badge
                    className="shrink-0"
                    style={{
                      backgroundColor: `${award.color}20`,
                      color: award.color,
                      border: `1px solid ${award.color}60`,
                    }}
                  >
                    رتبه {toPersianDigits(award.rank)}
                  </Badge>
                )}
              </CardContent>
              {award.title && (
                <div className="border-t border-border/40 bg-secondary/20 px-4 py-2">
                  <p className="truncate text-xs font-medium text-foreground">
                    {award.title}
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------- All-time top 10 table ----------
function Top10Table({
  entries,
  loading,
}: {
  entries: LeaderEntry[];
  loading: boolean;
}) {
  const navigate = useRouterStore((s) => s.navigate);

  if (loading) {
    return (
      <Card className="glass overflow-hidden border-border/60">
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="glass border-border/60">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary/40">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            هنوز کاربری در رتبه‌بندی ماه جاری حضور ندارد.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass overflow-hidden border-border/60">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-secondary/40 hover:bg-secondary/40">
              <TableHead className="w-16 text-center">رتبه</TableHead>
              <TableHead>کاربر</TableHead>
              <TableHead className="text-center">مجموع تایم</TableHead>
              <TableHead className="hidden text-center sm:table-cell">
                تعداد تسک
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                onClick={() => navigate("profile", entry.username)}
                className={cn(
                  "cursor-pointer border-border/40 transition-colors",
                  rankRowClass(entry.rank),
                )}
              >
                <TableCell className="text-center">
                  <span
                    className={cn(
                      "inline-grid h-7 min-w-7 place-items-center rounded-full px-2 text-xs font-bold",
                      rankBadgeClass(entry.rank),
                    )}
                  >
                    {toPersianDigits(entry.rank)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border/60">
                      {entry.avatarUrl && (
                        <AvatarImage
                          src={entry.avatarUrl}
                          alt={entry.displayName}
                        />
                      )}
                      <AvatarFallback className="bg-secondary text-xs">
                        {entry.displayName?.charAt(0) || "؟"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {entry.displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{entry.username}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm font-medium text-primary">
                    {formatDurationHuman(entry.totalSeconds)}
                  </span>
                </TableCell>
                <TableCell className="hidden text-center sm:table-cell">
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <ListTodo className="h-3.5 w-3.5" />
                    {toPersianDigits(entry.taskCount)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

// ---------- Achievement showcase ----------
function AchievementShowcase() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {Object.entries(AWARD_TYPE_META).map(([key, meta], idx) => {
        const Icon = meta.icon;
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: idx * 0.08,
              duration: 0.4,
              ease: "easeOut",
            }}
          >
            <Card className="glass card-lift h-full border-border/60">
              <CardContent className="flex h-full flex-col items-center gap-3 p-5 text-center">
                <div
                  className="grid h-14 w-14 place-items-center rounded-full"
                  style={{
                    backgroundColor: `${meta.color}20`,
                    color: meta.color,
                    border: `1px solid ${meta.color}40`,
                  }}
                >
                  <Icon className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <p
                    className="text-sm font-bold"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {meta.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------- Main view ----------
export function WinnersView() {
  const navigate = useRouterStore((s) => s.navigate);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [loadingLeader, setLoadingLeader] = useState(true);
  const [monthlyAwards, setMonthlyAwards] = useState<AwardItem[]>([]);
  const [loadingAwards, setLoadingAwards] = useState(true);

  const fetchLeaderboard = useCallback(async (silent = false) => {
    if (!silent) setLoadingLeader(true);
    const res = await apiFetch<LeaderboardResp>(
      "/api/leaderboard?range=month",
    );
    if (res.ok && res.data?.leaderboard) {
      setLeaderboard(res.data.leaderboard);
    } else if (!silent) {
      setLeaderboard([]);
    }
    if (!silent) setLoadingLeader(false);
  }, []);

  const fetchAwards = useCallback(async (silent = false) => {
    if (!silent) setLoadingAwards(true);
    const res = await apiFetch<AwardsResp>(
      "/api/admin/awards?page=1&limit=50",
    );
    if (res.ok && res.data?.awards) {
      // Publicly visible: all MONTHLY_WINNER + TOP_3 awards (these are public achievements)
      // If admin endpoint returns 403 for non-admin, just hide the past winners section.
      const filtered = res.data.awards.filter(
        (a) => a.type === "MONTHLY_WINNER" || a.type === "TOP_3",
      );
      setMonthlyAwards(filtered);
    } else if (!silent) {
      setMonthlyAwards([]);
    }
    if (!silent) setLoadingAwards(false);
  }, []);

  // Initial fetch — call inside effect, setState only after await resolves
  useEffect(() => {
    let active = true;
    (async () => {
      const [lb, aw] = await Promise.all([
        apiFetch<LeaderboardResp>("/api/leaderboard?range=month"),
        apiFetch<AwardsResp>("/api/admin/awards?page=1&limit=50"),
      ]);
      if (!active) return;
      if (lb.ok && lb.data?.leaderboard) setLeaderboard(lb.data.leaderboard);
      if (aw.ok && aw.data?.awards) {
        const filtered = aw.data.awards.filter(
          (a) => a.type === "MONTHLY_WINNER" || a.type === "TOP_3",
        );
        setMonthlyAwards(filtered);
      }
      setLoadingLeader(false);
      setLoadingAwards(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Auto-refresh every 60s (silent)
  useEffect(() => {
    const id = setInterval(() => {
      void fetchLeaderboard(true);
      void fetchAwards(true);
    }, PULSE_INDICATOR_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchLeaderboard, fetchAwards]);

  const top3 = useMemo(
    () => leaderboard.slice(0, 3),
    [leaderboard],
  );
  const top10 = useMemo(
    () => leaderboard.slice(0, 10),
    [leaderboard],
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-6 lg:px-8">
      {/* Hero header */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-10"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(ellipse at top right, rgba(224,203,168,0.18), transparent 55%)",
          }}
        />
        <div className="relative flex flex-col gap-4 text-center sm:text-right">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Trophy className="h-6 w-6" />
            </div>
            <h1 className="text-gradient-gold font-academic text-3xl font-extrabold sm:text-4xl lg:text-5xl">
              تالار افتخارات
            </h1>
          </div>
          <p className="text-sm text-muted-foreground sm:text-base">
            برندگان دوره‌های قبلی رقابت ماهانه — تمرکز، نظم و پیروزی.
          </p>

          {/* Live indicator */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              زنده
            </span>
            <span className="text-xs text-muted-foreground">
              هر روز به‌روزرسانی می‌شود
            </span>
          </div>
        </div>
      </motion.section>

      {/* Current month podium */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          <h2 className="font-academic text-xl font-bold text-foreground sm:text-2xl">
            سکوی ماه جاری
          </h2>
        </div>
        <Podium top3={top3} loading={loadingLeader} />
      </section>

      {/* All-time top 10 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" />
          <h2 className="font-academic text-xl font-bold text-foreground sm:text-2xl">
            جدول رتبه‌بندی ماه جاری
          </h2>
        </div>
        <Top10Table entries={top10} loading={loadingLeader} />
      </section>

      {/* Previous monthly winners */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Medal className="h-5 w-5 text-primary" />
          <h2 className="font-academic text-xl font-bold text-foreground sm:text-2xl">
            برندگان دوره‌های پیشین
          </h2>
        </div>
        <PastWinnersGrid awards={monthlyAwards} loading={loadingAwards} />
      </section>

      {/* Achievement showcase */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-academic text-xl font-bold text-foreground sm:text-2xl">
            نشان‌های افتخار
          </h2>
        </div>
        <AchievementShowcase />
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card/40 p-6 text-center sm:p-8">
        <Trophy className="h-10 w-10 text-primary" />
        <p className="font-academic text-lg font-bold text-foreground">
          می‌خواهید نام شما هم در این تالار ثبت شود؟
        </p>
        <p className="max-w-xl text-sm text-muted-foreground">
          هر روز تایم‌های تمرکز خود را ثبت کنید تا در پایان ماه، برنده رقابت
          باشید.
        </p>
        <Button
          onClick={() => navigate("register")}
          className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          شروع رقابت
        </Button>
      </section>
    </div>
  );
}

export default WinnersView;
