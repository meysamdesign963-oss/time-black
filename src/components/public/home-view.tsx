"use client";

/**
 * HomeView — landing page for Time Black.
 * Sections: Hero, Stats Bar, Top-3 Podium, How It Works.
 * Full-width, RTL, framer-motion entrance animations.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Crown,
  ListTodo,
  Medal,
  Play,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouterStore } from "@/store/router";
import { useAuthStore } from "@/store/auth";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatDurationHuman,
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
  from: string;
  leaderboard: LeaderEntry[];
};

const STATS = [
  {
    label: "کاربران فعال",
    value: "۱٬۲۴۸",
    icon: Users,
    hint: "در ۳۰ روز گذشته",
  },
  {
    label: "تایم ثبت‌شده این ماه",
    value: "۱۵٬۳۶۰ ساعت",
    icon: Clock,
    hint: "مجموع فعالیت کاربران",
  },
  {
    label: "تسک‌های تکمیل‌شده",
    value: "۸٬۹۲۰",
    icon: ListTodo,
    hint: "از ابتدای ماه",
  },
  {
    label: "رقابت‌های انجام‌شده",
    value: "۳۲",
    icon: Trophy,
    hint: "دوره‌های ماهانه",
  },
];

const STEPS = [
  {
    icon: UserPlus,
    title: "ثبت‌نام و ایجاد تسک",
    desc: "حساب بسازید و وظایف روزمره خود را تعریف کنید.",
  },
  {
    icon: Play,
    title: "شروع تایمر",
    desc: "روی تسک مورد نظر تایمر را فعال کنید تا زمان دقیق ثبت شود.",
  },
  {
    icon: Trophy,
    title: "رقابت و رشد",
    desc: "در رتبه‌بندی ماهانه با سایر کاربران رقابت کنید و رشد کنید.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

export function HomeView() {
  const navigate = useRouterStore((s) => s.navigate);
  const user = useAuthStore((s) => s.user);
  const [top, setTop] = useState<LeaderEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const res = await apiFetch<LeaderboardResp>(
        "/api/leaderboard?range=month",
      );
      if (res.ok && res.data?.leaderboard) {
        setTop(res.data.leaderboard.slice(0, 3));
      } else {
        setTop([]);
      }
      setLoading(false);
    };
    run();
  }, []);

  const handleCta = () => {
    if (user) navigate("dashboard");
    else navigate("register");
  };

  // Podium ordering: 2nd (right), 1st (center), 3rd (left)
  const podiumOrder: Array<{ entry: LeaderEntry | null; rank: number }> = [
    { entry: top?.[1] ?? null, rank: 2 },
    { entry: top?.[0] ?? null, rank: 1 },
    { entry: top?.[2] ?? null, rank: 3 },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 px-6 py-12 sm:px-10 sm:py-16 lg:px-16 lg:py-20">
        {/* Decorative blurred circles */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent/15 blur-3xl"
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            پلتفرم رقابت تایم‌محور
          </motion.div>
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={1}
            className="mt-5 font-academic text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl"
          >
            <span className="text-gradient-gold">رقابت تایم‌محور</span>
            <br />
            <span className="text-foreground">برای بهره‌وری بیشتر</span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={2}
            className="mt-5 text-sm text-muted-foreground sm:text-base lg:text-lg"
          >
            تسک‌های خود را تعریف کنید، تایمر را فعال کنید و در رتبه‌بندی ماهانه با
            دیگران رقابت کنید. هر ثانیه مهم است.
          </motion.p>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={3}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button size="lg" onClick={handleCta} className="w-full sm:w-auto">
              {user ? "ورود به داشبورد" : "شروع کنید"}
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("leaderboard")}
              className="w-full sm:w-auto"
            >
              <Trophy className="h-4 w-4" />
              مشاهده رتبه‌بندی
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={i}
          >
            <Card className="card-lift h-full gap-2 py-4">
              <CardContent className="px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="mt-1 font-academic text-xl font-bold text-foreground sm:text-2xl">
                      {s.value}
                    </p>
                    {s.hint && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {s.hint}
                      </p>
                    )}
                  </div>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary/60 text-primary">
                    <s.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>

      {/* Top 3 Podium */}
      <section className="mt-10 lg:mt-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-academic text-2xl font-bold text-foreground sm:text-3xl">
              <span className="text-gradient-gold">نفرات برتر</span> ماه
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              برترین‌ترین‌های رتبه‌بندی ماه جاری بر اساس مجموع تایم ثبت‌شده
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => navigate("leaderboard")}
          >
            مشاهده رتبه‌بندی کامل
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
          {podiumOrder.map(({ entry, rank }, idx) => {
            const isFirst = rank === 1;
            return (
              <motion.div
                key={`${rank}-${entry?.id ?? "empty"}`}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={idx}
                className={isFirst ? "sm:-mt-6" : ""}
              >
                {loading ? (
                  <PodiumCardSkeleton rank={rank} />
                ) : entry ? (
                  <PodiumCard entry={entry} rank={rank} />
                ) : (
                  <EmptyPodiumCard rank={rank} />
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="mt-6 sm:hidden">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("leaderboard")}
          >
            مشاهده رتبه‌بندی کامل
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* How It Works */}
      <section className="mt-12 lg:mt-16">
        <div className="mb-6 text-center">
          <h2 className="font-academic text-2xl font-bold text-foreground sm:text-3xl">
            چگونه کار می‌کند؟
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            در سه قدم ساده به رقابت بپیوندید
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={i}
            >
              <Card className="card-lift h-full">
                <CardContent className="flex h-full flex-col gap-3 px-6">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <s.icon className="h-5 w-5" />
                    </div>
                    <span className="font-academic text-sm text-muted-foreground">
                      قدم {toPersianDigits(i + 1)}
                    </span>
                  </div>
                  <h3 className="font-academic text-lg font-bold text-foreground">
                    {s.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PodiumCard({ entry, rank }: { entry: LeaderEntry; rank: number }) {
  const navigate = useRouterStore((s) => s.navigate);
  const isFirst = rank === 1;
  const medalColor =
    rank === 1 ? "text-primary" : rank === 2 ? "text-foreground/80" : "text-foreground/60";

  return (
    <button
      type="button"
      onClick={() => navigate("profile", entry.username)}
      className={`group block w-full rounded-2xl border p-5 text-center transition-all card-lift ${
        isFirst
          ? "border-primary/40 bg-card shadow-[0_0_30px_-8px_rgba(224,203,168,0.35)]"
          : "border-border/60 bg-card/70"
      }`}
    >
      <div className="mb-3 flex items-center justify-center">
        {rank === 1 ? (
          <Crown className={`h-7 w-7 ${medalColor}`} />
        ) : (
          <Medal className={`h-6 w-6 ${medalColor}`} />
        )}
      </div>
      <Avatar
        className={`mx-auto ${
          isFirst ? "h-20 w-20" : "h-16 w-16"
        } border-2 ${isFirst ? "border-primary/60" : "border-border/60"}`}
      >
        {entry.avatarUrl ? (
          <AvatarImage src={entry.avatarUrl} alt={entry.displayName} />
        ) : null}
        <AvatarFallback className="bg-secondary text-foreground">
          {entry.displayName?.charAt(0) || "؟"}
        </AvatarFallback>
      </Avatar>
      <h3 className="mt-3 truncate font-academic text-sm font-bold text-foreground sm:text-base">
        {entry.displayName}
      </h3>
      <p className="text-xs text-muted-foreground">@{entry.username}</p>
      <p className="mt-2 text-sm font-medium text-primary">
        {formatDurationHuman(entry.totalSeconds)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {toPersianDigits(entry.taskCount)} تسک
      </p>
      <span className="mt-3 inline-block rounded-md bg-secondary/60 px-2 py-0.5 text-xs font-medium text-foreground">
        رتبه {toPersianDigits(rank)}
      </span>
    </button>
  );
}

function EmptyPodiumCard({ rank }: { rank: number }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-5 text-center">
      <div className="mb-3 flex items-center justify-center">
        <Medal className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <div className="mx-auto h-16 w-16 rounded-full border-2 border-dashed border-border/60" />
      <h3 className="mt-3 text-sm text-muted-foreground">موقعیت خالی</h3>
      <p className="mt-2 text-[11px] text-muted-foreground">
        رتبه {toPersianDigits(rank)} در انتظار نخبگان
      </p>
    </div>
  );
}

function PodiumCardSkeleton({ rank }: { rank: number }) {
  const isFirst = rank === 1;
  return (
    <div
      className={`rounded-2xl border border-border/60 bg-card/70 p-5 text-center ${
        isFirst ? "shadow-[0_0_30px_-8px_rgba(224,203,168,0.2)]" : ""
      }`}
    >
      <Skeleton className="mx-auto h-6 w-6 rounded-full" />
      <Skeleton
        className={`mx-auto mt-3 rounded-full ${isFirst ? "h-20 w-20" : "h-16 w-16"}`}
      />
      <Skeleton className="mx-auto mt-3 h-4 w-24" />
      <Skeleton className="mx-auto mt-2 h-3 w-20" />
      <Skeleton className="mx-auto mt-2 h-4 w-28" />
    </div>
  );
}

export default HomeView;
