"use client";

/**
 * PublicProfileView — public profile page for any user.
 * Reads username from router store param, fetches /api/profile/[username].
 * Cover image (gradient fallback), avatar overlap, follow button, tabs:
 * posts grid + activity feed (recent time entries).
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  Eye,
  Flag,
  Heart,
  Loader2,
  Mail,
  ListTodo,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Send,
  Settings,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { AwardBadges, type Award } from "@/components/common/award-badges";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouterStore } from "@/store/router";
import { useAuthStore } from "@/store/auth";
import { apiFetch } from "@/utils/api-fetch";
import {
  formatDurationHuman,
  formatPersianDate,
  formatRelativeTime,
  toPersianDigits,
} from "@/utils/persian-date";
import { ProfileTimeStats } from "@/components/public/profile-time-stats";

type ProfileData = {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  role: string;
  // Masked contact info (canvas security req #5)
  phone: string | null;
  email: string | null;
  totalSeconds: number;
  currentRank: number | null;
  prevRank: number | null;
  createdAt: string;
  isOwner: boolean;
  isFollowing: boolean;
  stats: {
    todaySeconds: number;
    weekSeconds: number;
    monthSeconds: number;
    totalSeconds: number;
    taskCount: number;
    postCount: number;
    followers: number;
    following: number;
  };
  recentPosts: Array<{
    id: string;
    content: string;
    imageUrl: string | null;
    likeCount: number;
    commentCount: number;
    createdAt: string;
    slug?: string | null;
  }>;
  awards?: Award[];
};

type ProfileResp = { profile: ProfileData };

export function PublicProfileView() {
  const username = useRouterStore((s) => s.param);
  const navigate = useRouterStore((s) => s.navigate);
  const currentUser = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  // Reveal-contact state (canvas security req #5 — masked by default)
  const [revealedContact, setRevealedContact] = useState<{
    phone: string | null;
    email: string | null;
    username: string; // track which profile this reveal belongs to
  } | null>(null);
  const [revealBusy, setRevealBusy] = useState(false);
  // Report-user dialog state
  const [reportOpen, setReportOpen] = useState(false);

  // Fetch profile on mount / whenever username changes
  useEffect(() => {
    let active = true;
    (async () => {
      if (!username) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      setNotFound(false);
      const res = await apiFetch<ProfileResp>(
        `/api/profile/${encodeURIComponent(username)}`,
      );
      if (!active) return;
      if (res.ok && res.data?.profile) {
        setProfile(res.data.profile);
        setIsFollowing(res.data.profile.isFollowing);
      } else {
        setProfile(null);
        setNotFound(true);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [username]);

  // Reveal full contact (canvas security req #5 + audit trail req #8)
  const handleRevealContact = async () => {
    if (!currentUser) {
      navigate("login");
      return;
    }
    if (!profile || profile.isOwner) return;
    setRevealBusy(true);
    const res = await apiFetch<{ phone: string | null; email: string | null }>(
      `/api/profile/${encodeURIComponent(profile.username)}/reveal-contact`,
      { method: "POST" },
    );
    setRevealBusy(false);
    if (res.ok && res.data) {
      setRevealedContact({
        phone: res.data.phone,
        email: res.data.email,
        username: profile.username,
      });
      toast.success("اطلاعات تماس نمایش داده شد — این عمل در لاگ ثبت شد");
    } else {
      toast.error(res.error || "خطا در نمایش اطلاعات تماس");
    }
  };

  // Derive: is the revealed contact for the currently-viewed profile?
  const currentReveal =
    revealedContact && revealedContact.username === profile?.username
      ? revealedContact
      : null;

  const handleFollow = async () => {
    if (!currentUser) {
      navigate("login");
      return;
    }
    if (!profile || profile.isOwner) return;
    setFollowBusy(true);
    const res = await apiFetch<{ following: boolean }>(
      `/api/follow/${encodeURIComponent(profile.username)}`,
      { method: "POST" },
    );
    setFollowBusy(false);
    if (res.ok && res.data) {
      setIsFollowing(res.data.following);
      setProfile((p) =>
        p
          ? {
              ...p,
              isFollowing: res.data!.following,
              stats: {
                ...p.stats,
                followers: p.stats.followers + (res.data!.following ? 1 : -1),
              },
            }
          : p,
      );
      toast.success(
        res.data.following ? "کاربر دنبال شد" : "دنبال‌کردن لغو شد",
      );
    } else {
      toast.error(res.error || "خطا در ثبت درخواست");
    }
  };

  if (loading) return <ProfileSkeleton />;
  if (notFound || !profile)
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-12 lg:px-8">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary/60">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-academic text-lg font-bold text-foreground">
                کاربر یافت نشد
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {username
                  ? `کاربری با نام «${username}» وجود ندارد.`
                  : "نام کاربری مشخص نیست."}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("explore")}>
              بازگشت به اکسپلور
            </Button>
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Cover + Avatar Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-border/60"
      >
        {/* Cover */}
        <div className="relative h-36 w-full sm:h-48 lg:h-56">
          {profile.coverUrl ? (
            <img
              src={profile.coverUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/30 via-card to-accent/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
        </div>

        {/* Profile row */}
        <div className="border-t border-border/60 bg-card/50 px-5 pb-5 sm:px-6 lg:px-8">
          <div className="-mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:gap-4">
              <Avatar className="h-24 w-24 border-4 border-card bg-card shadow-xl sm:h-28 sm:w-28">
                {profile.avatarUrl ? (
                  <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                ) : null}
                <AvatarFallback className="bg-secondary text-2xl font-bold">
                  {profile.displayName?.charAt(0) || "؟"}
                </AvatarFallback>
              </Avatar>
              <div className="pb-1 text-center sm:text-right">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1 className="font-academic text-xl font-bold text-foreground sm:text-2xl">
                    {profile.displayName}
                  </h1>
                  {profile.role !== "USER" && (
                    <Badge className="bg-primary text-primary-foreground">
                      {profile.role === "BOSS" ? "مدیر ارشد" : "مدیر"}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  @{profile.username}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {profile.isOwner ? (
                <Button
                  variant="outline"
                  onClick={() => navigate("settings")}
                >
                  <Settings className="h-4 w-4" />
                  ویرایش پروفایل
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleFollow}
                    disabled={followBusy}
                    variant={isFollowing ? "secondary" : "default"}
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus className="h-4 w-4" />
                        دنبال‌شده
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        دنبال کردن
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!currentUser) {
                        navigate("login");
                        return;
                      }
                      navigate("messages-with", profile.username);
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    پیام
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="بیشتر">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={() => {
                          if (!currentUser) {
                            navigate("login");
                            return;
                          }
                          setReportOpen(true);
                        }}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Flag className="h-4 w-4" />
                        گزارش کاربر
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          navigate("profile", profile.username)
                        }
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        مشاهده کامل پروفایل
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>

          {/* Bio + meta */}
          {profile.bio && (
            <p className="mt-4 max-w-2xl text-sm text-foreground/90">
              {profile.bio}
            </p>
          )}

          {/* Award badges */}
          {profile.awards && profile.awards.length > 0 && (
            <div className="mt-3">
              <AwardBadges awards={profile.awards} />
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              عضو از {formatPersianDate(new Date(profile.createdAt))}
            </span>
            {profile.currentRank && (
              <span className="inline-flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-primary" />
                رتبه فعلی: {toPersianDigits(profile.currentRank)}
              </span>
            )}
          </div>

          {/* Contact info — masked by default (canvas security req #5) */}
          {!profile.isOwner && (profile.phone || profile.email) ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-secondary/30 p-2.5 text-xs">
              {profile.phone && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span dir="ltr">
                    {currentReveal?.phone ?? profile.phone}
                  </span>
                </span>
              )}
              {profile.email && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span dir="ltr">
                    {currentReveal?.email ?? profile.email}
                  </span>
                </span>
              )}
              {!currentReveal && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={handleRevealContact}
                  disabled={revealBusy}
                >
                  {revealBusy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                  مشاهده
                </Button>
              )}
            </div>
          ) : null}

          {/* Quick stats */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <QuickStat
              icon={Clock}
              label="مجموع تایم"
              value={formatDurationHuman(profile.stats.totalSeconds)}
              accent="primary"
            />
            <QuickStat
              icon={Trophy}
              label="رتبه"
              value={profile.currentRank ? toPersianDigits(profile.currentRank) : "—"}
            />
            <QuickStat
              icon={ListTodo}
              label="تسک‌ها"
              value={toPersianDigits(profile.stats.taskCount)}
            />
            <QuickStat
              icon={MessageCircle}
              label="پست‌ها"
              value={toPersianDigits(profile.stats.postCount)}
            />
            <QuickStat
              icon={Users}
              label="دنبال‌کننده"
              value={toPersianDigits(profile.stats.followers)}
              className="col-span-2 sm:col-span-1"
            />
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="posts" className="mt-8">
        <TabsList className="w-full justify-start sm:w-auto">
          <TabsTrigger value="posts">
            <MessageCircle className="h-4 w-4" />
            پست‌ها
          </TabsTrigger>
          <TabsTrigger value="times">
            <Clock className="h-4 w-4" />
            تایم‌ها و تسک‌ها
          </TabsTrigger>
          <TabsTrigger value="stats">
            <Trophy className="h-4 w-4" />
            تایم‌ها و آمار
          </TabsTrigger>
        </TabsList>

        {/* Posts tab */}
        <TabsContent value="posts" className="mt-4">
          {profile.recentPosts.length === 0 ? (
            <EmptyTab label="این کاربر هنوز پستی منتشر نکرده است" />
          ) : (
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
              {profile.recentPosts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                >
                  <Card
                    role={p.slug ? "button" : undefined}
                    tabIndex={p.slug ? 0 : undefined}
                    onClick={() => {
                      if (p.slug) navigate("post", p.slug);
                    }}
                    onKeyDown={(e) => {
                      if (p.slug && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        navigate("post", p.slug);
                      }
                    }}
                    className={`card-lift h-full overflow-hidden p-0 ${
                      p.slug
                        ? "cursor-pointer hover:border-primary/40"
                        : ""
                    }`}
                  >
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="h-40 w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    <CardContent className="flex flex-col gap-2 p-4">
                      <p className="line-clamp-3 text-sm text-foreground/90 whitespace-pre-wrap">
                        {p.content}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatRelativeTime(new Date(p.createdAt))}</span>
                        <div className="flex items-center gap-4">
                          <span className="inline-flex items-center gap-1">
                            <Heart className="h-3.5 w-3.5" />
                            {toPersianDigits(p.likeCount)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="h-3.5 w-3.5" />
                            {toPersianDigits(p.commentCount)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Times tab */}
        <TabsContent value="times" className="mt-4">
          <ActivityFeed profile={profile} />
        </TabsContent>

        {/* Stats tab — heatmap + charts */}
        <TabsContent value="stats" className="mt-4">
          <ProfileTimeStats username={profile.username} />
        </TabsContent>
      </Tabs>

      {/* Report user dialog */}
      <ReportUserDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        profile={profile}
        currentUser={currentUser}
        navigate={navigate}
      />
    </div>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
  accent = "default",
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  accent?: "primary" | "default";
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border/60 bg-card/60 p-3 ${
        className ?? ""
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon
          className={`h-3.5 w-3.5 ${
            accent === "primary" ? "text-primary" : ""
          }`}
        />
        {label}
      </div>
      <p className="mt-1 font-academic text-sm font-bold text-foreground sm:text-base">
        {value}
      </p>
    </div>
  );
}

function ActivityFeed({ profile }: { profile: ProfileData }) {
  // Synthesize a friendly activity list from stats since the API doesn't expose
  // a paginated time-entry feed for public viewers. This gives the tab useful
  // content without lying about specific data.
  const items: Array<{
    icon: React.ElementType;
    title: string;
    sub: string;
    value: string;
  }> = [
    {
      icon: Clock,
      title: "فعالیت امروز",
      sub: "مجموع تایم‌های ثبت‌شده امروز",
      value: formatDurationHuman(profile.stats.todaySeconds),
    },
    {
      icon: Clock,
      title: "فعالیت این هفته",
      sub: "مجموع تایم‌های هفته جاری",
      value: formatDurationHuman(profile.stats.weekSeconds),
    },
    {
      icon: Clock,
      title: "فعالیت این ماه",
      sub: "مجموع تایم‌های ماه جاری",
      value: formatDurationHuman(profile.stats.monthSeconds),
    },
    {
      icon: ListTodo,
      title: "تسک‌های فعال",
      sub: "مجموع تسک‌های تعریف‌شده",
      value: `${toPersianDigits(profile.stats.taskCount)} تسک`,
    },
    {
      icon: Trophy,
      title: "مجموع کل تایم",
      sub: "از زمان عضویت تاکنون",
      value: formatDurationHuman(profile.stats.totalSeconds),
    },
  ];

  return (
    <Card>
      <CardContent className="divide-y divide-border/50 p-0">
        {items.map((it, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.06, 0.3) }}
            className="flex items-center gap-3 p-4"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary/60 text-primary">
              <it.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{it.title}</p>
              <p className="text-xs text-muted-foreground">{it.sub}</p>
            </div>
            <p className="shrink-0 text-sm font-bold text-primary">{it.value}</p>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <Card className="border-dashed bg-card/40">
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <MessageCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">
      <div className="overflow-hidden rounded-2xl border border-border/60">
        <Skeleton className="h-44 w-full rounded-none" />
        <div className="border-t border-border/60 bg-card/50 px-6 pb-6">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:gap-4">
              <Skeleton className="h-28 w-28 rounded-full border-4 border-card" />
              <div className="space-y-2 pb-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );
}

export default PublicProfileView;

// ------------------------------------------------------------------
// ReportUserDialog — submit an ABUSE report about this profile user.
// Mirrors the report-view form but pre-fills reportedUserId and type.
// ------------------------------------------------------------------
type ReportType =
  | "BUG"
  | "ABUSE"
  | "SPAM"
  | "FEATURE_REQUEST"
  | "FEEDBACK"
  | "OTHER";

const REPORT_TYPES: Array<{ value: ReportType; label: string }> = [
  { value: "ABUSE", label: "سواستفاده / رفتار نامناسب" },
  { value: "SPAM", label: "اسپم" },
  { value: "BUG", label: "باگ" },
  { value: "FEATURE_REQUEST", label: "پیشنهاد قابلیت" },
  { value: "FEEDBACK", label: "بازخورد" },
  { value: "OTHER", label: "سایر" },
];

function ReportUserDialog({
  open,
  onOpenChange,
  profile,
  currentUser,
  navigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileData;
  currentUser: ReturnType<typeof useAuthStore.getState>["user"];
  navigate: ReturnType<typeof useRouterStore.getState>["navigate"];
}) {
  const [type, setType] = useState<ReportType>("ABUSE");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset form when dialog closes
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      // Defer state reset to next tick to avoid setState during render
      setTimeout(() => {
        setType("ABUSE");
        setSubject("");
        setBody("");
      }, 0);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      navigate("login");
      onOpenChange(false);
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error("عنوان و متن گزارش الزامی است");
      return;
    }
    setSubmitting(true);
    const res = await apiFetch<{ report: unknown }>("/api/reports", {
      method: "POST",
      body: JSON.stringify({
        type,
        subject,
        body,
        reportedUserId: profile.id,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("گزارش شما برای تیم مدیریت ارسال شد");
      onOpenChange(false);
    } else {
      toast.error(res.error || "ارسال گزارش ناموفق بود");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-academic">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/15 text-destructive">
              <Flag className="h-4 w-4" />
            </span>
            گزارش کاربر
          </DialogTitle>
          <DialogDescription>
            گزارش «{profile.displayName}» (@{profile.username}) را برای تیم
            مدیریت ارسال کنید.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="report-type">نوع گزارش</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as ReportType)}
            >
              <SelectTrigger id="report-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="report-subject">عنوان</Label>
            <Input
              id="report-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="عنوان کوتاه و گویا"
              maxLength={200}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="report-body">توضیح</Label>
            <Textarea
              id="report-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="جزئیات تخلف یا مشکل را شرح دهید…"
              rows={5}
              maxLength={5000}
              required
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              انصراف
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              ارسال گزارش
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
