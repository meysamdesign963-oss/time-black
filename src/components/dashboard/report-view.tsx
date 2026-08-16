"use client";

/**
 * ReportView — user-facing reports / tickets to admin.
 *
 * Two sections:
 *  1. Submit new report form (type, subject, body) → POST /api/reports
 *  2. List of the user's existing reports with expandable body + admin
 *     response. Each row shows type badge, subject, status badge, and
 *     relative time. Click to expand.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Bug,
  ChevronDown,
  Flag,
  Lightbulb,
  Loader2,
  MessageSquareWarning,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

type Report = {
  id: string;
  type: ReportType;
  subject: string;
  body: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  adminResponse: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

type ReportsResp = { reports: Report[] };

const TYPE_META: Record<
  ReportType,
  { label: string; icon: React.ElementType; color: string }
> = {
  BUG: { label: "باگ", icon: Bug, color: "text-destructive" },
  ABUSE: { label: "سواستفاده", icon: ShieldAlert, color: "text-destructive" },
  SPAM: { label: "اسپم", icon: Trash2, color: "text-yellow-500" },
  FEATURE_REQUEST: {
    label: "پیشنهاد قابلیت",
    icon: Lightbulb,
    color: "text-primary",
  },
  FEEDBACK: {
    label: "بازخورد",
    icon: MessageSquareWarning,
    color: "text-accent",
  },
  OTHER: { label: "سایر", icon: AlertCircle, color: "text-muted-foreground" },
};

function StatusBadge({ status }: { status: Report["status"] }) {
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
          <Loader2 className="h-3 w-3" />
          در حال بررسی
        </Badge>
      );
    case "RESOLVED":
      return (
        <Badge className="bg-accent/15 text-accent border border-accent/40 gap-1">
          <Sparkles className="h-3 w-3" />
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

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: "easeOut" as const },
  }),
};

export function ReportView() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // form state
  const [type, setType] = useState<ReportType>("FEEDBACK");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const fetchReports = async () => {
    const res = await apiFetch<ReportsResp>("/api/reports");
    if (res.ok && res.data?.reports) setReports(res.data.reports);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      await fetchReports();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      toast.error("عنوان و متن گزارش الزامی است");
      return;
    }
    setSubmitting(true);
    const res = await apiFetch<{ report: Report }>("/api/reports", {
      method: "POST",
      body: JSON.stringify({ type, subject, body }),
    });
    setSubmitting(false);
    if (res.ok && res.data?.report) {
      toast.success("گزارش شما با موفقیت ثبت شد");
      setReports((prev) => [res.data!.report, ...prev]);
      setSubject("");
      setBody("");
      setType("FEEDBACK");
      setOpenId(res.data.report.id);
    } else {
      toast.error(res.error || "ثبت گزارش ناموفق بود");
    }
  };

  return (
    <div className="mx-auto max-w-[700px] space-y-6 px-4 py-6">
      <PageHeader
        title="ارتباط با ادمین / گزارش"
        description="باگ، تخلف، پیشنهاد یا بازخورد خود را برای تیم مدیریت ارسال کنید"
      />

      {/* ----------------------- Submit form ----------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-academic">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Flag className="h-4.5 w-4.5" />
              </span>
              ثبت گزارش جدید
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                    {(Object.keys(TYPE_META) as ReportType[]).map((t) => {
                      const meta = TYPE_META[t];
                      const Icon = meta.icon;
                      return (
                        <SelectItem key={t} value={t}>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${meta.color}`} />
                            <span>{meta.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
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
                <Label htmlFor="report-body">متن گزارش</Label>
                <Textarea
                  id="report-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="توضیح کامل مسئله، مراحل بازتولید (در صورت باگ)، یا جزئیات پیشنهاد…"
                  rows={6}
                  maxLength={5000}
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  {toPersianDigits(body.length)} / {toPersianDigits(5000)} کاراکتر
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                ارسال گزارش
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* ----------------------- My reports ----------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-academic text-lg font-bold text-foreground">
            گزارش‌های من
          </h2>
          <Badge variant="secondary" className="font-mono">
            {toPersianDigits(reports.length)}
          </Badge>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary/40">
                <Flag className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-academic text-base font-bold text-foreground">
                هنوز گزارشی ثبت نکرده‌اید
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                باگ‌ها، پیشنهادها و گزارش‌های شما در این بخش نمایش داده می‌شوند.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {reports.map((r, idx) => {
              const meta = TYPE_META[r.type];
              const Icon = meta.icon;
              const open = openId === r.id;
              return (
                <motion.li
                  key={r.id}
                  custom={idx}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                >
                  <Card className="glass overflow-hidden p-0">
                    <Collapsible
                      open={open}
                      onOpenChange={(o) => setOpenId(o ? r.id : null)}
                    >
                      <CollapsibleTrigger asChild>
                        <button className="flex w-full items-center gap-3 p-4 text-right hover:bg-secondary/30 transition-colors">
                          <div
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary/60 ${meta.color}`}
                          >
                            <Icon className="h-4.5 w-4.5" />
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
                              <StatusBadge status={r.status} />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatRelativeTime(new Date(r.createdAt))}
                              {r.resolvedAt && (
                                <>
                                  {" · "}
                                  حل‌شده در{" "}
                                  {formatRelativeTime(new Date(r.resolvedAt))}
                                </>
                              )}
                            </p>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                              open ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-3 border-t border-border/60 px-4 py-3 text-sm">
                          <div>
                            <p className="mb-1 text-xs font-medium text-muted-foreground">
                              متن گزارش:
                            </p>
                            <p
                              dir="auto"
                              className="whitespace-pre-wrap text-foreground/90"
                            >
                              {r.body}
                            </p>
                          </div>
                          {r.adminResponse && (
                            <div className="rounded-lg border border-accent/40 bg-accent/10 p-3">
                              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-accent">
                                <Sparkles className="h-3.5 w-3.5" />
                                پاسخ ادمین:
                              </p>
                              <p
                                dir="auto"
                                className="whitespace-pre-wrap text-foreground/90"
                              >
                                {r.adminResponse}
                              </p>
                            </div>
                          )}
                          {!r.adminResponse &&
                            (r.status === "OPEN" ||
                              r.status === "IN_PROGRESS") && (
                              <p className="text-xs text-muted-foreground">
                                منتظر پاسخ از تیم مدیریت…
                              </p>
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
      </div>
    </div>
  );
}

export default ReportView;
