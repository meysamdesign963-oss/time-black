"use client";

/**
 * AdminSettingsView — system settings with per-section cards.
 * Sections: competition config, time-entry limits, public announcement,
 * security (display only). Each section has its own Save button that
 * fires a success toast (no API endpoint yet — placeholder behaviour).
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Clock,
  Lock,
  Save,
  Settings2,
  ShieldCheck,
  Timer,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toPersianDigits } from "@/utils/persian-date";

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" as const },
  }),
};

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  onSave,
  idx = 0,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  onSave: () => void;
  idx?: number;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <motion.div variants={fadeUp} custom={idx} initial="hidden" animate="show">
      <Card className="glass border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="font-academic text-lg">{title}</CardTitle>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          <Separator className="bg-border/40" />
          <div className="flex justify-end">
            <Button
              className="gap-2"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await new Promise((r) => setTimeout(r, 400));
                setSaving(false);
                onSave();
              }}
            >
              <Save className="h-4 w-4" />
              {saving ? "در حال ذخیره…" : "ذخیره تغییرات"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ReadOnlyRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-card/30 px-3 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
      <span className="font-mono text-sm text-primary">{value}</span>
    </div>
  );
}

export function AdminSettingsView() {
  // competition
  const [compDuration, setCompDuration] = useState("30");
  const [periodName, setPeriodName] = useState("مرداد ۱۴۰۳");
  // time-entry limits
  const [maxDailyHours, setMaxDailyHours] = useState("12");
  const [minSessionSeconds, setMinSessionSeconds] = useState("60");
  // announcement
  const [announcement, setAnnouncement] = useState(
    "به پلتفرم تایم بلک خوش آمدید! در رقابت ماهانه شرکت کنید و رتبه خود را ارتقا دهید.",
  );

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 space-y-6">
      <PageHeader
        title="تنظیمات سیستم"
        description="پیکربندی رقابت‌ها، محدودیت‌ها و پیام‌های عمومی پلتفرم"
      />

      {/* Competition config */}
      <SectionCard
        icon={Trophy}
        title="تنظیمات رقابت"
        description="مدت دوره و نام دوره فعال"
        idx={0}
        onSave={() =>
          toast.success("تنظیمات رقابت با موفقیت ذخیره شد")
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="comp-duration">مدت دوره (روز)</Label>
            <Input
              id="comp-duration"
              type="number"
              min={1}
              max={90}
              value={compDuration}
              onChange={(e) => setCompDuration(e.target.value)}
              dir="ltr"
            />
            <p className="text-[10px] text-muted-foreground">
              بین ۱ تا ۹۰ روز
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="period-name">نام دوره فعال</Label>
            <Input
              id="period-name"
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      {/* Time-entry limits */}
      <SectionCard
        icon={Timer}
        title="محدودیت‌های ثبت تایم"
        description="حداکثر تایم روزانه و حداقل مدت هر نشست"
        idx={1}
        onSave={() =>
          toast.success("محدودیت‌های تایم به‌روزرسانی شد")
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="max-daily">حداکثر تایم روزانه (ساعت)</Label>
            <Input
              id="max-daily"
              type="number"
              min={1}
              max={24}
              value={maxDailyHours}
              onChange={(e) => setMaxDailyHours(e.target.value)}
              dir="ltr"
            />
            <p className="text-[10px] text-muted-foreground">
              ثبت تایم بعد از این مقدار مسدود می‌شود
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="min-session">حداقل مدت نشست (ثانیه)</Label>
            <Input
              id="min-session"
              type="number"
              min={0}
              max={3600}
              value={minSessionSeconds}
              onChange={(e) => setMinSessionSeconds(e.target.value)}
              dir="ltr"
            />
            <p className="text-[10px] text-muted-foreground">
              نشست‌های کوتاه‌تر از این مقدار ذخیره نمی‌شوند
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border/40 bg-card/30 px-3 py-2 text-xs text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0 text-primary" />
          مقدار فعلی:{" "}
          <span className="font-mono text-foreground">
            {toPersianDigits(maxDailyHours)}
          </span>{" "}
          ساعت در روز · حداقل{" "}
          <span className="font-mono text-foreground">
            {toPersianDigits(minSessionSeconds)}
          </span>{" "}
          ثانیه هر نشست
        </div>
      </SectionCard>

      {/* Public announcement */}
      <SectionCard
        icon={Bell}
        title="پیام‌های عمومی"
        description="بنر اعلان سراسری برای همه کاربران"
        idx={2}
        onSave={() =>
          toast.success("پیام اعلان به‌روزرسانی شد")
        }
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="announcement">متن اعلان</Label>
            <span className="font-mono text-[10px] text-muted-foreground">
              {toPersianDigits(announcement.length)} /{" "}
              {toPersianDigits(300)}
            </span>
          </div>
          <Textarea
            id="announcement"
            value={announcement}
            onChange={(e) =>
              e.target.value.length <= 300 && setAnnouncement(e.target.value)
            }
            rows={4}
            maxLength={300}
            placeholder="پیامی که در بالای صفحه برای همه کاربران نمایش داده می‌شود…"
          />
          <p className="text-[10px] text-muted-foreground">
            برای غیرفعال‌سازی بنر، متن را خالی بگذارید
          </p>
        </div>
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <p className="mb-1 text-[10px] text-muted-foreground">
            پیش‌نمایش بنر
          </p>
          <p className="text-sm leading-6">
            {announcement || "اعلانی برای نمایش وجود ندارد"}
          </p>
        </div>
      </SectionCard>

      {/* Security (display only) */}
      <SectionCard
        icon={ShieldCheck}
        title="امنیت"
        description="تنظیمات امنیتی فعلی سیستم (فقط نمایش)"
        idx={3}
        onSave={() => toast.info("این مقادیر از سمت سرور مدیریت می‌شوند")}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReadOnlyRow
            label="انقضای نشست"
            value="۱۵ روز"
            hint="عمر توکن بازخوانی"
          />
          <ReadOnlyRow
            label="حد نرخ درخواست ورود"
            value="۵ / ۱۵ دقیقه"
            hint="برای هر IP"
          />
          <ReadOnlyRow
            label="حد نرخ درخواست OTP"
            value="۳ / ۵ دقیقه"
            hint="برای هر شماره"
          />
          <ReadOnlyRow
            label="الگوریتم هش رمز"
            value="bcrypt / ۱۲ دور"
            hint="الگوریتم رمزنگاری"
          />
        </div>
        <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0 text-accent" />
          مقادیر امنیتی فقط از طریق متغیرهای محیطی سرور قابل تغییر هستند.
        </div>
      </SectionCard>

      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/30 p-3 text-xs text-muted-foreground">
        <Settings2 className="h-4 w-4 shrink-0 text-primary" />
        تمامی تغییرات پس از ذخیره به‌صورت آنی برای کاربران اعمال می‌شود. در
        صورت نیاز به پشتیبان‌گیری از تنظیمات، با تیم فنی تماس بگیرید.
      </div>
    </div>
  );
}

export default AdminSettingsView;
