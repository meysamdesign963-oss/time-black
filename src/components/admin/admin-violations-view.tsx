"use client";

/**
 * AdminViolationsView — admin inbox for user-submitted reports / tickets.
 *
 * Replaces the previous placeholder (which scraped audit logs). Now uses the
 * dedicated /api/admin/reports endpoint with status/type filters, stats
 * cards, an expandable list with admin response form, and one-click resolve.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flag,
  Flame,
  Loader2,
  MessageSquareWarning,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { apiFetch } from "@/utils/api-fetch";
import { formatRelativeTime, toPersianDigits } from "@/utils/persian-date";

type ReportType =
  | "BUG"
  | "ABUSE"
  | "SPAM"
  | "FEATURE_REQUEST"
  | "FEEDBACK"
  | "OTHER";

type ReportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";
type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

type AdminReport = {
  id: string;
  type: ReportType;
  subject: string;
  body: string;
  status: ReportStatus;
  priority: Priority;
  adminResponse: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  reportedUser: {
    id: string;
    username: string;
    displayName: string;
  } | null;
};

type ReportsResp = {
  reports: AdminReport[];
  total: number;
  page: number;
  limit: number;
};

const TYPE_META: Record<
  ReportType,
  { label: string; icon: React.ElementType; color: string }
> = {
  BUG: { label: "باگ", icon: Bug, color: "text-destructive" },
  ABUSE: {
    label: "سواستفاده",
    icon: ShieldAlert,
    color: "text-destructive",
  },
  SPAM: { label: "اسپم", icon: Trash2, color: "text-yellow-500" },
  FEATURE_REQUEST: {
    label: "پیشنهاد قابلیت",
    icon: Sparkles,
    color: "text-primary",
  },
  FEEDBACK: { label: "بازخورد", icon: MessageSquareWarning, color: "text-accent" },
  OTHER: { label: "سایر", icon: AlertCircle, color: "text-muted-foreground" },
};

function StatusBadge({ status }: { status: ReportStatus }) {
  switch (status) {
    case "OPEN":
      return (
        <Badge className="bg-yellow-500/15 text-yellow-500 border border-yellow-500/40 gap-1">
          <AlertCircle className="h-3 w-3" />
          باز
        </Badge>
      );
    case "IN_PROGRESS":
      return (
        <Badge className="bg-sky-500/15 text-sky-500 border border-sky-500/40 gap-1">
          <Clock className="h-3 w-3" />
          در حال بررسی
        </Badge>
      );
    case "RESOLVED":
      return (
        <Badge className="bg-accent/15 text-accent border border-accent/40 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          حل‌شده
        </Badge>
      );
    case "DISMISSED":
      return (
        <Badge className="bg-muted/40 text-muted-foreground border border-border gap-1">
          رد شده
        </Badge>
      );
    default:
      return null;
  }
}

function PriorityBadge({ priority }: { priority: Priority }) {
  switch (priority) {
    case "URGENT":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-destructive/60 text-destructive"
        >
          <Flame className="h-3 w-3" />
          فوری
        </Badge>
      );
    case "HIGH":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-orange-500/60 text-orange-500"
        >
          بالا
        </Badge>
      );
    case "LOW":
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          پایین
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          معمولی
        </Badge>
      );
  }
}

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.3, ease: "easeOut" as const },
  }),
};

export function AdminViolationsView() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ReportStatus>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ReportType>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  // Map of reportId → admin response draft
  const [responseDrafts, setResponseDrafts] = useState<
    Record<string, string>
  >({});
  const [busyId, setBusyId] = useState<string | null>(null);
  // Track signature of current filter so we can re-fetch when it changes
  const [filterSig, setFilterSig] = useState(
    `${statusFilter}:${typeFilter}`,
  );
  const sig = `${statusFilter}:${typeFilter}`;
  // Detect filter change without setState in effect
  if (sig !== filterSig) {
    setFilterSig(sig);
    setLoading(true);
  }

  const fetchReports = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await apiFetch<ReportsResp>(`/api/admin/reports${qs}`);
    if (res.ok && res.data?.reports) {
      setReports(res.data.reports);
    } else {
      setReports([]);
    }
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    let active = true;
    (async () => {
      await fetchReports();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [fetchReports]);

  // Stats from the current loaded list (rough; the API doesn't return
  // pre-computed counts, but the current page is small enough to derive).
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    let open = 0;
    let inProgress = 0;
    let resolvedToday = 0;
    let urgent = 0;
    for (const r of reports) {
      if (r.status === "OPEN") open++;
      if (r.status === "IN_PROGRESS") inProgress++;
      if (
        r.status === "RESOLVED" &&
        r.resolvedAt &&
        new Date(r.resolvedAt).getTime() >= todayTs
      )
        resolvedToday++;
      if (r.priority === "URGENT" && r.status !== "RESOLVED") urgent++;
    }
    return { open, inProgress, resolvedToday, urgent };
  }, [reports]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------
  const patchReport = async (
    id: string,
    patch: { status?: ReportStatus; priority?: Priority; adminResponse?: string },
  ) => {
    setBusyId(id);
    const res = await apiFetch<{ report: AdminReport }>(
      `/api/admin/reports/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    );
    setBusyId(null);
    if (res.ok && res.data?.report) {
      setReports((prev) =>
        prev.map((r) => (r.id === id ? res.data!.report : r)),
      );
      toast.success("گزارش به‌روزرسانی شد");
    } else {
      toast.error(res.error || "خطا در به‌روزرسانی گزارش");
    }
  };

  const handleSaveResponse = async (id: string) => {
    const text = responseDrafts[id]?.trim();
    if (!text) {
      toast.error("پاسخ خالی است");
      return;
    }
    await patchReport(id, { adminResponse: text });
    setResponseDrafts((prev) => ({ ...prev, [id]: "" }));
  };

  const handleResolve = async (id: string) => {
    await patchReport(id, { status: "RESOLVED" });
  };

  const handleDismiss = async (id: string) => {
    await patchReport(id, { status: "DISMISSED" });
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-6 px-4 py-6">
      <PageHeader
        title="گزارش‌ها و تیکت‌ها"
        description="رسیدگی به گزارش‌ها، تیکت‌ها و درخواست‌های پشتیبانی کاربران"
        action={
          <Button variant="outline" onClick={() => fetchReports()}>
            <Loader2 className="h-4 w-4" />
            به‌روزرسانی
          </Button>
        }
      />

      {/* ----------------------- Filters ----------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="همه وضعیت‌ها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            <SelectItem value="OPEN">باز</SelectItem>
            <SelectItem value="IN_PROGRESS">در حال بررسی</SelectItem>
            <SelectItem value="RESOLVED">حل‌شده</SelectItem>
            <SelectItem value="DISMISSED">رد شده</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="همه انواع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه انواع</SelectItem>
            {(Object.keys(TYPE_META) as ReportType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ----------------------- Stats cards ----------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={AlertCircle}
          label="باز"
          value={stats.open}
          color="text-yellow-500"
          bg="bg-yellow-500/15"
        />
        <StatCard
          icon={Clock}
          label="در حال بررسی"
          value={stats.inProgress}
          color="text-sky-500"
          bg="bg-sky-500/15"
        />
        <StatCard
          icon={CheckCircle2}
          label="حل‌شده امروز"
          value={stats.resolvedToday}
          color="text-accent"
          bg="bg-accent/15"
        />
        <StatCard
          icon={Flame}
          label="فوری"
          value={stats.urgent}
          color="text-destructive"
          bg="bg-destructive/15"
        />
      </div>

      {/* ----------------------- Reports list ----------------------- */}
      <Card className="glass border-border/60">
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-accent/15">
                <CheckCircle2 className="h-8 w-8 text-accent" />
              </div>
              <p className="font-academic text-lg font-bold text-foreground">
                گزارشی یافت نشد
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                با فیلتر فعلی هیچ گزارشی وجود ندارد. وقتی کاربران گزارشی
                ثبت کنند، اینجا نمایش داده خواهد شد.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {reports.map((r, idx) => {
                const meta = TYPE_META[r.type];
                const Icon = meta.icon;
                const open = openId === r.id;
                const draft = responseDrafts[r.id] ?? "";
                const isBusy = busyId === r.id;
                return (
                  <motion.li
                    key={r.id}
                    custom={idx}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                  >
                    <Card className="overflow-hidden border-border/60 p-0">
                      <Collapsible
                        open={open}
                        onOpenChange={(o) => setOpenId(o ? r.id : null)}
                      >
                        <CollapsibleTrigger asChild>
                          <button className="flex w-full items-start gap-3 p-3 text-right hover:bg-secondary/30 transition-colors">
                            <div
                              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary/60 ${meta.color}`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {r.subject}
                                </p>
                                <Badge
                                  variant="outline"
                                  className="gap-1 text-[10px]"
                                >
                                  {meta.label}
                                </Badge>
                                <PriorityBadge priority={r.priority} />
                                <StatusBadge status={r.status} />
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                {r.reporter && (
                                  <span className="inline-flex items-center gap-1">
                                    <Avatar className="h-4 w-4">
                                      {r.reporter.avatarUrl && (
                                        <AvatarImage
                                          src={r.reporter.avatarUrl}
                                          alt={r.reporter.displayName}
                                        />
                                      )}
                                      <AvatarFallback className="bg-secondary text-[8px]">
                                        {r.reporter.displayName?.[0] ?? "?"}
                                      </AvatarFallback>
                                    </Avatar>
                                    @{r.reporter.username}
                                  </span>
                                )}
                                {r.reportedUser && (
                                  <span className="inline-flex items-center gap-1">
                                    <Flag className="h-3 w-3 text-destructive" />
                                    مورد اشاره: @{r.reportedUser.username}
                                  </span>
                                )}
                                <span>·</span>
                                <span>
                                  {formatRelativeTime(new Date(r.createdAt))}
                                </span>
                              </div>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                                open ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="space-y-4 border-t border-border/60 p-3">
                            {/* Body */}
                            <div>
                              <p className="mb-1 text-xs font-medium text-muted-foreground">
                                متن گزارش:
                              </p>
                              <p
                                dir="auto"
                                className="whitespace-pre-wrap rounded-lg bg-secondary/30 p-3 text-sm text-foreground/90"
                              >
                                {r.body}
                              </p>
                            </div>

                            {/* Admin response (if any) */}
                            {r.adminResponse && (
                              <div className="rounded-lg border border-accent/40 bg-accent/10 p-3">
                                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-accent">
                                  <Sparkles className="h-3.5 w-3.5" />
                                  پاسخ ادمین:
                                </p>
                                <p
                                  dir="auto"
                                  className="whitespace-pre-wrap text-sm text-foreground/90"
                                >
                                  {r.adminResponse}
                                </p>
                              </div>
                            )}

                            {/* Admin response form */}
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">
                                {r.adminResponse
                                  ? "ویرایش پاسخ ادمین:"
                                  : "افزودن پاسخ ادمین:"}
                              </p>
                              <Textarea
                                value={draft}
                                onChange={(e) =>
                                  setResponseDrafts((prev) => ({
                                    ...prev,
                                    [r.id]: e.target.value,
                                  }))
                                }
                                placeholder="پاسخ به کاربر…"
                                rows={3}
                                disabled={isBusy}
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveResponse(r.id)}
                                  disabled={isBusy || !draft.trim()}
                                >
                                  {isBusy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5" />
                                  )}
                                  ذخیره پاسخ
                                </Button>

                                {/* Status changes */}
                                <Select
                                  value={r.status}
                                  onValueChange={(v) =>
                                    patchReport(r.id, {
                                      status: v as ReportStatus,
                                    })
                                  }
                                  disabled={isBusy}
                                >
                                  <SelectTrigger className="h-8 w-36 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="OPEN">باز</SelectItem>
                                    <SelectItem value="IN_PROGRESS">
                                      در حال بررسی
                                    </SelectItem>
                                    <SelectItem value="RESOLVED">
                                      حل‌شده
                                    </SelectItem>
                                    <SelectItem value="DISMISSED">
                                      رد شده
                                    </SelectItem>
                                  </SelectContent>
                                </Select>

                                <Select
                                  value={r.priority}
                                  onValueChange={(v) =>
                                    patchReport(r.id, {
                                      priority: v as Priority,
                                    })
                                  }
                                  disabled={isBusy}
                                >
                                  <SelectTrigger className="h-8 w-32 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="LOW">پایین</SelectItem>
                                    <SelectItem value="NORMAL">
                                      معمولی
                                    </SelectItem>
                                    <SelectItem value="HIGH">بالا</SelectItem>
                                    <SelectItem value="URGENT">فوری</SelectItem>
                                  </SelectContent>
                                </Select>

                                {r.status !== "RESOLVED" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleResolve(r.id)}
                                    disabled={isBusy}
                                    className="h-8 gap-1 border-accent/40 text-accent hover:bg-accent/10"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    حل‌شده
                                  </Button>
                                )}
                                {r.status !== "DISMISSED" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDismiss(r.id)}
                                    disabled={isBusy}
                                    className="h-8 gap-1 text-muted-foreground"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    رد کردن
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Reporter info card */}
                            {r.reporter && (
                              <div className="rounded-lg border border-border/40 bg-card/40 p-3 text-xs">
                                <p className="mb-2 font-medium text-muted-foreground">
                                  اطلاعات گزارش‌دهنده:
                                </p>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    {r.reporter.avatarUrl && (
                                      <AvatarImage
                                        src={r.reporter.avatarUrl}
                                        alt={r.reporter.displayName}
                                      />
                                    )}
                                    <AvatarFallback className="bg-secondary text-primary text-xs">
                                      {r.reporter.displayName?.[0] ?? "?"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-foreground">
                                      {r.reporter.displayName}
                                    </p>
                                    <p className="text-muted-foreground">
                                      @{r.reporter.username}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <Card className="glass">
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`grid h-9 w-9 place-items-center rounded-lg ${bg} ${color}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-academic text-xl font-bold">
            {toPersianDigits(value)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminViolationsView;
