"use client";

/**
 * SocialView — social network page.
 * Tabs: followers / following / suggestions. User cards with avatar,
 * displayName, @username, follow toggle, view profile button.
 * Suggestions derive from leaderboard and exclude already-followed users.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  Loader2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useRouterStore } from "@/store/router";
import { useAuthStore } from "@/store/auth";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatDurationHuman,
  toPersianDigits,
} from "@/utils/persian-date";

type SocialUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  currentRank: number | null;
  totalSeconds: number;
  /** Present when the user comes from the leaderboard endpoint (instead of currentRank). */
  rank?: number;
};

type FollowingResp = {
  following: Array<{ id: string; createdAt: string; followee: SocialUser }>;
};
type FollowersResp = {
  followers: Array<{ id: string; createdAt: string; follower: SocialUser }>;
};
type LeaderboardResp = {
  range: string;
  from: string;
  leaderboard: Array<SocialUser & { taskCount: number; rank: number; topThree: boolean }>;
};
type FollowResp = { following: boolean };

type TabKey = "followers" | "following" | "suggestions";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: "easeOut" as const },
  }),
};

export function SocialView() {
  const navigate = useRouterStore((s) => s.navigate);
  const currentUser = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<TabKey>("following");
  const [following, setFollowing] = useState<SocialUser[]>([]);
  const [followers, setFollowers] = useState<SocialUser[]>([]);
  const [leaderboard, setLeaderboard] = useState<
    Array<SocialUser & { taskCount: number; rank: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [follRes, flrRes, lbRes] = await Promise.all([
        apiFetch<FollowingResp>("/api/social/following"),
        apiFetch<FollowersResp>("/api/social/followers"),
        apiFetch<LeaderboardResp>("/api/leaderboard?range=month"),
      ]);
      if (!active) return;
      if (follRes.ok && follRes.data?.following) {
        const list = follRes.data.following.map((f) => f.followee);
        setFollowing(list);
        setFollowedIds(new Set(list.map((u) => u.id)));
      }
      if (flrRes.ok && flrRes.data?.followers) {
        setFollowers(flrRes.data.followers.map((f) => f.follower));
      }
      if (lbRes.ok && lbRes.data?.leaderboard) {
        setLeaderboard(lbRes.data.leaderboard);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const suggestions = useMemo(() => {
    return leaderboard
      .filter(
        (u) =>
          u.id !== currentUser?.id && !followedIds.has(u.id),
      )
      .slice(0, 20);
  }, [leaderboard, followedIds, currentUser]);

  const toggleFollow = async (user: SocialUser) => {
    setBusyId(user.id);
    const res = await apiFetch<FollowResp>(
      `/api/follow/${encodeURIComponent(user.username)}`,
      { method: "POST" },
    );
    setBusyId(null);
    if (res.ok && res.data) {
      const nowFollowing = res.data.following;
      setFollowedIds((prev) => {
        const next = new Set(prev);
        if (nowFollowing) next.add(user.id);
        else next.delete(user.id);
        return next;
      });
      if (nowFollowing) {
        setFollowing((prev) =>
          prev.find((u) => u.id === user.id) ? prev : [user, ...prev],
        );
        toast.success(`${user.displayName} دنبال شد`);
      } else {
        setFollowing((prev) => prev.filter((u) => u.id !== user.id));
        toast.info(`${user.displayName} از دنبال‌شوندگان حذف شد`);
      }
    } else {
      toast.error(res.error || "خطا در عملیات دنبال کردن");
    }
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-6 px-4 py-6">
      <PageHeader title="شبکه اجتماعی" description="دنبال‌کنندگان و دنبال‌شوندگان شما" />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="following">
            دنبال‌شوندگان
            <Badge variant="secondary" className="ml-1">
              {toPersianDigits(following.length)}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="followers">
            دنبال‌کنندگان
            <Badge variant="secondary" className="ml-1">
              {toPersianDigits(followers.length)}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="suggestions">پیشنهادات</TabsTrigger>
        </TabsList>

        <TabsContent value="following" className="mt-4">
          <UserList
            users={following}
            loading={loading}
            emptyTitle="هنوز کسی را دنبال نمی‌کنید"
            emptyHint="از تب پیشنهادات، کاربران جذاب را پیدا و دنبال کنید"
            busyId={busyId}
            onToggleFollow={toggleFollow}
            onViewProfile={(u) => navigate("profile", u.username)}
            isFollowing={(u) => followedIds.has(u.id)}
          />
        </TabsContent>

        <TabsContent value="followers" className="mt-4">
          <UserList
            users={followers}
            loading={loading}
            emptyTitle="هنوز دنبال‌کننده‌ای ندارید"
            emptyHint="با فعالیت بیشتر و انتشار پست، دنبال‌کننده‌های بیشتری جذب کنید"
            busyId={busyId}
            onToggleFollow={toggleFollow}
            onViewProfile={(u) => navigate("profile", u.username)}
            isFollowing={(u) => followedIds.has(u.id)}
          />
        </TabsContent>

        <TabsContent value="suggestions" className="mt-4">
          <UserList
            users={suggestions}
            loading={loading}
            emptyTitle="پیشنهادی موجود نیست"
            emptyHint="همه کاربران برتر را دنبال کرده‌اید — آفرین!"
            busyId={busyId}
            onToggleFollow={toggleFollow}
            onViewProfile={(u) => navigate("profile", u.username)}
            isFollowing={(u) => followedIds.has(u.id)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserList({
  users,
  loading,
  emptyTitle,
  emptyHint,
  busyId,
  onToggleFollow,
  onViewProfile,
  isFollowing,
}: {
  users: SocialUser[];
  loading: boolean;
  emptyTitle: string;
  emptyHint: string;
  busyId: string | null;
  onToggleFollow: (u: SocialUser) => void;
  onViewProfile: (u: SocialUser) => void;
  isFollowing: (u: SocialUser) => boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/30 py-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
          <Users className="h-7 w-7" />
        </div>
        <div>
          <p className="font-academic text-base font-bold text-foreground">
            {emptyTitle}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {emptyHint}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {users.map((u, i) => {
        const followed = isFollowing(u);
        return (
          <motion.div
            key={u.id}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={i}
          >
            <Card className="card-lift">
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar className="h-12 w-12 border-2 border-border/60">
                  {u.avatarUrl ? (
                    <AvatarImage src={u.avatarUrl} alt={u.displayName} />
                  ) : null}
                  <AvatarFallback className="bg-secondary text-foreground">
                    {u.displayName?.charAt(0) || "؟"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">
                    {u.displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{u.username}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {(u.currentRank != null || u.rank != null) && (
                      <span className="flex items-center gap-1">
                        رتبه: #{toPersianDigits(u.currentRank ?? u.rank!)}
                      </span>
                    )}
                    <span className="text-primary">·</span>
                    <span>{formatDurationHuman(u.totalSeconds)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    size="sm"
                    variant={followed ? "secondary" : "default"}
                    disabled={busyId === u.id}
                    onClick={() => onToggleFollow(u)}
                    className="h-8"
                  >
                    {busyId === u.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : followed ? (
                      <>
                        <UserCheck className="h-3.5 w-3.5" />
                        دنبال‌شده
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3.5 w-3.5" />
                        دنبال کردن
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onViewProfile(u)}
                    className="h-8 text-xs"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    پروفایل
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

export default SocialView;
