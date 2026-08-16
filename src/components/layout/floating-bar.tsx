"use client";

/**
 * Floating User Bar — fixed bottom strip in dashboard pages.
 * Shows today's time · current rank · active tasks.
 * Clickable to jump to relevant pages.
 */
import { useEffect, useState } from "react";
import { Clock, Trophy, ListTodo, TrendingUp, TrendingDown } from "lucide-react";
import { useRouterStore } from "@/store/router";
import { useAuthStore } from "@/store/auth";
import { apiFetch } from "@/utils/api-fetch";
import { formatDurationHuman, toPersianDigits } from "@/utils/persian-date";
import { cn } from "@/lib/utils";

type Stats = {
  todaySeconds: number;
  rank: number;
  activeTasks: number;
  rankDelta: number;
};

export function FloatingBar() {
  const { navigate } = useRouterStore();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const res = await apiFetch<{
        stats: {
          todaySeconds: number;
          taskCounts: { ACTIVE: number };
        };
      }>("/api/stats/me");
      if (!active || !res.ok || !res.data?.stats) return;
      setStats({
        todaySeconds: res.data.stats.todaySeconds || 0,
        rank: user?.currentRank || 0,
        activeTasks: res.data.stats.taskCounts?.ACTIVE || 0,
        rankDelta: 0,
      });
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [user?.currentRank]);

  if (!user) return null;

  return (
    <div className="sticky bottom-0 z-40 mx-4 mb-4">
      <div className="glass-strong flex items-center justify-around gap-2 rounded-2xl border border-border/60 p-2 shadow-xl">
        <button
          onClick={() => navigate("timer")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-secondary/40"
        >
          <Clock className="h-4 w-4 text-primary" />
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">تایم امروز</p>
            <p className="text-xs font-semibold">
              {stats ? formatDurationHuman(stats.todaySeconds) : "—"}
            </p>
          </div>
        </button>

        <div className="h-8 w-px bg-border" />

        <button
          onClick={() => navigate("leaderboard")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-secondary/40"
        >
          <Trophy className="h-4 w-4 text-primary" />
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">رتبه فعلی</p>
            <p className="flex items-center gap-1 text-xs font-semibold">
              {stats ? `#${toPersianDigits(stats.rank || 0)}` : "—"}
              {stats && stats.rankDelta > 0 && (
                <TrendingUp className="h-3 w-3 text-accent" />
              )}
              {stats && stats.rankDelta < 0 && (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
            </p>
          </div>
        </button>

        <div className="h-8 w-px bg-border" />

        <button
          onClick={() => navigate("tasks")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-secondary/40"
        >
          <ListTodo className="h-4 w-4 text-primary" />
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">تسک‌های فعال</p>
            <p className="text-xs font-semibold">
              {stats ? toPersianDigits(stats.activeTasks) : "—"}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
