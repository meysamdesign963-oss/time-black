"use client";

/**
 * NotificationsView — notifications center.
 * Filter tabs (all/unread/rank/interaction/system). Each item has type
 * icon + title + message + relative time. Unread items highlighted.
 * Click marks as read + navigates to link if present. Mark-all action.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  CheckCheck,
  Heart,
  Info,
  ListTodo,
  Loader2,
  MessageCircle,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useRouterStore } from "@/store/router";
import { apiFetch } from "@/utils/api-fetch";
import { formatRelativeTime, toPersianDigits } from "@/utils/persian-date";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
};

type NotifResp = { notifications: Notification[]; unreadCount: number };

type Filter = "all" | "unread" | "rank" | "interaction" | "system";

const NOTIF_ICON: Record<string, React.ElementType> = {
  RANK_CHANGE: Trophy,
  LIKE: Heart,
  COMMENT: MessageCircle,
  SYSTEM: Info,
  TASK: ListTodo,
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: "easeOut" as const },
  }),
};

export function NotificationsView() {
  const navigate = useRouterStore((s) => s.navigate);
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [readingId, setReadingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await apiFetch<NotifResp>(
        `/api/notifications?filter=${filter}`,
      );
      if (!active) return;
      if (res.ok && res.data?.notifications) setItems(res.data.notifications);
      else setItems([]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [filter]);

  const handleMarkAll = async () => {
    setMarkingAll(true);
    const res = await apiFetch("/api/notifications/read-all", {
      method: "POST",
    });
    setMarkingAll(false);
    if (res.ok) {
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("همه اعلان‌ها به‌عنوان خوانده‌شده علامت‌گذاری شدند");
    } else {
      toast.error(res.error || "خطا در علامت‌گذاری");
    }
  };

  const handleRead = async (n: Notification) => {
    if (!n.isRead) {
      setReadingId(n.id);
      const res = await apiFetch(`/api/notifications/${n.id}/read`, {
        method: "POST",
      });
      setReadingId(null);
      if (res.ok) {
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
        );
      }
    }
    // Navigate if link is present (e.g. /profile/username, /post/slug)
    if (n.link) {
      const postMatch = n.link.match(/\/post\/([^/]+)/);
      if (postMatch) {
        navigate("post", postMatch[1]);
        return;
      }
      const profileMatch = n.link.match(/\/profile\/([^/]+)/);
      if (profileMatch) {
        navigate("profile", profileMatch[1]);
        return;
      }
    }
  };

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div className="mx-auto max-w-[900px] space-y-6 px-4 py-6">
      <PageHeader
        title="اعلان‌ها"
        description="اعلان‌های رتبه‌بندی، تعاملات و سیستمی"
        action={
          <Button
            variant="outline"
            onClick={handleMarkAll}
            disabled={markingAll || unreadCount === 0}
          >
            {markingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            علامت‌گذاری همه
          </Button>
        }
      />

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as Filter)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5">
          <TabsTrigger value="all">همه</TabsTrigger>
          <TabsTrigger value="unread">خوانده‌نشده</TabsTrigger>
          <TabsTrigger value="rank">تغییر رتبه</TabsTrigger>
          <TabsTrigger value="interaction">تعاملات</TabsTrigger>
          <TabsTrigger value="system">سیستمی</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/30 py-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
            <Bell className="h-7 w-7" />
          </div>
          <div>
            <p className="font-academic text-base font-bold text-foreground">
              اعلانی وجود ندارد
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {filter === "unread"
                ? "همه اعلان‌ها را خوانده‌اید — آفرین!"
                : "اعلان‌های جدید در اینجا نمایش داده می‌شوند"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n, i) => {
            const Icon = NOTIF_ICON[n.type] || Bell;
            return (
              <motion.div
                key={n.id}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={i}
              >
                <Card
                  className={`card-lift cursor-pointer transition-colors hover:bg-card/80 ${
                    !n.isRead
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/50 bg-card/40"
                  }`}
                  onClick={() => handleRead(n)}
                >
                  <CardContent className="flex items-start gap-3 p-4">
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                        n.type === "RANK_CHANGE"
                          ? "bg-primary/15 text-primary"
                          : n.type === "LIKE"
                            ? "bg-destructive/15 text-destructive"
                            : n.type === "COMMENT"
                              ? "bg-accent/15 text-accent"
                              : "bg-secondary/60 text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-foreground">
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {n.message}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {formatRelativeTime(new Date(n.createdAt))}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-muted-foreground"
                        >
                          {TYPE_LABEL[n.type] || n.type}
                        </Badge>
                      </div>
                    </div>
                    {readingId === n.id && (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  RANK_CHANGE: "تغییر رتبه",
  LIKE: "پسندیده",
  COMMENT: "نظر",
  SYSTEM: "سیستمی",
  TASK: "تسک",
};

export default NotificationsView;
