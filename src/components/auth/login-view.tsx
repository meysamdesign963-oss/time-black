"use client";

/**
 * LoginView — authentication entry point for Time Black.
 * -----------------------------------------------------
 * Three login modes (segmented control):
 *   1. Username / Password (default)
 *   2. OTP via phone (5-digit code, 2-min countdown)
 *   3. Email (Google OAuth placeholder)
 *
 * Top-level tabs switch between "ورود" and "ثبت‌نام"; clicking
 * the register tab navigates to the register view via the SPA
 * router store.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Logo } from "@/components/common/logo";
import { useRouterStore } from "@/store/router";
import { useAuthStore, type CurrentUser } from "@/store/auth";
import { apiFetch } from "@/utils/api-fetch";
import {
  isValidEmail,
  isValidPassword,
  isValidPhone,
} from "@/utils/validation";
import { toLatinDigits, toPersianDigits } from "@/utils/persian-date";
import { toast } from "sonner";

type LoginMode = "password" | "otp" | "google";

const OTP_COUNTDOWN_SEC = 120;
const OTP_LENGTH = 5; // server validates /^\d{5}$/

/** Decorative blurred circles used as the page background. */
function BackgroundDecor() {
  return (
    <>
      <div className="pointer-events-none absolute top-[8%] right-[6%] h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[8%] left-[4%] h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute top-[45%] left-[40%] h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
    </>
  );
}

/** Format a seconds countdown as MM:SS in Persian digits. */
function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return toPersianDigits(`${m}:${s}`);
}

