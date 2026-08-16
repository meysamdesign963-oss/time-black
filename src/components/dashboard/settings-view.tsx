"use client";

/**
 * SettingsView — account settings page.
 * Tabs: profile / security / notifications / privacy.
 * Profile: edit displayName + bio + avatar URL (with preview).
 * Security: change password form.
 * Notifications: switches for email/push/rank/interaction.
 * Privacy: profile visibility radio + show-stats switch.
 * Note: backend doesn't yet expose profile-update or password-change
 * endpoints, so all saves are simulated with toast feedback.
 */
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Eye,
  EyeOff,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Lock,
  Save,
  Shield,
  Upload,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuthStore, type CurrentUser } from "@/store/auth";
import { apiFetch } from "@/utils/api-fetch";

type TabKey = "profile" | "security" | "notifications" | "privacy";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" as const },
  }),
};

export function SettingsView() {
  const [tab, setTab] = useState<TabKey>("profile");
  return (
    <div className="mx-auto max-w-[900px] space-y-6 px-4 py-6">
      <PageHeader
        title="تنظیمات حساب"
        description="مدیریت پروفایل، امنیت و حریم خصوصی"
      />
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="profile">پروفایل</TabsTrigger>
          <TabsTrigger value="security">امنیت</TabsTrigger>
          <TabsTrigger value="notifications">اعلان‌ها</TabsTrigger>
          <TabsTrigger value="privacy">حریم خصوصی</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="privacy" className="mt-4">
          <PrivacyTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------- Profile ----------------- */
function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [coverUrl, setCoverUrl] = useState(user?.coverUrl || "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (
    file: File,
    type: "avatar" | "cover",
  ): Promise<string | null> => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حداکثر حجم تصویر ۲ مگابایت است");
      return null;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("فقط تصویر مجاز است");
      return null;
    }
    const setUploading = type === "avatar" ? setUploadingAvatar : setUploadingCover;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || "خطا در آپلود");
        return null;
      }
      toast.success(type === "avatar" ? "آواتار آپلود شد" : "تصویر کاور آپلود شد");
      return json.data.url as string;
    } catch {
      toast.error("خطا در ارتباط با سرور");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, "avatar");
    if (url) setAvatarUrl(url);
    e.target.value = "";
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, "cover");
    if (url) setCoverUrl(url);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error("نام نمایشی نمی‌تواند خالی باشد");
      return;
    }
    setSaving(true);
    const res = await apiFetch<{ user: CurrentUser }>(
      "/api/auth/update-profile",
      {
        method: "PATCH",
        body: JSON.stringify({
          displayName,
          bio,
          avatarUrl: avatarUrl || null,
          coverUrl: coverUrl || null,
        }),
      },
    );
    setSaving(false);
    if (res.ok && res.data?.user) {
      setUser(res.data.user);
      toast.success("پروفایل به‌روزرسانی شد");
    } else {
      toast.error(res.error || "خطا در به‌روزرسانی پروفایل");
    }
  };

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-primary" />
            <h3 className="font-academic text-lg font-bold text-foreground">
              اطلاعات پروفایل
            </h3>
          </div>

          {/* Cover image upload */}
          <div className="space-y-2">
            <Label>تصویر کاور</Label>
            <div className="relative overflow-hidden rounded-xl border border-border/60 bg-secondary/30">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="کاور"
                  className="h-32 w-full object-cover sm:h-40"
                />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-primary/20 via-card to-accent/15 sm:h-40">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-background/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-colors hover:bg-background"
              >
                {uploadingCover ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {coverUrl ? "تغییر کاور" : "آپلود کاور"}
              </button>
              {coverUrl && (
                <button
                  onClick={() => setCoverUrl("")}
                  className="absolute bottom-2 right-2 rounded-lg bg-destructive/80 px-2 py-1.5 text-xs text-destructive-foreground backdrop-blur-sm hover:bg-destructive"
                >
                  حذف
                </button>
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleCoverSelect}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              حداکثر ۲ مگابایت — فرمت‌های jpg, png, webp, gif
            </p>
          </div>

          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-border/60">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={displayName} />
              ) : null}
              <AvatarFallback className="bg-secondary text-foreground text-xl">
                {displayName?.charAt(0) || "؟"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {avatarUrl ? "تغییر آواتار" : "آپلود آواتار"}
              </Button>
              {avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setAvatarUrl("")}
                >
                  حذف آواتار
                </Button>
              )}
              <p className="text-xs text-muted-foreground">حداکثر ۲ مگابایت</p>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarSelect}
              className="hidden"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">نام نمایشی *</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">بیوگرافی</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="چند کلمه درباره خودتان..."
              rows={3}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">
              {toFaDigits(bio.length)} / ۳۰۰
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatarUrl">آدرس آواتار</Label>
            <Input
              id="avatarUrl"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              dir="ltr"
            />
          </div>

          {user?.username && (
            <div className="rounded-lg border border-border/60 bg-secondary/20 px-4 py-3">
              <p className="text-xs text-muted-foreground">نام کاربری</p>
              <p className="mt-1 font-mono text-sm text-foreground">
                @{user.username}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                نام کاربری قابل تغییر نیست
              </p>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            ذخیره تغییرات
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ----------------- Security ----------------- */
function SecurityTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!current || !next || !confirm) {
      toast.error("همه فیلدها را پر کنید");
      return;
    }
    if (next.length < 8) {
      toast.error("رمز عبور جدید باید حداقل ۸ کاراکتر باشد");
      return;
    }
    if (next !== confirm) {
      toast.error("رمز عبور جدید و تکرار آن مطابقت ندارند");
      return;
    }
    setSaving(true);
    const res = await apiFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: current,
        newPassword: next,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("رمز عبور تغییر کرد — لطفاً دوباره وارد شوید");
      setCurrent("");
      setNext("");
      setConfirm("");
    } else {
      toast.error(res.error || "خطا در تغییر رمز عبور");
    }
  };

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="font-academic text-lg font-bold text-foreground">
              امنیت حساب
            </h3>
          </div>

          <PasswordInput
            id="current"
            label="رمز عبور فعلی"
            value={current}
            onChange={setCurrent}
            show={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
          />
          <PasswordInput
            id="next"
            label="رمز عبور جدید"
            value={next}
            onChange={setNext}
            show={showNext}
            onToggle={() => setShowNext((v) => !v)}
          />
          <PasswordInput
            id="confirm"
            label="تکرار رمز عبور جدید"
            value={confirm}
            onChange={setConfirm}
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
          />

          <div className="rounded-lg border border-border/60 bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Lock className="h-4 w-4 text-accent" />
              توصیه امنیتی
            </p>
            <p className="mt-1">
              از رمز عبوری استفاده کنید که حداقل ۸ کاراکتر داشته باشد و شامل
              حروف و عدد باشد. از استفاده مجدد رمز عبور سایر سرویس‌ها خودداری
              کنید.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            تغییر رمز عبور
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir="ltr"
          className="pl-10"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={show ? "پنهان کردن رمز" : "نمایش رمز"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/* ----------------- Notifications ----------------- */
function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    email: true,
    push: false,
    rank: true,
    interaction: true,
    system: true,
  });

  const toggle = (key: keyof typeof prefs) => (checked: boolean) => {
    setPrefs((p) => ({ ...p, [key]: checked }));
    const labels: Record<keyof typeof prefs, string> = {
      email: "اعلان‌های ایمیلی",
      push: "اعلان‌های PUSH",
      rank: "اعلان‌های تغییر رتبه",
      interaction: "اعلان‌های تعاملات",
      system: "اعلان‌های سیستمی",
    };
    toast.success(
      `${labels[key]} ${checked ? "فعال شد" : "غیرفعال شد"}`,
    );
  };

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-academic text-lg font-bold text-foreground">
              تنظیمات اعلان‌ها
            </h3>
          </div>

          <ToggleRow
            label="اعلان‌های ایمیلی"
            description="دریافت اعلان‌ها از طریق ایمیل"
            checked={prefs.email}
            onToggle={toggle("email")}
          />
          <ToggleRow
            label="اعلان‌های PUSH"
            description="اعلان‌های مرورگری در لحظه وقوع"
            checked={prefs.push}
            onToggle={toggle("push")}
          />
          <ToggleRow
            label="تغییرات رتبه"
            description="اعلام صعود یا سقوط در رتبه‌بندی"
            checked={prefs.rank}
            onToggle={toggle("rank")}
          />
          <ToggleRow
            label="تعاملات"
            description="پسند، نظر و دنبال‌کردن توسط دیگران"
            checked={prefs.interaction}
            onToggle={toggle("interaction")}
          />
          <ToggleRow
            label="اعلان‌های سیستمی"
            description="پیام‌های سیستمی و مهم پلتفرم"
            checked={prefs.system}
            onToggle={toggle("system")}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-secondary/20 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}

