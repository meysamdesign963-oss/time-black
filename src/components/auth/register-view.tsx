"use client";

/**
 * RegisterView — sign-up form for Time Black.
 * -------------------------------------------
 * Fields: displayName, username, phone (optional), email (optional),
 * password (with strength hint), confirmPassword, rules checkbox.
 *
 * Includes an info box reminding the user that the first registered
 * account becomes the platform BOSS (مدیر ارشد).
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AtSign,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/common/logo";
import { useRouterStore } from "@/store/router";
import { useAuthStore, type CurrentUser } from "@/store/auth";
import { apiFetch } from "@/utils/api-fetch";
import {
  isValidDisplayName,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  isValidUsername,
} from "@/utils/validation";
import { toLatinDigits } from "@/utils/persian-date";
import { toast } from "sonner";

/** Decorative blurred circles used as the page background. */
function BackgroundDecor() {
  return (
    <>
      <div className="pointer-events-none absolute top-[8%] left-[6%] h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[8%] right-[4%] h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute top-[45%] right-[35%] h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
    </>
  );
}

type FieldErrors = {
  displayName?: string;
  username?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  rules?: string;
};

/** Simple 0-4 password strength score. */
function scorePassword(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/\d/.test(pw) && /[A-Za-z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const STRENGTH_META: { label: string; color: string }[] = [
  { label: "خیلی ضعیف", color: "bg-destructive" },
  { label: "ضعیف", color: "bg-destructive" },
  { label: "متوسط", color: "bg-yellow-500" },
  { label: "قوی", color: "bg-accent" },
  { label: "خیلی قوی", color: "bg-primary" },
];

export function RegisterView() {
  const navigate = useRouterStore((s) => s.navigate);
  const setUser = useAuthStore((s) => s.setUser);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptRules, setAcceptRules] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const pwScore = useMemo(() => scorePassword(password), [password]);

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!displayName.trim()) e.displayName = "نام نمایشی را وارد کنید";
    else if (!isValidDisplayName(displayName.trim()))
      e.displayName = "۲ تا ۴۰ حرف فارسی یا انگلیسی";

    const u = username.trim().toLowerCase();
    if (!u) e.username = "نام کاربری را وارد کنید";
    else if (!isValidUsername(u))
      e.username = "۳ تا ۲۰ حرف انگلیسی کوچک، عدد یا زیرخط";

    const p = toLatinDigits(phone).replace(/[^\d]/g, "");
    if (p && !isValidPhone(p)) e.phone = "شماره باید ۱۱ رقم و با ۰۹ شروع شود";

    const em = email.trim().toLowerCase();
    if (em) {
      if (!isValidEmail(em)) e.email = "فرمت ایمیل نامعتبر است";
      else if (!em.endsWith("@gmail.com"))
        e.email = "ایمیل گوگل پیشنهاد می‌شود";
    }

    if (!password) e.password = "رمز عبور را وارد کنید";
    else if (!isValidPassword(password))
      e.password = "حداقل ۸ کاراکتر شامل حرف و عدد";

    if (!confirmPassword) e.confirmPassword = "تکرار رمز را وارد کنید";
    else if (confirmPassword !== password)
      e.confirmPassword = "تکرار رمز مطابقت ندارد";

    if (!acceptRules) e.rules = "پذیرش قوانین الزامی است";

    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) {
      toast.error("لطفاً خطاهای فرم را برطرف کنید");
      return;
    }

    const p = toLatinDigits(phone).replace(/[^\d]/g, "");
    const em = email.trim().toLowerCase() || undefined;

    setLoading(true);
    const res = await apiFetch<CurrentUser>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        phone: p || undefined,
        email: em,
        password,
      }),
    });
    setLoading(false);

    if (!res.ok || !res.data) {
      toast.error(res.error || "ثبت‌نام ناموفق بود");
      return;
    }

    setUser(res.data);
    await fetchMe();
    toast.success(
      `ثبت‌نام موفق بود. خوش آمدید، ${res.data.displayName}!`,
    );
    if (res.data.role === "BOSS") {
      toast.info("شما به‌عنوان رئیس پلتفرم ثبت شدید", { duration: 6000 });
    }
    navigate("dashboard");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-sidebar px-4 py-10">
      <BackgroundDecor />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative mx-auto flex w-full max-w-md flex-col items-stretch"
      >
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <button
            type="button"
            onClick={() => navigate("home")}
            className="transition-transform hover:scale-105"
            aria-label="بازگشت به خانه"
          >
            <Logo size={44} />
          </button>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl p-6 shadow-2xl sm:p-8">
          {/* Top-level login/register tabs */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
            <button
              type="button"
              onClick={() => navigate("login")}
              className="rounded-lg py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              ورود
            </button>
            <button
              type="button"
              className="rounded-lg bg-background py-2 text-sm font-semibold text-foreground shadow-sm"
            >
              ثبت‌نام
            </button>
          </div>

          {/* First-user-becomes-boss info */}
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-foreground/80">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              اولین کاربر ثبت‌نام‌شده به‌عنوان{" "}
              <span className="font-semibold text-primary">رئیس</span> (مدیر
              ارشد) شناخته می‌شود.
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* displayName */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-displayName">نام نمایشی</Label>
              <div className="relative">
                <User className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reg-displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثلاً علی رضایی"
                  autoComplete="name"
                  className="ps-3 pe-9"
                  aria-invalid={!!errors.displayName}
                />
              </div>
              {errors.displayName && (
                <p className="text-xs text-destructive">{errors.displayName}</p>
              )}
            </div>

            {/* username */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-username">نام کاربری</Label>
              <div className="relative">
                <AtSign className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reg-username"
                  value={username}
                  onChange={(e) => {
                    const v = toLatinDigits(e.target.value)
                      .replace(/\s/g, "")
                      .toLowerCase();
                    setUsername(v);
                  }}
                  placeholder="ali_reza"
                  autoComplete="username"
                  maxLength={20}
                  className="ps-3 pe-9 font-mono"
                  dir="ltr"
                  aria-invalid={!!errors.username}
                />
              </div>
              {errors.username ? (
                <p className="text-xs text-destructive">{errors.username}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  ۳ تا ۲۰ حرف انگلیسی کوچک، عدد یا زیرخط
                </p>
              )}
            </div>

            {/* phone */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-phone">
                شماره موبایل{" "}
                <span className="text-muted-foreground">(اختیاری)</span>
              </Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reg-phone"
                  value={phone}
                  onChange={(e) =>
                    setPhone(
                      toLatinDigits(e.target.value).replace(/[^\d]/g, ""),
                    )
                  }
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="09xxxxxxxxx"
                  className="ps-3 pe-9 tracking-wider"
                  dir="ltr"
                  aria-invalid={!!errors.phone}
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone}</p>
              )}
            </div>

            {/* email */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-email">
                ایمیل <span className="text-muted-foreground">(اختیاری)</span>
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  autoComplete="email"
                  className="ps-3 pe-9"
                  dir="ltr"
                  aria-invalid={!!errors.email}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            {/* password */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-password">رمز عبور</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reg-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="ps-3 pe-9"
                  dir="ltr"
                  aria-invalid={!!errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPw ? "پنهان کردن رمز" : "نمایش رمز"}
                >
                  {showPw ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {/* Strength meter */}
              {password && (
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < pwScore
                          ? STRENGTH_META[pwScore].color
                          : "bg-muted"
                      }`}
                    />
                  ))}
                  <span className="ms-1 text-xs text-muted-foreground">
                    {STRENGTH_META[pwScore].label}
                  </span>
                </div>
              )}
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  حداقل ۸ کاراکتر شامل حرف و عدد
                </p>
              )}
            </div>

            {/* confirm password */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-confirmPassword">تکرار رمز عبور</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reg-confirmPassword"
                  type={showConfirmPw ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="ps-3 pe-9"
                  dir="ltr"
                  aria-invalid={!!errors.confirmPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((s) => !s)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={
                    showConfirmPw ? "پنهان کردن رمز" : "نمایش رمز"
                  }
                >
                  {showConfirmPw ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* rules checkbox */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="reg-rules"
                  checked={acceptRules}
                  onCheckedChange={(v) => setAcceptRules(v === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="reg-rules"
                  className="cursor-pointer text-xs leading-relaxed font-normal text-foreground/90"
                >
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="size-3.5 text-accent" />
                    قوانین پلتفرم را می‌پذیرم و می‌پذیرم که فعالیت‌هایم بر اساس
                    آن‌ها ثبت می‌شود.{" "}
                    <button
                      type="button"
                      onClick={() => navigate("rules")}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      مطالعه قوانین
                    </button>
                  </span>
                </Label>
              </div>
              {errors.rules && (
                <p className="text-xs text-destructive">{errors.rules}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-10 w-full text-sm font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  در حال ثبت‌نام...
                </>
              ) : (
                "ثبت‌نام"
              )}
            </Button>
          </form>
        </div>

        {/* Footer hint */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          قبلاً حساب دارید؟{" "}
          <button
            type="button"
            onClick={() => navigate("login")}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            وارد شوید
          </button>
        </p>
      </motion.div>
    </div>
  );
}

export default RegisterView;