export function LoginView() {
  const navigate = useRouterStore((s) => s.navigate);
  const setUser = useAuthStore((s) => s.setUser);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  const [mode, setMode] = useState<LoginMode>("password");

  // --- password mode state ---
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // --- otp mode state ---
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStage, setOtpStage] = useState<"phone" | "code">("phone");
  const [sendOtpLoading, setSendOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- google mode state ---
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Cleanup OTP timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(OTP_COUNTDOWN_SEC);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleLoginSuccess = useCallback(
    async (user: CurrentUser) => {
      setUser(user);
      // fetchMe ensures the auth store + header are in sync
      await fetchMe();
      toast.success(`خوش آمدید، ${user.displayName}`);
      navigate("dashboard");
    },
    [fetchMe, navigate, setUser],
  );

  // -------------------------------------------------------------
  // Password login
  // -------------------------------------------------------------
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = identifier.trim();
    if (!id) {
      toast.error("نام کاربری، ایمیل یا شماره موبایل را وارد کنید");
      return;
    }
    if (!password) {
      toast.error("رمز عبور را وارد کنید");
      return;
    }
    if (password.length < 8) {
      toast.error("رمز عبور باید حداقل ۸ کاراکتر باشد");
      return;
    }
    setPwLoading(true);
    const res = await apiFetch<CurrentUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: id, password }),
    });
    setPwLoading(false);
    if (!res.ok || !res.data) {
      toast.error(res.error || "ورود ناموفق بود");
      return;
    }
    await handleLoginSuccess(res.data);
  };

  // -------------------------------------------------------------
  // OTP send
  // -------------------------------------------------------------
  const handleSendOtp = async () => {
    const p = toLatinDigits(phone).replace(/[^\d]/g, "");
    if (!isValidPhone(p)) {
      toast.error("شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود");
      return;
    }
    setPhone(p);
    setSendOtpLoading(true);
    const res = await apiFetch<{ delivered?: boolean; devCode?: string }>(
      "/api/auth/send-otp",
      {
        method: "POST",
        body: JSON.stringify({ phone: p, purpose: "LOGIN" }),
      },
    );
    setSendOtpLoading(false);
    if (!res.ok) {
      toast.error(res.error || "ارسال کد ناموفق بود");
      return;
    }
    setOtpStage("code");
    setOtpCode("");
    startCountdown();
    toast.success("کد تایید ارسال شد");
    // Dev hint: show the devCode so the sandbox user can log in.
    if (res.data?.devCode) {
      toast.info(`کد توسعه‌دهنده: ${toPersianDigits(res.data.devCode)}`, {
        duration: 8000,
      });
    }
  };

  // -------------------------------------------------------------
  // OTP verify
  // -------------------------------------------------------------
  const handleVerifyOtp = async () => {
    if (otpCode.length !== OTP_LENGTH) {
      toast.error(`کد باید ${toPersianDigits(OTP_LENGTH)} رقم باشد`);
      return;
    }
    setVerifyLoading(true);
    const res = await apiFetch<CurrentUser>("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, code: otpCode }),
    });
    setVerifyLoading(false);
    if (!res.ok || !res.data) {
      toast.error(res.error || "تایید کد ناموفق بود");
      return;
    }
    await handleLoginSuccess(res.data);
  };

  // -------------------------------------------------------------
  // Google (email) placeholder
  // -------------------------------------------------------------
  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!isValidEmail(v)) {
      toast.error("ایمیل نامعتبر است");
      return;
    }
    if (!v.endsWith("@gmail.com")) {
      toast.error("در حال حاضر فقط ایمیل گوگل پشتیبانی می‌شود");
      return;
    }
    setEmailLoading(true);
    // Simulate brief delay for UX
    await new Promise((r) => setTimeout(r, 600));
    setEmailLoading(false);
    toast.info("ورود با گوگل به‌زودی فعال می‌شود");
  };

  const modeTabs: { key: LoginMode; label: string; icon: typeof User }[] = [
    { key: "password", label: "رمز عبور", icon: KeyRound },
    { key: "otp", label: "کد یکبار مصرف", icon: Phone },
    { key: "google", label: "گوگل", icon: Mail },
  ];

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
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
            <button
              type="button"
              className="rounded-lg bg-background py-2 text-sm font-semibold text-foreground shadow-sm"
            >
              ورود
            </button>
            <button
              type="button"
              onClick={() => navigate("register")}
              className="rounded-lg py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              ثبت‌نام
            </button>
          </div>

          {/* Mode segmented control */}
          <div className="mb-6 grid grid-cols-3 gap-1 rounded-xl border border-border bg-background/40 p-1">
            {modeTabs.map((t) => {
              const Icon = t.icon;
              const active = mode === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setMode(t.key)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* ---------------- Password mode ---------------- */}
          {mode === "password" && (
            <motion.form
              key="password-form"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              onSubmit={handlePasswordSubmit}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-identifier">نام کاربری / ایمیل / شماره</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="مثلاً ali یا 09xxxxxxxxx"
                    autoComplete="username"
                    className="ps-3 pe-9"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="login-password">رمز عبور</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="ps-3 pe-9"
                    dir="ltr"
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
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled
                  className="text-xs text-muted-foreground/60 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:no-underline"
                  title="بزودی"
                >
                  فراموشی رمز عبور
                </button>
              </div>

              <Button
                type="submit"
                disabled={pwLoading}
                className="h-10 w-full text-sm font-semibold"
              >
                {pwLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    در حال ورود...
                  </>
                ) : (
                  "ورود"
                )}
              </Button>
            </motion.form>
          )}

          {/* ---------------- OTP mode ---------------- */}
          {mode === "otp" && (
            <motion.div
              key="otp-form"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              {otpStage === "phone" && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="login-phone">شماره موبایل</Label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-phone"
                        value={phone}
                        onChange={(e) =>
                          setPhone(toLatinDigits(e.target.value).replace(/[^\d]/g, ""))
                        }
                        inputMode="numeric"
                        maxLength={11}
                        placeholder="09xxxxxxxxx"
                        className="ps-3 pe-9 tracking-wider"
                        dir="ltr"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      کد ۵ رقمی به این شماره پیامک می‌شود
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendOtpLoading}
                    className="h-10 w-full text-sm font-semibold"
                  >
                    {sendOtpLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        در حال ارسال...
                      </>
                    ) : (
                      "ارسال کد تایید"
                    )}
                  </Button>
                </>
              )}

              {otpStage === "code" && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label>کد تایید</Label>
                    <p className="text-xs text-muted-foreground">
                      کد ارسال‌شده به{" "}
                      <span className="font-mono tracking-wider" dir="ltr">
                        {phone}
                      </span>{" "}
                      را وارد کنید
                    </p>
                    <div className="flex justify-center pt-2" dir="ltr">
                      <InputOTP
                        maxLength={OTP_LENGTH}
                        value={otpCode}
                        onChange={(v) => setOtpCode(v)}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                            <InputOTPSlot
                              key={i}
                              index={i}
                              className="size-12 text-lg font-bold"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStage("phone");
                        setOtpCode("");
                        if (timerRef.current) clearInterval(timerRef.current);
                        setCountdown(0);
                      }}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      تغییر شماره
                    </button>
                    {countdown > 0 ? (
                      <span className="text-muted-foreground">
                        ارسال مجدد تا {formatCountdown(countdown)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={sendOtpLoading}
                        className="font-medium text-primary transition-colors hover:text-primary/80"
                      >
                        ارسال مجدد کد
                      </button>
                    )}
                  </div>

                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifyLoading || otpCode.length !== OTP_LENGTH}
                    className="h-10 w-full text-sm font-semibold"
                  >
                    {verifyLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        در حال تایید...
                      </>
                    ) : (
                      "تایید و ورود"
                    )}
                  </Button>
                </>
              )}
            </motion.div>
          )}

          {/* ---------------- Google (email) mode ---------------- */}
          {mode === "google" && (
            <motion.form
              key="google-form"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleGoogleSubmit}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-accent" />
                <span>فعلاً فقط حساب گوگل پشتیبانی می‌شود</span>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-email">ایمیل گوگل</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    autoComplete="email"
                    className="ps-3 pe-9"
                    dir="ltr"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={emailLoading}
                className="h-10 w-full text-sm font-semibold"
              >
                {emailLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    لطفاً صبر کنید...
                  </>
                ) : (
                  "ورود با ایمیل"
                )}
              </Button>
            </motion.form>
          )}
        </div>

        {/* Footer hint */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          با ورود به پلتفرم،{" "}
          <button
            type="button"
            onClick={() => navigate("rules")}
            className="text-primary underline-offset-4 hover:underline"
          >
            قوانین پلتفرم
          </button>{" "}
          را می‌پذیرید.
        </p>
      </motion.div>
    </div>
  );
}

export default LoginView;