/* ----------------- Privacy ----------------- */
function PrivacyTab() {
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [showStats, setShowStats] = useState(true);

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <h3 className="font-academic text-lg font-bold text-foreground">
              حریم خصوصی
            </h3>
          </div>

          <div className="space-y-2">
            <Label>نمایش پروفایل</Label>
            <RadioGroup
              value={visibility}
              onValueChange={(v) => {
                setVisibility(v as "PUBLIC" | "PRIVATE");
                toast.success(
                  `پروفایل ${v === "PUBLIC" ? "عمومی شد" : "خصوصی شد"}`,
                );
              }}
              className="grid gap-2"
            >
              <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/20 p-3">
                <RadioGroupItem value="PUBLIC" id="vis-pub" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="vis-pub"
                    className="cursor-pointer text-sm font-medium text-foreground"
                  >
                    عمومی
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    همه می‌توانند پروفایل، پست‌ها و آمار شما را ببینند
                  </p>
                </div>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/20 p-3">
                <RadioGroupItem
                  value="PRIVATE"
                  id="vis-priv"
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label
                    htmlFor="vis-priv"
                    className="cursor-pointer text-sm font-medium text-foreground"
                  >
                    خصوصی
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    فقط دنبال‌کنندگان می‌توانند پروفایل و پست‌های شما را ببینند
                  </p>
                </div>
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              </div>
            </RadioGroup>
          </div>

          <ToggleRow
            label="نمایش آمار من به دیگران"
            description="مجموع زمان، رتبه و تسک‌ها برای دیگران قابل مشاهده باشد"
            checked={showStats}
            onToggle={(c) => {
              setShowStats(c);
              toast.success(
                `نمایش آمار ${c ? "فعال شد" : "غیرفعال شد"}`,
              );
            }}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}

function toFaDigits(n: number): string {
  return String(n).replace(/\d/g, (d) =>
    "۰۱۲۳۴۵۶۷۸۹".charAt(Number(d)),
  );
}

export default SettingsView;
